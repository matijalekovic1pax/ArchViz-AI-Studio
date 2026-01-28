"""
Health Check Endpoint
"""

from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Send response
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
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
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
