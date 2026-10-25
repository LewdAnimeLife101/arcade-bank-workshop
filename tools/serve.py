"""Local static preview with portable JavaScript/WASM MIME types."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path

SimpleHTTPRequestHandler.extensions_map.update({'.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm'})
root = Path(__file__).resolve().parents[1] / 'dist'
print('Local: http://127.0.0.1:8766/', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8766), partial(SimpleHTTPRequestHandler, directory=str(root))).serve_forever()
