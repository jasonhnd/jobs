      // Site is JA-only since v1.4.0. `lang` is retained as a label-dict key
      // (used by `L[X][lang]` lookups against the I18N.labels object), not as
      // a feature flag — the `lang === "en"` branches were removed in a
      // follow-up. `name_en` is kept on the data side for analytics event
      // payloads + alternate-name search.
      const lang = "ja";
      let layer = "ai_risk";
      let palette = "redgreen"; // or "viridis"
      let data = [];
      let rects = [];
      let hovered = null;
      let searchQuery = "";
      let dimmedIds = null; // null = no filter; Set when searching
      let lastTooltipId = null;
      let lastTapped = null;
      let lastTapTime = 0;
      let keyboardIdx = -1;
      let percentiles = {};
      const canvas = document.getElementById("treemap");
      if (!canvas) {
        // If the treemap canvas was removed from the template, bail out
        // before any subsequent line crashes the rest of this script.
        // Note: this is a top-level <script>, not an IIFE — `return` would
        // be a SyntaxError and refuse to parse the whole block. `throw`
        // halts execution at the point of the error (rest of script never
        // runs), which is what we want.
        console.error("[treemap] #treemap canvas missing — aborting init");
        const ls = document.getElementById("loadingState");
        if (ls) { ls.className = "error-state"; ls.textContent = "レンダラーの初期化に失敗しました"; }
        throw new Error("[treemap] #treemap canvas missing");
      }
      const ctx = canvas.getContext("2d");
      const hl = document.getElementById("tileHighlight");

      // ─── Hot-path geometry cache (avoid forced reflows) ─────────────
      // canvas.getBoundingClientRect() forces synchronous layout — 30-100ms on slow mobile.
      // We cache it and only refresh on resize/scroll. Hit-test, tooltip positioning,
      // and tile centering all read this instead of querying live each time.
      let canvasRect = null;
      function refreshCanvasRect() {
        canvasRect = canvas.getBoundingClientRect();
      }
      window.addEventListener("scroll", refreshCanvasRect, { passive: true });
      window.addEventListener("resize", refreshCanvasRect);

      // ─── CSS overlay highlight (replaces canvas redraw on hover/select) ─────
      // setHighlight(tile) just moves a positioned <div> over the tile.
      // setHighlight(null) hides it. Coordinates are wrapper-relative
      // (canvas is inside #wrapper which is position:relative).
      function setHighlight(tile) {
        if (!tile) { hl.style.display = "none"; return; }
        hl.style.display = "block";
        hl.style.left = (canvas.offsetLeft + tile.rx) + "px";
        hl.style.top = (canvas.offsetTop + tile.ry) + "px";
        hl.style.width = tile.rw + "px";
        hl.style.height = tile.rh + "px";
      }

      // ─── Tooltip update scheduler — defer heavy DOM work to next paint ────
      // showTooltip() does ~10-50ms of innerHTML / measurement work.
      // Wrapping it in rAF lets the highlight paint first (INP marker hits),
      // then tooltip catches up next frame. Coalesces rapid mousemove events.
      let tooltipScheduled = false;
      let pendingTooltipArgs = null;
      function scheduleTooltip(d, mx, my) {
        pendingTooltipArgs = [d, mx, my];
        if (tooltipScheduled) return;
        tooltipScheduled = true;
        requestAnimationFrame(() => {
          tooltipScheduled = false;
          if (pendingTooltipArgs) {
            showTooltip(pendingTooltipArgs[0], pendingTooltipArgs[1], pendingTooltipArgs[2]);
            pendingTooltipArgs = null;
          }
        });
      }
      let dpr = window.devicePixelRatio || 1;
      const MARGIN = 4, GAP = 1;
      const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

      // Build the per-occupation URL. v1.4.0: JA-only.
      // Mirrors src/pages/ja/[id].astro URL shape (writes ja/<id>.html).
      function occUrl(rec) {
        if (!rec || rec.id == null) return "/";
        return "/ja/" + rec.id;
      }
      // Fire occupation_tile_click for any path that opens a per-occupation page
      // from the treemap (canvas click, touch tap, keyboard Enter). source lets
      // analytics distinguish which input modality drove the click.
      function fireTileClick(rec, source) {
        if (!window.gtag || !rec) return;
        const risk = rec.ai_risk != null ? rec.ai_risk : 0;
        const tier = risk >= 7 ? "high" : (risk >= 5 ? "mid" : "low");
        const idx = (typeof rects !== "undefined" && rects.indexOf) ? rects.indexOf(rec) : -1;
        gtag("event", "occupation_tile_click", {
          occupation_id: rec.id,
          occupation_name_ja: (rec.name_ja || "").slice(0, 100),
          occupation_name_en: (rec.name_en || "").slice(0, 100),
          ai_risk_score: risk,
          risk_tier: tier,
          salary: rec.salary || 0,
          tile_position_idx: idx,
          source: source,
          language: lang,
        });
      }

      const EDU_LABELS = ["高卒未満","高卒","専門学校卒","短大卒","高専卒","大卒","修士課程卒（修士と同等の専門職学位を含む）","博士課程卒"];

      const I18N = {
        searchPlaceholder: { ja: "職業名で検索…", en: "Search occupations…" },
        searchHits: { ja: n => n + " 件", en: n => n + " match" + (n === 1 ? "" : "es") },
        statTitle: {
          ai_risk: { ja: "AI リスク", en: "AI Risk" },
          salary: { ja: "年収", en: "Salary" },
          age: { ja: "平均年齢", en: "Avg Age" },
          hours: { ja: "労働時間", en: "Hours" },
          recruit_ratio: { ja: "求人倍率", en: "Recruit Ratio" },
          education: { ja: "学歴", en: "Education" }
        },
        labels: {
          occupations: { ja: "職業数", en: "Occupations" },
          workforce: { ja: "総就業者数", en: "Total workforce" },
          weightedAvg: { ja: "加重平均", en: "Weighted avg" },
          distribution: { ja: "分布", en: "Distribution" },
          tiers: { ja: "段階別", en: "Tiers" },
          crosstab: { ja: "クロス集計", en: "Cross-tab" },
          impact: { ja: "影響度", en: "Impact" },
          wagesExposed: { ja: "高リスク賃金総額（リスク≥7）", en: "Wages exposed (risk≥7)" },
          highRiskJobs: { ja: "高リスク職業数", en: "High-risk jobs" },
          topPay: { ja: "最高年収", en: "Top salary" },
          medianPay: { ja: "中央値年収", en: "Median salary" },
          totalWages: { ja: "賃金総額", en: "Total wages" },
          oldestField: { ja: "最高齢分野", en: "Oldest occupations" },
          youngestField: { ja: "最若分野", en: "Youngest occupations" },
          longestHrs: { ja: "労働時間最長", en: "Longest hours" },
          highestDemand: { ja: "需要最高", en: "Highest demand" },
          uniDegree: { ja: "大卒以上 %", en: "Bachelor+ %" }
        }
      };

      // v1.4.0: language switcher removed — site is JA-only. The `lang`
      // module-level variable is kept (initialized to "ja") so existing
      // code paths that read I18N[lang] continue to work without rewrites.

      function clamp(t) { return Math.max(0, Math.min(1, t)); }
      function boostContrast(t) { const c = (t - 0.5) * 2; const b = Math.sign(c) * Math.pow(Math.abs(c), 0.55); return b / 2 + 0.5; }
      // Module-level HTML escape — used at every site that interpolates
      // data.json fields into innerHTML strings. Prevents stored-XSS if any
      // future ai_rationale_* / name_* field contains HTML metacharacters.
      function escapeHtml(s) {
        return String(s == null ? "" : s).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
      }
      // Theme detection — used by treemap palette + canvas bg.
      function isLightThemeNow() {
        const explicit = document.documentElement.getAttribute("data-theme");
        if (explicit === "light") return true;
        if (explicit === "dark") return false;
        return matchMedia("(prefers-color-scheme: light)").matches;
      }
      // Map-page palette (5-stop, gentler than the original vivid emerald→
      // bright red). Synced with /map's RISK_PALETTE so the homepage hero
      // treemap, mobile preview, and the dedicated map page all look the same.
      // User feedback: the vivid (15,195,105)→(235,40,55) ramp was 刺眼.
      const MAP_PALETTE_STOPS = [
        [15, 138, 102],   // #0F8A66 muted dark green (low risk)
        [91, 168, 79],    // #5BA84F sage
        [217, 160, 59],   // #D9A03B amber
        [226, 122, 51],   // #E27A33 burnt orange
        [196, 66, 47],    // #C4422F terracotta red (high risk)
      ];
      // Discrete 5-bucket palette — matches /map's colorForRisk(risk) exactly:
      //   risk 0-2 → stop 0 (dark green)
      //   risk 2-4 → stop 1 (sage)
      //   risk 4-6 → stop 2 (amber)
      //   risk 6-8 → stop 3 (orange)
      //   risk 8-10 → stop 4 (red)
      // Was previously interpolating between stops + boostContrast + alpha 0.85
      // which produced muddy brown/olive midtones absent from /map's flat blocks.
      // User wants the two pages to look identical — switching to flat discrete.
      function mapPaletteCSS(t, alpha) {
        t = clamp(t);
        let stop;
        if (t < 0.2) stop = MAP_PALETTE_STOPS[0];
        else if (t < 0.4) stop = MAP_PALETTE_STOPS[1];
        else if (t < 0.6) stop = MAP_PALETTE_STOPS[2];
        else if (t < 0.8) stop = MAP_PALETTE_STOPS[3];
        else stop = MAP_PALETTE_STOPS[4];
        return `rgba(${stop[0]},${stop[1]},${stop[2]},${alpha})`;
      }
      function greenRedCSSDark(t, alpha) { return mapPaletteCSS(t, alpha); }
      function greenRedCSSLight(t, alpha) { return mapPaletteCSS(t, alpha); }
      // Drop boostContrast — /map uses raw risk → bucket directly.
      function greenRedCSS(t, alpha) {
        return mapPaletteCSS(clamp(t), alpha);
      }
      // Viridis-like 5-stop perceptually-uniform palette (colorblind-safe)
      const VIRIDIS_STOPS = [
        [68, 1, 84],     // dark purple
        [59, 82, 139],   // blue
        [33, 144, 141],  // teal
        [94, 201, 98],   // green
        [253, 231, 37]   // yellow
      ];
      function viridisCSS(t, alpha) {
        t = clamp(t);
        const seg = Math.min(VIRIDIS_STOPS.length - 2, Math.floor(t * (VIRIDIS_STOPS.length - 1)));
        const localT = t * (VIRIDIS_STOPS.length - 1) - seg;
        const a = VIRIDIS_STOPS[seg], b = VIRIDIS_STOPS[seg + 1];
        const r = Math.round(a[0] + (b[0] - a[0]) * localT);
        const g = Math.round(a[1] + (b[1] - a[1]) * localT);
        const bl = Math.round(a[2] + (b[2] - a[2]) * localT);
        return `rgba(${r},${g},${bl},${alpha})`;
      }
      function paletteCSS(t, alpha) {
        return palette === "viridis" ? viridisCSS(t, alpha) : greenRedCSS(t, alpha);
      }

      function dominantEduIdx(eduMap) {
        let best = -1, bestPct = -1;
        for (let i = 0; i < EDU_LABELS.length; i++) {
          const p = eduMap[EDU_LABELS[i]] || 0;
          if (p > bestPct) { bestPct = p; best = i; }
        }
        return best;
      }

      // Returns t in [0,1] for the layer metric of d, or null if missing
      function layerT(d) {
        if (layer === "salary") {
          if (d.salary == null) return null;
          return (Math.log(Math.max(280, Math.min(1700, d.salary))) - Math.log(280)) / (Math.log(1700) - Math.log(280));
        }
        if (layer === "age") {
          if (d.age == null) return null;
          return (Math.max(28, Math.min(60, d.age)) - 28) / 32;
        }
        if (layer === "hours") {
          if (d.hours == null) return null;
          return (Math.max(140, Math.min(190, d.hours)) - 140) / 50;
        }
        if (layer === "recruit_ratio") {
          if (d.recruit_ratio == null) return null;
          const tt = (Math.log(Math.max(0.3, Math.min(15, d.recruit_ratio))) - Math.log(0.3)) / (Math.log(15) - Math.log(0.3));
          return 1 - tt; // reversed: higher demand -> "low" end of green
        }
        if (layer === "education") {
          const idx = dominantEduIdx(d.education_pct || {});
          if (idx < 0) return null;
          return idx / (EDU_LABELS.length - 1);
        }
        if (layer === "ai_risk") {
          if (d.ai_risk == null) return null;
          return d.ai_risk / 10;
        }
        return null;
      }

      function tileColorCSS(d, alpha) {
        const t = layerT(d);
        if (t == null) return `rgba(120,120,120,${alpha})`;
        return paletteCSS(t, alpha);
      }

      function squarify(items, x, y, w, h) {
        if (items.length === 0) return [];
        if (items.length === 1) return [{...items[0], rx: x, ry: y, rw: w, rh: h}];
        const total = items.reduce((s, d) => s + d.value, 0);
        if (total === 0) return [];
        const results = [];
        let remaining = [...items], cx = x, cy = y, cw = w, ch = h;
        while (remaining.length > 0) {
          const remTotal = remaining.reduce((s, d) => s + d.value, 0);
          const vertical = cw >= ch;
          const side = vertical ? ch : cw;
          let row = [remaining[0]], rowSum = remaining[0].value;
          for (let i = 1; i < remaining.length; i++) {
            const cand = [...row, remaining[i]];
            const candSum = rowSum + remaining[i].value;
            if (worstAspect(cand, candSum, side, remTotal, vertical ? cw : ch) <
                worstAspect(row, rowSum, side, remTotal, vertical ? cw : ch)) {
              row = cand; rowSum = candSum;
            } else break;
          }
          const rowFraction = rowSum / remTotal;
          const rowThickness = vertical ? cw * rowFraction : ch * rowFraction;
          let offset = 0;
          for (const item of row) {
            const itemFraction = item.value / rowSum;
            const itemLength = side * itemFraction;
            if (vertical) results.push({...item, rx: cx, ry: cy + offset, rw: rowThickness, rh: itemLength});
            else results.push({...item, rx: cx + offset, ry: cy, rw: itemLength, rh: rowThickness});
            offset += itemLength;
          }
          if (vertical) { cx += rowThickness; cw -= rowThickness; }
          else { cy += rowThickness; ch -= rowThickness; }
          remaining = remaining.slice(row.length);
        }
        return results;
      }
      function worstAspect(row, rowSum, side, totalArea, availableExtent) {
        const rowExtent = availableExtent * (rowSum / totalArea);
        if (rowExtent === 0) return Infinity;
        let worst = 0;
        for (const item of row) {
          const itemLen = side * (item.value / rowSum);
          if (itemLen === 0) continue;
          const aspect = Math.max(rowExtent / itemLen, itemLen / rowExtent);
          if (aspect > worst) worst = aspect;
        }
        return worst;
      }

      function layout() {
        const isMobile = window.innerWidth < 768;
        // Cache the geometric read into a const so all subsequent writes happen after; helps the engine batch and reduces forced-reflow time.
        const wrapperWidth = document.getElementById("wrapper").clientWidth;
        const w = wrapperWidth - (isMobile ? 32 : 56);
        // Mobile: tall portrait canvas (~2.6x width) so each tile gets enough area to be readable.
        // Desktop: landscape (~0.6x width) since the wrapper is already wide.
        // Design.md §5.1: desktop 1.05 (was 0.6) — small tiles need vertical room for labels.
        const h = isMobile ? Math.round(w * 2.6) : Math.round(w * 1.05);
        canvas.width = w * dpr; canvas.height = h * dpr;
        canvas.style.width = w + "px"; canvas.style.height = h + "px";
        const items = data.filter(d => d.workers && d.workers > 0).map(d => ({...d, value: d.workers}));
        items.sort((a, b) => b.value - a.value);
        rects = squarify(items, MARGIN, MARGIN, w - MARGIN * 2, h - MARGIN * 2);
      }

      function tileSubInfo(d) {
        if (layer === "salary") return d.salary != null ? d.salary + "万円" : "";
        if (layer === "age") return d.age != null ? d.age + "歳" : "";
        if (layer === "hours") return d.hours != null ? d.hours + "h" : "";
        if (layer === "recruit_ratio") return d.recruit_ratio != null ? d.recruit_ratio.toFixed(2) + "x" : "";
        if (layer === "education") {
          const idx = dominantEduIdx(d.education_pct || {});
          if (idx < 0) return "";
          return EDU_LABELS[idx];
        }
        if (layer === "ai_risk") return d.ai_risk != null ? d.ai_risk + "/10" : "";
        return "";
      }

      function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Design.md §5.5: theme-aware bg matches site --bg so canvas seam is invisible.
        ctx.fillStyle = isLightThemeNow() ? "#fafafa" : "#0b0d10";
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        const isMobile = window.innerWidth < 768;
        const labelMinW = isMobile ? 30 : 50;
        const labelMinH = isMobile ? 14 : 18;
        const subInfoMinW = isMobile ? 50 : 70;
        const subInfoMinH = isMobile ? 26 : 32;
        const fontMin = isMobile ? 8 : 9;
        const fontMax = isMobile ? 12 : 13;
        for (const r of rects) {
          const isDimmed = dimmedIds && !dimmedIds.has(r.id);
          // Hover/select indication is handled by the #tileHighlight overlay,
          // not by per-tile alpha differential — that way hover changes don't
          // require redrawing all 552 tiles. Keep theme- and dim-based alpha only.
          // Match /map's flat opaque tiles. Original had alpha 0.95/0.62 to
          // softly blend tiles into cream/dark canvas, but that diluted the
          // discrete palette into muddy mid-tones absent from /map.
          const baseAlpha = isDimmed ? 0.18 : 1.0;
          const g = GAP / 2;
          const rx = r.rx + g, ry = r.ry + g, rw = r.rw - g * 2, rh = r.rh - g * 2;
          if (rw <= 0 || rh <= 0) continue;
          ctx.fillStyle = tileColorCSS(r, baseAlpha);
          ctx.fillRect(rx, ry, rw, rh);
          if (rw > labelMinW && rh > labelMinH && !isDimmed) {
            ctx.save(); ctx.beginPath(); ctx.rect(rx + 3, ry + 2, rw - 6, rh - 4); ctx.clip();
            const fontSize = Math.min(fontMax, Math.max(fontMin, Math.min(rw / 8, rh / 3)));
            ctx.font = `500 ${fontSize}px -apple-system, system-ui, sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.92)";
            ctx.textBaseline = "top";
            const label = r.name_ja;
            ctx.fillText(label, rx + 4, ry + 3);
            if (rh > subInfoMinH && rw > subInfoMinW) {
              ctx.font = `400 ${Math.max(fontMin - 1, fontSize - 2)}px -apple-system, system-ui, sans-serif`;
              ctx.fillStyle = "rgba(255,255,255,0.55)";
              ctx.fillText(tileSubInfo(r), rx + 4, ry + 3 + fontSize + 2);
            }
            ctx.restore();
          }
        }
      }

      function hitTest(mx, my) {
        const rect = canvasRect || canvas.getBoundingClientRect();
        const cx = mx - rect.left, cy = my - rect.top;
        for (let i = rects.length - 1; i >= 0; i--) {
          const r = rects[i];
          if (cx >= r.rx && cx < r.rx + r.rw && cy >= r.ry && cy < r.ry + r.rh) return r;
        }
        return null;
      }

      function fmtN(n) {
        if (n == null) return "—";
        if (n >= 1e8) return (n / 1e8).toFixed(1) + "億";
        if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
        if (n >= 1e3) return (n / 1e3).toFixed(1) + "千";
        return Math.round(n).toLocaleString();
      }

      function computePercentiles(data) {
        const fields = ["salary", "age", "hours", "recruit_ratio", "ai_risk"];
        const sorted = {};
        for (const f of fields) {
          sorted[f] = data.map(d => d[f]).filter(v => v != null).sort((a, b) => a - b);
        }
        return sorted;
      }
      function pctRank(v, arr) {
        if (!arr || arr.length === 0 || v == null) return null;
        let i = 0;
        while (i < arr.length && arr[i] < v) i++;
        return Math.round((i / arr.length) * 100);
      }

      function showTooltip(d, mx, my) {
        const tt = document.getElementById("tooltip");
        if (d.id !== lastTooltipId) {
          const title = d.name_ja;
          tt.querySelector(".tt-title").textContent = title;
          const idx = dominantEduIdx(d.education_pct || {});
          const eduLabel = idx >= 0 ? EDU_LABELS[idx] : "—";
          const eduPct = idx >= 0 ? (d.education_pct[EDU_LABELS[idx]] || 0).toFixed(1) + "%" : "";
          // Percentile context: top X% of N occupations. For salary & ai_risk: higher is "top".
          const salaryPctTop = d.salary != null && percentiles.salary ? 100 - pctRank(d.salary, percentiles.salary) : null;
          const riskPctTop = d.ai_risk != null && percentiles.ai_risk ? 100 - pctRank(d.ai_risk, percentiles.ai_risk) : null;

          // Defensive: new fields (employment_type, hourly_wage, prior_experience) may be missing
          const empType = d.employment_type;
          const topEmp = (empType && typeof empType === "object")
            ? Object.entries(empType).sort((a,b)=>b[1]-a[1])[0]
            : null;
          const hourlyWage = d.hourly_wage;

          const workersJa = d.category_size && d.category_size > 1
            ? fmtN(d.workers) + " 人（親 " + fmtN(d.category_workers) + " ÷ " + d.category_size + "）"
            : fmtN(d.workers) + " 人";

          const rowsJa = [
            ["年収", d.salary != null
              ? d.salary + " 万円"
                + (salaryPctTop != null ? "（上位 " + salaryPctTop + "%）" : "")
              : "—"],
            ["就業者数", workersJa],
            ["平均年齢", d.age != null ? d.age + " 歳" : "—"],
            ["労働時間/月", d.hours != null ? d.hours + " 時間" : "—"],
            ["有効求人倍率", d.recruit_ratio != null ? d.recruit_ratio.toFixed(2) : "—"],
            ["最多学歴", eduPct ? eduLabel + "（" + eduPct + "）" : "—"]
          ];
          if (topEmp) rowsJa.push(["最多雇用形態", topEmp[0] + " " + topEmp[1].toFixed(0) + "%"]);
          if (hourlyWage != null) rowsJa.push(["時給", Math.round(hourlyWage).toLocaleString() + " 円"]);
          rowsJa.push(["AI リスク", d.ai_risk != null
            ? d.ai_risk + "/10" + (riskPctTop != null ? "（上位 " + riskPctTop + "%）" : "")
            : "—"]);
          rowsJa.push(["理由", d.ai_rationale_ja || "—"]);

          const rows = rowsJa;
          // Sanitize values defensively (these are LLM outputs but trusted from our own pipeline; still escape just in case)
          const esc = s => String(s).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
          document.getElementById("ttRow").innerHTML = rows.map(([k, v]) => `<span class="label">${esc(k)}</span><span class="value">${esc(v)}</span>`).join("");
          // Tooltip CTA href — Design.md §6.6. Points at /ja/<id>.
          const cta = document.getElementById("tooltipCta");
          if (cta) {
            cta.href = occUrl(d);
            cta.dataset.occId = d.id;
            cta.dataset.aiRisk = d.ai_risk != null ? String(d.ai_risk) : "";
          }
          lastTooltipId = d.id;
        }
        // Measure actual rendered dimensions (works while opacity:0; tooltip is display:block)
        const ttW = tt.offsetWidth;
        const ttH = tt.offsetHeight;
        const VW = window.innerWidth;
        const VH = window.innerHeight;
        const PAD = 8;
        let tx = mx + 16, ty = my - 16;
        // Horizontal: if right overflow, flip to left of cursor; if still off-screen, center
        if (tx + ttW > VW - PAD) tx = mx - ttW - 16;
        if (tx < PAD) tx = Math.max(PAD, Math.floor((VW - ttW) / 2));
        // Vertical: prefer above cursor; if overflow, push up; final clamp to top
        if (ty < PAD) ty = my + 16;
        if (ty + ttH > VH - PAD) ty = VH - ttH - PAD;
        if (ty < PAD) ty = PAD;
        tt.style.left = tx + "px";
        tt.style.top = ty + "px";
        tt.classList.add("visible");
        // 2026-05-06: tooltip_view event with 10% sampling. Tooltip can fire
        // dozens of times per session via desktop hover; full-rate would dwarf
        // every other event. 10% gives a representative signal of which
        // occupations attract attention without blowing up event volume.
        // Sampled per tooltip-show, not per occupation, so a hot occupation's
        // tail still reaches GA4 statistically.
        if (window.gtag && Math.random() < 0.10) {
          gtag("event", "tooltip_view", {
            occupation_id: d.id,
            ai_risk_score: d.ai_risk != null ? d.ai_risk : 0,
            language: lang,
          });
        }
      }
      function hideTooltip() {
        const tt = document.getElementById("tooltip");
        tt.classList.remove("visible");
        tt.classList.remove("touch-mode");
        lastTooltipId = null;
      }

      // ---- Rich per-layer stats panel ----
      function buildHistogram(values, bins) {
        const counts = new Array(bins).fill(0);
        if (values.length === 0) return counts;
        const min = Math.min(...values), max = Math.max(...values);
        const range = max - min || 1;
        for (const v of values) {
          let idx = Math.floor(((v - min) / range) * bins);
          if (idx >= bins) idx = bins - 1;
          counts[idx]++;
        }
        return counts;
      }
      function renderHistogram(counts) {
        const max = Math.max(1, ...counts);
        return `<div class="mini-hist">${counts.map((c, i) => {
          const tColor = bins => i / Math.max(1, bins - 1);
          const color = paletteCSS(tColor(counts.length), 0.85);
          return `<div class="bar" style="height:${(c/max*100)}%;background:${color}" title="${c}"></div>`;
        }).join("")}</div>`;
      }
      function renderTierTable(rows) {
        // rows: [[label, count, totalWorkers], ...]
        const totalCount = rows.reduce((s, r) => s + r[1], 0);
        return `<table class="tier-table">${rows.map(([lbl, n, _w]) => {
          const pct = totalCount > 0 ? (n / totalCount * 100).toFixed(0) : 0;
          return `<tr><td>${lbl}</td><td>${n}</td><td>${pct}%</td></tr>`;
        }).join("")}</table>`;
      }
      // Default-safe: every input is escapeHtml'd before interpolation. Most
      // callers pass occupation names from data.json (highest-pay, oldest,
      // longest-hours, top-recruit-ratio) — escaping is correct. Numeric
      // strings ("5.0 / 10", "180 h") survive escaping unchanged.
      // Audit CODE-001 R1 — closes the 5 stats-panel injection sites that
      // the first-pass fix missed (lines 2592 / 2620 / 2625 / 2651 / 2677).
      function statBlock(label, value, sub) {
        return `<div class="stat-block">
          <div class="stat-label">${escapeHtml(label)}</div>
          <div class="stat-value">${escapeHtml(value)}</div>
          ${sub ? `<div class="stat-sub">${escapeHtml(sub)}</div>` : ""}
        </div>`;
      }
      // Companion for callers that need to inject pre-built HTML (histogram
      // <div>, tier-table <table>). Callers control safety; the explicit
      // `…HTML` suffix flags this as deliberate trust.
      function statBlockHTML(label, html) {
        return `<div class="stat-block">
          <div class="stat-label">${escapeHtml(label)}</div>
          ${html}
        </div>`;
      }

      function fmtSalary(v) { return v + "万円"; }
      function fmtTotalWages(manYenWeighted) {
        // input: sum of (salary 万円 × workers). Convert to 兆円: ÷ 1e8 (万 × 10000 / 1e12)
        return (manYenWeighted / 1e8).toFixed(1) + " 兆円";
      }

      function updateStats() {
        const panel = document.getElementById("statsPanel");
        if (!panel) return;
        const L = I18N.labels;
        const totalCount = data.length;
        const totalWorkers = data.reduce((s, d) => s + (d.workers || 0), 0);

        // Block 1: total occupations + total workforce (constant across layers)
        const block1 = statBlock(
          L.occupations[lang],
          totalCount.toLocaleString(),
          L.workforce[lang] + ": " + fmtN(totalWorkers) + " 人"
        );

        // Block 2-6 specific to layer
        let blocks = [block1];

        if (layer === "ai_risk") {
          const items = data.filter(d => d.ai_risk != null && d.workers);
          const totalW = items.reduce((s, d) => s + d.workers, 0);
          const wAvg = items.reduce((s, d) => s + d.ai_risk * d.workers, 0) / totalW;
          const hist = new Array(11).fill(0);
          for (const d of items) hist[Math.round(d.ai_risk)]++;
          const tiers = [
            ["0-2 低",   items.filter(d => d.ai_risk <= 2).length],
            ["3-4 中低", items.filter(d => d.ai_risk >= 3 && d.ai_risk <= 4).length],
            ["5-6 中",   items.filter(d => d.ai_risk >= 5 && d.ai_risk <= 6).length],
            ["7-8 高",   items.filter(d => d.ai_risk >= 7 && d.ai_risk <= 8).length],
            ["9-10 最高", items.filter(d => d.ai_risk >= 9).length]
          ].map(([l, n]) => [l, n, 0]);
          const highRiskItems = items.filter(d => d.ai_risk >= 7 && d.salary != null);
          const wagesExposed = highRiskItems.reduce((s, d) => s + d.salary * d.workers, 0);
          const highRiskJobsCount = highRiskItems.length;
          // Cross-tab: avg AI risk by salary band
          const salBands = [[0, 350], [350, 500], [500, 700], [700, 1000], [1000, 9999]];
          // Salary tier label: "350-500万円".
          const fmtSalBand = (lo, hi) => `${lo}-${hi}万円`;
          const ctRows = salBands.map(([lo, hi]) => {
            const sub = items.filter(d => d.salary != null && d.salary >= lo && d.salary < hi);
            if (sub.length === 0) return [fmtSalBand(lo, hi), 0, 0];
            const subW = sub.reduce((s, d) => s + d.workers, 0);
            const wA = sub.reduce((s, d) => s + d.ai_risk * d.workers, 0) / subW;
            return [fmtSalBand(lo, hi), sub.length, wA];
          });

          blocks.push(statBlock(
            L.weightedAvg[lang],
            wAvg.toFixed(1) + " / 10",
            "就業者数で加重"
          ));
          blocks.push(statBlockHTML(L.distribution[lang], renderHistogram(hist)));
          blocks.push(statBlockHTML(L.tiers[lang], renderTierTable(tiers)));
          blocks.push(statBlockHTML(
            "リスク × 年収",
            `<table class="tier-table">${ctRows.map(([b, n, a]) =>
              `<tr><td>${b}</td><td>${n}</td><td>${a ? a.toFixed(1) : "—"}</td></tr>`).join("")}</table>`
          ));
          blocks.push(statBlock(
            L.wagesExposed[lang],
            fmtTotalWages(wagesExposed),
            highRiskJobsCount + " 職業"
          ));
        } else if (layer === "salary") {
          const items = data.filter(d => d.salary != null && d.workers);
          const totalW = items.reduce((s, d) => s + d.workers, 0);
          const wAvg = items.reduce((s, d) => s + d.salary * d.workers, 0) / totalW;
          const sortedSal = [...items].sort((a, b) => a.salary - b.salary);
          const median = sortedSal[Math.floor(sortedSal.length / 2)].salary;
          const max = sortedSal[sortedSal.length - 1];
          const totalWages = items.reduce((s, d) => s + d.salary * d.workers, 0);
          const hist = buildHistogram(items.map(d => d.salary), 10);
          // Salary tier labels: ja shows "<400 万" (manen), en converts to millions JPY.
          const tiers = [
            ["<400 万",    items.filter(d => d.salary < 400).length],
            ["400-600 万", items.filter(d => d.salary >= 400 && d.salary < 600).length],
            ["600-800 万", items.filter(d => d.salary >= 600 && d.salary < 800).length],
            ["800-1200 万", items.filter(d => d.salary >= 800 && d.salary < 1200).length],
            ["≥1200 万",    items.filter(d => d.salary >= 1200).length]
          ].map(([l, n]) => [l, n, 0]);

          blocks.push(statBlock(
            L.weightedAvg[lang],
            Math.round(wAvg) + " 万円",
            "中央値: " + median + " 万"
          ));
          blocks.push(statBlockHTML(L.distribution[lang], renderHistogram(hist)));
          blocks.push(statBlockHTML(L.tiers[lang], renderTierTable(tiers)));
          blocks.push(statBlock(
            L.topPay[lang],
            max.name_ja,
            fmtSalary(max.salary)
          ));
          blocks.push(statBlock(L.totalWages[lang], fmtTotalWages(totalWages)));
        } else if (layer === "age") {
          const items = data.filter(d => d.age != null && d.workers);
          const totalW = items.reduce((s, d) => s + d.workers, 0);
          const wAvg = items.reduce((s, d) => s + d.age * d.workers, 0) / totalW;
          const hist = buildHistogram(items.map(d => d.age), 10);
          const tiers = [
            ["<35 歳",  items.filter(d => d.age < 35).length],
            ["35-40",   items.filter(d => d.age >= 35 && d.age < 40).length],
            ["40-45",   items.filter(d => d.age >= 40 && d.age < 45).length],
            ["45-50",   items.filter(d => d.age >= 45 && d.age < 50).length],
            ["≥50 歳", items.filter(d => d.age >= 50).length]
          ].map(([l, n]) => [l, n, 0]);
          const oldest = [...items].sort((a, b) => b.age - a.age)[0];
          const youngest = [...items].sort((a, b) => a.age - b.age)[0];

          blocks.push(statBlock(
            L.weightedAvg[lang],
            wAvg.toFixed(1) + " 歳",
            "就業者数で加重"
          ));
          blocks.push(statBlockHTML(L.distribution[lang], renderHistogram(hist)));
          blocks.push(statBlockHTML(L.tiers[lang], renderTierTable(tiers)));
          blocks.push(statBlock(
            L.oldestField[lang],
            oldest.name_ja,
            oldest.age + " 歳"
          ));
          blocks.push(statBlock(
            L.youngestField[lang],
            youngest.name_ja,
            youngest.age + " 歳"
          ));
        } else if (layer === "hours") {
          const items = data.filter(d => d.hours != null && d.workers);
          const totalW = items.reduce((s, d) => s + d.workers, 0);
          const wAvg = items.reduce((s, d) => s + d.hours * d.workers, 0) / totalW;
          const hist = buildHistogram(items.map(d => d.hours), 10);
          const tiers = [
            ["<150 h",  items.filter(d => d.hours < 150).length],
            ["150-160", items.filter(d => d.hours >= 150 && d.hours < 160).length],
            ["160-170", items.filter(d => d.hours >= 160 && d.hours < 170).length],
            ["170-180", items.filter(d => d.hours >= 170 && d.hours < 180).length],
            ["≥180 h",  items.filter(d => d.hours >= 180).length]
          ].map(([l, n]) => [l, n, 0]);
          const longest = [...items].sort((a, b) => b.hours - a.hours)[0];

          blocks.push(statBlock(
            L.weightedAvg[lang],
            wAvg.toFixed(1) + " 時間",
            "月間就業者加重"
          ));
          blocks.push(statBlockHTML(L.distribution[lang], renderHistogram(hist)));
          blocks.push(statBlockHTML(L.tiers[lang], renderTierTable(tiers)));
          blocks.push(statBlock(
            L.longestHrs[lang],
            longest.name_ja,
            longest.hours + " h"
          ));
        } else if (layer === "recruit_ratio") {
          const items = data.filter(d => d.recruit_ratio != null && d.workers);
          const totalW = items.reduce((s, d) => s + d.workers, 0);
          const wAvg = items.reduce((s, d) => s + d.recruit_ratio * d.workers, 0) / totalW;
          const hist = buildHistogram(items.map(d => Math.log10(Math.max(0.1, d.recruit_ratio))), 10);
          const tiers = [
            ["<0.5x",  items.filter(d => d.recruit_ratio < 0.5).length],
            ["0.5-1x", items.filter(d => d.recruit_ratio >= 0.5 && d.recruit_ratio < 1).length],
            ["1-2x",   items.filter(d => d.recruit_ratio >= 1 && d.recruit_ratio < 2).length],
            ["2-5x",   items.filter(d => d.recruit_ratio >= 2 && d.recruit_ratio < 5).length],
            ["≥5x",    items.filter(d => d.recruit_ratio >= 5).length]
          ].map(([l, n]) => [l, n, 0]);
          const top = [...items].sort((a, b) => b.recruit_ratio - a.recruit_ratio)[0];

          blocks.push(statBlock(
            L.weightedAvg[lang],
            wAvg.toFixed(2) + "x",
            "1.0 = 需給均衡"
          ));
          blocks.push(statBlockHTML(L.distribution[lang], renderHistogram(hist)));
          blocks.push(statBlockHTML(L.tiers[lang], renderTierTable(tiers)));
          blocks.push(statBlock(
            L.highestDemand[lang],
            top.name_ja,
            top.recruit_ratio.toFixed(2) + "x"
          ));
        } else if (layer === "education") {
          const items = data.filter(d => d.education_pct);
          const counts = new Array(EDU_LABELS.length).fill(0);
          let uniPlus = 0;
          for (const d of items) {
            const idx = dominantEduIdx(d.education_pct);
            if (idx >= 0) counts[idx]++;
            const uni = (d.education_pct["大卒"] || 0) + (d.education_pct["修士課程卒（修士と同等の専門職学位を含む）"] || 0) + (d.education_pct["博士課程卒"] || 0);
            uniPlus += uni;
          }
          const avgUni = items.length ? (uniPlus / items.length) : 0;
          const tiers = EDU_LABELS.map((lbl, i) => {
            const display = lbl.length > 14 ? lbl.slice(0, 12) + "…" : lbl;
            return [display, counts[i], 0];
          });

          blocks.push(statBlock(
            L.uniDegree[lang],
            avgUni.toFixed(1) + "%",
            "552 職業の平均"
          ));
          blocks.push(statBlockHTML(L.distribution[lang], renderHistogram(counts)));
          blocks.push(statBlockHTML(
            "最多学歴の内訳",
            renderTierTable(tiers)
          ));
        }

        panel.innerHTML = blocks.join("");
      }

      function drawGradientLegend() {
        const c = document.getElementById("gradientLegend");
        const g = c.getContext("2d");
        const reverse = layer === "recruit_ratio";
        for (let x = 0; x < 80; x++) {
          const t = x / 79;
          g.fillStyle = paletteCSS(reverse ? 1 - t : t, 1);
          g.fillRect(x, 0, 1, 8);
        }
        const cfgs = {
          salary: {ja: ["低い", "高い"], en: ["Low", "High"]},
          age: {ja: ["若い", "高い"], en: ["Young", "Older"]},
          hours: {ja: ["短い", "長い"], en: ["Short", "Long"]},
          recruit_ratio: {ja: ["低い", "高い"], en: ["Low demand", "High demand"]},
          education: {ja: ["学歴低", "学歴高"], en: ["Low edu", "High edu"]},
          ai_risk: {ja: ["低リスク", "高リスク"], en: ["Low risk", "High risk"]}
        };
        const cfg = cfgs[layer] || cfgs.salary;
        document.getElementById("legendLow").textContent = cfg[lang][0];
        document.getElementById("legendHigh").textContent = cfg[lang][1];
      }

      // ---- Layer toggle ----
      function updateDimensionHint() {
        const titles = I18N.statTitle[layer] || {ja: layer, en: layer};
        const ja = document.getElementById("hintLayerJa");
        const en = document.getElementById("hintLayerEn");
        if (ja) ja.textContent = titles.ja;
        if (en) en.textContent = titles.en;
      }
      const layerToggleEl = document.getElementById("layerToggle");
      if (layerToggleEl) layerToggleEl.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn || !btn.dataset.mode) return;
        const from = layer;
        layer = btn.dataset.mode;
        if (from !== layer && window.gtag) gtag("event", "layer_change", {
          layer_name: layer,
          from_layer: from,
          language: lang,
        });
        document.querySelectorAll("#layerToggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateStats();
        updateDimensionHint();
        drawGradientLegend(); draw();
        updateHash();
      });

      // ---- Palette toggle (colorblind-safe) ----
      const paletteToggleEl = document.getElementById("paletteToggle");
      if (paletteToggleEl) paletteToggleEl.addEventListener("click", () => {
        const from = palette;
        palette = palette === "viridis" ? "redgreen" : "viridis";
        const btn = paletteToggleEl;
        btn.classList.toggle("active", palette === "viridis");
        btn.setAttribute("aria-pressed", String(palette === "viridis"));
        try { localStorage.setItem("jp-jobs-palette", palette); } catch(e) {}
        if (from !== palette && window.gtag) gtag("event", "palette_change", {
          palette: palette,
          language: lang,
        });
        drawGradientLegend(); draw();
      });
      // Restore palette preference
      try {
        const stored = localStorage.getItem("jp-jobs-palette");
        if (stored === "viridis") {
          palette = "viridis";
          const btn = document.getElementById("paletteToggle");
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
        }
      } catch(e) {}

      // ---- Search filter ----
      function applyFilter(query) {
        searchQuery = query.trim().toLowerCase();
        let matchCount = 0;
        if (!searchQuery) {
          dimmedIds = null;
          document.getElementById("searchCount").textContent = "";
        } else {
          const matches = data.filter(d =>
            (d.name_ja || "").toLowerCase().includes(searchQuery) ||
            (d.name_en || "").toLowerCase().includes(searchQuery)
          );
          dimmedIds = new Set(matches.map(d => d.id));
          matchCount = matches.length;
          document.getElementById("searchCount").textContent = I18N.searchHits[lang](matches.length);
        }
        draw();
        return matchCount;
      }
      let searchDebounce = null;
      // Separate, longer debounce so job_search_typed fires once per pause-in-typing
      // instead of once per keystroke. 800 ms is the threshold treated as "user stopped".
      let searchAnalyticsDebounce = null;
      let lastSearchTracked = "";
      // P0-A: split "typed" (every paused query) from "intent" (user actually engaged
      // with autocomplete — arrow keys / hover ≥ 500ms / form submit / suggestion click).
      // Real CTR = job_search_navigate / job_search_intent.
      let lastIntentTracked = "";
      // 2026-05-06 PII audit: users sometimes type personal info into search
      // (their own phone / email / long names) — strip the obvious patterns
      // before any query string leaves the browser. We trade some search-term
      // analytics fidelity for never logging user PII to GA4.
      // Patterns:
      //   - 10+ consecutive digits → likely phone / postal / ID → drop
      //   - Anything with "@" + alphanumeric → likely email → drop
      //   - Length > 30 chars → unusually long, suspect → drop
      // Returns "" to signal "do not log this query" (the event still fires
      // but with empty query — preserves count without leaking content).
      function sanitizeSearchQuery(q) {
        if (!q) return "";
        if (q.length > 30) return "";
        if (/\d{10,}/.test(q)) return "";
        if (/@[A-Za-z0-9]/.test(q)) return "";
        return q.slice(0, 100);
      }
      function fireSearchIntent(source, query) {
        const trimmed = (query || "").trim();
        if (!trimmed || trimmed === lastIntentTracked) return;
        lastIntentTracked = trimmed;
        if (window.gtag) gtag("event", "job_search_intent", {
          query: sanitizeSearchQuery(trimmed),
          intent_source: source,
          language: lang,
        });
      }
      // Both #searchInput (desktop) and #searchInputMobile (mobile-hero, Design.md §7.11)
      // call the same applyFilter pipeline. We mirror values across both so a viewport
      // resize never strands a query in the wrong field.
      const searchInputs = [
        document.getElementById("searchInput"),
        document.getElementById("searchInputMobile"),
        document.getElementById("searchInputDesktop"),
      ].filter(Boolean);
      searchInputs.forEach(inp => {
        inp.addEventListener("input", e => {
          const v = e.target.value;
          searchInputs.forEach(other => { if (other !== inp) other.value = v; });
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => applyFilter(v), 100);
          // P0-A: rename job_search_submit → job_search_typed. This event is the
          // raw "user paused while typing" signal — it fires for BOTH visual-filter
          // intent AND navigate intent, so it can no longer be used as a CTR
          // denominator. Use job_search_intent for that.
          clearTimeout(searchAnalyticsDebounce);
          searchAnalyticsDebounce = setTimeout(() => {
            const trimmed = v.trim();
            if (!trimmed || trimmed === lastSearchTracked) return;
            lastSearchTracked = trimmed;
            if (window.gtag) gtag("event", "job_search_typed", {
              query: sanitizeSearchQuery(trimmed),
              match_count: dimmedIds ? dimmedIds.size : 0,
              language: lang,
            });
          }, 800);
        });
      });

      // ─── Stage 1 PREVIEW: direct-nav search + chips + autocomplete ─────────
      // Chip click → 1-step direct nav to a mapped occupation page.
      // Some chip labels are category words (事務職, 営業, カスタマーサポート) that don't
      // exactly match any single row in data.json — map them to the most representative
      // occupation. Exact-match chips (看護師) just navigate to themselves.
      const CHIP_TO_JOB = {
        "事務職": "一般事務",
        "経理": "経理事務",
        "営業": "営業事務",
        "カスタマーサポート": "コールセンターオペレーター",
        "看護師": "看護師"
      };

      function findJobByName(name) {
        if (!name) return null;
        return data.find(d => (d.name_ja || "") === name || (d.name_en || "") === name) || null;
      }

      function navigateToJob(rec, source) {
        if (!rec) return;
        if (window.gtag) gtag("event", source === "chip" ? "popular_job_click" : "job_search_navigate", {
          occupation_id: rec.id,
          occupation_name_ja: (rec.name_ja || "").slice(0, 100),
          occupation_name_en: (rec.name_en || "").slice(0, 100),
          ai_risk_score: rec.ai_risk != null ? rec.ai_risk : 0,
          language: lang,
          source: source
        });
        // Use location.href (stays in same tab) so the user follows the conversion path.
        window.location.href = occUrl(rec);
      }

      // Rank matches for a query string. Tier order: exact name → starts-with → contains.
      // Within each tier sort by name length asc (shorter = more specific).
      function rankMatches(query, limit) {
        const q = (query || "").trim().toLowerCase();
        if (!q || !data.length) return [];
        const matches = data.filter(d =>
          (d.name_ja || "").toLowerCase().includes(q) ||
          (d.name_en || "").toLowerCase().includes(q)
        );
        matches.sort((a, b) => {
          const an = (a.name_ja || "").toLowerCase();
          const bn = (b.name_ja || "").toLowerCase();
          const aTier = an === q ? 0 : (an.startsWith(q) ? 1 : 2);
          const bTier = bn === q ? 0 : (bn.startsWith(q) ? 1 : 2);
          if (aTier !== bTier) return aTier - bTier;
          return an.length - bn.length;
        });
        return limit ? matches.slice(0, limit) : matches;
      }

      // Schema.org SearchAction handler — matches WebSite#potentialAction.
      // Reads ?q=... from URL, then either:
      //   - exact name match → redirect to /ja/<id> (best UX from Google search box)
      //   - partial match    → pre-fill all hero search inputs + trigger autocomplete
      // Called from the data.treemap.json .then() so `data` is guaranteed populated.
      function handleSearchActionQuery() {
        const params = new URLSearchParams(window.location.search);
        const query = (params.get("q") || "").trim();
        if (!query || !data.length) return;

        const matches = rankMatches(query, 5);
        if (matches.length > 0) {
          const top = matches[0];
          const topNameJa = (top.name_ja || "").toLowerCase();
          const topNameEn = (top.name_en || "").toLowerCase();
          const q = query.toLowerCase();
          // Exact match → redirect (use replace so the back button skips this hop)
          if (topNameJa === q || topNameEn === q) {
            if (window.gtag) gtag("event", "search_action_redirect", {
              query: query.slice(0, 100),
              occupation_id: top.id,
              language: "ja"
            });
            window.location.replace(occUrl(top));
            return;
          }
        }

        // Partial / no match → pre-fill all 3 hero inputs (only the visible one
        // is seen; the other two are hidden but exist in the DOM)
        ["searchInputDesktop", "searchInputMobile", "searchInput"].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.value = query;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });

        // Focus the visible one based on viewport
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        const target = isMobile
          ? document.getElementById("searchInputMobile")
          : document.getElementById("searchInputDesktop");
        if (target) {
          try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
        }

        if (window.gtag) gtag("event", "search_action_landed", {
          query: query.slice(0, 100),
          match_count: matches.length,
          language: "ja"
        });
      }

      // Chip click — direct nav (covers BOTH desktop-hero-chips and mobile-hero-chips).
      document.querySelectorAll(".desktop-hero-chips button, .mobile-hero-chips button").forEach(btn => {
        btn.addEventListener("click", () => {
          const label = btn.dataset.chip || btn.textContent.trim();
          const targetName = CHIP_TO_JOB[label] || label;
          let rec = findJobByName(targetName);
          if (!rec) {
            // Fallback: substring match → first ranked result.
            const ranked = rankMatches(targetName, 1);
            rec = ranked[0];
          }
          if (rec) {
            navigateToJob(rec, "chip");
          } else {
            // Nothing matched anywhere — visible feedback instead of silent no-op.
            const nr = document.getElementById("searchNoResult");
            if (nr) nr.classList.add("visible");
          }
        });
      });

      // Form submit (Enter / click "気になる職業から始める" desktop / 診断 mobile) → direct nav to top match.
      function wireSearchSubmit(formId, inputId) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const inp = document.getElementById(inputId);
          const q = inp ? inp.value.trim() : "";
          const noResultEl = document.getElementById("searchNoResult");
          if (!q) return;
          // P0-A: form submit = clear navigate-intent, regardless of whether a
          // match exists. "Submitted but no match" is a real funnel step.
          fireSearchIntent("submit", q);
          const matches = rankMatches(q, 1);
          if (matches.length === 0) {
            if (noResultEl) noResultEl.classList.add("visible");
            return;
          }
          if (noResultEl) noResultEl.classList.remove("visible");
          navigateToJob(matches[0], "search_submit");
        });
      }
      wireSearchSubmit("dhSearchForm", "searchInputDesktop");
      wireSearchSubmit("mhSearchForm", "searchInputMobile");

      // Phase 7 mobile hamburger menu — toggle expand/collapse + Esc + body scroll lock.
      // Note: the BaseLayout-driven pages get the same logic from MobileNav.astro's
      // inline <script>. The home page can't use BaseLayout, so this is the inline
      // copy. Both implementations watch `mobBurger` / `mobDrawer` IDs.
      (function wireMobileNav() {
        const burger = document.getElementById("mobBurger");
        const drawer = document.getElementById("mobDrawer");
        if (!burger || !drawer) return;
        if (burger.dataset.wired === "1") return;
        burger.dataset.wired = "1";

        let lastFocus = null;

        function setOpen(open) {
          burger.setAttribute("aria-expanded", String(open));
          burger.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
          if (open) {
            lastFocus = document.activeElement;
            drawer.hidden = false;
            document.body.style.overflow = "hidden";
            requestAnimationFrame(() => {
              const first = drawer.querySelector("a");
              if (first) first.focus();
            });
          } else {
            drawer.hidden = true;
            document.body.style.overflow = "";
            if (lastFocus && typeof lastFocus.focus === "function") {
              try { lastFocus.focus(); } catch (e) {}
            }
          }
        }

        burger.addEventListener("click", () => {
          setOpen(burger.getAttribute("aria-expanded") !== "true");
        });

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
            setOpen(false);
          }
        });

        // Close on any link tap inside the drawer (browser navigates after).
        drawer.addEventListener("click", (e) => {
          let t = e.target;
          while (t && t !== drawer) {
            if (t.tagName === "A") { setOpen(false); return; }
            t = t.parentNode;
          }
        });

        window.addEventListener("pageshow", () => {
          document.body.style.overflow = "";
        });
      })();

      // Live autocomplete dropdown — top 8 matches as user types.
      // v1.2.0: wired to BOTH desktop hero (#searchInputDesktop / #searchSuggest)
      // AND mobile hero (#searchInputMobile / #searchSuggestMobile) so mobile
      // users get the same suggest experience.
      function attachSuggest(inputId, suggestId, parentSelector) {
        const inputEl = document.getElementById(inputId);
        const suggestEl = document.getElementById(suggestId);
        if (!inputEl || !suggestEl) return;
        let focusedIdx = -1;
        // P0-D (2026-05-06): mobile touch state machine + iOS keyboard sizing.
        //   touchActiveOnDropdown — set during touchstart…touchend+grace so the
        //     blur-timeout doesn't hide the dropdown mid-scroll.
        //   touchState — for tap-vs-scroll discrimination (mirrors §6.7 canvas).
        const TAP_SLOP_PX = 10;
        const TAP_MAX_MS = 500;
        let touchActiveOnDropdown = false;
        let touchState = null;

        // RA-014 (2026-05-18): mirror dropdown open/close into the input's
        // aria-expanded so screen readers announce listbox state.
        function setExpanded(open) {
          try { inputEl.setAttribute("aria-expanded", open ? "true" : "false"); } catch (e) {}
        }
        function render(q) {
          const matches = rankMatches(q, 8);
          if (matches.length === 0) {
            suggestEl.classList.remove("visible");
            suggestEl.innerHTML = "";
            focusedIdx = -1;
            setExpanded(false);
            return;
          }
          // P0-C: keyboard hint row at top of dropdown — desktop only.
          // matchMedia detection: touch devices skip hint to keep dropdown compact.
          const isTouchDevice = window.matchMedia &&
            window.matchMedia("(hover: none) and (pointer: coarse)").matches;
          const hintLabel = "↑↓ で選択  ·  Enter で開く";
          const hintHtml = isTouchDevice
            ? ""
            : '<li class="ss-hint" aria-hidden="true">' + escapeHtml(hintLabel) + '</li>';
          // P0-B: auto-highlight the first option so Enter just works without
          // requiring the user to press ↓ first. data-idx="0" is the first match.
          suggestEl.innerHTML = hintHtml + matches.map((rec, i) => {
            const nameJa = rec.name_ja || "";
            const nameEn = rec.name_en || "";
            const display = nameJa || nameEn;
            const risk = rec.ai_risk != null ? rec.ai_risk : 0;
            const tier = risk >= 7 ? "high" : (risk >= 5 ? "mid" : "low");
            const riskLabel = "AI 影響度 " + risk + "/10";
            const focusClass = i === 0 ? " focused" : "";
            return '<li role="option" class="ss-item' + focusClass + '" data-job-id="' + Number(rec.id) + '" data-idx="' + Number(i) + '">' +
              '<span class="ss-name">' + escapeHtml(display) + '</span>' +
              '<span class="ss-risk ' + tier + '">' + escapeHtml(riskLabel) + '</span>' +
              '</li>';
          }).join("");
          suggestEl.classList.add("visible");
          focusedIdx = 0;
          setExpanded(true);
        }

        inputEl.addEventListener("input", () => {
          render(inputEl.value);
          const nr = document.getElementById("searchNoResult");
          if (nr) nr.classList.remove("visible");
        });
        inputEl.addEventListener("focus", () => {
          if (inputEl.value.trim()) render(inputEl.value);
          // P0-D F1: ensure dropdown is sized to fit between input and keyboard.
          fitDropdownToViewport();
        });
        inputEl.addEventListener("blur", () => {
          // Delay so click/touch-on-item registers before blur hides the list.
          // P0-D F3: if a finger is currently mid-gesture on the dropdown
          // (scrolling or tapping), defer the hide — touchend will clear the
          // flag once the gesture finishes.
          setTimeout(() => {
            if (touchActiveOnDropdown) return;
            suggestEl.classList.remove("visible");
          }, 150);
        });
        inputEl.addEventListener("keydown", (e) => {
          if (!suggestEl.classList.contains("visible")) return;
          // P0-C: only data-job-id items are navigable. Skip the .ss-hint row.
          const items = suggestEl.querySelectorAll("li[data-job-id]");
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            // P0-A: arrow-key navigation = clear keyboard intent.
            fireSearchIntent("arrow_keys", inputEl.value);
            focusedIdx = (focusedIdx + 1) % items.length;
            items.forEach((el, i) => el.classList.toggle("focused", i === focusedIdx));
            items[focusedIdx].scrollIntoView({ block: "nearest" });
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            fireSearchIntent("arrow_keys", inputEl.value);
            focusedIdx = focusedIdx <= 0 ? items.length - 1 : focusedIdx - 1;
            items.forEach((el, i) => el.classList.toggle("focused", i === focusedIdx));
            items[focusedIdx].scrollIntoView({ block: "nearest" });
          } else if (e.key === "Enter" && focusedIdx >= 0) {
            e.preventDefault();
            // P0-A: Enter on a focused suggestion = strongest commit-intent signal.
            // P0-B: focusedIdx now defaults to 0 on render(), so Enter works immediately.
            fireSearchIntent("submit", inputEl.value);
            const id = parseInt(items[focusedIdx].dataset.jobId, 10);
            const rec = data.find(d => d.id === id);
            if (rec) navigateToJob(rec, "suggest_keyboard");
          } else if (e.key === "Escape") {
            suggestEl.classList.remove("visible");
            focusedIdx = -1;
          }
        });

        // === Pointer / Touch handling — Design.md §6.7 + §7.12 (P0-D F2) ===
        // Desktop (mousedown): immediate selection.
        // Mobile: tap-vs-scroll state machine — touchstart only RECORDS the
        //   start point + time; touchend evaluates whether the gesture was a
        //   tap (< TAP_SLOP_PX displacement AND < TAP_MAX_MS duration). Only
        //   taps trigger nav. Drags (= scroll intent) and long-presses get a
        //   no-op so the user can browse the dropdown without picking by accident.
        // P0-C: closest("li[data-job-id]") skips the .ss-hint row so hint clicks no-op.
        const selectFromEvent = (e) => {
          const li = e.target.closest("li[data-job-id]");
          if (!li) return;
          e.preventDefault();
          // P0-A: click/tap on a suggestion = strongest commit-intent signal.
          fireSearchIntent("click", inputEl.value);
          const id = parseInt(li.dataset.jobId, 10);
          const rec = data.find(d => d.id === id);
          if (rec) navigateToJob(rec, "suggest_click");
        };
        suggestEl.addEventListener("mousedown", selectFromEvent);

        suggestEl.addEventListener("touchstart", (e) => {
          touchActiveOnDropdown = true;
          const t = e.touches && e.touches[0];
          if (!t) { touchState = null; return; }
          touchState = {
            x: t.clientX,
            y: t.clientY,
            t0: Date.now(),
            target: e.target,
          };
        }, { passive: true });

        suggestEl.addEventListener("touchend", (e) => {
          // Hold the active flag briefly so a blur-timeout that fires during
          // navigateToJob doesn't race the hide.
          setTimeout(() => { touchActiveOnDropdown = false; }, 350);
          if (!touchState) return;
          const t = e.changedTouches && e.changedTouches[0];
          const state = touchState;
          touchState = null;
          if (!t) return;
          const dx = t.clientX - state.x;
          const dy = t.clientY - state.y;
          const dt = Date.now() - state.t0;
          const wasTap = Math.hypot(dx, dy) < TAP_SLOP_PX && dt < TAP_MAX_MS;
          if (!wasTap) return; // scroll or long-press — let the user keep browsing
          const li = state.target && state.target.closest && state.target.closest("li[data-job-id]");
          if (!li) return;
          // Suppress the synthetic click that follows touchend so we don't double-fire.
          e.preventDefault();
          fireSearchIntent("click", inputEl.value);
          const id = parseInt(li.dataset.jobId, 10);
          const rec = data.find(d => d.id === id);
          if (rec) navigateToJob(rec, "suggest_click");
        });

        suggestEl.addEventListener("touchcancel", () => {
          touchState = null;
          touchActiveOnDropdown = false;
        });

        // P0-A: hover ≥ 500 ms on a suggestion = mouse-driven engagement intent.
        // Fires once per query (deduped inside fireSearchIntent). Touch devices
        // emit a synthetic mouseover after tap — guarded by no-op since by then
        // mousedown's "click" intent has already set lastIntentTracked.
        let hoverTimer = null;
        suggestEl.addEventListener("mouseover", (e) => {
          const li = e.target.closest("li[data-job-id]");
          if (!li) return;
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => {
            fireSearchIntent("hover", inputEl.value);
          }, 500);
        });
        suggestEl.addEventListener("mouseout", () => {
          clearTimeout(hoverTimer);
        });

        // === P0-D F1: visualViewport-aware max-height ===
        // iOS Safari's `100vh` does NOT shrink when the keyboard appears, so a
        // fixed max-height: 360px gets pushed half-off-screen behind the keyboard.
        // visualViewport.height reflects the real visible region — recompute on
        // focus / resize / scroll so the dropdown always fits between the input
        // bottom and the keyboard top. Falls back to the CSS max-height when
        // visualViewport is unavailable (older browsers).
        function fitDropdownToViewport() {
          if (!window.visualViewport) return;
          const vh = window.visualViewport.height;
          const inputBottom = inputEl.getBoundingClientRect().bottom;
          const available = vh - inputBottom - 12; // 12px breathing room
          const next = Math.max(160, available);
          suggestEl.style.maxHeight = next + "px";
        }
        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", fitDropdownToViewport);
          window.visualViewport.addEventListener("scroll", fitDropdownToViewport);
        }

        // Click outside the hero-search container closes the dropdown.
        document.addEventListener("click", (e) => {
          const inside = e.target.closest(parentSelector);
          if (!inside) suggestEl.classList.remove("visible");
        });
      }
      attachSuggest("searchInputDesktop", "searchSuggest",       ".desktop-hero-search");
      attachSuggest("searchInputMobile",  "searchSuggestMobile", ".mobile-hero-search");

      // ---- Pointer/Touch handling for mobile vs desktop ----
      // Touch state machine — Design.md §6.7. Distinguishes scroll-intent vs tap-intent
      // so the canvas doesn't lock native scrolling when the finger lands on a tile.
      // Tap fires on touchend if total displacement < TAP_SLOP_PX AND duration < TAP_MAX_MS.
      const TAP_SLOP_PX = 10;
      const TAP_MAX_MS = 500;
      let touchStart = null;

      function handleTouchTap(clientX, clientY) {
        const hit = hitTest(clientX, clientY);
        if (!hit) {
          hideTooltip();
          hovered = null;
          lastTapped = null;
          setHighlight(null);
          return;
        }
        const tt = document.getElementById("tooltip");
        if (lastTapped && lastTapped.id === hit.id && Date.now() - lastTapTime < 1500) {
          // Second tap on same tile -> open detail page (legacy shortcut, kept alongside the visible CTA)
          if (window.gtag) gtag("event", "tile_double_tap_open", {
            occupation_id: hit.id,
            ai_risk_score: hit.ai_risk != null ? hit.ai_risk : 0,
            language: lang,
          });
          fireTileClick(hit, "touch_tap");
          // Same-tab navigation: stay in the user's current tab. GA event
          // above is already queued via beacon transport; safe to navigate
          // immediately afterwards without losing the event.
          window.location.href = occUrl(hit);
          lastTapped = null;
          hideTooltip();
          return;
        }
        lastTapped = hit;
        lastTapTime = Date.now();
        hovered = hit;
        keyboardIdx = rects.indexOf(hit);
        const cb = canvasRect || canvas.getBoundingClientRect();
        const cx = cb.left + hit.rx + hit.rw / 2;
        const cy = cb.top + hit.ry + hit.rh / 2;
        scheduleTooltip(hit, cx, cy);
        tt.classList.add("touch-mode");
        setHighlight(hit);
        updateHash();
      }

      // touchstart: only RECORD the start point. passive: true means the browser
      // can keep native scrolling fluid — we no longer steal the gesture.
      canvas.addEventListener("touchstart", e => {
        if (e.touches && e.touches[0]) {
          touchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            t: Date.now(),
          };
        } else {
          touchStart = null;
        }
      }, { passive: true });

      // touchend: decide whether the gesture was a tap (small displacement, short time).
      // changedTouches has the lifted finger position. If it was a scroll, do nothing.
      canvas.addEventListener("touchend", e => {
        if (!touchStart) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) { touchStart = null; return; }
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        const dt = Date.now() - touchStart.t;
        const wasTap = Math.hypot(dx, dy) < TAP_SLOP_PX && dt < TAP_MAX_MS;
        touchStart = null;
        if (wasTap) {
          // Synthetic click follows touchend on most browsers; suppress it so we don't
          // double-fire (canvas click handler also opens detail page on hit).
          if (typeof e.preventDefault === "function") e.preventDefault();
          handleTouchTap(t.clientX, t.clientY);
        }
      }, { passive: false });

      canvas.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });

      canvas.addEventListener("mousemove", e => {
        // Skip if this is a synthesized mouse event from a touch (Chrome fires both)
        const hit = hitTest(e.clientX, e.clientY);
        if (hit !== hovered) { hovered = hit; lastTooltipId = null; setHighlight(hit); }
        if (hovered) { scheduleTooltip(hovered, e.clientX, e.clientY); canvas.style.cursor = "pointer"; }
        else { hideTooltip(); canvas.style.cursor = "default"; }
      });
      canvas.addEventListener("click", e => {
        // On touch devices, suppress click handling — touchstart already handled it
        // (most browsers will fire click after touchstart but our preventDefault should suppress it)
        if (lastTapped) { return; }
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) {
          fireTileClick(hit, "desktop_click");
          // Same-tab navigation. updateHashFor() before the navigate so the
          // outgoing /#jobid=N entry is in history; back-button returns
          // here with that hash, scrolling the right tile back into view.
          updateHashFor(hit.id);
          window.location.href = occUrl(hit);
        }
      });
      canvas.addEventListener("mouseleave", () => {
        if (!isTouchDevice) { hovered = null; hideTooltip(); setHighlight(null); }
      });

      // Tooltip close button (used on touch devices)
      document.getElementById("tooltipClose").addEventListener("click", () => {
        hideTooltip();
        hovered = null;
        lastTapped = null;
        setHighlight(null);
      });

      // Tooltip CTA — Design.md §6.6. Fires GA4 tooltip_cta_click before navigation.
      // The link is a plain <a href="/ja/<id>"> — we don't preventDefault here.
      // GA event fires (beacon transport), then the browser navigates in the
      // SAME tab. Was target="_blank" until 2026-05-09; users found new-tab
      // behavior on internal links surprising.
      document.getElementById("tooltipCta").addEventListener("click", e => {
        const cta = e.currentTarget;
        const occId = parseInt(cta.dataset.occId || "0", 10) || 0;
        const aiRisk = parseInt(cta.dataset.aiRisk || "0", 10);
        const tier = aiRisk >= 7 ? "high" : (aiRisk >= 5 ? "mid" : "low");
        if (window.gtag) gtag("event", "tooltip_cta_click", {
          occupation_id: occId,
          ai_risk_score: aiRisk,
          risk_tier: tier,
          language: lang,
        });
      });

      // Tap outside canvas + tooltip dismisses the touch-mode tooltip.
      // Only engages when tooltip is in touch-mode (i.e., shown via tap), so desktop hover behavior is unchanged.
      document.addEventListener("pointerdown", e => {
        const tt = document.getElementById("tooltip");
        if (!tt.classList.contains("touch-mode")) return;
        if (!tt.classList.contains("visible")) return;
        if (tt.contains(e.target)) return;        // tap inside tooltip (X button, scroll) — don't dismiss
        if (e.target === canvas) return;          // tap on canvas — let touchstart/click handle it
        hideTooltip();
        hovered = null;
        lastTapped = null;
        setHighlight(null);
      });

      // ---- Keyboard accessibility ----
      canvas.addEventListener("keydown", e => {
        if (rects.length === 0) return;
        if (keyboardIdx < 0) keyboardIdx = 0;
        let next = keyboardIdx;
        let handled = true;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(rects.length - 1, keyboardIdx + 1);
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, keyboardIdx - 1);
        else if (e.key === "Enter" || e.key === " ") {
          const r = rects[keyboardIdx];
          if (r) {
            fireTileClick(r, "keyboard");
            // Same-tab navigation (a11y: keyboard users expect Enter/Space
            // on a focused tile to follow the link, not pop a new window).
            window.location.href = occUrl(r);
          }
        } else if (e.key === "Escape") {
          hideTooltip(); hovered = null; setHighlight(null);
        } else {
          handled = false;
        }
        if (handled) e.preventDefault();
        if (next !== keyboardIdx) {
          keyboardIdx = next;
          hovered = rects[keyboardIdx];
          lastTooltipId = null;
          const cb = canvasRect || canvas.getBoundingClientRect();
          const r = hovered;
          scheduleTooltip(r, cb.left + r.rx + r.rw / 2, cb.top + r.ry + r.rh / 2);
          setHighlight(r);
          updateHash();
        }
      });

      // ---- URL hash deep-link ----
      function updateHash() {
        if (hovered) updateHashFor(hovered.id);
      }
      function updateHashFor(id) {
        try {
          history.replaceState(null, "", "#" + id);
        } catch(e) {}
      }
      function applyHash() {
        const m = location.hash.match(/^#(\d+)$/);
        if (!m) return;
        const id = parseInt(m[1], 10);
        const target = rects.find(r => r.id === id);
        if (target) {
          hovered = target;
          keyboardIdx = rects.indexOf(target);
          lastTooltipId = null;
          const cb = canvasRect || canvas.getBoundingClientRect();
          scheduleTooltip(target, cb.left + target.rx + target.rw / 2, cb.top + target.ry + target.rh / 2);
          if (isTouchDevice) document.getElementById("tooltip").classList.add("touch-mode");
          setHighlight(target);
          // Scroll canvas into view
          canvas.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      window.addEventListener("hashchange", applyHash);

      // ---- Debounced resize ----
      let resizeTimer = null;
      function resize() { dpr = window.devicePixelRatio || 1; layout(); draw(); refreshCanvasRect(); if (hovered) setHighlight(hovered); }
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 120);
      });

      // ---- Fetch with error handling ----
      function showError(err) {
        const ls = document.getElementById("loadingState");
        if (!ls) return;
        ls.className = "error-state";
        // DOM construction (not innerHTML) so an err.message with HTML
        // characters renders as text. err originates from local fetch
        // failures, so the practical exposure is small, but textContent
        // removes the foot-gun entirely.
        while (ls.firstChild) ls.removeChild(ls.firstChild);
        const top = document.createElement("div");
        top.textContent = "データの読み込みに失敗しました";
        const detail = document.createElement("div");
        detail.style.fontSize = "0.78rem";
        detail.style.color = "var(--fg2)";
        detail.style.marginTop = "6px";
        detail.textContent = (err && err.message) || (typeof err === "string" ? err : "") || "";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "再読込";
        btn.addEventListener("click", function () { location.reload(); });
        ls.appendChild(top);
        ls.appendChild(detail);
        ls.appendChild(btn);
      }

      // v1.2.x: render mobile-only TOP 10 horizontal-swipe carousel.
      // Pulls top-10 by ai_risk desc from the loaded `data` array (treemap projection).
      // Visible only at ≤768px (CSS media query). v1.4.0: JA-only.
      function renderMobileTop10() {
        const track = document.getElementById("mTop10Track");
        const section = document.getElementById("mTop10");
        if (!track || !section || !data.length) return;
        const top10 = [...data]
          .filter(d => d.ai_risk != null)
          .sort((a, b) => b.ai_risk - a.ai_risk)
          .slice(0, 10);
        if (top10.length === 0) return;
        const tag = "大きく変わる仕事";
        const wLabel = "就業者";
        const sLabel = "年収";
        const fmtMan = n => {
          if (n == null) return "—";
          if (n >= 10000) return (n / 10000).toFixed(0) + "万";
          if (n >= 1000)  return (n / 1000).toFixed(1) + "千";
          return String(n);
        };
        const fmtSalary = (manYen) => {
          if (manYen == null) return "—";
          return Math.round(manYen) + "万円";
        };
        track.innerHTML = top10.map((rec, i) => {
          const rank = i + 1;
          const nameJa = rec.name_ja || "";
          const nameEn = rec.name_en || "";
          const display = nameJa || nameEn;
          const sub = nameEn;
          const score = (rec.ai_risk != null) ? Number(rec.ai_risk) : 0;
          const rationaleRaw = rec.ai_rationale_ja || rec.ai_rationale_en || "";
          const wValue = (rec.workers != null) ? (fmtMan(rec.workers) + "人") : "—";
          const sValue = fmtSalary(rec.salary);
          const href = "/ja/" + Number(rec.id);
          return (
            '<a class="m-top10-card" role="listitem" href="' + href + '">' +
              '<span class="m-top10-card-rank">' + rank + " 位" + '</span>' +
              '<div class="m-top10-card-head">' +
                '<span class="m-top10-card-name">' + escapeHtml(display) + '</span>' +
                (sub ? '<span class="m-top10-card-name-en">' + escapeHtml(sub) + '</span>' : "") +
              '</div>' +
              '<div class="m-top10-card-score">' +
                '<span class="num">' + score + '</span>' +
                '<span class="denom">/ 10</span>' +
                '<span class="m-top10-card-tag">' + escapeHtml(tag) + '</span>' +
              '</div>' +
              '<p class="m-top10-card-rationale">' + escapeHtml(rationaleRaw) + '</p>' +
              '<div class="m-top10-card-stats">' +
                '<div class="m-top10-card-stat"><span class="v">' + wValue + '</span><span class="l">' + wLabel + '</span></div>' +
                '<div class="m-top10-card-stat"><span class="v">' + sValue + '</span><span class="l">' + sLabel + '</span></div>' +
              '</div>' +
            '</a>'
          );
        }).join("");
        section.hidden = false;

        // Wire scroll → progress bar + counter update.
        const fill = document.getElementById("mTop10Fill");
        const counter = document.getElementById("mTop10Idx");
        if (fill && counter) {
          let scrollTimer = null;
          track.addEventListener("scroll", () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
              const cards = track.querySelectorAll(".m-top10-card");
              if (!cards.length) return;
              const cardWidth = cards[0].offsetWidth + 14; /* gap */
              const idx = Math.min(top10.length - 1, Math.max(0, Math.round(track.scrollLeft / cardWidth)));
              counter.textContent = String(idx + 1);
              fill.style.width = ((idx + 1) / top10.length * 100) + "%";
            }, 60);
          }, { passive: true });
        }
      }

      fetch("data.treemap.json", { credentials: "omit" })
        .then(r => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(d => {
          data = d;
          percentiles = computePercentiles(data);
          const ls = document.getElementById("loadingState");
          if (ls) ls.remove();
          canvas.style.visibility = "visible";
          // Defer the 552-item screen-reader fallback list until the browser is idle.
          // It's only consumed by assistive tech and never visible — but rendering it inline
          // adds ~552 DOM nodes that triple Style & Layout time on initial paint.
          const fb = document.getElementById("canvasFallback");
          if (fb) {
            const renderFallback = () => {
              fb.innerHTML = data.slice(0, 552).map(d =>
                `<li><a href="${escapeHtml(occUrl(d))}">${escapeHtml(d.name_en || d.name_ja)} / ${escapeHtml(d.name_ja)} — AI risk ${Number(d.ai_risk) || 0}/10</a></li>`
              ).join("");
            };
            if ("requestIdleCallback" in window) {
              requestIdleCallback(renderFallback, { timeout: 3000 });
            } else {
              setTimeout(renderFallback, 1500);
            }
          }
          // v1.4.0: site is JA-only. Initial render uses the JA strings already
          // baked into the markup; no language toggle needed.
          updateStats();
          updateDimensionHint();
          drawGradientLegend();
          resize();
          renderMobileTop10();   // v1.2.x: TOP 10 carousel (mobile only via CSS @media)
          // Apply hash deep-link if present
          if (location.hash) setTimeout(applyHash, 50);
          // Schema.org SearchAction — handle ?q=... from sitelinks search box,
          // social shares, or direct URL access. Runs after data is loaded so
          // exact-match redirect can resolve immediately.
          handleSearchActionQuery();
          // GA4 map_loaded — typed signal that initial render finished. Lets
          // dashboards split sessions by device + occupation count without
          // relying on auto page_view (which fires before data.json arrives).
          if (window.gtag) {
            const _vw = window.innerWidth;
            const _device = _vw < 768 ? "mobile" : (_vw < 1024 ? "tablet" : "desktop");
            gtag("event", "map_loaded", {
              language: "ja",
              device_category: _device,
              tile_count: data.length,
            });
          }
        })
        .catch(showError);

      // ---- Theme toggle (light/dark) ----
      (function themeToggle() {
        // Wire up BOTH the legacy mobile-h1 toggle and the desktop-hero utility toggle.
        const btns = [
          document.getElementById("themeToggle"),
          document.getElementById("themeToggleDesktop"),
        ].filter(Boolean);
        if (!btns.length) return;
        const handler = () => {
          const sysLight = matchMedia("(prefers-color-scheme: light)").matches;
          let saved = null;
          try { saved = localStorage.getItem("theme"); } catch (e) {}
          const cur = document.documentElement.getAttribute("data-theme")
            || (sysLight ? "light" : "dark");
          const next = cur === "light" ? "dark" : "light";
          document.documentElement.setAttribute("data-theme", next);
          try { localStorage.setItem("theme", next); } catch (e) {}
          // Design.md §3.2: canvas must repaint with theme-appropriate palette + bg.
          if (typeof draw === "function") {
            try { draw(); } catch (e) {
              if (typeof console !== 'undefined') console.warn('[theme] treemap redraw failed:', e);
            }
          }
          if (window.gtag) gtag("event", "theme_change", {
            from: cur,
            to: next,
            was_explicit: saved === "light" || saved === "dark",
            system_pref: sysLight ? "light" : "dark"
          });
        };
        btns.forEach(b => b.addEventListener("click", handler));
      })();

      // X follow CTA telemetry (home only — the X follow CTA lives only on
      // the home page).
      (function xFollowTelemetry() {
        const xFollow = document.getElementById("x-follow-cta");
        if (xFollow) xFollow.addEventListener("click", () => {
          if (window.gtag) gtag("event", "x_follow_click");
        });
      })();

      // Footer share buttons — same logic as src/components/Footer.astro
      // (which serves all BaseLayout pages). The home page can't use the
      // component, so this is the inline equivalent. Each share carries the
      // current page URL; uses og:description for share text fallback.
      (function wireShareButtons() {
        const footer = document.querySelector("footer.site-footer");
        if (!footer) return;
        if (footer.dataset.shareWired === "1") return;
        footer.dataset.shareWired = "1";

        const COPY_TOAST = "コピーしました";
        const FALLBACK_TEXT = "日本 552 職業への AI 影響を 0〜10 で可視化したマップ。あなたの仕事は？";

        function shareText() {
          const og = document.querySelector('meta[property="og:description"]');
          if (og && og.content && og.content.length < 240) return og.content;
          return FALLBACK_TEXT;
        }
        function shareUrl(source, medium) {
          const u = new URL(window.location.href);
          u.searchParams.set("utm_source", source);
          u.searchParams.set("utm_medium", medium);
          u.searchParams.set("utm_campaign", "page_share");
          return u.toString();
        }
        function track(platform) {
          if (window.gtag) {
            gtag("event", "share_click", {
              platform: platform,
              page_path: window.location.pathname
            });
          }
        }
        function popOpen(url) { window.open(url, "_blank", "noopener,noreferrer"); }

        const x = footer.querySelector('.share-btn[data-platform="x"]');
        if (x) x.addEventListener("click", e => {
          e.preventDefault();
          popOpen("https://x.com/intent/post?url=" + encodeURIComponent(shareUrl("x", "social")) + "&text=" + encodeURIComponent(shareText()));
          track("x");
        });

        const line = footer.querySelector('.share-btn[data-platform="line"]');
        if (line) line.addEventListener("click", e => {
          e.preventDefault();
          popOpen("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(shareUrl("line", "im")));
          track("line");
        });

        const hatena = footer.querySelector('.share-btn[data-platform="hatena"]');
        if (hatena) hatena.addEventListener("click", e => {
          e.preventDefault();
          popOpen("https://b.hatena.ne.jp/entry/" + shareUrl("hatena", "social").replace(/^https?:\/\//, ""));
          track("hatena");
        });

        const linkedin = footer.querySelector('.share-btn[data-platform="linkedin"]');
        if (linkedin) linkedin.addEventListener("click", e => {
          e.preventDefault();
          popOpen("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(shareUrl("linkedin", "social")));
          track("linkedin");
        });

        const facebook = footer.querySelector('.share-btn[data-platform="facebook"]');
        if (facebook) facebook.addEventListener("click", e => {
          e.preventDefault();
          popOpen("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareUrl("facebook", "social")));
          track("facebook");
        });

        const copy = footer.querySelector('.share-btn[data-platform="copy"]');
        const toast = footer.querySelector(".share-toast");
        if (copy && toast) copy.addEventListener("click", async e => {
          e.preventDefault();
          const url = shareUrl("direct", "copylink");
          try {
            await navigator.clipboard.writeText(url);
            toast.textContent = COPY_TOAST;
          } catch (err) {
            toast.textContent = url;
          }
          toast.classList.add("visible");
          track("copy");
          setTimeout(() => toast.classList.remove("visible"), 2200);
        });

        const native = footer.querySelector('.share-btn[data-platform="native"]');
        if (native) {
          if (typeof navigator.share === "function") {
            native.hidden = false;
            native.addEventListener("click", async e => {
              e.preventDefault();
              try {
                await navigator.share({
                  title: document.title,
                  text: shareText(),
                  url: shareUrl("native", "share_api")
                });
                track("native");
              } catch (err) { /* user cancelled */ }
            });
          }
        }
      })();
