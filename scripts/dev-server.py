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

        # Vercel cleanUrls equivalents — mirror vercel.json: cleanUrls: true.
        path = self.path.split("?", 1)[0]
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
        return super().do_GET()

    do_HEAD = do_GET

    def log_message(self, *a, **k):
        pass


class ReuseTCP(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReuseTCP(("", 8765), Handler) as srv:
        srv.serve_forever()
