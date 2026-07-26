import unittest
from unittest.mock import patch, MagicMock
import os
import json
from app import app

class TestYtdlApi(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_index_route(self):
        """Test the home page route serves index.html properly."""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    def test_api_info_missing_url(self):
        """Test `/api/info` behavior when `url` parameter is missing."""
        response = self.app.get('/api/info')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    @patch('yt_dlp.YoutubeDL')
    def test_api_info_success(self, mock_ytdl):
        """Test `/api/info` with a mocked YouTube DL extractor."""
        # Mocking the inner object returned by context manager `YoutubeDL`
        mock_instance = mock_ytdl.return_value.__enter__.return_value
        mock_instance.extract_info.return_value = {
            'title': 'Test Song',
            'duration': 185,
            'thumbnail': 'http://example.com/thumb.jpg',
            'uploader': 'Test Channel',
            'view_count': 12345
        }

        response = self.app.get('/api/info?url=https://www.youtube.com/watch?v=12345')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['title'], 'Test Song')
        self.assertEqual(data['duration_string'], '03:05')
        self.assertEqual(data['channel'], 'Test Channel')
        self.assertEqual(data['view_count'], 12345)

    @patch('yt_dlp.YoutubeDL')
    def test_api_info_failure(self, mock_ytdl):
        """Test `/api/info` when yt_dlp throws an error."""
        mock_instance = mock_ytdl.return_value.__enter__.return_value
        mock_instance.extract_info.side_effect = Exception("Video unavailable")

        response = self.app.get('/api/info?url=https://www.youtube.com/watch?v=12345')
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_api_download_missing_url(self):
        """Test `/api/download` behavior when `url` parameter is missing."""
        response = self.app.get('/api/download')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    @patch('yt_dlp.YoutubeDL')
    def test_api_download_success(self, mock_ytdl):
        """Test `/api/download` succeeds and triggers a file transfer."""
        mock_instance = mock_ytdl.return_value.__enter__.return_value
        mock_instance.extract_info.return_value = {
            'title': 'Awesome Beat Track 123'
        }

        # Mock the download execution to generate a dummy file in the temp path
        def mock_download_side_effect(urls):
            # Locate the output path configured in ytdl_opts
            # We will grab temp_dir from the configured outtmpl or simulate it
            # The app expects: {unique_id}.mp3 to be generated in temp_dir
            pass
        
        mock_instance.download.side_effect = mock_download_side_effect

        # We can mock the os.path.exists and send_file as well, or we can mock os.path.exists to return True
        # and mock open() or send_file itself. Let's patch os.path.exists to be True for our expected file.
        with patch('os.path.exists') as mock_exists, \
             patch('app.send_file') as mock_send_file:
            
            mock_exists.return_value = True
            mock_send_file.return_value = "Mocked File Response"

            response = self.app.get('/api/download?url=https://www.youtube.com/watch?v=12345')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, b"Mocked File Response")

if __name__ == '__main__':
    unittest.main()
