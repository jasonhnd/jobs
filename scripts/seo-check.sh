#!/usr/bin/env bash
# seo-check.sh — one-shot SEO + GEO health probe for mirai-shigoto.com
#
# What it checks:
#   - /robots.txt: reachable, has Sitemap directive, AI crawler whitelist
#   - /sitemap.xml: reachable, valid <loc>, hreflang alternates
#   - /llms.txt: reachable, expected sections + How-to-cite block
#   - /llms-full.txt: reachable (extended GEO companion)
#   - For each URL in the sitemap:
#       HTTP status, <title> length, meta description length, canonical,
#       hreflang (ja + x-default; the site is Japanese-only), OG tags
#       (5 required), Twitter Card,
#       Schema.org JSON-LD (presence + @types + page-specific expectations:
#         home → FAQPage / ItemList / Dataset / Organization;
#         /privacy → BreadcrumbList),
#       dns-prefetch + preconnect (perf hints),
#       4 analytics scripts, HSTS, Vercel edge node,
#       <html lang>, viewport meta.
#
# Usage:
#   ./scripts/seo-check.sh                                          # production host; refused unless ALLOW_PROD=1
#   ALLOW_PROD=1 ./scripts/seo-check.sh https://mirai-shigoto.com   # explicit production opt-in
#   ./scripts/seo-check.sh https://pre.mirai-shigoto.com --sample 5 # preview alias (npm test:seo)
#   ./scripts/seo-check.sh http://localhost:8765                    # local dev server
#
# Production hosts (mirai-shigoto.com, www.mirai-shigoto.com, in any case,
# with a trailing dot, port, userinfo or fragment) exit 2 before any request
# unless ALLOW_PROD=1. Sitemap <loc> values are rewritten onto the requested
# host, so a preview run does not follow canonical production URLs, and
# redirects are never followed (a redirect could land on production); a 3xx
# is reported as such. `bun run test:seo` targets the preview alias with
# --sample 5.
#
# Exit codes:
#   0 = all green
#   1 = warnings only (still healthy)
#   2 = errors (something broken)
#
# Dependencies: bash 4+, curl, grep, sed, awk (all preinstalled on macOS / Linux)

set -uo pipefail

usage() {
  printf '%s\n' "usage: $0 [BASE_URL] [--sample N]   (N: positive integer)" >&2
  exit 2
}

BASE="${1:-https://mirai-shigoto.com}"
BASE="${BASE%/}"  # strip trailing slash

# Optional --sample N checks the home page plus N evenly-spaced other sitemap
# URLs. Useful when the sitemap has 800+ URLs. Anything else after BASE_URL
# is an error: a typo'd or non-numeric N used to fall through to a full crawl.
SAMPLE=0
if [ "$#" -gt 1 ]; then
  if [ "$#" -ne 3 ] || [ "$2" != "--sample" ]; then
    usage
  fi
  case "$3" in
    ''|*[!0-9]*|0*) usage ;;
  esac
  SAMPLE="$3"
fi

# Refuse the production apex before any curl. AGENTS.md: do not crawl
# mirai-shigoto.com from a script (platform mitigation can challenge the IP
# and break the GEO policy). pre.mirai-shigoto.com and other hosts are allowed.
# Set ALLOW_PROD=1 to opt in; that path prints a warning and continues.
request_host() {
  local rest host
  rest="${1#*://}"
  rest="${rest%%\?*}"
  rest="${rest%%#*}"
  rest="${rest%%/*}"
  host="${rest##*@}"
  host="${host%%:*}"
  # A fully-qualified `mirai-shigoto.com.` is the same host.
  while [ "${host%.}" != "$host" ]; do host="${host%.}"; done
  printf '%s' "$host" | tr '[:upper:]' '[:lower:]'
}

HOST=$(request_host "$BASE")
case "$HOST" in
  mirai-shigoto.com|www.mirai-shigoto.com)
    if [ "${ALLOW_PROD:-}" != "1" ]; then
      printf '%s\n' "seo-check: refusing production host ${HOST}. Crawling mirai-shigoto.com from this script can trip platform mitigation and break the GEO policy. Use https://pre.mirai-shigoto.com/ (bun run test:seo does this with --sample 5), or set ALLOW_PROD=1 to opt in." >&2
      exit 2
    fi
    printf '%s\n' "seo-check: warning: probing production host ${HOST} because ALLOW_PROD=1" >&2
    ;;
esac

# Map a sitemap loc onto BASE. Preview (and local) sitemaps advertise the
# production canonical host; requesting those locs would crawl production.
rewrite_onto_base() {
  local url rest path
  url="$1"
  case "$url" in
    *://*)
      rest="${url#*://}"
      case "$rest" in
        */*) path="/${rest#*/}" ;;
        *) path="/" ;;
      esac
      printf '%s%s\n' "$BASE" "$path"
      ;;
    /*)
      printf '%s%s\n' "$BASE" "$url"
      ;;
    *)
      printf '%s/%s\n' "$BASE" "$url"
      ;;
  esac
}

refuse_production_url() {
  local page_host
  page_host=$(request_host "$1")
  case "$page_host" in
    mirai-shigoto.com|www.mirai-shigoto.com)
      if [ "${ALLOW_PROD:-}" != "1" ]; then
        printf '%s\n' "seo-check: refusing production URL ${1}. Set ALLOW_PROD=1 to opt in." >&2
        exit 2
      fi
      ;;
  esac
}

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

# No -L: a redirect target is not rewritten onto BASE, so following it could
# crawl production. A 3xx surfaces as an HTTP status failure instead.
fetch_body()   { curl -fsS --max-time 12 -A "seo-check.sh/1.0" "$1" 2>/dev/null; }
fetch_header() { curl -fsSI --max-time 12 -A "seo-check.sh/1.0" "$1" 2>/dev/null; }

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
  URL_COUNT=$(grep -oE "<loc>" <<<"$SITEMAP" | wc -l | tr -d ' ')
  ok "$URL_COUNT URL(s) declared"
  # The site is Japanese-only (v1.4.0): pages carry ja + x-default hreflang
  # and the sitemap needs no alternates, so their absence is not a warning.
  HREFLANG_COUNT=$(grep -oE "hreflang=" <<<"$SITEMAP" | wc -l | tr -d ' ')
  note "$HREFLANG_COUNT hreflang alternate(s) in sitemap"
  URLS=$(grep -oE "<loc>[^<]+</loc>" <<<"$SITEMAP" | sed 's|<[^>]*>||g')
  if [ "$SAMPLE" -gt 0 ]; then
    # Always keep the home page (wherever it sits in the sitemap), then
    # evenly sample $SAMPLE of the other URLs. llms.txt / llms-full.txt are
    # checked in their own sections above.
    HOME_URLS=$(grep -E '^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+/?$' <<<"$URLS" | head -n 1)
    REST_URLS=$(grep -vE '^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+/?$' <<<"$URLS" || true)
    REST_TOTAL=$(grep -c . <<<"$REST_URLS" || true)
    if [ "$REST_TOTAL" -gt "$SAMPLE" ]; then
      STEP=$(( REST_TOTAL / SAMPLE ))
      REST_URLS=$(awk -v step="$STEP" '(NR - 1) % step == 0' <<<"$REST_URLS" | head -n "$SAMPLE")
    fi
    URLS=$(printf '%s\n%s' "$HOME_URLS" "$REST_URLS")
    note "sampling: home + $(grep -c . <<<"$REST_URLS" || true) of $REST_TOTAL other URLs"
  fi
  rewritten=""
  while IFS= read -r loc; do
    [ -z "$loc" ] && continue
    rewritten="${rewritten}$(rewrite_onto_base "$loc")"$'\n'
  done <<< "$URLS"
  URLS="$rewritten"
fi

# ---- llms.txt (GEO) ------------------------------------------------------

section "llms.txt (GEO)"
LLMS=$(fetch_body "$BASE/llms.txt")
if [ -z "$LLMS" ]; then
  warn "$BASE/llms.txt unreachable (emerging standard, optional)"
else
  SIZE=$(wc -c <<<"$LLMS" | tr -d ' ')
  ok "reachable (${SIZE} bytes)"
  for sect in "Key facts" "Pages" "Methodology" "FAQ" "How to cite" "Disclaimer"; do
    if grep -qi "$sect" <<<"$LLMS"; then
      ok "section: '$sect'"
    else
      warn "missing section: '$sect'"
    fi
  done
  # BibTeX block (citation hygiene — AI engines quote this verbatim)
  if grep -qi "@misc" <<<"$LLMS"; then
    ok "BibTeX citation block present"
  else
    warn "no BibTeX citation block (recommend for academic / journalistic citation)"
  fi
fi

# ---- llms-full.txt (extended GEO) ----------------------------------------

section "llms-full.txt (extended GEO)"
LLMSFULL=$(fetch_body "$BASE/llms-full.txt")
if [ -z "$LLMSFULL" ]; then
  warn "$BASE/llms-full.txt unreachable (extended GEO companion, optional)"
else
  SIZE=$(wc -c <<<"$LLMSFULL" | tr -d ' ')
  ok "reachable (${SIZE} bytes)"
  for sect in "methodology" "rubric" "Frequently asked questions" "How to cite" "Disclaimer"; do
    if grep -qi "$sect" <<<"$LLMSFULL"; then
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
    refuse_production_url "$URL"
    section "Page: $URL"
    HTML_RAW=$(fetch_body "$URL")
    HEADERS=$(fetch_header "$URL")

    if [ -z "$HTML_RAW" ]; then
      STATUS=$(echo "$HEADERS" | grep -oE "HTTP/[0-9.]+ [0-9]+" | tail -1 | awk '{print $2}')
      case "$STATUS" in
        3[0-9][0-9])
          LOCATION=$(echo "$HEADERS" | grep -i '^location:' | head -1 | sed 's/^[Ll]ocation: *//' | tr -d '\r')
          fail "HTTP $STATUS redirect to ${LOCATION:-?} (not followed)"
          ;;
        *) fail "page unreachable" ;;
      esac
      continue
    fi

    # Non-HTML resources (e.g. /llms.txt, /llms-full.txt, /data.json):
    # only verify HTTP 200 and skip HTML/meta/schema checks.
    case "$URL" in
      *.txt|*.json|*.xml)
        STATUS=$(echo "$HEADERS" | grep -oE "HTTP/[0-9.]+ [0-9]+" | tail -1 | awk '{print $2}')
        [ "$STATUS" = "200" ] && ok "HTTP $STATUS (non-HTML resource — skipping page-level checks)" || fail "HTTP $STATUS"
        continue
        ;;
    esac

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

    # hreflang: the site is Japanese-only (no English UI since v1.4.0), so
    # every page declares ja + x-default. An `en` alternate is not expected.
    HAS_JA=$(grep -cE 'hreflang="ja"' <<<"$HTML" || true)
    HAS_XD=$(grep -cE 'hreflang="x-default"' <<<"$HTML" || true)
    if [ "$HAS_JA" -ge 1 ] && [ "$HAS_XD" -ge 1 ]; then
      ok "hreflang: ja + x-default"
    elif [ "$HAS_JA" -ge 1 ] || [ "$HAS_XD" -ge 1 ]; then
      warn "hreflang: expected both ja and x-default"
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

      # Page-specific schema expectations (the high-impact GEO additions):
      # home page  → Organization + WebSite + Dataset + ItemList + FAQPage + SpeakableSpecification
      # /privacy   → WebPage + BreadcrumbList + SpeakableSpecification
      case "$URL" in
        */ja/[0-9]*|*/en/[0-9]*|*/occ/*)
          # Real occupation pages live at /ja/<id> and /en/<id> (Stage 1
          # numeric-id scheme). The legacy /occ/* match is kept so this
          # check still works against archived snapshots / old sitemaps.
          for st in WebPage Occupation BreadcrumbList; do
            if printf '%s' "$TYPES" | grep -qw "$st"; then
              ok "schema: $st"
            else
              warn "schema missing: $st (occupation page should have it)"
            fi
          done
          if grep -qE 'shigoto\.mhlw\.go\.jp/User/Occupation/Detail/' <<<"$HTML"; then
            ok "sameAs links to canonical MHLW jobtag URL"
          else
            warn "sameAs to MHLW jobtag URL missing"
          fi
          ;;
        */about*)
          for st in WebPage BreadcrumbList; do
            if printf '%s' "$TYPES" | grep -qw "$st"; then
              ok "schema: $st"
            else
              warn "schema missing: $st (about page should have it)"
            fi
          done
          ;;
        */privacy*)
          for st in WebPage BreadcrumbList SpeakableSpecification; do
            if printf '%s' "$TYPES" | grep -qw "$st"; then
              ok "schema: $st"
            else
              warn "schema missing: $st (privacy page should have it)"
            fi
          done
          ;;
        */|"$BASE")
          for st in Organization WebSite Dataset ItemList FAQPage SpeakableSpecification; do
            if printf '%s' "$TYPES" | grep -qw "$st"; then
              ok "schema: $st"
            else
              warn "schema missing: $st (home page should have it)"
            fi
          done
          ;;
      esac
    else
      fail "no Schema.org JSON-LD"
    fi

    # Performance hints — dns-prefetch + preconnect for analytics origins
    # (warms TCP/TLS while HTML parses; ~150–250ms saved on first beacon).
    PREFETCH=$(grep -oE 'rel="dns-prefetch"' <<<"$HTML" | wc -l | tr -d ' ')
    PRECONNECT=$(grep -oE 'rel="preconnect"' <<<"$HTML" | wc -l | tr -d ' ')
    if [ "$PREFETCH" -ge 1 ] && [ "$PRECONNECT" -ge 1 ]; then
      ok "perf hints: ${PREFETCH} dns-prefetch + ${PRECONNECT} preconnect"
    else
      warn "no dns-prefetch / preconnect (analytics origins should warm TCP/TLS)"
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
