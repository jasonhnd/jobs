#!/usr/bin/env python3
"""
dev-server.py — local static dev server that mirrors Vercel's clean-URL routing.

Vercel (per vercel.json: cleanUrls: true) strips .html from URLs:
  /privacy            → /privacy.html
  /occ/<id>-<slug>    → /occ/<id>-<slug>.html

Plain `python3 -m http.server` does not, so the per-occupation links
404 locally even though they work on production. This wrapper adds
the same rewrites + serves a localhost-rebased sitemap.xml so
scripts/seo-check.sh can be pointed at http://localhost:8765 and
follow the URLs end-to-end.

Usage (.claude/launch.json):
    python3 scripts/dev-server.py
Bind port: 8765.
"""
from __future__ import annotations
import http.server
import re
import socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve sitemap.xml with localhost-rebased URLs so seo-check.sh
        # can crawl the listed paths against the local server.
        if self.path == "/sitemap.xml":
            with open("sitemap.xml", "rb") as f:
                body = re.sub(rb"https://mirai-shigoto\.com", b"http://localhost:8765", f.read())
            self.send_response(200)
            self.send_header("Content-Type", "application/xml; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # v1.0.9: mirror vercel.json's 301 for legacy /data.json (kept for ext links).
        path = self.path.split("?", 1)[0]
        if path == "/data.json":
            self.send_response(301)
            self.send_header("Location", "/data.treemap.json")
            self.end_headers()
            return

        # Vercel cleanUrls equivalents — mirror vercel.json: cleanUrls: true.
        if path == "/privacy":
            self.path = "/privacy.html"
        elif path == "/about":
            self.path = "/about.html"
        elif path == "/compliance":
            self.path = "/compliance.html"
        elif re.match(r"^/(ja|en)/\d+$", path):
            # Stage 1 numeric-id occupation URLs (Design.md §0).
            self.path = path + ".html"
        elif path.startswith("/occ/") and "." not in path.rsplit("/", 1)[-1]:
            # Legacy slug URLs — Vercel 301-redirects these in production
            # (see vercel.json), but locally serve the HTML directly so old
            # links still preview without a redirect-loop hop.
            self.path = path + ".html"
        # v1.1.0: mobile-web pages live under /m/{ja,en}/* (MOBILE_DESIGN.md §3, §6, §9)
        elif re.match(r"^/m/(ja|en)/?$", path):
            # Mobile home: /m/ja/ → /m/ja/index.html
            self.path = path.rstrip("/") + "/index.html"
        elif re.match(r"^/m/(ja|en)/\d+$", path):
            # Mobile detail: /m/ja/427 → /m/ja/427.html
            self.path = path + ".html"
        elif re.match(r"^/m/(ja|en)/[a-z][a-z0-9_-]*$", path):
            # Mobile static screens: /m/ja/map → /m/ja/map.html  (also: search, compare, ranking, about)
            self.path = path + ".html"
        elif path == "/m" or path == "/m/":
            # Bare /m → 301 to default-language home (Japanese)
            self.send_response(301)
            self.send_header("Location", "/m/ja/")
            self.end_headers()
            return
        # v1.0.8: mirror vercel.json rewrites — projection paths live under dist/
        elif path == "/data.treemap.json":
            self.path = "/dist/data.treemap.json"
        elif path == "/data.search.json":
            self.path = "/dist/data.search.json"
        elif path == "/data.sectors.json":  # v1.1.0
            self.path = "/dist/data.sectors.json"
        elif path == "/data.profile5.json":  # v1.1.0 phase 2
            self.path = "/dist/data.profile5.json"
        elif path == "/data.transfer_paths.json":  # v1.1.0 phase 2
            self.path = "/dist/data.transfer_paths.json"
        elif path.startswith("/data.detail/"):
            self.path = "/dist" + path
        elif path.startswith("/data.labels/"):
            self.path = "/dist" + path
        return super().do_GET()

    do_HEAD = do_GET

    def log_message(self, *a, **k):
        pass


class ReuseTCP(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReuseTCP(("", 8765), Handler) as srv:
        srv.serve_forever()
