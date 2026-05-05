#!/usr/bin/env python3
"""
build_occupations.py — generate 1112 static per-occupation pages.

  ja/<id>.html (556 JA-only pages)  +  en/<id>.html (556 EN-only pages)

Each page is single-language (no in-page toggle). JA and EN pages are linked
via canonical + hreflang and a visible top-right language switch. Each page
includes a "Related occupations" block (5 entries) for SEO link equity and
reader navigation: 3 same-risk-band peers + 2 ID-neighbors.

URLs are pure-numeric — /ja/<id> and /en/<id>. The previous slug-based URLs
(/occ/<id>-<slug>) are 301-redirected to /ja/<id> via vercel.json.

Output:
  ja/<id>.html              e.g. ja/428.html
  en/<id>.html              e.g. en/428.html
  scripts/.occ_manifest.json  (id, ja_url, en_url, ai_risk, ...)
  sitemap.xml                rewritten with 1112 occ URLs + 4 site URLs

Usage:
  python3 scripts/build_occupations.py                    # all 552 (×2 langs)
  python3 scripts/build_occupations.py --limit 3
  python3 scripts/build_occupations.py --ids 428,33,1
"""
from __future__ import annotations
import argparse
import json
import re
from html import escape
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA_PATH = REPO / "dist" / "data.detail"  # v1.0.8: per-occupation files (was REPO/data.json)
PROFILE5_PATH = REPO / "dist" / "data.profile5.json"
TRANSFER_PATHS_PATH = REPO / "dist" / "data.transfer_paths.json"

# Module-level caches populated by main() — used by render helpers (avoid threading
# them through every helper signature). Reset each main() call.
PROFILE5: dict = {}
TRANSFER_PATHS: dict = {}
NAME_LOOKUP: dict = {}  # id (int) -> (name_ja, name_en)
OUT_DIR_JA = REPO / "ja"
OUT_DIR_EN = REPO / "en"
MANIFEST_PATH = REPO / "scripts" / ".occ_manifest.json"
SITEMAP_PATH = REPO / "sitemap.xml"
DATE_PUBLISHED = "2026-04-25"
DATE_MODIFIED = "2026-04-30"
RELATED_COUNT = 5


def _load_profile5() -> dict:
    """Returns {id_str: {creative, social, judgment, physical, routine}} (values 0-100)."""
    if not PROFILE5_PATH.exists():
        return {}
    return json.loads(PROFILE5_PATH.read_text(encoding="utf-8")).get("profiles", {})


def _load_transfer_paths() -> dict:
    """Returns {id_str: {source_id, candidates: [{id, title_ja, ai_risk, similarity, sector_id}, ...]}}."""
    if not TRANSFER_PATHS_PATH.exists():
        return {}
    return json.loads(TRANSFER_PATHS_PATH.read_text(encoding="utf-8")).get("paths", {})


def _load_legacy_shape_corpus() -> list[dict]:
    """Read dist/data.detail/<padded>.json × N → list of legacy-shape dicts.

    Adapter introduced in v1.0.8 (Phase 3): the IPD pipeline's DetailProjectionSchema
    nests stats / ai_risk / title; the legacy data.json shape this file expected was
    flat. We translate at load time so all ~900 lines of render_html / pick_related
    code stay unchanged.

    Fields produced:
        id, name_ja, name_en, desc_ja, desc_en,
        salary, workers, hours, age, recruit_wage, recruit_ratio, hourly_wage,
        ai_risk, ai_rationale_ja, ai_rationale_en, url
    """
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"dist/data.detail/ not found. Run `npm run build:data` first.\n"
            f"  expected: {DATA_PATH}"
        )
    out: list[dict] = []
    for f in sorted(DATA_PATH.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        stats = d.get("stats") or {}
        ai = d.get("ai_risk") or {}
        out.append({
            "id": d["id"],
            "name_ja": d["title"]["ja"],
            "name_en": d["title"].get("en"),
            "desc_ja": d["description"].get("summary_ja"),
            "desc_en": d["description"].get("summary_en"),
            "what_it_is_ja":         d["description"].get("what_it_is_ja"),
            "what_it_is_en":         d["description"].get("what_it_is_en"),
            "how_to_become_ja":      d["description"].get("how_to_become_ja"),
            "how_to_become_en":      d["description"].get("how_to_become_en"),
            "working_conditions_ja": d["description"].get("working_conditions_ja"),
            "working_conditions_en": d["description"].get("working_conditions_en"),
            "salary": stats.get("salary_man_yen"),
            "workers": stats.get("workers"),
            "hours": stats.get("monthly_hours"),
            "age": stats.get("average_age"),
            "recruit_wage": stats.get("recruit_wage_man_yen"),
            "recruit_ratio": stats.get("recruit_ratio"),
            "hourly_wage": None,  # legacy field not carried in IPD
            "ai_risk": ai.get("score"),
            "ai_rationale_ja": ai.get("rationale_ja"),
            "ai_rationale_en": ai.get("rationale_en"),
            "url": d.get("url") or f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{d['id']}",
            # v1.2.0 schema-1.1 rich fields (Push 1: integrate into desktop detail).
            "aliases_ja":     (d.get("title") or {}).get("aliases_ja", []),
            "aliases_en":     (d.get("title") or {}).get("aliases_en", []),
            "classifications": d.get("classifications", {}),
            "sector":          d.get("sector"),                  # {id, ja, en, hue, provenance}
            "risk_band":       d.get("risk_band"),               # "low" / "mid" / "high"
            "workforce_band":  d.get("workforce_band"),
            "demand_band":     d.get("demand_band"),
            "ai_model":        ai.get("model"),
            "ai_scored_at":    ai.get("scored_at"),
            "skills_top10":    d.get("skills_top10", []),        # [{key, label_ja, label_en, score}]
            "knowledge_top5":  d.get("knowledge_top5", []),
            "abilities_top5":  d.get("abilities_top5", []),
            "tasks_count":     d.get("tasks_count"),
            "tasks_lead_ja":   d.get("tasks_lead_ja"),
            "related_orgs":    d.get("related_orgs", []),        # [{name_ja, url}]
            "related_certs_ja": d.get("related_certs_ja", []),
            "data_source_versions": d.get("data_source_versions", {}),
        })
    return out


def fmt_int(n) -> str:
    if n is None:
        return "—"
    return f"{int(n):,}"


def _format_paragraphs(text: str) -> str:
    """Split long-form text into <p> blocks.

    MHLW source uses a mix of '\\n\\n', '\\n　' (Japanese full-width-space indent),
    or single '\\n' between logical paragraphs. We normalize all of them and emit
    one escaped <p> per non-empty chunk so the page reads as multi-paragraph
    rather than a single wall of text.
    """
    if not text:
        return ""
    # Normalize: collapse '\n　' (newline + indent marker) into '\n\n', then split.
    normalized = text.replace("\n　", "\n\n").replace("\r\n", "\n")
    chunks = [c.strip() for c in re.split(r"\n\s*\n+", normalized) if c.strip()]
    if not chunks:
        # Fall back: single line — still wrap in <p>
        return f"<p>{escape(text.strip())}</p>"
    return "\n        ".join(f"<p>{escape(c)}</p>" for c in chunks)


def ja_url(id_: int) -> str:
    return f"https://mirai-shigoto.com/ja/{id_}"


def en_url(id_: int) -> str:
    return f"https://mirai-shigoto.com/en/{id_}"


def pick_related(rec: dict, all_records: list[dict], count: int = RELATED_COUNT) -> list[dict]:
    """Pick {count} related occupations.

    Strategy: prefer same risk band (±1), then fill with ID-neighbors so every
    page links to a deterministic, content-relevant set. Ordering is stable
    (no randomness) so identical input → identical output.
    """
    rid = rec["id"]
    risk = rec.get("ai_risk")

    chosen: list[dict] = []
    chosen_ids: set[int] = set()

    if risk is not None:
        same_band = [
            r
            for r in all_records
            if r["id"] != rid
            and r.get("ai_risk") is not None
            and abs(r["ai_risk"] - risk) <= 1
        ]
        same_band.sort(key=lambda r: (abs(r["ai_risk"] - risk), abs(r["id"] - rid), r["id"]))
        for r in same_band:
            if len(chosen) >= 3:
                break
            chosen.append(r)
            chosen_ids.add(r["id"])

    neighbors = sorted(
        [r for r in all_records if r["id"] != rid and r["id"] not in chosen_ids],
        key=lambda r: (abs(r["id"] - rid), r["id"]),
    )
    for r in neighbors:
        if len(chosen) >= count:
            break
        chosen.append(r)
        chosen_ids.add(r["id"])

    return chosen[:count]


# ════════════════════ v1.2.0 schema-1.1 rich section renderers ════════════════════
# All return "" if the underlying data is missing — sections degrade gracefully.

def _band_label(field: str, band: str | None, lang: str) -> str | None:
    """Map (band_field, value) → user-facing label.

    Disambiguates because risk_band and workforce_band both use "mid" as a value.
    field ∈ {"risk_band", "workforce_band", "demand_band"}.
    """
    if not band:
        return None
    labels = {
        "risk_band": {
            "ja": {"low": "AI 影響 低", "mid": "AI 影響 中", "high": "AI 影響 高"},
            "en": {"low": "Low AI risk", "mid": "Mid AI risk", "high": "High AI risk"},
        },
        "workforce_band": {
            "ja": {"small": "規模 小", "mid": "規模 中", "medium": "規模 中", "large": "規模 大"},
            "en": {"small": "Small workforce", "mid": "Medium workforce", "medium": "Medium workforce", "large": "Large workforce"},
        },
        "demand_band": {
            "ja": {"cool": "需要 安定", "warm": "需要 旺盛", "hot": "需要 過熱"},
            "en": {"cool": "Steady demand", "warm": "Active demand", "hot": "Hot demand"},
        },
    }
    return labels.get(field, {}).get(lang, {}).get(band)


def _band_class(field: str, band: str | None) -> str:
    """Band CSS class — maps each field's bands to one of band-{low,mid,high}.

    risk_band → low/mid/high directly. workforce_band: small→low, mid/medium→mid, large→high.
    demand_band: cool→low, warm→mid, hot→high (visual intensity escalation).
    """
    if not band:
        return ""
    if field == "risk_band":
        return f"band-{band}"
    if field == "workforce_band":
        return {"small": "band-low", "mid": "band-mid", "medium": "band-mid", "large": "band-high"}.get(band, "")
    if field == "demand_band":
        return {"cool": "band-low", "warm": "band-mid", "hot": "band-high"}.get(band, "")
    return ""


def _render_meta_row(rec: dict, lang: str) -> str:
    """Sector chip + risk/workforce/demand band badges, shown right under H1."""
    parts = []
    sector = rec.get("sector") or {}
    sector_name = (sector.get("en") if lang == "en" else sector.get("ja")) or ""
    if sector_name:
        # link to dedicated sector hub page; gives every detail page an internal
        # link into the 16 hub-page graph (build_sector_hubs.py).
        sector_href = f"/{lang}/sectors/{sector.get('id')}"
        parts.append(
            f'<a class="sector-chip" href="{escape(sector_href)}">{escape(sector_name)}</a>'
        )
    for b_field in ("risk_band", "workforce_band", "demand_band"):
        b = rec.get(b_field)
        label = _band_label(b_field, b, lang)
        if label:
            parts.append(f'<span class="band {_band_class(b_field, b)}">{escape(label)}</span>')
    if not parts:
        return ""
    return f'<div class="meta-row">{"".join(parts)}</div>'


def _render_profile_radar(rec: dict, lang: str) -> str:
    """5-axis profile radar SVG (data from data.profile5.json indexed by id_str).

    Algorithm copied from scripts/templates/mobile/detail.py to ensure visual parity.
    Returns "" if profile data is unavailable for this occupation.
    """
    import math
    profile = PROFILE5.get(str(rec["id"]))
    if not profile:
        return ""
    axes = ["creative", "social", "judgment", "physical", "routine"]
    values = [profile.get(a) or 0 for a in axes]
    if not any(values):
        return ""
    labels_map = {
        "ja": ["創造性", "対人", "判断", "身体", "定型"],
        "en": ["Creative", "Social", "Judgment", "Physical", "Routine"],
    }
    labels = labels_map.get(lang, labels_map["ja"])

    cx, cy, r = 170, 170, 130
    pts = []
    for i, v in enumerate(values):
        ang = math.radians(-90 + i * 72)
        scale = (v or 0) / 100
        x = cx + math.cos(ang) * r * scale
        y = cy + math.sin(ang) * r * scale
        pts.append(f"{x:.1f},{y:.1f}")

    grid_layers = ""
    for level in (0.25, 0.5, 0.75, 1.0):
        layer_pts = []
        for i in range(5):
            ang = math.radians(-90 + i * 72)
            x = cx + math.cos(ang) * r * level
            y = cy + math.sin(ang) * r * level
            layer_pts.append(f"{x:.1f},{y:.1f}")
        grid_layers += (
            f'<polygon points="{" ".join(layer_pts)}" fill="none" '
            f'stroke="rgba(36,30,24,0.10)" stroke-width="1"/>'
        )

    label_html = ""
    for i, lab in enumerate(labels):
        ang = math.radians(-90 + i * 72)
        lx = cx + math.cos(ang) * (r + 22)
        ly = cy + math.sin(ang) * (r + 22)
        label_html += (
            f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
            f'dominant-baseline="middle" font-size="13" '
            f'font-family="Plus Jakarta Sans, sans-serif" font-weight="600" '
            f'fill="#7A6F5E" letter-spacing="0.04em">{escape(lab)}</text>'
        )

    legend_html = "".join(
        f'<dt>{escape(labels[i])}</dt><dd>{int(values[i])}</dd>'
        for i in range(5)
    )

    h2 = "5 次元プロファイル" if lang == "ja" else "5-Dimension Profile"
    return (
        f'<section class="profile" aria-label="{escape(h2)}">'
        f'<h2>{escape(h2)}</h2>'
        f'<div class="radar-wrap">'
        f'<svg class="radar-svg" viewBox="0 0 340 340" role="img" aria-label="{escape(h2)}">'
        f'{grid_layers}'
        f'<polygon points="{" ".join(pts)}" '
        f'fill="rgba(217,107,61,0.18)" stroke="#D96B3D" stroke-width="2.5" stroke-linejoin="round"/>'
        f'{label_html}'
        f'</svg>'
        f'<dl class="radar-legend">{legend_html}</dl>'
        f'</div>'
        f'</section>'
    )


def _render_topn(rec: dict, lang: str) -> str:
    """Top-N skills (10) / knowledge (5) / abilities (5) panels."""
    skills = rec.get("skills_top10") or []
    knowledge = rec.get("knowledge_top5") or []
    abilities = rec.get("abilities_top5") or []
    if not (skills or knowledge or abilities):
        return ""
    label_key = "label_en" if lang == "en" else "label_ja"

    def _block(title: str, items: list[dict]) -> str:
        if not items:
            return ""
        lis = "".join(
            f'<li><span class="topn-name">{escape(it.get(label_key) or it.get("label_ja") or "")}</span>'
            f'<span class="topn-score">{it.get("score", 0):.1f}</span></li>'
            for it in items
        )
        return f'<div class="topn-block"><h3>{escape(title)}</h3><ol>{lis}</ol></div>'

    if lang == "ja":
        h2 = "必要なスキル・知識・能力"
        t_skills, t_knowledge, t_abilities = "スキル Top 10", "知識 Top 5", "能力 Top 5"
    else:
        h2 = "Required Skills, Knowledge & Abilities"
        t_skills, t_knowledge, t_abilities = "Top 10 Skills", "Top 5 Knowledge", "Top 5 Abilities"

    body = (
        _block(t_skills, skills)
        + _block(t_knowledge, knowledge)
        + _block(t_abilities, abilities)
    )
    return (
        f'<section class="topn" aria-label="{escape(h2)}">'
        f'<h2>{escape(h2)}</h2>'
        f'<div class="topn-grid">{body}</div>'
        f'</section>'
    )


def _render_transfer(rec: dict, lang: str) -> str:
    """Career-change candidates from data.transfer_paths (top 3).

    Replaces the legacy "same risk-band 5" related-occupations list when
    transfer paths data exists; the legacy `related` section is rendered
    only as fallback.
    """
    path = TRANSFER_PATHS.get(str(rec["id"]))
    if not path:
        return ""
    candidates = (path.get("candidates") or [])[:3]
    if not candidates:
        return ""

    cards = ""
    for c in candidates:
        cid = c["id"]
        # Look up name in this language; fall back to JA.
        name_ja, name_en = NAME_LOOKUP.get(cid, (None, None))
        name = (name_en if lang == "en" else name_ja) or name_ja or c.get("title_ja") or "?"
        href = (f"/en/{cid}" if lang == "en" else f"/ja/{cid}")
        risk = c.get("ai_risk")
        sim = c.get("similarity")
        risk_str = f"{risk}/10" if risk is not None else "—"
        if lang == "ja":
            risk_label = f"AI 影響 {risk_str}"
            sim_label = f"類似度 {sim:.0%}" if sim is not None else ""
        else:
            risk_label = f"AI {risk_str}"
            sim_label = f"similarity {sim:.0%}" if sim is not None else ""
        sim_html = f'<span class="tc-similarity">{escape(sim_label)}</span>' if sim_label else ""
        cards += (
            f'<a class="transfer-card" href="{href}">'
            f'<span class="tc-name">{escape(name)}</span>'
            f'<span class="tc-meta"><span class="tc-risk">{escape(risk_label)}</span>{sim_html}</span>'
            f'</a>'
        )

    h2 = "似た仕事 / キャリア転換の候補" if lang == "ja" else "Similar work / Career transitions"
    return (
        f'<section class="transfer" aria-label="{escape(h2)}">'
        f'<h2>{escape(h2)}</h2>'
        f'<div class="transfer-grid">{cards}</div>'
        f'</section>'
    )


def _render_orgs_certs(rec: dict, lang: str) -> str:
    """Industry organizations + certifications side-by-side."""
    orgs = rec.get("related_orgs") or []
    certs = rec.get("related_certs_ja") or []
    if not (orgs or certs):
        return ""

    if lang == "ja":
        h_orgs, h_certs = "関連業界団体", "関連資格"
    else:
        h_orgs, h_certs = "Industry Organizations", "Related Certifications"

    org_block = ""
    if orgs:
        items = "".join(
            f'<li><a href="{escape(o.get("url") or "#")}" rel="external" target="_blank">'
            f'{escape(o.get("name_ja") or "")}</a></li>'
            for o in orgs if o.get("name_ja")
        )
        org_block = f'<div class="org-cert-block"><h3>{escape(h_orgs)}</h3><ul class="org-list">{items}</ul></div>'

    cert_block = ""
    if certs:
        items = "".join(f'<li>{escape(c)}</li>' for c in certs)
        cert_block = f'<div class="org-cert-block"><h3>{escape(h_certs)}</h3><ul class="cert-list">{items}</ul></div>'

    return (
        f'<section class="orgs-certs">'
        f'<div class="org-cert-grid">{org_block}{cert_block}</div>'
        f'</section>'
    )


def _render_provenance(rec: dict, lang: str) -> str:
    """Compact provenance footnote: AI model, scored_at, IPD versions."""
    model = rec.get("ai_model")
    scored_at = rec.get("ai_scored_at")
    dsv = rec.get("data_source_versions") or {}
    ipd_num = dsv.get("ipd_numeric")
    ipd_desc = dsv.get("ipd_description")
    bits = []
    if model and scored_at:
        if lang == "ja":
            bits.append(f"AI 影響度 — モデル <code>{escape(model)}</code> · スコア取得 <code>{escape(scored_at[:10])}</code>")
        else:
            bits.append(f"AI impact — model <code>{escape(model)}</code> · scored on <code>{escape(scored_at[:10])}</code>")
    if ipd_num or ipd_desc:
        v = ipd_num or ipd_desc
        if lang == "ja":
            bits.append(f"データ — 厚労省 / JILPT IPD <code>{escape(v)}</code>")
        else:
            bits.append(f"Data — MHLW / JILPT IPD <code>{escape(v)}</code>")
    if not bits:
        return ""
    return f'<p class="provenance">{" · ".join(bits)}</p>'


def render_jsonld(rec: dict, lang: str) -> str:
    """Render Schema.org JSON-LD for one language version of an occupation page."""
    id_ = rec["id"]
    name_ja = rec.get("name_ja") or ""
    name_en = rec.get("name_en") or ""
    risk = rec.get("ai_risk")
    rationale_en = rec.get("ai_rationale_en") or ""
    rationale_ja = rec.get("ai_rationale_ja") or ""
    desc_en = rec.get("desc_en") or ""
    desc_ja = rec.get("desc_ja") or ""
    # Audit CODE-004: keep None as None instead of `or 0` so SEO meta
    # descriptions never claim "平均年収 0万円 / 平均年齢 0" for occupations
    # where MHLW jobtag returned no value. Display sites below substitute
    # explicit "—" / "データなし" / "Data unavailable" via the `_disp` helpers.
    # The Schema.org JSON-LD truthy filters (`if salary_man:` etc.) already
    # correctly omit absent properties — None and 0 both fall through.
    salary_man = rec.get("salary")
    workers = rec.get("workers")
    age = rec.get("age")
    hours = rec.get("hours")
    recruit = rec.get("recruit_ratio")
    hourly = rec.get("hourly_wage")
    mhlw_url = rec.get("url") or f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{id_}"

    canonical = ja_url(id_) if lang == "ja" else en_url(id_)

    if lang == "ja":
        # v1.2.0 Direction C convergence: strict per-language pages, no cross-language bleed.
        page_name = (
            f"{name_ja} — AI 影響 {risk}/10"
            if risk is not None
            else f"{name_ja} — mirai-shigoto.com"
        )
        page_desc = rationale_ja or desc_ja or name_ja
        breadcrumb_root = "日本の職業 AI 影響マップ"
        breadcrumb_self = name_ja
        home_url = "https://mirai-shigoto.com/"
    else:
        page_name = (
            f"{(name_en or name_ja)} — AI Impact {risk}/10"
            if risk is not None
            else f"{name_en or name_ja} — mirai-shigoto.com"
        )
        page_desc = rationale_en or desc_en or name_en or name_ja
        breadcrumb_root = "Japan Jobs × AI Impact Map"
        breadcrumb_self = name_en or name_ja
        home_url = "https://mirai-shigoto.com/?lang=en"

    additional = []
    if risk is not None:
        additional.append(
            {
                "@type": "PropertyValue",
                "name": "AI risk score (0-10)",
                "value": risk,
                "description": "Independent LLM estimate by Claude Opus 4.7. Reflects task-level exposure, not probability of job loss.",
            }
        )
    if workers:
        additional.append({"@type": "PropertyValue", "name": "Workforce size", "value": workers, "unitText": "persons"})
    if age:
        additional.append({"@type": "PropertyValue", "name": "Average age", "value": age, "unitText": "years"})
    if hours:
        additional.append({"@type": "PropertyValue", "name": "Monthly working hours", "value": hours, "unitText": "hours"})
    if recruit is not None:
        additional.append({"@type": "PropertyValue", "name": "Effective recruit ratio", "value": recruit})
    if hourly:
        additional.append({"@type": "PropertyValue", "name": "Hourly wage", "value": hourly, "unitText": "JPY/hour"})

    occupation_node = {
        "@type": "Occupation",
        "@id": f"{canonical}#occupation",
        "name": name_ja,
        "description": rationale_en or desc_en or rationale_ja or desc_ja or name_ja,
        "occupationLocation": {"@type": "Country", "name": "Japan"},
        "occupationalCategory": str(id_),
        "sameAs": mhlw_url,
        "additionalProperty": additional,
        "isPartOf": {"@id": "https://mirai-shigoto.com/#dataset"},
    }
    # v1.2.0 schema-1.1 enrichment: alternateName aggregates JA/EN names + aliases.
    alt_names = []
    if name_en and name_en != name_ja:
        alt_names.append(name_en)
    alt_names.extend(rec.get("aliases_ja") or [])
    alt_names.extend(rec.get("aliases_en") or [])
    if alt_names:
        # Schema.org alternateName accepts string or array; use array for multi.
        occupation_node["alternateName"] = alt_names if len(alt_names) > 1 else alt_names[0]
    # Industry / sector → Schema.org "industry"
    sector = rec.get("sector") or {}
    if sector.get("ja") or sector.get("en"):
        occupation_node["industry"] = sector.get("en") or sector.get("ja")
    # MHLW classifications → occupationalCategory (replace bare id with codes if present)
    cls = rec.get("classifications") or {}
    if cls.get("mhlw_main") or cls.get("jsoc_main"):
        occupation_node["occupationalCategory"] = (
            cls.get("mhlw_main") or cls.get("jsoc_main") or str(id_)
        )
    # Top skills → Schema.org "skills" (string list)
    skills_top10 = rec.get("skills_top10") or []
    if skills_top10:
        occupation_node["skills"] = [
            s.get("label_en") or s.get("label_ja") for s in skills_top10
            if (s.get("label_en") or s.get("label_ja"))
        ]
    # Required certifications (Japanese names; informational)
    certs = rec.get("related_certs_ja") or []
    if certs:
        occupation_node["qualifications"] = certs
    if salary_man:
        occupation_node["estimatedSalary"] = {
            "@type": "MonetaryAmountDistribution",
            "name": "Annual salary (estimated mean from MHLW jobtag)",
            "currency": "JPY",
            "duration": "P1Y",
            "median": int(salary_man * 10000),
        }

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": f"{canonical}#webpage",
                "url": canonical,
                "name": page_name,
                "description": page_desc,
                "isPartOf": {"@id": "https://mirai-shigoto.com/#website"},
                "about": {"@id": f"{canonical}#occupation"},
                "mainEntity": {"@id": f"{canonical}#occupation"},
                "primaryImageOfPage": f"https://mirai-shigoto.com/api/og?id={id_}&lang={lang}",
                "inLanguage": lang,
                "breadcrumb": {"@id": f"{canonical}#breadcrumb"},
                "datePublished": DATE_PUBLISHED,
                "dateModified": DATE_MODIFIED,
                "publisher": {"@id": "https://mirai-shigoto.com/#organization"},
                "author": {"@id": "https://mirai-shigoto.com/#organization"},
            },
            occupation_node,
            {
                "@type": "BreadcrumbList",
                "@id": f"{canonical}#breadcrumb",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": breadcrumb_root, "item": home_url},
                    {"@type": "ListItem", "position": 2, "name": breadcrumb_self, "item": canonical},
                ],
            },
        ],
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


CSS_BLOCK = """
      *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
      /* Direction C: Warm Editorial — synced from styles/mobile-tokens.css. v1.2.0 PC convergence. */
      :root{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10);--font-serif:"Noto Serif JP","Source Serif Pro",Georgia,serif;--font-sans:"Plus Jakarta Sans","Hiragino Sans",-apple-system,BlinkMacSystemFont,"Yu Gothic UI","Segoe UI",Roboto,sans-serif}
      html,body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);-webkit-font-smoothing:antialiased;line-height:1.6}
      h1,h2,h3{font-family:var(--font-serif);font-weight:600;letter-spacing:-0.005em}
      a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
      .skip-link{position:absolute;left:-9999px}.skip-link:focus{position:static;background:var(--accent);color:#000;padding:8px}
      .top-banner{background:var(--bg2);border-bottom:1px solid var(--border);padding:8px 16px;font-size:0.78rem;color:var(--fg2);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .top-banner .badge{background:#ff8a3d;color:#000;font-weight:700;padding:2px 8px;border-radius:4px;font-size:0.7rem;letter-spacing:0.04em}
      #wrapper{max-width:780px;margin:0 auto;padding:24px 24px 80px}
      /* Breadcrumb — make the parent link obviously clickable (terracotta accent
         + hover underline + back-arrow chevron via ::before). v1.2.x feedback. */
      nav.crumb{font-size:0.85rem;color:var(--fg2);margin-bottom:18px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      nav.crumb a{color:var(--accent);font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:var(--bg3);border:1px solid var(--border);transition:background 150ms ease,border-color 150ms ease}
      nav.crumb a::before{content:"←";font-size:0.92em;line-height:1}
      nav.crumb a:hover{background:rgba(217,107,61,0.10);border-color:var(--accent);text-decoration:none}
      nav.crumb a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      nav.crumb > span[aria-hidden]{color:var(--fg3)}
      nav.crumb > span:not([aria-hidden]){color:var(--fg);font-weight:500}
      h1{font-size:clamp(1.4rem,1rem+1.6vw,2rem);font-weight:700;letter-spacing:-0.01em;margin-bottom:6px}
      h1 .accent{color:var(--accent);font-style:italic}
      h1 .h1-sub{font-size:0.7em;color:var(--fg2);font-weight:500;margin-left:8px}
      .lang-switch{display:inline-block;font-size:0.78rem;margin-left:8px;vertical-align:middle}
      .lang-switch a{border:1px solid var(--border);color:var(--fg2);padding:3px 9px;border-radius:999px}
      .lang-switch a:hover{border-color:var(--accent);color:var(--accent);text-decoration:none}
      .risk-card{display:flex;align-items:center;gap:18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 22px;margin:18px 0 22px}
      .risk-num{font-size:clamp(2.4rem,1.8rem+2vw,3.4rem);font-weight:800;line-height:1;letter-spacing:-0.02em}
      .risk-num small{font-size:0.4em;color:var(--fg2);font-weight:500;margin-left:4px}
      .risk-label{font-size:0.85rem;color:var(--fg2);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em}
      .risk-rationale{flex:1;font-size:0.95rem;color:var(--fg)}
      .risk-0,.risk-1,.risk-2{color:#7ddc7d}.risk-3,.risk-4{color:#a8d572}
      .risk-5,.risk-6{color:#ffd84d}.risk-7,.risk-8{color:#ff8a3d}.risk-9,.risk-10{color:#ff5050}
      dl.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 18px;margin:20px 0;padding:16px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px}
      dl.stats dt{font-size:0.72rem;color:var(--fg2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px}
      dl.stats dd{font-size:1.05rem;font-weight:600}
      section.context,section.sources,section.related,section.how-to-become,section.working-conditions{margin-top:28px}
      section h2{font-size:1.05rem;margin-bottom:10px;color:var(--accent)}
      section p{color:var(--fg);margin-bottom:8px}
      section ul{list-style:none;padding:0}section li{margin-bottom:6px;font-size:0.92rem}
      section.related ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 12px}
      section.related li{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;align-items:baseline;margin:0}
      section.related li:hover{border-color:var(--accent)}
      section.related .r-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      section.related .r-risk{font-size:0.78rem;color:var(--fg2);font-variant-numeric:tabular-nums}
      .disclaimer{margin-top:32px;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--fg2);font-size:0.82rem;line-height:1.6}
      .disclaimer strong{color:#ff8a3d}
      footer{margin-top:24px;padding:22px 0;border-top:1px solid var(--border);font-size:0.78rem;color:var(--fg2);text-align:center}
      footer .footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin-bottom:14px}
      footer .footer-links a{color:var(--fg2);text-decoration:none;padding:5px 14px;border:1px solid var(--border);border-radius:999px;font-size:0.78rem;line-height:1.2;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
      footer .footer-links a:hover{color:var(--accent);border-color:var(--accent);background:rgba(217,107,61,0.06);text-decoration:none}
      footer .footer-meta{color:var(--fg2);font-size:0.7rem;line-height:1.55;opacity:0.92}
      footer .footer-meta a{color:var(--accent)}
      /* Stage 1: Follow + Share footer block (visual layering — follow prominent, share small) */
      .follow-share-section{margin:48px auto 8px;text-align:center}
      .follow-block{margin-bottom:28px}
      .follow-cta{display:inline-flex;align-items:center;gap:14px;padding:14px 26px;background:var(--accent);color:#1a1206;border-radius:10px;text-decoration:none;font:inherit;transition:filter 150ms ease,transform 100ms ease;max-width:100%}
      .follow-cta:hover{filter:brightness(1.05);text-decoration:none}
      .follow-cta:active{transform:translateY(1px)}
      .follow-cta:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .follow-cta .follow-icon{font-size:1.5rem;line-height:1}
      .follow-cta .follow-text{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}
      .follow-cta .follow-text strong{font-size:1.02rem;font-weight:700;color:#1a1206}
      .follow-cta .follow-text small{font-size:0.78rem;opacity:0.8;font-weight:500}
      .share-divider{font-size:0.74rem;color:var(--fg2);letter-spacing:0.08em;text-transform:uppercase;margin:0 auto 14px;max-width:480px;display:flex;align-items:center;gap:12px}
      .share-divider::before,.share-divider::after{content:"";flex:1;height:1px;background:var(--border)}
      .share-row{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin:0}
      .share-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--bg2);color:var(--fg2);border:1px solid var(--border);border-radius:999px;cursor:pointer;font-family:inherit;text-decoration:none;transition:color 150ms ease,background 150ms ease,border-color 150ms ease}
      .share-btn:hover{color:#fff;border-color:transparent;text-decoration:none}
      .share-btn[data-platform="x"]:hover{background:#000}
      .share-btn[data-platform="line"]:hover{background:#06C755}
      .share-btn[data-platform="hatena"]:hover{background:#00A4DE}
      .share-btn[data-platform="linkedin"]:hover{background:#0A66C2}
      .share-btn[data-platform="facebook"]:hover{background:#1877F2}
      .share-btn[data-platform="copy"]:hover,.share-btn[data-platform="native"]:hover{background:var(--accent);color:#1a1206}
      .share-btn svg{width:16px;height:16px;fill:currentColor}
      .share-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .share-toast{font-size:0.78rem;color:var(--accent);margin-left:6px;opacity:0;transition:opacity 200ms ease}
      .share-toast.visible{opacity:1}
      @media (max-width:540px){.share-btn{width:36px;height:36px}.follow-cta{padding:12px 20px;gap:10px}.follow-cta .follow-text strong{font-size:0.95rem}.follow-cta .follow-text small{font-size:0.72rem}}
      /* Direction C single-theme: prefers-color-scheme + data-theme all resolve to warm cream. */
      @media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10)}}
      :root[data-theme="light"],:root[data-theme="dark"]{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10)}
      @media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .risk-card,:root:not([data-theme="dark"]) dl.stats,:root:not([data-theme="dark"]) section.related li,:root:not([data-theme="dark"]) .disclaimer{box-shadow:0 1px 3px rgba(0,0,0,0.05)}}
      :root[data-theme="light"] .risk-card,:root[data-theme="light"] dl.stats,:root[data-theme="light"] section.related li,:root[data-theme="light"] .disclaimer{box-shadow:0 1px 3px rgba(0,0,0,0.05)}
      .theme-toggle{display:none !important}
      .theme-toggle-orig{background:transparent;border:1px solid var(--border);color:var(--fg2);width:28px;height:28px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;margin-left:6px;font-family:inherit;transition:color 150ms,border-color 150ms;vertical-align:middle}
      .theme-toggle:hover{color:var(--accent);border-color:var(--accent)}
      .theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .theme-toggle svg{width:13px;height:13px;fill:currentColor}
      .theme-toggle .icon-sun{display:inline-block}
      .theme-toggle .icon-moon{display:none}
      @media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .theme-toggle .icon-sun{display:none}:root:not([data-theme="dark"]) .theme-toggle .icon-moon{display:inline-block}}
      :root[data-theme="light"] .theme-toggle .icon-sun{display:none}
      :root[data-theme="light"] .theme-toggle .icon-moon{display:inline-block}
      :root[data-theme="dark"] .theme-toggle .icon-sun{display:inline-block}
      :root[data-theme="dark"] .theme-toggle .icon-moon{display:none}

      /* ═══════════ v1.2.0 schema-1.1 rich-detail components ═══════════ */
      /* Sector chip + band row right under H1 */
      .meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0 18px}
      .sector-chip{display:inline-flex;align-items:center;gap:6px;font-size:0.78rem;padding:4px 11px;background:var(--bg3);color:var(--accent-deep);border-radius:999px;text-decoration:none;font-weight:500}
      .sector-chip:hover{background:var(--accent-2);color:#fff;text-decoration:none}
      .band{font-family:var(--font-sans);font-size:0.7rem;padding:3px 10px;border-radius:999px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600}
      .band-low{background:rgba(110,155,137,0.18);color:var(--accent-deep)}
      .band-mid{background:rgba(212,167,73,0.18);color:#8B6B2A}
      .band-high{background:rgba(217,107,61,0.18);color:var(--accent)}
      .band-hot{background:rgba(217,107,61,0.18);color:var(--accent)}
      .band-warm{background:rgba(212,167,73,0.18);color:#8B6B2A}
      .band-cool{background:rgba(110,155,137,0.18);color:var(--accent-deep)}

      /* 5-dim profile radar */
      section.profile{margin-top:32px}
      .radar-wrap{display:flex;gap:32px;align-items:center;margin:18px 0;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:24px}
      .radar-svg{width:340px;height:340px;flex-shrink:0}
      .radar-legend{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin:0}
      .radar-legend dt{font-family:var(--font-sans);font-size:0.74rem;color:var(--fg2);text-transform:uppercase;letter-spacing:0.06em;margin:0}
      .radar-legend dd{font-family:var(--font-serif);font-size:1.3rem;color:var(--fg);margin:0;font-variant-numeric:tabular-nums}
      @media (max-width:768px){
        .radar-wrap{flex-direction:column;gap:18px;padding:18px}
        .radar-svg{width:280px;height:280px}
        .radar-legend{grid-template-columns:1fr 1fr;width:100%}
      }
      @media (max-width:380px){
        .radar-svg{width:240px;height:240px}
        .radar-legend dd{font-size:1.1rem}
      }

      /* Top-N: skills / knowledge / abilities */
      section.topn{margin-top:32px}
      .topn-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin:14px 0}
      @media (max-width:900px){.topn-grid{grid-template-columns:1fr;gap:14px}}
      .topn-block{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px}
      .topn-block h3{font-family:var(--font-serif);font-size:1.05rem;color:var(--accent);margin:0 0 12px;font-weight:600;font-style:normal}
      .topn-block ol{list-style:none;padding:0;margin:0;counter-reset:rank}
      .topn-block li{counter-increment:rank;display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px dashed var(--border);font-size:0.92rem}
      .topn-block li:last-child{border-bottom:none}
      .topn-block li::before{content:counter(rank);font-family:ui-monospace,monospace;color:var(--fg3);font-size:0.78rem;font-variant-numeric:tabular-nums}
      .topn-block .topn-name{color:var(--fg)}
      .topn-block .topn-score{font-family:ui-monospace,monospace;color:var(--fg2);font-size:0.78rem;font-variant-numeric:tabular-nums}

      /* Transfer paths (career change candidates) */
      section.transfer{margin-top:32px}
      .transfer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0}
      @media (max-width:768px){.transfer-grid{grid-template-columns:1fr}}
      .transfer-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;text-decoration:none;color:var(--fg);transition:border-color 150ms,transform 100ms;display:flex;flex-direction:column;gap:6px}
      .transfer-card:hover{border-color:var(--accent);transform:translateY(-1px);text-decoration:none}
      .transfer-card .tc-name{font-family:var(--font-serif);font-size:1.02rem;color:var(--fg);line-height:1.35}
      .transfer-card .tc-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;font-size:0.76rem;color:var(--fg2)}
      .transfer-card .tc-meta .tc-risk{font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums}
      .transfer-card .tc-similarity{font-family:ui-monospace,monospace;color:var(--fg3)}

      /* Related orgs / certs side-by-side */
      section.orgs-certs{margin-top:32px}
      .org-cert-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:14px 0}
      @media (max-width:768px){.org-cert-grid{grid-template-columns:1fr;gap:16px}}
      .org-cert-block{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 20px}
      .org-cert-block h3{font-family:var(--font-serif);font-size:1rem;color:var(--accent);margin:0 0 10px;font-weight:600}
      .org-list,.cert-list{list-style:none;padding:0;margin:0}
      .org-list li,.cert-list li{padding:5px 0;font-size:0.92rem;color:var(--fg);border-bottom:1px dashed var(--border)}
      .org-list li:last-child,.cert-list li:last-child{border-bottom:none}
      .org-list a{color:var(--accent);text-decoration:none}
      .org-list a:hover{text-decoration:underline}

      /* Provenance footnote */
      .provenance{margin-top:18px;padding:12px 16px;background:var(--bg3);border-radius:6px;font-size:0.74rem;color:var(--fg2);line-height:1.55}
      .provenance code{font-family:ui-monospace,monospace;color:var(--fg);font-size:0.96em}
"""


ANALYTICS_BLOCK = """    <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "b1588779b90341ea9d87d93769b348dc"}'></script>

    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-GLDNBDPF13');
      window.addEventListener('load', function () {
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-GLDNBDPF13';
        document.head.appendChild(s);
      });
    </script>

    <script defer src="/_vercel/insights/script.js"></script>
    <script defer src="/_vercel/speed-insights/script.js"></script>"""


def render_html(rec: dict, lang: str, related: list[dict]) -> str:
    """Render the full HTML for one occupation page in the given language.

    lang: 'ja' or 'en'
    related: list of related occupation records (RELATED_COUNT entries)
    """
    id_ = rec["id"]
    canonical = ja_url(id_) if lang == "ja" else en_url(id_)

    name_ja = rec.get("name_ja") or ""
    name_en = rec.get("name_en") or ""
    risk = rec.get("ai_risk")
    risk_str = f"{risk}/10" if risk is not None else "—"
    rationale_ja = rec.get("ai_rationale_ja") or ""
    rationale_en = rec.get("ai_rationale_en") or ""
    desc_ja = (rec.get("desc_ja") or "")[:240]
    desc_en = (rec.get("desc_en") or "")[:200]
    long_what_ja = rec.get("what_it_is_ja") or ""
    long_what_en = rec.get("what_it_is_en") or ""
    long_how_ja = rec.get("how_to_become_ja") or ""
    long_how_en = rec.get("how_to_become_en") or ""
    long_cond_ja = rec.get("working_conditions_ja") or ""
    long_cond_en = rec.get("working_conditions_en") or ""

    # Audit CODE-004: keep None as None instead of `or 0` so SEO meta
    # descriptions never claim "平均年収 0万円 / 平均年齢 0" for occupations
    # where MHLW jobtag returned no value. Display sites below substitute
    # explicit "—" / "データなし" / "Data unavailable" via the `_disp` helpers.
    # The Schema.org JSON-LD truthy filters (`if salary_man:` etc.) already
    # correctly omit absent properties — None and 0 both fall through.
    salary_man = rec.get("salary")
    workers = rec.get("workers")
    age = rec.get("age")
    hours = rec.get("hours")
    recruit = rec.get("recruit_ratio")
    hourly = rec.get("hourly_wage")
    mhlw_url = rec.get("url") or f"https://shigoto.mhlw.go.jp/User/Occupation/Detail/{id_}"

    risk_class = f"risk-{risk}" if risk is not None else "risk-na"
    jsonld = render_jsonld(rec, lang)

    # Audit CODE-004: SEO description must read "データなし" instead of
    # "0万円" / "0" when MHLW didn't ship a value. _meta_* are the natural-
    # language fragments embedded in <meta description>; visible UI cells
    # use _ui_* below.
    if lang == "ja":
        _meta_workers = f"就業者 約{fmt_int(workers)}人" if workers else "就業者数データなし"
        _meta_salary = f"平均年収 {int(salary_man)}万円" if salary_man else "平均年収データなし"
        _meta_age = f"平均年齢 {age}" if age else "平均年齢データなし"
    else:
        _meta_workers = f"workforce ~{fmt_int(workers)}" if workers else "workforce data unavailable"
        _meta_salary = f"annual salary {int(salary_man)}万円" if salary_man else "annual salary data unavailable"
        _meta_age = f"avg age {age}" if age else "avg age data unavailable"

    if lang == "ja":
        # v1.2.0 Direction C convergence: strict per-language pages, no cross-language bleed.
        title = f"{name_ja} — AI 影響 {risk_str}｜mirai-shigoto.com"
        seo_desc = (
            f"{name_ja}：{_meta_workers} / {_meta_salary} "
            f"/ {_meta_age} / AI 影響 {risk_str}。Claude Opus 4.7 による独自スコア（非公式）。"
        )
        og_locale = "ja_JP"
        og_locale_alt = "en_US"
        site_name = "未来の仕事 — Mirai Shigoto"
        home_href = "/"
        crumb_root = "日本の職業 AI 影響マップ"
        crumb_self_label = name_ja
        h1_main = name_ja
        h1_sub = ""
        risk_label = "AI 影響"
        rationale = rationale_ja or desc_ja
        st_workers = "就業者数"
        st_workers_unit = " 人"
        st_salary = "年収（平均）"
        st_age = "平均年齢"
        st_age_unit = " 歳"
        st_hours = "月労働時間"
        st_hours_unit = " 時間/月"
        st_recruit = "求人倍率"
        st_hourly = "時給"
        ctx_h2 = "この職業について"
        # Prefer long-form what_it_is when available; fall back to summary, then rationale.
        ctx_p = long_what_ja or desc_ja or rationale_ja
        how_h2 = "なるには（経路・資格）"
        how_p = long_how_ja
        cond_h2 = "労働条件・働き方"
        cond_p = long_cond_ja
        src_h2 = "出典 / 関連リンク"
        src_mhlw_label = f"厚生労働省 job tag — {name_ja}（公式）"
        src_method_label = "方法論 / スコアリングルーブリック"
        src_back_label = "552 職種マップに戻る"
        rel_h2 = "類似する職業"
        rel_path = "/ja/"
        banner_html = "独自分析・<strong>厚労省 / job tag / JILPT の公式見解ではありません</strong>"
        skip_label = "本文へ"
        disclaim = "AI 影響スコアは Claude Opus 4.7 による独自推定（非公式）。MHLW / jobtag / JILPT の公式見解ではありません。個別の職業選択の唯一の根拠としては使わないでください。"
        lang_switch_label = "English"
        lang_switch_target_lang = "en"
        salary_cell = (
            f'{("¥" + fmt_int(int(salary_man * 10000))) if salary_man else "—"}（{int(salary_man) if salary_man else "—"} 万円）'
        )
    else:
        # v1.2.0 Direction C convergence: strict per-language pages, no cross-language bleed.
        title = f"{(name_en or name_ja)} — AI Impact {risk_str}｜mirai-shigoto.com"
        seo_desc = (
            f"{(name_en or name_ja)}: {_meta_workers} / {_meta_salary} "
            f"/ {_meta_age} / AI impact {risk_str}. Independent score by Claude Opus 4.7 (unofficial)."
        )
        og_locale = "en_US"
        og_locale_alt = "ja_JP"
        site_name = "Mirai Shigoto — Future of Work"
        home_href = "/?lang=en"
        crumb_root = "Japan Jobs × AI Impact Map"
        crumb_self_label = name_en or name_ja
        h1_main = name_en or name_ja
        h1_sub = ""
        risk_label = "AI Impact"
        rationale = rationale_en or desc_en
        st_workers = "Workforce"
        st_workers_unit = " persons"
        st_salary = "Annual salary"
        st_age = "Avg age"
        st_age_unit = " yrs"
        st_hours = "Monthly hours"
        st_hours_unit = " h/mo"
        st_recruit = "Recruit ratio"
        st_hourly = "Hourly wage"
        ctx_h2 = "About this occupation"
        # Prefer long-form what_it_is when available; fall back to summary, then rationale.
        ctx_p = long_what_en or desc_en or rationale_en
        how_h2 = "How to enter the field"
        how_p = long_how_en
        cond_h2 = "Working conditions"
        cond_p = long_cond_en
        src_h2 = "Sources / Related"
        src_mhlw_label = f"MHLW jobtag — {(name_en or name_ja)} (official source)"
        src_method_label = "Methodology / scoring rubric"
        src_back_label = "Back to the 552-occupation map"
        rel_h2 = "Related occupations"
        rel_path = "/en/"
        banner_html = "<strong>Independent analysis</strong> · Not endorsed by MHLW / jobtag / JILPT"
        skip_label = "Skip to content"
        disclaim = "AI risk scores are independent LLM estimates by Claude Opus 4.7 — not official forecasts. Not endorsed by MHLW, jobtag, or JILPT. Should not be the sole basis for personal career decisions."
        lang_switch_label = "日本語"
        lang_switch_target_lang = "ja"
        salary_cell = (
            f'{("¥" + fmt_int(int(salary_man * 10000))) if salary_man else "—"} ({int(salary_man) if salary_man else "—"}万円)'
        )

    # Stage 1: Follow + Share localized strings.
    if lang == "ja":
        follow_strong = "X でフォローする"
        follow_small = "毎日の職業分析を受け取る"
        share_label = "このページをシェア"
        share_text_for_post = (
            f"{name_ja} の AI 影響度は {risk_str}。日本 552 職種の AI 影響マップ（非公式・独自分析）。"
        )
        share_aria_x = "X で共有"
        share_aria_line = "LINE で共有"
        share_aria_hatena = "はてなブックマークで共有"
        share_aria_linkedin = "LinkedIn で共有"
        share_aria_facebook = "Facebook で共有"
        share_aria_copy = "URL をコピー"
        share_aria_native = "共有"
        copy_toast_text = "コピーしました"
        about_link_label = "データについて →"
    else:
        display_name = name_en or name_ja
        follow_strong = "Follow on X"
        follow_small = "Daily occupation insights"
        share_label = "Share this page"
        share_text_for_post = (
            f"{display_name}: AI impact {risk_str}. Map of 552 Japanese occupations "
            f"(independent analysis, unofficial)."
        )
        share_aria_x = "Share on X"
        share_aria_line = "Share on LINE"
        share_aria_hatena = "Share on Hatena Bookmark"
        share_aria_linkedin = "Share on LinkedIn"
        share_aria_facebook = "Share on Facebook"
        share_aria_copy = "Copy link"
        share_aria_native = "Share"
        copy_toast_text = "Link copied"
        about_link_label = "About the data →"

    og_title = title[:120]
    og_desc = seo_desc[:300]
    # alternate_url is the absolute production URL — used for SEO hreflang in <head>.
    # alternate_path is the relative path — used for the visible lang-switch button so
    # users on preview / staging domains stay within their current environment.
    alternate_url = en_url(id_) if lang == "ja" else ja_url(id_)
    alternate_path = f"/en/{id_}" if lang == "ja" else f"/ja/{id_}"
    h1_sub_html = f'<span class="h1-sub">{escape(h1_sub)}</span>' if h1_sub else ""

    related_li_html_parts = []
    for r in related:
        rid = r["id"]
        if lang == "ja":
            rname = r.get("name_ja") or r.get("name_en") or f"#{rid}"
        else:
            rname = r.get("name_en") or r.get("name_ja") or f"#{rid}"
        rrisk = r.get("ai_risk")
        rrisk_str = f"{rrisk}/10" if rrisk is not None else "—"
        ai_short = "AI 影響" if lang == "ja" else "AI"
        related_li_html_parts.append(
            f'<li><a class="r-name" href="{rel_path}{rid}">{escape(rname)}</a>'
            f'<span class="r-risk">{ai_short} {rrisk_str}</span></li>'
        )
    related_html = "\n          ".join(related_li_html_parts)

    # Display-only formatters (Audit CODE-004). When the underlying value is
    # missing, both the value AND its unit suffix collapse to "—" alone, so
    # the page never reads "— 人" / "— yrs" — just the dash.
    salary_int = int(salary_man) if salary_man else "—"
    age_disp = age if age else "—"
    hours_disp = int(hours) if hours else "—"
    recruit_disp = recruit if recruit is not None else "—"
    hourly_disp = f"¥{fmt_int(hourly)}" if hourly else "—"
    risk_num_disp = risk if risk is not None else "—"
    workers_cell = f"{fmt_int(workers)}{st_workers_unit}" if workers else "—"
    age_cell = f"{age_disp}{st_age_unit}" if age else "—"
    hours_cell = f"{hours_disp}{st_hours_unit}" if hours else "—"

    # GA4 result_view signal — fires synchronously on page load. The gtag stub
    # in ANALYTICS_BLOCK queues the call into dataLayer and the real gtag.js
    # (loaded on window.load) replays it. Risk tier mirrors the convention used
    # for tooltip_cta_click in index.html.
    risk_score_js = str(risk) if risk is not None else "null"
    if risk is not None and risk >= 7:
        risk_tier_js = "'high'"
    elif risk is not None and risk >= 5:
        risk_tier_js = "'mid'"
    else:
        risk_tier_js = "'low'"
    result_view_block = (
        "    <script>\n"
        "      // Per-occupation page-view signal for the GA4 conversion funnel.\n"
        f"      gtag('event', 'result_view', {{ occupation_id: {id_}, "
        f"ai_risk_score: {risk_score_js}, risk_tier: {risk_tier_js}, "
        f"language: '{lang}' }});\n"
        "    </script>"
    )

    # Stage 1: JS literals for the share/follow handlers (escape-safe via repr).
    canonical_js = canonical
    share_text_js = share_text_for_post
    copy_toast_js = copy_toast_text
    occ_id_js = id_
    lang_js = lang

    # v1.1.0 long-form sections — pre-render so the f-string template stays clean.
    # ctx_html always renders (with fallback chain). how/cond sections only render
    # when the source has the field (occupations missing IPD long-form stay short).
    ctx_html = _format_paragraphs(ctx_p) if ctx_p else f"<p>{escape('')}</p>"
    how_section = (
        f'<section class="how-to-become" aria-label="{escape(how_h2)}">\n'
        f'        <h2>{escape(how_h2)}</h2>\n'
        f'        {_format_paragraphs(how_p)}\n'
        f'      </section>'
    ) if how_p else ""
    cond_section = (
        f'<section class="working-conditions" aria-label="{escape(cond_h2)}">\n'
        f'        <h2>{escape(cond_h2)}</h2>\n'
        f'        {_format_paragraphs(cond_p)}\n'
        f'      </section>'
    ) if cond_p else ""

    # v1.2.0 schema-1.1 rich sections (graceful empty fallback).
    # SEO keywords from current-language name + aliases (still used by Bing/Yandex).
    aliases = rec.get("aliases_en") if lang == "en" else rec.get("aliases_ja")
    kw_terms = [name_en or name_ja] if lang == "en" else [name_ja]
    if aliases:
        kw_terms.extend(aliases[:8])
    keywords_meta = (
        f'<meta name="keywords" content="{escape(", ".join(t for t in kw_terms if t))}" />'
        if kw_terms else ""
    )
    meta_row_html   = _render_meta_row(rec, lang)
    profile_html    = _render_profile_radar(rec, lang)
    topn_html       = _render_topn(rec, lang)
    transfer_html   = _render_transfer(rec, lang)
    orgs_certs_html = _render_orgs_certs(rec, lang)
    provenance_html = _render_provenance(rec, lang)
    # When transfer_paths supplied a section, suppress the legacy "same risk-band 5"
    # related list to avoid two near-duplicate sections. Legacy stays as fallback.
    legacy_related_html = "" if transfer_html else (
        f'<section class="related" aria-label="{escape(rel_h2)}">\n'
        f'        <h2>{escape(rel_h2)}</h2>\n'
        f'        <ul>\n          {related_html}\n        </ul>\n'
        f'      </section>'
    )

    html = f"""<!doctype html>
<html lang="{lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Theme: read saved choice before paint (no flash). Falls back to system preference via CSS @media. -->
    <script>(function(){{try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}}})();</script>
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(seo_desc)}" />
    <meta name="robots" content="index, follow" />
    {keywords_meta}

    <link rel="canonical" href="{canonical}" />
    <link rel="alternate" hreflang="ja" href="{ja_url(id_)}" />
    <link rel="alternate" hreflang="en" href="{en_url(id_)}" />
    <link rel="alternate" hreflang="x-default" href="{ja_url(id_)}" />

    <link rel="dns-prefetch" href="//static.cloudflareinsights.com" />
    <link rel="dns-prefetch" href="//www.googletagmanager.com" />
    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="{escape(site_name)}" />
    <meta property="og:locale" content="{og_locale}" />
    <meta property="og:locale:alternate" content="{og_locale_alt}" />
    <meta property="og:title" content="{escape(og_title)}" />
    <meta property="og:description" content="{escape(og_desc)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="https://mirai-shigoto.com/api/og?id={id_}&amp;lang={lang}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="{escape(og_title)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(og_title)}" />
    <meta name="twitter:description" content="{escape(og_desc)}" />
    <meta name="twitter:image" content="https://mirai-shigoto.com/api/og?id={id_}&amp;lang={lang}" />
    <meta name="twitter:image:alt" content="{escape(og_title)}" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='8' width='22' height='22' fill='%23ffd84d' rx='3'/><rect x='34' y='8' width='22' height='22' fill='%23ff8a3d' rx='3'/><rect x='8' y='34' width='22' height='22' fill='%2380c0ff' rx='3'/><rect x='34' y='34' width='22' height='22' fill='%2300b04b' rx='3'/></svg>" />

    <!-- Schema.org JSON-LD: WebPage + Occupation + BreadcrumbList. References parent #website / #organization / #dataset from the home page. -->
    <script type="application/ld+json">
{jsonld}
    </script>

{ANALYTICS_BLOCK}

{result_view_block}

    <style>{CSS_BLOCK}</style>
  </head>
  <body>
    <a class="skip-link" href="#content">{skip_label}</a>

    <div id="wrapper">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="{home_href}" rel="up">{escape(crumb_root)}</a>
        <span aria-hidden="true">›</span>
        <span>{escape(crumb_self_label)}</span>
      </nav>

      <header id="content">
        <h1>
          <span class="accent">{escape(h1_main)}</span>{h1_sub_html}
          <span class="lang-switch"><a href="{alternate_path}" hreflang="{lang_switch_target_lang}" rel="alternate">{lang_switch_label}</a></span>
          <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light / dark">
            <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-1-13h2v3h-2V2Zm0 19h2v3h-2v-3ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2ZM5.6 4.2 7.7 6.3 6.3 7.7 4.2 5.6l1.4-1.4Zm12.7 12.7 2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4ZM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1ZM18.3 7.7l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1Z"/></svg>
            <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          </button>
        </h1>
        {meta_row_html}
      </header>

      <div class="risk-card {risk_class}">
        <div>
          <div class="risk-label">{risk_label}</div>
          <div class="risk-num">{risk_num_disp}<small> / 10</small></div>
        </div>
        <div class="risk-rationale">{escape(rationale)}</div>
      </div>

      <dl class="stats" aria-label="Key occupation statistics">
        <div><dt>{st_workers}</dt><dd>{workers_cell}</dd></div>
        <div><dt>{st_salary}</dt><dd>{salary_cell}</dd></div>
        <div><dt>{st_age}</dt><dd>{age_cell}</dd></div>
        <div><dt>{st_hours}</dt><dd>{hours_cell}</dd></div>
        <div><dt>{st_recruit}</dt><dd>{recruit_disp}</dd></div>
        <div><dt>{st_hourly}</dt><dd>{hourly_disp}</dd></div>
      </dl>

      <section class="context">
        <h2>{ctx_h2}</h2>
        {ctx_html}
      </section>

      {how_section}

      {cond_section}

      {profile_html}

      {topn_html}

      {transfer_html}

      {legacy_related_html}

      {orgs_certs_html}

      <section class="sources">
        <h2>{src_h2}</h2>
        <ul>
          <li><a href="{escape(mhlw_url)}" rel="external" target="_blank">{escape(src_mhlw_label)}</a></li>
          <li><a href="/llms-full.txt" rel="noopener">{src_method_label}</a></li>
          <li><a href="{home_href}" rel="up">{src_back_label}</a></li>
        </ul>
        {provenance_html}
      </section>

      <p class="disclaimer">
        <strong>UNOFFICIAL.</strong>
        {escape(disclaim)}
      </p>

      <!-- Stage 1: Follow + Share footer block (visual layering — follow prominent, share small) -->
      <div class="follow-share-section" aria-label="Follow and share">
        <div class="follow-block">
          <a class="follow-cta"
             id="x-follow-cta"
             href="https://x.com/miraishigotocom"
             target="_blank"
             rel="noopener noreferrer">
            <span class="follow-icon" aria-hidden="true">📬</span>
            <span class="follow-text">
              <strong>{escape(follow_strong)}</strong>
              <small>{escape(follow_small)}</small>
            </span>
          </a>
        </div>

        <div class="share-divider"><span>{escape(share_label)}</span></div>

        <div class="share-row" role="group" aria-label="{escape(share_label)}">
          <a class="share-btn" id="share-x" data-platform="x" href="#" aria-label="{escape(share_aria_x)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z"/></svg>
          </a>
          <a class="share-btn" id="share-line" data-platform="line" href="#" aria-label="{escape(share_aria_line)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755Zm-3.855 3.016c0 .27-.174.51-.432.596a.616.616 0 0 1-.199.031.61.61 0 0 1-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595a.658.658 0 0 1 .194-.033c.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771Zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771Zm-2.466.629H4.917a.629.629 0 0 1-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          </a>
          <a class="share-btn" id="share-hatena" data-platform="hatena" href="#" aria-label="{escape(share_aria_hatena)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.47 0C22.42 0 24 1.58 24 3.53v16.94c0 1.95-1.58 3.53-3.53 3.53H3.53C1.58 24 0 22.42 0 20.47V3.53C0 1.58 1.58 0 3.53 0h16.94Zm-3.7 14.47a1.41 1.41 0 1 0 0 2.82 1.41 1.41 0 0 0 0-2.82Zm-5.92 2.69c1.59 0 2.92-.18 3.71-.83.84-.65 1.27-1.55 1.27-2.69 0-.97-.32-1.75-.97-2.34-.65-.59-1.5-.92-2.55-1 .92-.25 1.62-.59 2.04-1.07.43-.45.65-1.07.65-1.84 0-.61-.13-1.16-.4-1.61-.27-.45-.65-.83-1.18-1.07-.45-.22-1-.4-1.61-.5-.61-.07-1.55-.13-2.79-.13H6.74v13.07h4.11Zm-.86-2.5h-.94v-3.13h.97c1.16 0 1.95.13 2.34.4.4.27.59.72.59 1.34 0 .54-.18.97-.54 1.21-.36.27-1.16.18-2.42.18Zm0-5.45h-.94V6.5h.4c1.21 0 2 .07 2.39.27.4.18.61.61.61 1.27 0 .59-.22 1.05-.65 1.27-.4.18-1.18.27-2.39.27ZM22.59 16.94v-7.5h-2.13v7.5h2.13Z"/></svg>
          </a>
          <a class="share-btn" id="share-linkedin" data-platform="linkedin" href="#" aria-label="{escape(share_aria_linkedin)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 0H5C2.24 0 0 2.24 0 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5V5c0-2.76-2.24-5-5-5ZM8 19H5V8h3v11ZM6.5 6.73a1.76 1.76 0 1 1 0-3.53 1.76 1.76 0 0 1 0 3.53ZM20 19h-3v-5.6c0-3.37-4-3.11-4 0V19h-3V8h3v1.77c1.4-2.59 7-2.78 7 2.47V19Z"/></svg>
          </a>
          <a class="share-btn" id="share-facebook" data-platform="facebook" href="#" aria-label="{escape(share_aria_facebook)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.19 2.24.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99C18.34 21.13 22 16.99 22 12Z"/></svg>
          </a>
          <button class="share-btn" id="share-copy" type="button" data-platform="copy" aria-label="{escape(share_aria_copy)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1ZM8 13h8v-2H8v2Zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 0-10Z"/></svg>
          </button>
          <button class="share-btn" id="share-native" type="button" data-platform="native" aria-label="{escape(share_aria_native)}" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 8 6h3v8h2V6h3l-4-4Zm-7 7v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-3v2h3v11H7V9h3V7H7c-1.1 0-2 .9-2 2Z"/></svg>
          </button>
          <span class="share-toast" id="share-toast" aria-live="polite"></span>
        </div>
      </div>

      <footer>
        <div class="footer-links">
          <a href="{home_href}">{('Home' if lang == 'en' else 'トップ')}</a>
          <a href="/about{'?lang=en' if lang == 'en' else ''}">{('About' if lang == 'en' else 'データについて')}</a>
          <a href="/compliance{'?lang=en' if lang == 'en' else ''}">{('Compliance' if lang == 'en' else 'コンプライアンス')}</a>
          <a href="/privacy{'?lang=en' if lang == 'en' else ''}">{('Privacy' if lang == 'en' else 'プライバシー')}</a>
        </div>
        <div class="footer-meta">
          © <a href="{home_href}">mirai-shigoto.com</a> · <a href="https://github.com/jasonhnd/jobs/blob/main/LICENSE">MIT</a><br>
          {('Source: MHLW &amp; JILPT &quot;Occupational Information Database (job tag)&quot; v7.00 (downloaded 2026-05-03) — processed as derivative work. Independent analysis, not endorsed by MHLW / jobtag / JILPT.' if lang == 'en' else '出典：厚生労働省・JILPT「職業情報データベース（job tag）」 v7.00（2026-05-03 ダウンロード）を加工して作成。独自分析。')}
        </div>
      </footer>
    </div>

    <script>
      (function(){{
        var btn=document.getElementById('themeToggle');
        if(!btn)return;
        btn.addEventListener('click',function(){{
          var sysLight=matchMedia('(prefers-color-scheme: light)').matches;
          var saved=null;try{{saved=localStorage.getItem('theme');}}catch(e){{}}
          var cur=document.documentElement.getAttribute('data-theme')||(sysLight?'light':'dark');
          var next=cur==='light'?'dark':'light';
          document.documentElement.setAttribute('data-theme',next);
          try{{localStorage.setItem('theme',next);}}catch(e){{}}
          if(window.gtag)gtag('event','theme_change',{{from:cur,to:next,was_explicit:saved==='light'||saved==='dark',system_pref:sysLight?'light':'dark'}});
        }});
      }})();
      // Stage 1: Follow + Share handlers
      (function(){{
        var SITE = {canonical_js!r};
        var SHARE_TEXT = {share_text_js!r};
        var COPY_TOAST = {copy_toast_js!r};
        function shareUrl(source, medium){{
          var sep = SITE.indexOf('?')>=0 ? '&' : '?';
          return SITE + sep + 'utm_source=' + source + '&utm_medium=' + medium + '&utm_campaign=footer_share&utm_content=occ';
        }}
        function track(p){{ if(window.gtag) gtag('event','share_click',{{platform:p,occupation_id:{occ_id_js},language:{lang_js!r}}}); }}
        function open(u){{ window.open(u,'_blank','noopener,noreferrer'); }}

        var x = document.getElementById('share-x');
        if(x) x.addEventListener('click',function(e){{e.preventDefault(); open('https://x.com/intent/post?url=' + encodeURIComponent(shareUrl('x','social')) + '&text=' + encodeURIComponent(SHARE_TEXT)); track('x');}});
        var line = document.getElementById('share-line');
        if(line) line.addEventListener('click',function(e){{e.preventDefault(); open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(shareUrl('line','im'))); track('line');}});
        var hatena = document.getElementById('share-hatena');
        if(hatena) hatena.addEventListener('click',function(e){{e.preventDefault(); open('https://b.hatena.ne.jp/entry/' + shareUrl('hatena','social').replace(/^https?:\\/\\//,'')); track('hatena');}});
        var linkedin = document.getElementById('share-linkedin');
        if(linkedin) linkedin.addEventListener('click',function(e){{e.preventDefault(); open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl('linkedin','social'))); track('linkedin');}});
        var fb = document.getElementById('share-facebook');
        if(fb) fb.addEventListener('click',function(e){{e.preventDefault(); open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl('facebook','social'))); track('facebook');}});
        var xfollow = document.getElementById('x-follow-cta');
        if(xfollow) xfollow.addEventListener('click',function(){{ if(window.gtag) gtag('event','x_follow_click',{{occupation_id:{occ_id_js},language:{lang_js!r}}}); }});

        var copy = document.getElementById('share-copy');
        var toast = document.getElementById('share-toast');
        if(copy && toast) copy.addEventListener('click',async function(e){{
          e.preventDefault();
          var url = shareUrl('direct','copylink');
          try{{ await navigator.clipboard.writeText(url); toast.textContent = COPY_TOAST; }}catch(err){{ toast.textContent = url; }}
          toast.classList.add('visible'); track('copy');
          setTimeout(function(){{toast.classList.remove('visible');}},2200);
        }});

        var native = document.getElementById('share-native');
        if(native){{
          if(typeof navigator.share === 'function'){{
            native.hidden = false;
            native.addEventListener('click',async function(e){{
              e.preventDefault();
              try{{ await navigator.share({{title: document.title, text: SHARE_TEXT, url: shareUrl('native','share_api')}}); track('native'); }}catch(err){{}}
            }});
          }}
        }}
      }})();
    </script>
  </body>
</html>
"""
    return html


SITEMAP_BASE = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://mirai-shigoto.com/</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/" />
  </url>
  <url>
    <loc>https://mirai-shigoto.com/privacy</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/privacy" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/privacy?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/privacy" />
  </url>
  <url>
    <loc>https://mirai-shigoto.com/about</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/about" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/about?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/about" />
  </url>
  <url>
    <loc>https://mirai-shigoto.com/compliance</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com/compliance" />
    <xhtml:link rel="alternate" hreflang="en" href="https://mirai-shigoto.com/compliance?lang=en" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com/compliance" />
  </url>
  <!-- GEO surface: llms.txt convention (https://llmstxt.org). Listed here so general crawlers discover them too. -->
  <url>
    <loc>https://mirai-shigoto.com/llms.txt</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.2</priority>
  </url>
  <url>
    <loc>https://mirai-shigoto.com/llms-full.txt</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.2</priority>
  </url>
  <!-- Per-occupation pages: 556 JA at /ja/<id> + 556 EN at /en/<id>. Generated by scripts/build_occupations.py. -->
{occupations}</urlset>
"""


def write_sitemap(manifest: list[dict], lastmod: str = DATE_MODIFIED) -> None:
    """Rewrite sitemap.xml with home + privacy + llms* + (556 JA + 556 EN) occupation URLs."""
    lines: list[str] = []
    for entry in manifest:
        ja = entry["ja_url"]
        en = entry["en_url"]
        for primary in (ja, en):
            lines.append(
                f"  <url>\n"
                f"    <loc>{primary}</loc>\n"
                f"    <lastmod>{lastmod}</lastmod>\n"
                f"    <changefreq>monthly</changefreq>\n"
                f"    <priority>0.5</priority>\n"
                f'    <xhtml:link rel="alternate" hreflang="ja" href="{ja}" />\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{en}" />\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ja}" />\n'
                f"  </url>\n"
            )
    SITEMAP_PATH.write_text(
        SITEMAP_BASE.format(lastmod=lastmod, occupations="".join(lines)),
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="Generate only the first N records (smoke test).")
    ap.add_argument("--ids", type=str, default=None, help="Comma-separated list of ids to generate (e.g., 428,33,1).")
    ap.add_argument("--no-sitemap", action="store_true", help="Skip rewriting sitemap.xml (default: rewrite when generating full set).")
    args = ap.parse_args()

    OUT_DIR_JA.mkdir(parents=True, exist_ok=True)
    OUT_DIR_EN.mkdir(parents=True, exist_ok=True)

    all_data = _load_legacy_shape_corpus()
    # v1.2.0: load extra projections used by new sections.
    global PROFILE5, TRANSFER_PATHS, NAME_LOOKUP
    PROFILE5 = _load_profile5()
    TRANSFER_PATHS = _load_transfer_paths()
    NAME_LOOKUP = {r["id"]: (r.get("name_ja"), r.get("name_en")) for r in all_data}
    is_full_run = args.ids is None and args.limit is None

    if args.ids:
        wanted = {int(x) for x in args.ids.split(",") if x.strip()}
        data = [r for r in all_data if r["id"] in wanted]
    elif args.limit:
        data = all_data[: args.limit]
    else:
        data = all_data

    manifest: list[dict] = []
    bytes_total = 0
    for rec in data:
        related = pick_related(rec, all_data, RELATED_COUNT)
        ja_html = render_html(rec, "ja", related)
        en_html = render_html(rec, "en", related)
        ja_path = OUT_DIR_JA / f"{rec['id']}.html"
        en_path = OUT_DIR_EN / f"{rec['id']}.html"
        ja_path.write_text(ja_html, encoding="utf-8")
        en_path.write_text(en_html, encoding="utf-8")
        ja_size = ja_path.stat().st_size
        en_size = en_path.stat().st_size
        bytes_total += ja_size + en_size
        manifest.append(
            {
                "id": rec["id"],
                "name_ja": rec.get("name_ja"),
                "name_en": rec.get("name_en"),
                "ai_risk": rec.get("ai_risk"),
                "ja_url": ja_url(rec["id"]),
                "en_url": en_url(rec["id"]),
                "ja_size_bytes": ja_size,
                "en_size_bytes": en_size,
            }
        )

    # Partial runs (--ids / --limit) write to .partial.json so the canonical
    # 552-entry manifest produced by full runs is never overwritten by smoke
    # tests. Only is_full_run promotes to the canonical path.
    if is_full_run:
        manifest_target = MANIFEST_PATH
    else:
        manifest_target = MANIFEST_PATH.with_suffix(".partial.json")
    manifest_target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    pages = len(manifest) * 2
    avg_kb = bytes_total / pages / 1024 if pages else 0
    print(f"Generated {pages} pages ({len(manifest)} JA + {len(manifest)} EN) → {OUT_DIR_JA.name}/, {OUT_DIR_EN.name}/")
    print(f"Total: {bytes_total/1024:.1f} KB  ·  Avg: {avg_kb:.1f} KB/page")
    print(f"Manifest: {manifest_target}{' (partial — full manifest at ' + str(MANIFEST_PATH) + ' unchanged)' if not is_full_run else ''}")

    if is_full_run and not args.no_sitemap:
        write_sitemap(manifest)
        print(f"Sitemap rewritten: {SITEMAP_PATH} ({pages} occupation URLs added)")
    elif not is_full_run:
        print("(partial run — sitemap NOT rewritten; pass --no-sitemap to silence this notice)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
