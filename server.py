"""Local preview of Finvoice, with an optional external CSV."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    dataset = None
    def do_GET(self):
        if self.path == '/__qa/mobile':
            content = b'<!doctype html><title>Mobile layout QA</title><style>body{margin:0;background:#ddd}iframe{width:390px;height:844px;border:0;display:block;margin:auto}</style><iframe title="390 pixel mobile preview" src="/"></iframe>'
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(content)
            return
        if self.path == '/data/properties.csv':
            if not self.dataset or not self.dataset.is_file():
                self.send_error(404, 'Choose your CSV in the app')
                return
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            with self.dataset.open('rb') as source:
                import shutil
                shutil.copyfileobj(source, self.wfile)
            return
        super().do_GET()
    def log_message(self, format, *args):
        # Do not log lookup input or company records.
        return

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8787)
    parser.add_argument('--csv', type=Path, default=Path(__file__).parent / 'dist' / 'data' / 'properties.csv')
    args = parser.parse_args()
    Handler.dataset = args.csv
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(Path(__file__).parent / 'dist')))
    print(f'Address is ready at http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
