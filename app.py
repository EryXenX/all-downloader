import os
import tempfile
import uuid
from flask import Flask, request, jsonify, render_template, send_file, after_this_request
import yt_dlp

app = Flask(__name__)

# Basic landing page
@app.route('/')
def index():
    return render_template('index.html')

# Endpoint to fetch details about a video
@app.route('/api/info', methods=['GET'])
def get_info():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'ইউটিউব লিঙ্ক প্রদান করা আবশ্যক (YouTube link is required)'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            # Handle list if playlist or multiple entries found
            if 'entries' in info:
                # Get the first item
                info = info['entries'][0]
                
            return jsonify({
                'title': info.get('title'),
                'duration': info.get('duration'),
                'duration_string': f"{info.get('duration') // 60:02d}:{info.get('duration') % 60:02d}" if info.get('duration') else 'N/A',
                'thumbnail': info.get('thumbnail'),
                'channel': info.get('uploader'),
                'view_count': info.get('view_count'),
                'url': url
            })
    except Exception as e:
        return jsonify({'error': f'তথ্য সংগ্রহ করতে ব্যর্থ হয়েছে (Failed to retrieve info): {str(e)}'}), 500

# Endpoint to download audio and return as MP3
@app.route('/api/download', methods=['GET'])
def download_audio():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'ইউটিউব লিঙ্ক প্রদান করা আবশ্যক (YouTube link is required)'}), 400

    # Create a unique directory to avoid collisions
    temp_dir = tempfile.mkdtemp()
    unique_id = str(uuid.uuid4())
    output_template = os.path.join(temp_dir, f'{unique_id}.%(ext)s')

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # First extract title for file name
            info = ydl.extract_info(url, download=False)
            if 'entries' in info:
                info = info['entries'][0]
            
            safe_title = "".join([c for c in info.get('title', 'song') if c.isalpha() or c.isdigit() or c==' ']).rstrip()
            if not safe_title:
                safe_title = 'song'
            safe_title = safe_title[:50]  # Limit filename length
            
            # Now download
            ydl.download([url])
            
            # Locate the expected downloaded file
            expected_file = os.path.join(temp_dir, f'{unique_id}.mp3')
            
            if not os.path.exists(expected_file):
                return jsonify({'error': 'ডাউনলোড সম্পন্ন হলেও ফাইলটি খুঁজে পাওয়া যায়নি (Downloaded file not found)'}), 500

            # Schedule clean up after response is sent
            @after_this_request
            def cleanup(response):
                try:
                    if os.path.exists(expected_file):
                        os.remove(expected_file)
                    if os.path.exists(temp_dir):
                        os.rmdir(temp_dir)
                except Exception as ex:
                    app.logger.error(f"Cleanup error: {ex}")
                return response

            return send_file(
                expected_file,
                as_attachment=True,
                download_name=f"{safe_title}.mp3",
                mimetype="audio/mpeg"
            )

    except Exception as e:
        # Cleanup in case of failure
        try:
            if os.path.exists(temp_dir):
                for f in os.listdir(temp_dir):
                    os.remove(os.path.join(temp_dir, f))
                os.rmdir(temp_dir)
        except Exception:
            pass
        return jsonify({'error': f'ডাউনলোড ব্যর্থ হয়েছে (Download failed): {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
