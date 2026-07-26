# Use official Python lightweight image
FROM python:3.12-slim

# Install system dependencies (ffmpeg is required for yt-dlp to convert audio to mp3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application files
COPY . .

# Expose port (Render automatically maps PORT)
EXPOSE 5000

# Start the Flask app using Gunicorn and bind dynamically to $PORT or default to 5000
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} app:app"]
