"""
iLovePDF API Proxy: DOCX to PDF Conversion
This serverless function proxies requests to iLovePDF API to avoid CORS issues
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
from urllib.parse import urlencode

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            # Extract parameters
            public_key = data.get('public_key')
            docx_base64 = data.get('docx_base64')

            if not public_key or not docx_base64:
                self.send_error_response(400, 'Missing public_key or docx_base64')
                return

            # Step 1: Start task
            print('Step 1: Starting iLovePDF task...')
            task_data = self.start_task(public_key, 'officepdf')
            if not task_data:
                self.send_error_response(500, 'Failed to start iLovePDF task')
                return

            server = task_data['server']
            task = task_data['task']
            print(f'Task started: {task} on server: {server}')

            # Step 2: Upload file
            print('Step 2: Uploading DOCX...')
            upload_data = self.upload_file(server, task, docx_base64, 'document.docx')
            if not upload_data:
                self.send_error_response(500, 'Failed to upload DOCX')
                return

            server_filename = upload_data['server_filename']
            print(f'File uploaded: {server_filename}')

            # Step 3: Process conversion
            print('Step 3: Processing conversion...')
            process_result = self.process_conversion(server, task, server_filename, 'officepdf')
            if not process_result:
                self.send_error_response(500, 'Failed to process conversion')
                return

            print('Conversion processed')

            # Step 4: Download result
            print('Step 4: Downloading PDF...')
            pdf_base64 = self.download_file(server, task)
            if not pdf_base64:
                self.send_error_response(500, 'Failed to download PDF')
                return

            print('✅ DOCX to PDF conversion complete')

            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            response = {
                'success': True,
                'pdf_base64': pdf_base64
            }
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f'Error: {str(e)}')
            self.send_error_response(500, str(e))

    def start_task(self, public_key, tool):
        """Start iLovePDF task"""
        try:
            url = f'https://api.ilovepdf.com/v1/start/{tool}'
            data = json.dumps({'public_key': public_key}).encode('utf-8')

            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            print(f'Start task error: {e}')
            return None

    def upload_file(self, server, task, file_base64, filename):
        """Upload file to iLovePDF"""
        try:
            import base64

            # Decode base64
            if ',' in file_base64:
                file_base64 = file_base64.split(',')[1]
            file_data = base64.b64decode(file_base64)

            # Create multipart form data
            boundary = '----WebKitFormBoundary' + os.urandom(16).hex()

            body = []
            body.append(f'--{boundary}'.encode())
            body.append(f'Content-Disposition: form-data; name="task"'.encode())
            body.append(b'')
            body.append(task.encode())

            body.append(f'--{boundary}'.encode())
            body.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode())
            body.append(b'Content-Type: application/octet-stream')
            body.append(b'')
            body.append(file_data)

            body.append(f'--{boundary}--'.encode())

            body_bytes = b'\r\n'.join(body)

            url = f'https://{server}/v1/upload'
            req = urllib.request.Request(
                url,
                data=body_bytes,
                headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
            )

            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            print(f'Upload error: {e}')
            return None

    def process_conversion(self, server, task, server_filename, tool):
        """Process the conversion"""
        try:
            url = f'https://{server}/v1/process'
            data = json.dumps({
                'task': task,
                'tool': tool,
                'files': [{'server_filename': server_filename, 'filename': server_filename}]
            }).encode('utf-8')

            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            print(f'Process error: {e}')
            return None

    def download_file(self, server, task):
        """Download converted file and return as base64"""
        try:
            import base64

            url = f'https://{server}/v1/download/{task}'
            req = urllib.request.Request(url)

            with urllib.request.urlopen(req) as response:
                file_data = response.read()
                # Convert to base64 data URL
                base64_data = base64.b64encode(file_data).decode('utf-8')
                return f'data:application/pdf;base64,{base64_data}'
        except Exception as e:
            print(f'Download error: {e}')
            return None

    def send_error_response(self, code, message):
        """Send error response"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            'success': False,
            'error': message
        }
        self.wfile.write(json.dumps(response).encode())
