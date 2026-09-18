const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { igdl, ttdl, fbdown } = require("btch-downloader");

// YouTube downloads are proxied to the EryXenX yt-dlp/y2mate API deployed on
// Railway, since btch-downloader's own youtube() stopped working.
const YT_PROXY_BASE =
    "https://youtube-download-api-production-6bbe.up.railway.app/api/dl";

async function resolveRedirect(url) {
    try {
        const res = await axios.get(url, {
            maxRedirects: 10,
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        return res.request.res.responseUrl || url;
    } catch {
        return url;
    }
}

async function youtube(url) {
    const apiUrl = `${YT_PROXY_BASE}?link=${encodeURIComponent(url)}&format=mp4`;
    const { data } = await axios.get(apiUrl, { timeout: 60_000 });

    if (data.status !== "success" || !data.data?.downloadUrl) {
        throw new Error(data.error || "Railway YouTube proxy did not return a download URL");
    }

    return data.data;
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

function detectPlatform(url) {
    if (/instagram\.com/i.test(url)) return "instagram";
    if (/tiktok\.com/i.test(url)) return "tiktok";
    if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
    return null;
}

app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "EryXenX Video Downloader API",
        endpoints: [
            "/api/ig?url=",
            "/api/tiktok?url=",
            "/api/fb?url=",
            "/api/youtube?url=",
            "/api/download?url="
        ]
    });
});

app.get("/api/ig", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });
    try {
        const data = await igdl(url);
        res.json({ status: true, platform: "instagram", result: data });
    } catch (err) {
        res.status(500).json({ status: false, message: "Failed to fetch Instagram media" });
    }
});

app.get("/api/tiktok", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });
    try {
        const resolvedUrl = await resolveRedirect(url);
        const data = await ttdl(resolvedUrl);
        res.json({ status: true, platform: "tiktok", result: data });
    } catch (err) {
        res.status(500).json({ status: false, message: "Failed to fetch TikTok media", error: err.message });
    }
});

function stripQuery(url) {
    return url.split("?")[0];
}

function toFbWatchUrl(url) {
    const match = url.match(/\/reel\/(\d+)/);
    if (match) return `https://www.facebook.com/watch/?v=${match[1]}`;
    return null;
}

app.get("/api/fb", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });
    let resolvedUrl = url;
    try {
        resolvedUrl = await resolveRedirect(url);
        const cleanUrl = stripQuery(resolvedUrl);
        let data;
        try {
            data = await fbdown(cleanUrl);
        } catch (firstErr) {
            const altUrl = toFbWatchUrl(cleanUrl);
            if (!altUrl) throw firstErr;
            data = await fbdown(altUrl);
        }
        res.json({ status: true, platform: "facebook", result: data });
    } catch (err) {
        res.status(500).json({ status: false, message: "Failed to fetch Facebook media", error: err.message, resolvedUrl });
    }
});

app.get("/api/youtube", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });
    try {
        const result = await youtube(url);
        res.json({ status: true, platform: "youtube", result });
    } catch (err) {
        res.status(502).json({ status: false, message: "Failed to fetch YouTube media", error: err.message });
    }
});

app.get("/api/download", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });

    const platform = detectPlatform(url);
    if (!platform) return res.status(400).json({ status: false, message: "Unsupported or invalid URL" });

    try {
        let data;
        if (platform === "instagram") data = await igdl(url);
        if (platform === "tiktok") data = await ttdl(await resolveRedirect(url));
        if (platform === "facebook") {
            const resolvedUrl = stripQuery(await resolveRedirect(url));
            try {
                data = await fbdown(resolvedUrl);
            } catch (firstErr) {
                const altUrl = toFbWatchUrl(resolvedUrl);
                if (!altUrl) throw firstErr;
                data = await fbdown(altUrl);
            }
        }
        if (platform === "youtube") data = await youtube(url);

        res.json({ status: true, platform, result: data });
    } catch (err) {
        res.status(502).json({ status: false, message: `Failed to fetch ${platform} media`, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`EryXenX Video API running on port ${PORT}`);
});
