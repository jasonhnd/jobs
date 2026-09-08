/**
 * Page-local CSS for /aiadoption.
 *
 * Keep this file scoped to .ai-adoption-page. Do not redefine global tokens or
 * alter existing site CSS.
 *
 * Layout (top to bottom): one headline sentence, four separate group cards,
 * one offline sentence, then the method / sources appendix. There is no chart
 * on this page on purpose — the four groups are different populations and are
 * never drawn as a 100% split.
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

/* ---- First screen: one sentence + a one-line caveat -------------------- */

.ai-adoption-page .adoption-hero {
  max-width: 900px;
  margin: 12px 0 34px;
}

.ai-adoption-page h1.adoption-headline {
  margin: 0 0 12px;
  font-size: clamp(1.7rem, 1.1rem + 2.4vw, 2.6rem) !important;
  line-height: 1.35 !important;
  letter-spacing: 0 !important;
  font-weight: 700;
}

.ai-adoption-page .headline-tail {
  white-space: nowrap;
}

.ai-adoption-page .headline-number {
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .adoption-hero-note {
  margin: 0;
  color: var(--fg2);
  font-size: 0.88rem;
  line-height: 1.7;
}

/* ---- Four separate groups ---------------------------------------------- */

.ai-adoption-page .group-section {
  margin: 0 0 30px;
}

.ai-adoption-page .group-heading {
  margin: 0 0 12px;
  color: var(--fg2);
  font-size: 0.92rem !important;
  font-weight: 600;
  line-height: 1.6 !important;
  letter-spacing: 0 !important;
}

.ai-adoption-page .group-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.ai-adoption-page .group-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 16px 14px;
  border: 1px solid var(--border);
  border-top: 4px solid var(--group-color, var(--accent-deep));
  border-radius: 8px;
  background: var(--bg2);
}

.ai-adoption-page .group-card-primary {
  background: var(--bg);
}

.ai-adoption-page .group-label {
  margin: 0;
  color: var(--fg);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
}

.ai-adoption-page .group-value {
  margin: 0;
  color: var(--fg2);
  font-size: 0.8rem;
  line-height: 1.2;
}

.ai-adoption-page .group-value strong {
  display: inline-block;
  margin: 0 2px;
  color: var(--fg);
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .group-card-primary .group-value strong {
  color: var(--accent-deep);
}

.ai-adoption-page .group-relation {
  margin: 2px 0 0;
  color: var(--group-color, var(--accent-deep));
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.4;
}

.ai-adoption-page .group-note {
  margin: 4px 0 0;
  color: var(--fg2);
  font-size: 0.8rem;
  line-height: 1.6;
}

/* ---- Offline sentence (a separate statement, not a fifth group) -------- */

.ai-adoption-page .offline-section {
  margin: 0 0 30px;
  padding: 14px 16px;
  border-left: 4px solid var(--border);
}

.ai-adoption-page .offline-line {
  margin: 0;
  color: var(--fg);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.7;
}

.ai-adoption-page .offline-note {
  margin: 4px 0 0;
  color: var(--fg2);
  font-size: 0.8rem;
  line-height: 1.6;
}

/* ---- Appendix panels ---------------------------------------------------- */

.ai-adoption-page .wide-panel {
  margin: 18px 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg2);
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

.ai-adoption-page .status-review_needed {
  background: var(--risk-soft-2);
  color: var(--risk-pill-mid-fg);
}

.ai-adoption-page .status-stale {
  background: var(--risk-soft-4);
  color: var(--risk-pill-high-fg);
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

.ai-adoption-page .parameter-value {
  display: inline-block;
  margin-left: 6px;
  color: var(--fg);
  font-weight: 700;
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

.ai-adoption-page .source-metrics span {
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

.ai-adoption-page .source-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 10px;
  margin: 0;
  font-size: 0.78rem;
  color: var(--fg2);
  font-variant-numeric: tabular-nums;
}

.ai-adoption-page .source-foot a {
  color: var(--accent-deep);
  white-space: nowrap;
}

.ai-adoption-page .method-note {
  margin: 10px 0 0;
  color: var(--fg2);
  font-size: 0.84rem;
  line-height: 1.7;
}

/* ---- Responsive ---------------------------------------------------------- */

@media (max-width: 900px) {
  .ai-adoption-page .group-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .ai-adoption-page .source-card-grid,
  .ai-adoption-page .source-metrics {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .formula-primer dl {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .ai-adoption-page .formula-primer dd {
    margin-bottom: 8px;
  }
}

@media (max-width: 560px) {
  .ai-adoption-page {
    padding: 18px 14px 64px;
  }

  .ai-adoption-page .adoption-hero {
    margin: 6px 0 24px;
  }

  .ai-adoption-page .group-grid,
  .ai-adoption-page .formula-grid {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .group-grid {
    gap: 10px;
  }

  .ai-adoption-page .group-value strong {
    font-size: 1.65rem;
  }

  .ai-adoption-page .panel-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .ai-adoption-page .source-card-top,
  .ai-adoption-page .source-group-head {
    grid-template-columns: 1fr;
  }

  .ai-adoption-page .source-card-top .status-chip,
  .ai-adoption-page .source-group-head > span {
    justify-self: start;
  }

  .ai-adoption-page .panel-head h2,
  .ai-adoption-page .wide-panel h2 {
    font-size: 1.15rem !important;
  }
}
`;
