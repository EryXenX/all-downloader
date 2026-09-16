const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { igdl, ttdl, fbdown, youtube } = require("btch-downloader");

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

app.get("/api/fb", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });
    let resolvedUrl = url;
    try {
        resolvedUrl = await resolveRedirect(url);
        const data = await fbdown(resolvedUrl);
        res.json({ status: true, platform: "facebook", result: data });
    } catch (err) {
        res.status(500).json({ status: false, message: "Failed to fetch Facebook media", error: err.message, resolvedUrl });
    }
});

app.get("/api/youtube", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "url is required" });
    try {
        const data = await youtube(url);
        res.json({ status: true, platform: "youtube", result: data });
    } catch (err) {
        res.status(500).json({ status: false, message: "Failed to fetch YouTube media" });
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
        if (platform === "facebook") data = await fbdown(await resolveRedirect(url));
        if (platform === "youtube") data = await youtube(url);

        res.json({ status: true, platform, result: data });
    } catch (err) {
        res.status(500).json({ status: false, message: `Failed to fetch ${platform} media` });
    }
});

app.listen(PORT, () => {
    console.log(`EryXenX Video API running on port ${PORT}`);
});
