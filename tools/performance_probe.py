"""Serve identical browser builds with reproducible shared throughput and latency.
Usage: python3 tools/performance_probe.py --port 8876
normal/slow, before/after paths use separate browser cache keys; repeat the same
URL for a warm run. Slow is shared 3 Mbps with 120 ms added per HTTP request.
The before build is a local v8.0.0 snapshot in ignored output/performance/baseline.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, threading, time, urllib.parse, mimetypes
ROOT = Path(__file__).resolve().parents[1]
lock = threading.Lock()
next_slot = 0.0
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        global next_slot
        parts = urllib.parse.urlsplit(self.path).path.strip('/').split('/')
        if len(parts) < 2 or parts[0] not in ('normal','slow') or parts[1] not in ('before','after'):
            self.send_error(404); return
        slow = parts[0] == 'slow'
        base = ROOT / 'output/performance/baseline' if parts[1] == 'before' else ROOT
        name = '/'.join(parts[2:]) or 'index.html'
        path = (base / name).resolve()
        # Baseline's assets are a symlink to unchanged original artwork.
        if not path.is_relative_to(ROOT) or not path.is_file(): self.send_error(404); return
        data = path.read_bytes()
        if name == 'index.html':
            probe = (ROOT/'tools/performance-probe.js').read_text()
            data = data.replace(b'</head>', ('<script>'+probe+'</script></head>').encode())
        if slow: time.sleep(.12)
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control','public, max-age=3600' if name.startswith('assets/') else 'no-store')
        self.end_headers()
        try:
            for offset in range(0,len(data),16384):
                chunk = data[offset:offset+16384]
                if slow:
                    with lock:
                        now = time.monotonic(); slot = max(next_slot,now); next_slot = slot + len(chunk)/375000
                    time.sleep(max(0,slot-time.monotonic()))
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError): pass
    def log_message(self,*args): pass
if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('--port',type=int,default=8876); a=p.parse_args()
    print(f'Browser benchmark: http://127.0.0.1:{a.port}/normal/before/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
