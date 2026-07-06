export const MBTI_PAGE_CSS = `
.mbti-page {
  box-sizing: border-box;
  width: min(100%, var(--content-max));
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 20px 20px 0;
}

.mbti-crumb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 16px 0 20px;
  color: var(--fg2);
  font-size: 0.86rem;
}

.mbti-crumb a {
  color: var(--fg2);
  text-decoration: none;
}

.mbti-crumb a:hover {
  color: var(--accent);
  text-decoration: underline;
}

.mbti-hero {
  padding: 30px 0 26px;
  border-bottom: 1px solid var(--border);
}

.mbti-kicker {
  margin: 0 0 10px;
  color: var(--accent-deep);
  font-size: 0.82rem;
  font-weight: 700;
}

.mbti-label-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin: 0 0 12px;
}

.mbti-label {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--fg2);
  background: var(--bg2);
  font-size: 0.82rem;
  font-weight: 600;
}

.mbti-lead {
  max-width: 760px;
  margin: 0;
}

.mbti-guardrail {
  max-width: 820px;
  margin: 18px 0 0;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent-deep);
  border-radius: 8px;
  background: var(--bg2);
  color: var(--fg);
  font-size: 0.95rem;
}

.mbti-section {
  margin: 36px 0 0;
}

.mbti-section-head {
  margin: 0 0 18px;
}

.mbti-section-head h2 {
  margin: 0 0 8px;
}

.mbti-section-head p {
  max-width: 760px;
  margin: 0;
  color: var(--fg2);
}

.mbti-editorial {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.mbti-editorial-card {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg2);
}

.mbti-editorial-card p {
  margin: 0;
}

.mbti-occupation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.mbti-occupation {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg2);
}

.mbti-occupation-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.mbti-occupation-title {
  margin: 0;
}

.mbti-occupation-title a {
  color: var(--fg);
  text-decoration: none;
}

.mbti-occupation-title a:hover {
  color: var(--accent);
  text-decoration: underline;
}

.mbti-sector {
  display: block;
  margin-top: 4px;
  color: var(--fg2);
  font-size: 0.78rem;
}

.mbti-score {
  flex: 0 0 auto;
  min-width: 104px;
  padding: 8px 10px;
  border: 1px solid rgba(217, 107, 61, 0.25);
  border-radius: 8px;
  background: rgba(217, 107, 61, 0.06);
  text-align: right;
}

.mbti-score span {
  display: block;
  color: var(--fg2);
  font-size: 0.72rem;
  font-weight: 600;
}

.mbti-score strong {
  display: block;
  color: var(--accent);
  font-size: 1.18rem;
  line-height: 1.2;
}

.mbti-card-reason {
  margin: 0;
}

.mbti-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.mbti-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg3);
  color: var(--fg2);
  font-size: 0.76rem;
  font-weight: 600;
}

.mbti-caveat {
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  color: var(--fg2);
  font-size: 0.78rem;
  line-height: 1.6;
}

.mbti-cta {
  margin: 42px 0 0;
  padding: 24px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--paper);
}

.mbti-cta h2,
.mbti-cta p {
  color: var(--paper);
}

.mbti-cta h2 {
  margin: 0 0 8px;
}

.mbti-cta p {
  max-width: 720px;
  margin: 0 0 18px;
}

.mbti-cta-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 18px;
  border-radius: 8px;
  background: var(--orange);
  color: var(--paper);
  text-decoration: none;
  font-weight: 700;
}

.mbti-cta-link:hover {
  background: var(--orange-hot);
  text-decoration: none;
}

.mbti-page-guardrail {
  max-width: 860px;
  margin: 28px 0 0;
  color: var(--fg2);
  font-size: 0.86rem;
}

@media (max-width: 760px) {
  .mbti-page {
    padding-inline: 16px;
  }

  .mbti-editorial,
  .mbti-occupation-grid {
    grid-template-columns: 1fr;
  }

  .mbti-occupation-head {
    flex-direction: column;
  }

  .mbti-score {
    width: 100%;
    text-align: left;
  }

  .mbti-cta {
    padding: 20px;
  }
}
`;
