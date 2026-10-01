#!/usr/bin/env python3
"""A standard-library localhost server, including byte ranges for motion clips."""
import argparse
import functools
import os
from pathlib import Path
import re
import shutil
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent


class StudioHandler(SimpleHTTPRequestHandler):
    range_remaining = None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def send_head(self):
        self.range_remaining = None
        path = Path(self.translate_path(self.path))
        range_header = self.headers.get('Range')
        if not range_header or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', range_header.strip())
        if not match or not size:
            self.send_error(416, 'Invalid byte range')
            return None
        first, last = match.groups()
        if not first and not last:
            self.send_error(416, 'Invalid byte range')
            return None
        start = int(first) if first else max(0, size - int(last))
        end = min(size - 1, int(last)) if first and last else size - 1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        source = path.open('rb')
        source.seek(start)
        self.range_remaining = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self.range_remaining))
        self.end_headers()
        return source

    def copyfile(self, source, output):
        try:
            if self.range_remaining is None:
                shutil.copyfileobj(source, output)
                return
            remaining = self.range_remaining
            while remaining > 0:
                data = source.read(min(64 * 1024, remaining))
                if not data:
                    break
                output.write(data)
                remaining -= len(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        if args and str(args[1] if len(args) > 1 else '').startswith(('4', '5')):
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description='Open Nieve Character Studio locally.')
    parser.add_argument('--port', type=int, default=8874)
    parser.add_argument('--open', action='store_true', help='Open the studio in your default browser.')
    args = parser.parse_args()
    handler = functools.partial(StudioHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        print(f'Cannot start port {args.port}: {error}')
        print('If the studio is already running, open the address below. Otherwise choose --port 8875.')
        print(f'http://127.0.0.1:{args.port}')
        return 1
    server.daemon_threads = True
    url = f'http://127.0.0.1:{args.port}'
    print(f'Nieve Character Studio: {url}', flush=True)
    print('Keep this window open. Press Ctrl+C to stop the studio.', flush=True)
    if args.open:
        threading.Timer(0.3, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
