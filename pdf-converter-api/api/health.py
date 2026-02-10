"""
Health Check Endpoint (public, no auth required)
"""

from http.server import BaseHTTPRequestHandler
import json

ALLOWED_ORIGIN = 'https://arch-viz-ai-studio.vercel.app'
ALLOWED_ORIGINS = [ALLOWED_ORIGIN, 'http://localhost:3000', 'http://localhost:5173']


def _get_cors_origin(handler):
    origin = handler.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGIN


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        origin = _get_cors_origin(self)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', origin)
        self.end_headers()

        response = {
            'status': 'healthy',
            'service': 'PDF Converter API',
            'endpoints': [
                '/api/pdf-to-docx',
                '/api/docx-to-pdf',
                '/api/health'
            ]
        }

        self.wfile.write(json.dumps(response).encode('utf-8'))

    def do_OPTIONS(self):
        origin = _get_cors_origin(self)
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
