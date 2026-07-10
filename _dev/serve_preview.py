# Sert le dossier preview en mappant les URLs sans extension vers .html (comme Netlify)
import http.server, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kw):
        super().__init__(*args, directory=ROOT, **kw)

    def translate_path(self, path):
        p = super().translate_path(path)
        clean = path.split("?")[0].split("#")[0]
        if clean == "/":
            return os.path.join(ROOT, "index.html")
        if not os.path.exists(p) and os.path.exists(p + ".html"):
            return p + ".html"
        return p

    def log_message(self, *a):
        pass

http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
