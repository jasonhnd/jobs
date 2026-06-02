/**
 * Page-local CSS for /aiadoption.
 *
 * Keep this file scoped to .ai-adoption-page. Do not redefine global tokens or
 * alter existing site CSS.
 */
export const AI_ADOPTION_CSS = `
.ai-adoption-page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 28px 20px 84px;
  color: var(--fg);
}

.ai-adoption-page * {
  box-sizing: border-box;
}

.ai-adoption-page a {
  color: var(--accent);
  text-decoration: none;
}

.ai-adoption-page a:hover {
  text-decoration: underline;
}

.ai-adoption-page .adoption-kicker {
  margin: 0 0 8px;
  color: var(--accent-deep);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
}

.ai-adoption-page h1.adoption-title {
  margin: 0 0 10px;
  font-size: 1.7rem !important;
  line-height: 1.3 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .adoption-lede {
  max-width: 820px;
  margin: 0 0 20px;
  color: var(--fg2);
  font-size: 1rem;
  line-height: 1.8;
}

.ai-adoption-page .adoption-lede span {
  display: block;
}

.ai-adoption-page .adoption-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 26px;
}

.ai-adoption-page .meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg2);
  color: var(--fg2);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 24px;
}

.ai-adoption-page .metric-card {
  min-height: 116px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg2);
}

.ai-adoption-page .metric-label {
  margin: 0 0 8px;
  color: var(--fg2);
  font-size: 0.78rem;
  line-height: 1.4;
}

.ai-adoption-page .metric-value {
  margin: 0;
  color: var(--fg);
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .metric-note {
  margin: 8px 0 0;
  color: var(--fg2);
  font-size: 0.76rem;
  line-height: 1.45;
}

.ai-adoption-page .dashboard-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
  gap: 18px;
  align-items: start;
  margin: 22px 0 34px;
}

.ai-adoption-page .chart-panel,
.ai-adoption-page .explain-panel,
.ai-adoption-page .wide-panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg2);
}

.ai-adoption-page .chart-panel {
  min-width: 0;
  padding: 16px;
}

.ai-adoption-page .explain-panel {
  padding: 16px;
  position: sticky;
  top: 70px;
}

.ai-adoption-page .panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 14px;
}

.ai-adoption-page .panel-head h2,
.ai-adoption-page .wide-panel h2 {
  margin: 0;
  font-size: 1.15rem !important;
  line-height: 1.4 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .panel-sub {
  margin: 0;
  color: var(--fg2);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .impact-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 12px;
}

.ai-adoption-page .impact-row > div {
  min-height: 90px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.ai-adoption-page .impact-number {
  color: var(--fg);
  font-size: 2.7rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .impact-number.muted {
  color: var(--fg2);
}

.ai-adoption-page .impact-unit {
  margin-left: 3px;
  color: var(--fg);
  font-size: 1rem;
  font-weight: 700;
}

.ai-adoption-page .impact-mini {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  margin-left: 8px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg2);
  color: var(--fg2);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  vertical-align: 8px;
  white-space: nowrap;
}

.ai-adoption-page .impact-row p {
  margin: 7px 0 0;
  color: var(--fg2);
  font-size: 0.78rem;
  line-height: 1.45;
}

.ai-adoption-page .chart-stage {
  width: 100%;
  min-height: 360px;
}

.ai-adoption-page .chart-stage svg,
.ai-adoption-page .trend-stage svg,
.ai-adoption-page .freshness-stage svg {
  display: block;
  width: 100%;
  height: auto;
}

.ai-adoption-page .chart-fallback {
  display: none;
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--fg2);
  font-size: 0.86rem;
}

.ai-adoption-page .chart-fallback li {
  margin: 4px 0;
}

.ai-adoption-page .layer-bar {
  cursor: pointer;
}

.ai-adoption-page .layer-bar:focus {
  outline: none;
}

.ai-adoption-page .layer-bar rect {
  transition: opacity 140ms ease, stroke-width 140ms ease;
}

.ai-adoption-page .layer-bar:hover rect,
.ai-adoption-page .layer-bar.is-selected rect {
  opacity: 1;
  stroke: var(--fg);
  stroke-width: 1.5;
}

.ai-adoption-page .waffle-caption,
.ai-adoption-page .stack-label,
.ai-adoption-page .touch-label,
.ai-adoption-page .tile-label,
.ai-adoption-page .tile-value {
  font-family: var(--font-sans);
  letter-spacing: 0;
}

.ai-adoption-page .waffle-caption {
  fill: var(--fg2);
  font-size: 12px;
  font-weight: 700;
}

.ai-adoption-page .waffle-frame {
  fill: var(--bg);
  stroke: var(--border);
}

.ai-adoption-page .waffle-halo {
  pointer-events: none;
  transition:
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    r 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ai-adoption-page .waffle-dot {
  cursor: pointer;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 1.3;
  vector-effect: non-scaling-stroke;
  transition:
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ai-adoption-page .waffle-dot:not(.is-selected) {
  opacity: 0.58;
}

.ai-adoption-page .waffle-dot:hover,
.ai-adoption-page .waffle-dot:focus-visible,
.ai-adoption-page .waffle-dot.is-selected {
  opacity: 1;
  stroke: var(--bg2);
  stroke-width: 2;
  filter: drop-shadow(0 2px 4px rgba(36, 30, 24, 0.24));
  outline: none;
}

.ai-adoption-page .stack-track {
  fill: var(--bg);
  stroke: var(--border);
}

.ai-adoption-page .stack-segment {
  cursor: pointer;
}

.ai-adoption-page .stack-segment rect {
  transition:
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ai-adoption-page .stack-segment:not(.is-selected) rect {
  opacity: 0.78;
}

.ai-adoption-page .stack-segment:hover rect,
.ai-adoption-page .stack-segment:focus-visible rect,
.ai-adoption-page .stack-segment.is-selected rect {
  opacity: 1;
  stroke: var(--fg);
  stroke-width: 2.4;
  filter: drop-shadow(0 2px 5px rgba(36, 30, 24, 0.22));
  outline: none;
}

.ai-adoption-page .stack-label {
  fill: var(--fg);
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
}

.ai-adoption-page .touch-line {
  stroke: var(--fg);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}

.ai-adoption-page .touch-label {
  fill: var(--fg);
  font-size: 11px;
  font-weight: 700;
}

.ai-adoption-page .layer-tile {
  cursor: pointer;
}

.ai-adoption-page .layer-tile-bg {
  fill: var(--bg);
  stroke: var(--border);
  transition:
    fill 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ai-adoption-page .layer-tile:hover .layer-tile-bg,
.ai-adoption-page .layer-tile:focus-visible .layer-tile-bg,
.ai-adoption-page .layer-tile.is-selected .layer-tile-bg {
  fill: var(--bg3);
  stroke: var(--fg);
  stroke-width: 2;
  filter: drop-shadow(0 2px 6px rgba(36, 30, 24, 0.16));
  outline: none;
}

.ai-adoption-page .tile-label {
  fill: var(--fg);
  font-size: 12px;
  font-weight: 700;
}

.ai-adoption-page .tile-value {
  fill: var(--fg2);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .axis text,
.ai-adoption-page .chart-label,
.ai-adoption-page .chart-value {
  fill: var(--fg2);
  font-family: var(--font-sans);
  letter-spacing: 0;
}

.ai-adoption-page .chart-label {
  fill: var(--fg);
  font-size: 13px;
  font-weight: 700;
}

.ai-adoption-page .chart-value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .grid-line {
  stroke: var(--border);
  stroke-width: 1;
}

.ai-adoption-page .explain-title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
}

.ai-adoption-page .explain-value {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 14px;
}

.ai-adoption-page .explain-number {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .explain-share {
  color: var(--fg2);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .explain-block {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.ai-adoption-page .explain-block h3 {
  margin: 0 0 6px;
  color: var(--accent-deep);
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .explain-block p {
  margin: 0;
  color: var(--fg);
  font-size: 0.9rem;
  line-height: 1.65;
}

.ai-adoption-page .formula-code {
  display: block;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--bg3);
  color: var(--fg);
  font-size: 0.82rem;
  line-height: 1.65;
  white-space: normal;
}

.ai-adoption-page .source-mini-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.ai-adoption-page .source-mini {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: baseline;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  font-size: 0.8rem;
}

.ai-adoption-page .source-mini strong {
  color: var(--fg);
  font-weight: 600;
}

.ai-adoption-page .source-mini span {
  color: var(--fg2);
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.ai-adoption-page .status-fresh {
  background: var(--risk-soft-0);
  color: var(--risk-pill-low-fg);
}

.ai-adoption-page .status-review_needed {
  background: var(--risk-soft-2);
  color: var(--risk-pill-mid-fg);
}

.ai-adoption-page .status-stale {
  background: var(--risk-soft-4);
  color: var(--risk-pill-high-fg);
}

.ai-adoption-page .wide-panel {
  margin: 18px 0;
  padding: 16px;
}

.ai-adoption-page .two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
}

.ai-adoption-page .trend-stage,
.ai-adoption-page .freshness-stage {
  min-height: 260px;
}

.ai-adoption-page .freshness-note {
  margin: 0 0 10px;
  color: var(--fg2);
  font-size: 0.84rem;
  line-height: 1.65;
}

.ai-adoption-page .review-queue {
  display: grid;
  gap: 8px;
  margin: 0 0 12px;
}

.ai-adoption-page .review-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.ai-adoption-page .review-item strong,
.ai-adoption-page .review-item span {
  display: block;
}

.ai-adoption-page .review-item strong {
  color: var(--fg);
  font-size: 0.84rem;
  line-height: 1.35;
}

.ai-adoption-page .review-item div > span {
  color: var(--fg2);
  font-size: 0.76rem;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .formula-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.ai-adoption-page .formula-primer {
  margin: 14px 0 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.ai-adoption-page .formula-primer h3 {
  margin: 0 0 10px;
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .formula-primer dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 12px;
  margin: 0;
}

.ai-adoption-page .formula-primer dt {
  color: var(--accent-deep);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .formula-primer dd {
  margin: 0;
  color: var(--fg);
  font-size: 0.9rem;
  line-height: 1.65;
}

.ai-adoption-page .formula-card {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.ai-adoption-page .formula-card h3 {
  margin: 0 0 8px;
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .formula-card p {
  margin: 8px 0 0;
  color: var(--fg2);
  font-size: 0.86rem;
  line-height: 1.65;
}

.ai-adoption-page .formula-card .formula-label {
  margin: 10px 0 5px;
  color: var(--accent-deep);
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.4;
}

.ai-adoption-page .formula-card .formula-label + p {
  margin-top: 0;
}

.ai-adoption-page .source-panel .method-note {
  margin-bottom: 14px;
}

.ai-adoption-page .source-groups {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}

.ai-adoption-page .source-group {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.ai-adoption-page .source-group-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  margin: 0 0 12px;
}

.ai-adoption-page .source-group-head h3 {
  margin: 0 0 4px;
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .source-group-head p {
  margin: 0;
  color: var(--fg2);
  font-size: 0.84rem;
  line-height: 1.55;
}

.ai-adoption-page .source-group-head > span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg2);
  color: var(--fg2);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.ai-adoption-page .source-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ai-adoption-page .source-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent-deep);
  border-radius: 8px;
  background: var(--bg2);
}

.ai-adoption-page .source-card-review_needed {
  border-left-color: var(--risk-2);
}

.ai-adoption-page .source-card-stale {
  border-left-color: var(--risk-4);
}

.ai-adoption-page .source-card-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  margin: 0 0 10px;
}

.ai-adoption-page .source-kind {
  margin: 0 0 3px;
  color: var(--fg2);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
}

.ai-adoption-page .source-card h4 {
  margin: 0;
  font-size: 0.95rem !important;
  line-height: 1.45 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .source-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 10px;
}

.ai-adoption-page .source-metrics div {
  padding: 8px;
  border-radius: 6px;
  background: var(--bg);
}

.ai-adoption-page .source-metrics span,
.ai-adoption-page .source-meta-grid dt {
  display: block;
  color: var(--fg2);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.35;
}

.ai-adoption-page .source-metrics strong {
  display: block;
  margin-top: 3px;
  color: var(--fg);
  font-size: 0.9rem;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .source-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 10px;
  margin: 0;
}

.ai-adoption-page .source-meta-grid div {
  min-width: 0;
}

.ai-adoption-page .source-meta-grid dd {
  margin: 2px 0 0;
  color: var(--fg);
  font-size: 0.78rem;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.ai-adoption-page .source-table-wrap {
  overflow-x: auto;
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.ai-adoption-page .source-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.ai-adoption-page .source-table th,
.ai-adoption-page .source-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.ai-adoption-page .source-table th {
  color: var(--fg2);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  background: var(--bg2);
  white-space: nowrap;
}

.ai-adoption-page .source-table td {
  color: var(--fg);
}

.ai-adoption-page .source-table tr:last-child td {
  border-bottom: 0;
}

.ai-adoption-page .source-table .num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ai-adoption-page .method-note {
  margin: 10px 0 0;
  color: var(--fg2);
  font-size: 0.84rem;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .ai-adoption-page .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-adoption-page .dashboard-shell,
  .ai-adoption-page .two-col {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .explain-panel {
    position: static;
  }
}

@media (max-width: 700px) {
  .ai-adoption-page .source-card-grid,
  .ai-adoption-page .source-metrics,
  .ai-adoption-page .source-meta-grid {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .formula-primer dl {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .ai-adoption-page .formula-primer dd {
    margin-bottom: 8px;
  }

  .ai-adoption-page .source-table-wrap {
    overflow-x: visible;
    border: 0;
    background: transparent;
  }

  .ai-adoption-page .source-table {
    min-width: 0;
    border-collapse: separate;
    border-spacing: 0 10px;
  }

  .ai-adoption-page .source-table thead {
    display: none;
  }

  .ai-adoption-page .source-table tbody,
  .ai-adoption-page .source-table tr,
  .ai-adoption-page .source-table td {
    display: block;
  }

  .ai-adoption-page .source-table tr {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    overflow: hidden;
  }

  .ai-adoption-page .source-table td {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 0;
    font-size: 0.8rem;
  }

  .ai-adoption-page .source-table td::before {
    content: attr(data-label);
    color: var(--fg2);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .ai-adoption-page .source-table td.num {
    white-space: normal;
  }
}

@media (max-width: 560px) {
  .ai-adoption-page {
    padding: 18px 14px 64px;
  }

  .ai-adoption-page h1.adoption-title {
    font-size: 1.7rem !important;
  }

  .ai-adoption-page .summary-grid,
  .ai-adoption-page .formula-grid {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .summary-grid {
    gap: 8px;
  }

  .ai-adoption-page .impact-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .ai-adoption-page .metric-card {
    min-height: 104px;
    padding: 14px;
  }

  .ai-adoption-page .metric-value,
  .ai-adoption-page .explain-number {
    font-size: 1.45rem;
  }

  .ai-adoption-page .impact-row > div {
    min-height: 82px;
    padding: 12px;
  }

  .ai-adoption-page .impact-number {
    font-size: 2.05rem;
  }

  .ai-adoption-page .impact-row p {
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .ai-adoption-page .panel-head {
    align-items: flex-start;
  }

  .ai-adoption-page .review-item,
  .ai-adoption-page .source-card-top,
  .ai-adoption-page .source-group-head {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .panel-head h2,
  .ai-adoption-page .wide-panel h2 {
    font-size: 1.15rem !important;
  }

  .ai-adoption-page .chart-stage {
    min-height: 620px;
  }
}
`;
