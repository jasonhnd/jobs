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
import os
import re
import socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    def _serve_404(self):
        """Mirror Vercel: any unknown path falls back to root /404.html with HTTP 404.
        Per docs/Design.md §7.14."""
        try:
            with open("404.html", "rb") as f:
                body = f.read()
        except FileNotFoundError:
            body = b"<h1>404 Not Found</h1>"
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
        elif re.match(r"^/(ja|en)/sectors/[a-z_]+$", path):
            # Sector hub pages: /<lang>/sectors/<sector_id> → file.html.
            self.path = path + ".html"
        elif path.startswith("/occ/") and "." not in path.rsplit("/", 1)[-1]:
            # Legacy slug URLs — Vercel 301-redirects these in production
            # (see vercel.json), but locally serve the HTML directly so old
            # links still preview without a redirect-loop hop.
            self.path = path + ".html"
        # DEAD CODE since v1.2.0: the /m/{ja,en}/* routing block below was for
        # v1.1.0 mobile-web architecture. v1.2.0 retired /m/* in favor of
        # single-URL responsive (no `m/` dir has been built since). vercel.json
        # has no /m/ rules, sitemap.xml has 0 mentions. Spec doc MOBILE_DESIGN.md
        # deleted 2026-05-06. Safe to delete the entire elif-block (lines 80-99)
        # in a follow-up cleanup.
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

        # Mirror Vercel 404: if the (possibly rewritten) target file doesn't
        # exist on disk and isn't a directory, fall back to /404.html with
        # HTTP 404 status. Only check for paths that look like files (have
        # a final segment, no trailing slash); directory listings are left
        # to the parent handler.
        resolved = self.path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        if resolved and not resolved.endswith("/"):
            disk_path = os.path.join(os.getcwd(), resolved)
            if not os.path.exists(disk_path):
                self._serve_404()
                return
        return super().do_GET()

    do_HEAD = do_GET

    def log_message(self, *a, **k):
        pass


class ReuseTCP(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReuseTCP(("", 8765), Handler) as srv:
        srv.serve_forever()
