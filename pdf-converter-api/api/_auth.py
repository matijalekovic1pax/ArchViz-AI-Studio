"""
Shared JWT verification for Vercel serverless functions.
Uses HS256 (HMAC-SHA256) with the JWT_SECRET environment variable.
No external dependencies — uses Python stdlib only.
"""

import os
import json
import hmac
import hashlib
import base64
import time

ALLOWED_ORIGIN = 'https://arch-viz-ai-studio.vercel.app'
ALLOWED_ORIGINS = [ALLOWED_ORIGIN, 'http://localhost:3000', 'http://localhost:5173']
MAX_PAYLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


def _base64url_decode(s):
    """Decode base64url string to bytes."""
    s = s.replace('-', '+').replace('_', '/')
    padding = 4 - len(s) % 4
    if padding != 4:
        s += '=' * padding
    return base64.b64decode(s)


def _base64url_encode(data):
    """Encode bytes to base64url string."""
    return base64.b64encode(data).rstrip(b'=').replace(b'+', b'-').replace(b'/', b'_').decode('ascii')


def verify_jwt(token):
    """
    Verify an HS256 JWT token.
    Returns the decoded payload dict or raises ValueError.
    """
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        raise ValueError('JWT_SECRET not configured')

    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError('Invalid JWT format')

    # Verify signature
    signing_input = f'{parts[0]}.{parts[1]}'.encode('ascii')
    expected_sig = hmac.new(
        secret.encode('utf-8'),
        signing_input,
        hashlib.sha256
    ).digest()

    actual_sig = _base64url_decode(parts[2])

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError('Invalid JWT signature')

    # Decode payload
    payload = json.loads(_base64url_decode(parts[1]).decode('utf-8'))

    # Check expiration
    if 'exp' in payload and payload['exp'] < time.time():
        raise ValueError('JWT expired')

    return payload


def authenticate_request(handler):
    """
    Check the Authorization header on a BaseHTTPRequestHandler.
    Returns (True, payload) on success, (False, error_message) on failure.
    """
    auth_header = handler.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return False, 'Missing or invalid Authorization header'

    token = auth_header[7:]
    try:
        payload = verify_jwt(token)
        return True, payload
    except ValueError as e:
        return False, str(e)


def check_payload_size(handler):
    """
    Check Content-Length against MAX_PAYLOAD_BYTES.
    Returns (True, content_length) if OK, (False, error_message) if too large.
    """
    content_length = int(handler.headers.get('Content-Length', 0))
    if content_length > MAX_PAYLOAD_BYTES:
        return False, f'Payload too large ({content_length} bytes, max {MAX_PAYLOAD_BYTES})'
    return True, content_length


def get_cors_origin(handler):
    """Get the allowed CORS origin based on request Origin header."""
    origin = handler.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGIN


def send_cors_headers(handler, origin=None):
    """Send CORS headers on a response."""
    if origin is None:
        origin = get_cors_origin(handler)
    handler.send_header('Access-Control-Allow-Origin', origin)


def send_unauthorized(handler, message='Unauthorized'):
    """Send a 401 response."""
    origin = get_cors_origin(handler)
    handler.send_response(401)
    handler.send_header('Content-Type', 'application/json')
    send_cors_headers(handler, origin)
    handler.end_headers()
    handler.wfile.write(json.dumps({'success': False, 'error': message}).encode('utf-8'))


def send_payload_too_large(handler):
    """Send a 413 response."""
    origin = get_cors_origin(handler)
    handler.send_response(413)
    handler.send_header('Content-Type', 'application/json')
    send_cors_headers(handler, origin)
    handler.end_headers()
    handler.wfile.write(json.dumps({'success': False, 'error': 'Payload too large'}).encode('utf-8'))
