#!/usr/bin/env bash
# seo-check.sh — one-shot SEO + GEO health probe for mirai-shigoto.com
#
# What it checks:
#   - /robots.txt: reachable, has Sitemap directive, AI crawler whitelist
#   - /sitemap.xml: reachable, valid <loc>, hreflang alternates
#   - /llms.txt: reachable, expected sections (GEO emerging standard)
#   - For each URL in the sitemap:
#       HTTP status, <title> length, meta description length, canonical,
#       hreflang count, OG tags (5 required), Twitter Card,
#       Schema.org JSON-LD (presence + @types), 4 analytics scripts,
#       HSTS, Vercel edge node, <html lang>, viewport meta.
#
# Usage:
#   ./scripts/seo-check.sh                              # production (default)
#   ./scripts/seo-check.sh https://mirai-shigoto.com    # explicit URL
#   ./scripts/seo-check.sh http://localhost:8765        # local dev server
#
# Exit codes:
#   0 = all green
#   1 = warnings only (still healthy)
#   2 = errors (something broken)
#
# Dependencies: bash 4+, curl, grep, sed, awk (all preinstalled on macOS / Linux)

set -uo pipefail

BASE="${1:-https://mirai-shigoto.com}"
BASE="${BASE%/}"  # strip trailing slash

# Colors only on TTY
if [ -t 1 ]; then
  G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[1;34m'; D='\033[2m'; X='\033[0m'
else
  G='' Y='' R='' B='' D='' X=''
fi

PASS=0; WARN=0; ERR=0

ok()     { printf "  ${G}✓${X} %s\n" "$1"; PASS=$((PASS+1)); }
warn()   { printf "  ${Y}⚠${X} %s\n" "$1"; WARN=$((WARN+1)); }
fail()   { printf "  ${R}✗${X} %s\n" "$1"; ERR=$((ERR+1)); }
section(){ printf "\n${B}== %s ==${X}\n" "$1"; }
note()   { printf "    ${D}%s${X}\n" "$1"; }

fetch_body()   { curl -fsSL  --max-time 12 -A "seo-check.sh/1.0" "$1" 2>/dev/null; }
fetch_header() { curl -fsSI  --max-time 12 -A "seo-check.sh/1.0" "$1" 2>/dev/null; }

printf "${B}SEO + GEO health check${X}  ${D}(target: %s)${X}\n" "$BASE"

# ---- robots.txt ----------------------------------------------------------

section "robots.txt"
ROBOTS=$(fetch_body "$BASE/robots.txt")
if [ -z "$ROBOTS" ]; then
  fail "$BASE/robots.txt unreachable"
else
  ok "reachable"
  if grep -qiE "^Sitemap:" <<<"$ROBOTS"; then
    ok "Sitemap directive: $(grep -iE '^Sitemap:' <<<"$ROBOTS" | head -1 | awk '{print $2}')"
  else
    fail "no Sitemap: directive"
  fi
  for bot in GPTBot ClaudeBot PerplexityBot Google-Extended CCBot Applebot-Extended Bytespider; do
    if grep -qiE "^User-agent: ${bot}" <<<"$ROBOTS"; then
      ok "$bot whitelisted"
    else
      warn "$bot not in whitelist"
    fi
  done
fi

# ---- sitemap.xml ---------------------------------------------------------

section "sitemap.xml"
SITEMAP=$(fetch_body "$BASE/sitemap.xml")
if [ -z "$SITEMAP" ]; then
  fail "$BASE/sitemap.xml unreachable"
  URLS=""
else
  ok "reachable"
  URL_COUNT=$(grep -c "<loc>" <<<"$SITEMAP" || true)
  ok "$URL_COUNT URL(s) declared"
  HREFLANG_COUNT=$(grep -c "hreflang=" <<<"$SITEMAP" || true)
  if [ "$HREFLANG_COUNT" -ge 1 ]; then
    ok "$HREFLANG_COUNT hreflang alternate(s)"
  else
    warn "no hreflang alternates in sitemap"
  fi
  URLS=$(grep -oE "<loc>[^<]+</loc>" <<<"$SITEMAP" | sed 's|<[^>]*>||g')
fi

# ---- llms.txt (GEO) ------------------------------------------------------

section "llms.txt (GEO)"
LLMS=$(fetch_body "$BASE/llms.txt")
if [ -z "$LLMS" ]; then
  warn "$BASE/llms.txt unreachable (emerging standard, optional)"
else
  SIZE=$(wc -c <<<"$LLMS" | tr -d ' ')
  ok "reachable (${SIZE} bytes)"
  for sect in "Key facts" "Pages" "Methodology" "Disclaimer"; do
    if grep -qi "$sect" <<<"$LLMS"; then
      ok "section: '$sect'"
    else
      warn "missing section: '$sect'"
    fi
  done
fi

# ---- per-URL checks ------------------------------------------------------

if [ -z "$URLS" ]; then
  warn "no URLs to check (sitemap empty/missing)"
else
  for URL in $URLS; do
    section "Page: $URL"
    HTML_RAW=$(fetch_body "$URL")
    HEADERS=$(fetch_header "$URL")

    if [ -z "$HTML_RAW" ]; then
      fail "page unreachable"
      continue
    fi

    # Flatten multi-line tags so regex like 'name="description"...content="..."'
    # works even when the meta is spread across several lines in the source.
    HTML=$(printf '%s' "$HTML_RAW" | tr '\n' ' ')

    STATUS=$(echo "$HEADERS" | grep -oE "HTTP/[0-9.]+ [0-9]+" | tail -1 | awk '{print $2}')
    [ "$STATUS" = "200" ] && ok "HTTP $STATUS" || fail "HTTP $STATUS"

    # <title>. Length budget is informational only — Google truncates by
    # pixel width, not bytes; CJK characters render ~2x wide so the byte
    # count overstates SERP-visible length. Treat 200 bytes as the soft cap.
    TITLE=$(grep -oE "<title>[^<]+</title>" <<<"$HTML" | head -1 | sed 's|<[^>]*>||g')
    if [ -n "$TITLE" ]; then
      BYTES=$(printf '%s' "$TITLE" | wc -c | tr -d ' ')
      # Crude CJK ratio (any byte >= 0xE0 = start of multi-byte UTF-8 sequence)
      if printf '%s' "$TITLE" | LC_ALL=C grep -qE '[\xE0-\xFF]'; then
        if [ "$BYTES" -gt 200 ]; then
          warn "title ${BYTES} bytes (CJK; soft cap 200, ideal 90-150)"
        else
          ok "title ${BYTES} bytes (CJK)"
        fi
      else
        if [ "$BYTES" -ge 30 ] && [ "$BYTES" -le 70 ]; then
          ok "title (${BYTES} chars)"
        elif [ "$BYTES" -lt 30 ]; then
          warn "title short (${BYTES} chars, ideal 50-70)"
        else
          warn "title long (${BYTES} chars, ideal 50-70)"
        fi
      fi
      note "$TITLE"
    else
      fail "no <title>"
    fi

    # meta description
    DESC=$(grep -oE 'name="description"[^>]*content="[^"]+"' <<<"$HTML" | head -1 | sed 's/.*content="//; s/"$//')
    if [ -n "$DESC" ]; then
      LEN=$(printf '%s' "$DESC" | wc -c | tr -d ' ')
      if [ "$LEN" -ge 100 ] && [ "$LEN" -le 200 ]; then
        ok "meta description (${LEN} chars)"
      else
        warn "meta description ${LEN} chars (ideal 120-160)"
      fi
    else
      fail "no meta description"
    fi

    # canonical
    if grep -qE 'rel="canonical"' <<<"$HTML"; then
      CANON=$(grep -oE 'rel="canonical"[^>]*href="[^"]+"' <<<"$HTML" | head -1 | sed 's/.*href="//; s/"$//')
      ok "canonical: $CANON"
    else
      fail "no <link rel='canonical'>"
    fi

    # hreflang (count occurrences, not matching lines — HTML is flattened)
    HC=$(grep -oE 'hreflang="[^"]+"' <<<"$HTML" | wc -l | tr -d ' ')
    if [ "$HC" -ge 3 ]; then
      ok "hreflang: $HC tags"
    elif [ "$HC" -ge 1 ]; then
      warn "hreflang: $HC tag(s) — recommend 3 (ja/en/x-default)"
    else
      fail "no hreflang"
    fi

    # OG required
    for og in og:type og:title og:description og:url og:image; do
      grep -qE "property=\"$og\"" <<<"$HTML" \
        && ok "OG: $og" \
        || warn "OG missing: $og"
    done

    # Twitter card
    grep -qE 'name="twitter:card"' <<<"$HTML" \
      && ok "twitter:card" \
      || warn "twitter:card missing"

    # Schema.org JSON-LD (count <script type="application/ld+json"> blocks)
    JSONLD=$(grep -oE 'application/ld\+json' <<<"$HTML" | wc -l | tr -d ' ')
    if [ "$JSONLD" -ge 1 ]; then
      ok "JSON-LD blocks: $JSONLD"
      # Extract all "@type": "Foo" occurrences (use awk to avoid greedy regex)
      TYPES=$(grep -oE '"@type": *"[^"]+"' <<<"$HTML" | awk -F'"' '{print $4}' | sort -u | tr '\n' ' ')
      [ -n "$TYPES" ] && note "@types: ${TYPES}"
    else
      fail "no Schema.org JSON-LD"
    fi

    # 4 analytics trackers
    for t in "cloudflareinsights.com" "googletagmanager.com" "_vercel/insights" "_vercel/speed-insights"; do
      grep -q "$t" <<<"$HTML" \
        && ok "tracker: $t" \
        || fail "tracker missing: $t"
    done

    # HSTS
    echo "$HEADERS" | grep -qi "strict-transport-security" \
      && ok "HSTS enabled" \
      || warn "HSTS not set"

    # Vercel edge
    EDGE=$(echo "$HEADERS" | grep -i "x-vercel-id:" | grep -oE "[a-z]+[0-9]+" | head -1 || true)
    [ -n "$EDGE" ] && ok "Vercel edge: $EDGE" || warn "no x-vercel-id (not on Vercel?)"

    # html lang
    HL=$(grep -oE '<html [^>]*lang="[^"]+"' <<<"$HTML" | head -1 | sed 's/.*lang="//; s/"$//')
    [ -n "$HL" ] && ok "<html lang=\"$HL\">" || warn "no <html lang>"

    # viewport
    grep -qE 'name="viewport"' <<<"$HTML" \
      && ok "viewport meta" \
      || fail "no viewport meta (mobile-broken)"
  done
fi

# ---- Summary -------------------------------------------------------------

section "Summary"
printf "  ${G}%d passed${X}   ${Y}%d warnings${X}   ${R}%d errors${X}\n\n" "$PASS" "$WARN" "$ERR"

if [ "$ERR" -gt 0 ]; then
  exit 2
elif [ "$WARN" -gt 0 ]; then
  exit 1
fi
exit 0
