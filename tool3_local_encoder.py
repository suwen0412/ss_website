#!/usr/bin/env python3
from __future__ import annotations
import base64, io, json, shutil, subprocess, tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from PIL import Image
except Exception as exc:
    raise SystemExit("Pillow is required. Install it with: pip install pillow") from exc

HOST='127.0.0.1'
PORT=8765

def decode_data_url(data_url: str) -> Image.Image:
    if ',' not in data_url:
        raise ValueError('Invalid data URL frame payload')
    _, b64 = data_url.split(',', 1)
    raw = base64.b64decode(b64)
    return Image.open(io.BytesIO(raw)).convert('RGBA')

def encode_with_pillow(images, fps: int) -> bytes:
    duration = max(20, round(1000 / max(1, fps)))
    first = images[0].convert('P', palette=Image.ADAPTIVE)
    rest = [im.convert('P', palette=Image.ADAPTIVE) for im in images[1:]]
    out = io.BytesIO()
    first.save(out, format='GIF', save_all=True, append_images=rest, duration=duration, loop=0, optimize=False, disposal=2)
    return out.getvalue()

def encode_with_ffmpeg(images, fps: int):
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for i, im in enumerate(images):
            im.save(tmp / f'frame_{i:04d}.png')
        out_path = tmp / 'out.gif'
        cmd = [ffmpeg, '-y', '-loglevel', 'error', '-framerate', str(max(1,fps)), '-i', str(tmp / 'frame_%04d.png'), '-loop', '0', str(out_path)]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0 or not out_path.exists():
            return None
        return out_path.read_bytes()

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        if self.path.rstrip('/') == '/health':
            engine = 'ffmpeg' if shutil.which('ffmpeg') else 'pillow'
            body = json.dumps({'ok': True, 'engine': engine}).encode()
            self.send_response(200); self._cors(); self.send_header('Content-Type','application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        self.send_response(404); self._cors(); self.end_headers()
    def do_POST(self):
        if self.path.rstrip('/') != '/encode-gif':
            self.send_response(404); self._cors(); self.end_headers(); return
        try:
            n = int(self.headers.get('Content-Length','0'))
            payload = json.loads(self.rfile.read(n).decode())
            fps = int(payload.get('fps', 6))
            frames = payload.get('frames', [])
            if not isinstance(frames, list) or not frames:
                raise ValueError('No frames received')
            images = [decode_data_url(f) for f in frames]
            gif_bytes = encode_with_ffmpeg(images, fps)
            if gif_bytes is None:
                gif_bytes = encode_with_pillow(images, fps)
            self.send_response(200); self._cors(); self.send_header('Content-Type','image/gif'); self.send_header('Content-Length', str(len(gif_bytes))); self.end_headers(); self.wfile.write(gif_bytes)
        except Exception as exc:
            body = str(exc).encode()
            self.send_response(400); self._cors(); self.send_header('Content-Type','text/plain; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

def main():
    print(f'Tool 3 local encoder running on http://{HOST}:{PORT}')
    print('Health check: GET /health')
    print('GIF endpoint: POST /encode-gif')
    print('Tip: install ffmpeg for fastest encoding; otherwise Pillow will be used.')
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
