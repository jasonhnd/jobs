# Work-Type Diagnostic Design

This is the canonical design document for the work-type diagnostic. It gates DIAG-1 through DIAG-9. Issue #58 is documentation-only; no data files, routes, scripts, or UI are implemented by this issue.

## 1. Purpose & Strategic Fit

The diagnostic is the top of the B2B and affiliate funnel for mirai-shigoto.com. It gives readers a fast, identity-affirming, shareable answer to "in the AI era, what kind of worker am I — and what should I do next?" and then routes them deeper into existing occupation pages, rankings, comparisons, and future partner offers.

It is built to be **actively spread**: readers should not only post their own result, but pull friends and colleagues in. Virality is an explicit design goal, balanced against the site's evidence-based credibility (see sections 6, 12, and 13).

It is not a separate product. It should feel like a guided entry point into the existing AIOIS-10 occupation map, not a standalone personality brand. The diagnostic must reuse the site's core assets: Japanese occupation data, AIOIS-10 scoring, occupation detail pages, ranking pages, and static delivery.

Framing principle (decisive): lead with **identity + agency**, never with fear. The emotional hook is "AI時代、あなたはどう働くタイプか" and "今できる次の一手", not "あなたの仕事は奪われる". Japanese white-collar AI-anxiety is comparatively low and doom framing under-converts; identity-labeling, 共感 (belonging), and a next step are what drive taking and sharing. Honest AI-exposure data is kept (it is the credibility moat) but is packaged as a role and a next step, never as a verdict.

Primary business fit:

- B2C reader entry: short quiz, named shareable result, viral loop.
- B2B lead path: team/workforce aggregate framing can be offered in P2 without changing the public MVP.
- Affiliate path: result pages can recommend occupation pages, learning categories, or career-transition content without implying endorsement or certainty.

The diagnostic should make the main site easier to enter. It should not dilute the core proposition: Japan Jobs x AI Impact is an evidence-based static visualization of Japanese occupations with model-generated AI-impact scores.

## 2. Concept

The diagnostic returns two separate outputs:

1. Personal type: a reader's self-reported work preference, expressed as a two-tier identity (family + variant; see section 6).
2. Occupation verdict: the selected occupation's work-type code derived from the occupation dataset and AIOIS-10 dimensions.

These outputs must stay separate in UI, copy, data, and analytics. The personal type is not inferred from the occupation. The occupation verdict is not a psychological label for the reader. The product value comes from comparing the two cleanly:

- "Your work type": the reader's family + variant from the test.
- "This occupation's type": the occupation's 3-letter family code from occupation data.
- "Gap verdict": the relationship between the two: hidden strength, hidden risk, or aligned.

Japanese product strings:

- Feature name: `AI働き方診断`
- Personal result label: `あなたのタイプ`
- Occupation verdict label: `この職業のタイプ`
- Gap label: `自分 x 仕事のギャップ`
- Share hashtag: `#AI働き方診断`

## 3. Non-Goals & Constraints

Non-goals:

- No clinical, psychological, aptitude-test, hiring, or employee-screening claim.
- No account system, saved history, team dashboard, paid report, CRM integration, or email capture in the static MVP.
- No backend scoring, database, LLM call, server session, or personalized server-rendered result.
- No English UI in the public product surface. The diagnostic is JA only.
- No fear-first positioning such as "your job will disappear" or "AI will replace you." No "loser" / doom result tier; every result is framed as a role, not a verdict.

Constraints:

- 100% static product runtime. All quiz scoring, occupation lookup, result rendering, rarity figures, and share-link construction must work with prebuilt static assets and browser JavaScript. The only runtime function allowed in P1 is the existing stateless `/api/og` Edge renderer for social-card images; it receives display parameters and does not compute, store, or personalize diagnostic results.
- Light entry, data payoff. The test itself can be light and entertaining (the viral entry), but the result must surface the real data grounding (government occupation data + AIOIS-10 across 556 occupations) — that grounding is the moat versus pseudo-science 占い-grade diagnostics, and it must never contradict AIOIS-10, occupation data, or the site's model-output disclaimers.
- The diagnostic must preserve AIOIS-10's separation between Transformation and Displacement-Risk. Work type is a classification lens, not a new risk score.
- Rarity is a share lever but never a status claim. A rarity percentage may be shown as a neutral distribution fact; copy must never imply elite, genius, safe, or doomed (see sections 8 and 13).
- The diagnostic must be JA only in UI copy, meta copy, share copy, and result copy.
- No new backend dependency may be introduced in DIAG-1 through DIAG-9 unless the deferred P2 backend scope is explicitly reopened. Live taker counts are therefore out of scope in P1; all rarity figures are static and data-derived (see sections 8 and 9).

## 4. The 3 Axes Mapped To AIOIS-10

The public diagnostic uses three reader-friendly axes. Each axis maps to AIOIS-10 dimensions so occupation verdicts remain grounded in the existing scoring system. The 8 combinations of these axes are the diagnostic's **families** — the statistically robust, data-grounded top layer of the two-tier type system (section 6).

| Axis | Public poles | Code poles | Reader meaning | Occupation mapping to AIOIS-10 |
| --- | --- | --- | --- | --- |
| A1 | `創造 / 定型` | `C / R` | Prefers open-ended creation vs repeatable procedures. | `C` rises with D6 Creative & Original Intelligence and lower D2 Routine-Procedural Exposure. `R` rises with D2 and routine D1 task exposure. |
| A2 | `人 / データ` | `P / D` | Prefers people, trust, care, negotiation, and coordination vs information, numbers, systems, and records. | `P` rises with D5 Social & Emotional Intelligence and D4 Judgment & Accountability. `D` rises with D1 Cognitive-Generative Exposure and D2 procedural information work. |
| A3 | `身体 / 知識` | `B / K` | Prefers embodied, on-site, tool, or physical work vs abstract, document, analytical, or knowledge work. | `B` rises with D3 Manual-Physical Demand. `K` rises with D1, D4, and D6 when the work is primarily cognitive rather than physical. |

Occupation verdicts must not use AIOIS Transformation or Displacement-Risk directly as type labels. Those indices remain separate overlays shown alongside the type.

DIAG-1 must compute normalized axis scores across the active 556 scored occupations:

- A1 occupation score: normalized D6 minus normalized D2, with D1 used only as a supporting exposure note.
- A2 occupation score: normalized D5 plus 0.5 x normalized D4 minus normalized D1.
- A3 occupation score: normalized D3 minus the mean of normalized D1, D4, and D6.

Exact threshold values and any tie-break adjustments are pending DIAG-1.

## 5. The 9-Question Test + Scoring To Family + Variant

The test has 9 forced-choice questions, 3 per axis. Each answer adds one point to one pole. There is no neutral answer in the MVP; if a question is skipped, the result cannot be shown until it is answered.

| Question | Axis | Left answer scores | Right answer scores |
| --- | --- | --- | --- |
| `新しいやり方を考えるほうが好き` / `決まった手順を正確に進めるほうが好き` | A1 | `C +1` | `R +1` |
| `答えが決まっていない課題に惹かれる` / `正解が明確な課題に集中しやすい` | A1 | `C +1` | `R +1` |
| `0から企画や表現を作るのが得意` / `同じ作業を安定して改善するのが得意` | A1 | `C +1` | `R +1` |
| `人の表情や空気を見て動く` / `数字や資料を見て動く` | A2 | `P +1` | `D +1` |
| `対話で合意を作る仕事が好き` / `分析で答えを絞る仕事が好き` | A2 | `P +1` | `D +1` |
| `相手に合わせて説明を変える` / `情報を整理して正確に伝える` | A2 | `P +1` | `D +1` |
| `現場で手を動かす仕事が合う` / `知識や概念を扱う仕事が合う` | A3 | `B +1` | `K +1` |
| `道具・移動・現物があるほうが集中できる` / `PC・文書・情報空間のほうが集中できる` | A3 | `B +1` | `K +1` |
| `体感や観察から判断する` / `理論や資料から判断する` | A3 | `B +1` | `K +1` |

Scoring to the family code:

- A1: `C` if C answers >= 2, otherwise `R`.
- A2: `P` if P answers >= 2, otherwise `D`.
- A3: `B` if B answers >= 2, otherwise `K`.
- Family code: concatenate A1 + A2 + A3, for example `CPK`.

Scoring to the variant (the flavor layer):

- The per-axis margin (a decisive 3-0 sweep vs a 2-1 lean) is retained, not just the winning pole.
- The margin pattern places the reader into one of the family's named variants (section 6). DIAG-1 defines the exact margin -> variant mapping; it is pending DIAG-1.
- Because 9 questions yield only a 3-0 / 2-1 margin per axis, DIAG-1 may recommend extending to 12 questions (4 per axis) if cleaner variant separation is needed. The MVP target is 9-12; keep it short to protect completion.

The result page must show the axis breakdown before the narrative label so readers can see why the code was assigned.

## 6. The Type System: 8 Families x ~3 Variants (~24 named types)

The result is a **two-tier identity**, designed for shareability while staying grounded in real data. Every mega-viral diagnostic (16Personalities = 16 types delivered as 4 role-families; 動物占い = 12 characters -> 60 variants) pairs a scannable, relatable top layer with a specific, collectible lower layer. A flat 8 is too coarse to drive sharing; a flat 16/24 dilutes legibility and thins the data. Two tiers get both.

- **Family (8, data-grounded):** the 3-axis code (`CPB` ... `RDK`) from section 4. This is the statistically robust layer: each family maps to roughly 70 of the 556 scored occupations and carries the AIOIS-10 grounding, the representative-occupation list, and the family-level rarity share. The 8 families are the scannable, relatable top layer (the 16Personalities role-family pattern).
- **Variant (~3 per family, ~24 total):** within a family, the test's axis margins (section 5) place the reader into one named variant. Variants are a **flavor / archetype / collectibility layer, not a separate statistical bucket.** All substantive data claims and representative-occupation lists stay at the family level. (Splitting 556 occupations across ~24 variants would give ~17 each — too thin to ground per-variant claims, which would break the credibility moat.) The variant adds a specific, ownable, collectible name on top of the robust family.

Naming principles (DIAG-9 authors all family and variant copy):

- **Identity + agency, never a verdict of doom.** Each name is an aspirational role, never a victim. The highest-AI-exposure families (especially `RDK`) are framed as "ready to hand routine to AI and level up to judgment and exception work," not "about to be replaced." This reframe is the heart of the product: same honest exposure data, packaged as a role and a next step.
- **Character + a short story per type** (the 16Personalities pattern that travels in Japan): a memorable label that doubles as a self-introduction (`◯◯です`).
- **No status hierarchy in copy.** Rarity is a neutral, shareable distribution fact, never "elite / genius / safe / doomed" (sections 8 and 13).

Family agency-reframe (the 8 family names below are the design direction; DIAG-9 finalizes wording):

| Code | AI exposure (count of R/D/K) | 家族名 (direction) | Representative occupations | AI posture |
| --- | --- | --- | --- | --- |
| `CPB` | 0 | `ふれあい創造家` | 美容師, 保育士, インテリアコーディネーター | AI is a prep/idea sidekick; the value is hands, presence, and trust. |
| `CPK` | 1 | `共感ストラテジスト` | 経営コンサルタント, 教師, キャリアカウンセラー | AI drafts and summarizes; the human owns framing, empathy, and meaning. |
| `CDB` | 1 | `ものづくり設計家` | 建築士, 工業デザイナー, 3Dプリンター技術者 | AI widens prototypes; physical constraints and site reality decide. |
| `CDK` | 2 | `AI共創パイロット` | ソフトウェア開発者, 研究者, データサイエンティスト | High-leverage AI co-pilot; the more AI is used, the more upside. |
| `RPB` | 1 | `現場のケアマイスター` | 訪問介護員, 看護助手, 接客スタッフ | AI removes admin; embodied care and trust are AI-resistant. |
| `RPK` | 2 | `段取りコーディネーター` | 医療事務, 人事労務, カスタマーサポート | AI handles templates/routing; the human owns accurate coordination. |
| `RDB` | 2 | `現場フロウ・マスター` | 倉庫作業員, 配送員, 検査員 | AI optimizes flow and prediction; on-site judgment remains. |
| `RDK` | 3 | `AIオートメーター` | 一般事務, データ入力, 経理事務 | Hand routine to AI and level up to checks, judgment, and exceptions — the biggest upside, not a sentence. |

Worked variant example (one family; DIAG-9 produces all ~24):

- `CDK` `AI共創パイロット` family -> `攻め型: AI先駆けハッカー` / `バランス型: 共創アーキテクト` / `職人型: 深掘りリサーチャー`. The variant reflects how decisively the reader swept the AI-exposed poles versus leaned the human poles within the family.

Variant assignment, count, and rarity (pending DIAG-1):

- DIAG-1 defines the exact margin -> variant mapping and confirms roughly 3 variants per family (about 24 total).
- Family-level rarity percentage is the primary shareable figure, derived from the occupation distribution (static; section 8). Variant-level rarity, if shown, is derived from the occupation axis-margin distribution within the family; whether it is statistically sound to display per variant is DIAG-1's call.

## 7. Signature Feature: Self x Job Gap

The signature feature compares the personal type with a selected occupation verdict. It must be displayed as a gap explanation, not a pass/fail judgment. The gap operates at the family-code level; variant is a flavor overlay and does not change gap logic.

Inputs:

- `selfCode`: 3-letter family result from the test.
- `jobCode`: 3-letter occupation verdict from static occupation work-type data.
- `jobAiois`: existing occupation AIOIS-10 Transformation and Displacement-Risk values.

Gap classes:

| Class | Rule | Public meaning | Copy stance |
| --- | --- | --- | --- |
| `aligned` | `selfCode` and `jobCode` match on at least 2 axes. | The occupation uses the reader's natural work pattern. | Affirm fit, then show how AI changes tasks inside that fit. |
| `hidden_strength` | At least 1 mismatch where `selfCode` has `C`, `P`, or `B` and `jobCode` has the opposite pole. | The reader may have a strength the current or target occupation underuses. | Suggest adjacent occupations and role redesign paths that use the underused axis. |
| `hidden_risk` | At least 2 mismatches where the occupation needs `C`, `P`, or `B` but `selfCode` leans `R`, `D`, or `K`, or the reader is aligned with a high-transformation `RDK` occupation. | The reader may be relying on a pattern that the occupation does not reward enough, or that AI is reshaping quickly. | Use action-oriented language: practice, add judgment, add human contact, or move toward adjacent occupations. |

Priority:

Rules are evaluated in priority order; first match wins. This priority list is part of the contract because 3 of the 64 self x job code pairs satisfy both the `hidden_strength` and `hidden_risk` table rules when the table is read without priority.

1. If aligned on 2 or 3 axes, return `aligned`, except for aligned `RDK` with high Transformation, where the result may show `aligned + watch`.
2. If not aligned and the mismatch includes underused `C`, `P`, or `B` from the self code, return `hidden_strength`.
3. Otherwise return `hidden_risk`.

DIAG-1 must define the high-transformation threshold for the `RDK` watch rule; the exact value is pending DIAG-1.

## 8. Calibration

Calibration has two targets: stable occupation classification and honest public framing.

Occupation threshold method (family level):

- Use median split per axis over the active 556 scored occupations.
- Compute continuous A1, A2, and A3 occupation scores from normalized AIOIS-10 dimensions as defined in section 4.
- Assign each occupation to the high-side pole above the median and the low-side pole below the median.
- If an axis score equals the median, DIAG-1 must use a deterministic tie-break based on the strongest raw AIOIS dimension for that axis.

Distribution guardrails (family level):

- No family may represent less than 3% of the 556 scored occupations.
- No family may represent more than 35% of the 556 scored occupations.
- If a family falls outside the range, DIAG-1 must adjust axis tie-breaks or threshold smoothing, then record the resulting distribution in this document or in a linked generated calibration note.
- The known tight cell is `CDB`: on the real Fable 5 data it is about 2.5%, just under the 3% floor. DIAG-1 must smooth that cell via deterministic tie-breaks or threshold adjustments while keeping exact medians pending DIAG-1.

Rarity figures (static, data-derived):

- Family rarity percentage is computed from the occupation distribution (the share of the 556 occupations in that family) and is fixed at build time. There is no live taker counter in P1 (no backend).
- This static figure is what the result and share card display as the rarity flex (for example `このタイプは全体の約7%`). It must be framed as a neutral distribution fact, not a status (section 13).
- Variant calibration (the margin -> variant mapping and any per-variant rarity) is pending DIAG-1.

Current status:

- Exact medians: pending DIAG-1.
- Family distribution table: pending DIAG-1.
- Variant mapping and distribution: pending DIAG-1.
- Tie-break rules after distribution audit: pending DIAG-1.

Rarity framing:

- Allowed (neutral fact, shareable): `このタイプは職業データ全体の約◯%です。`
- Not allowed: "rare genius", "elite", "safe type", "dangerous type", or any status hierarchy.

## 9. Architecture: 100% Static, No Backend

The diagnostic product must be static at runtime. It may use browser JavaScript and prebuilt JSON, but it must not require server scoring, a database, a session store, or a runtime LLM call. The existing `/api/og` Vercel Edge function is an allowed stateless rendering endpoint for social-card images; it must remain parameter-driven and must not become a scoring, persistence, or saved-result backend.

| Concern | Live/backend version | Static MVP version |
| --- | --- | --- |
| Quiz scoring | Server receives answers and returns type. | Browser scores 9 answers locally from static question data, into family + variant. |
| Occupation verdict | Server computes occupation type on request. | Build step precomputes occupation work-type family codes into static JSON. |
| Rarity | Live count of takers per type. | Static family rarity precomputed from the occupation distribution at build time. |
| Result rendering | Personalized server-rendered page. | Static route renders shell; browser enhances with query/hash state. |
| Share links | Saved result ID in database. | URL carries `self` (family + variant), and optional `job` and `gap`, or omits job for privacy. |
| Result images | Saved-result image generated from database state. | Existing stateless `/api/og` Edge function renders per-result cards from URL parameters, for example `/api/og?worktype=CPK&variant=hacker&gap=hidden_strength`. |
| Analytics | Server event stream tied to user account. | Existing client analytics events only, with no answer payload beyond aggregate type/variant/gap labels. |
| Premium report | Generated and stored server-side. | Deferred to P2 backend; not part of static MVP. |

Shared static data and copy contract for DIAG-2/3/4/5:

- `public/data.worktypes.json`: emitted by DIAG-1 with `{ thresholds, families, variants, occupations }`. It contains thresholds; per-family meta `{ familyId, count, pct }` (pct is the static rarity share); the variant mapping (margin pattern -> variantId per family); and per-occupation records `{ code, familyId, exposure, rarityPct }`.
- `src/site/worktype-copy.ts`: JA copy module from DIAG-9 for public labels, questions, family names + anchors, the ~24 variant names + one-liners, gap copy, and share copy.

Recommended route shape for DIAG implementation:

- `/gyakuten`: static front door — the 8-family overview, the collectible roster (図鑑) of all ~24 variants, and the handoff into `/shindan`.
- `/shindan`: static quiz and result surface. The result is the share unit (section 12).
- Query parameters add the result and optional occupation context, for example `/shindan?self=CPK&variant=hacker&job=0133&gap=hidden_strength`.
- Query-specific results must not be added to sitemap.

## 10. Per-Page Modification Plan

| Surface | Current | Change | Type | Backend |
| --- | --- | --- | --- | --- |
| `/shindan` | Does not exist. | Add static quiz shell, question flow, occupation picker, result rendering (family + variant), and the share/compare block. The result is the share unit. | New static page | No |
| `/gyakuten` | Does not exist. | Add static front door: 8-family overview, the ~24-variant collectible roster (図鑑), representative occupations, and handoff into `/shindan`. | New static page | No |
| `/` | Homepage routes readers to map/search and existing content. | Add a restrained `AI働き方診断` entry point near existing search or CTA area. | Copy/link update | No |
| `/map` | Interactive occupation treemap with search and `診断` search button. | Add optional link from selected occupation sheet to `/shindan?job=<id>`. | Link/client update | No |
| `/me` | Static self-positioning tool based on selected occupation. | Add cross-link to `/shindan?job=<id>`; do not merge `/me` and diagnostic logic. | Link/client update | No |
| Occupation detail `/{id}` | Shows AIOIS-10, stats, transfer paths, FAQ, JSON-LD. | Add static badge for occupation work-type family and link to `/shindan?job=<id>`. | Static data/render update | No |
| `/rankings` and `/rankings/[type]` | Ranking hubs and ranking detail pages. | Add light entry cards where relevant, especially high-transformation routine/data pages. | Copy/link update | No |
| `/compare` and `/compare/[pair]` | Occupation comparison surfaces. | Optionally show each occupation's work-type family once DIAG data exists. | Static data/render update | No |
| `/standard` | AIOIS-10 definition. | Add no diagnostic-specific content in P1; link only if needed after launch. | Deferred docs/copy | No |
| `/methodology` and `/data` | Explain scoring and public data. | Document work-type derived data only after DIAG-1 creates the data artifact. | Docs/copy update | No |
| `sitemap.xml` and SEO baselines | Current route set excludes diagnostic pages. | Include `/shindan` and `/gyakuten` only; exclude personalized query states. | Generated static update | No |

## 11. Phasing

P0 data (DIAG-1, DIAG-9):

- Define question data, family metadata, and the variant mapping, with public JA copy owned by `src/site/worktype-copy.ts`.
- Emit `public/data.worktypes.json` with thresholds, per-family meta + static rarity, the margin -> variant mapping, and per-occupation `{ code, familyId, exposure, rarityPct }` records for DIAG-2/3/4/5.
- Implement DIAG-1 calibration over active AIOIS-10 scores.
- Record medians, family distribution, variant mapping, and guardrail results.
- DIAG-9 authors the 8 family names + anchors and the ~24 variant names + one-liners, following the section 6 naming principles and the section 13 honesty guardrails.
- Keep data generation deterministic and covered by tests.

P1 static MVP (DIAG-2/3/4/5/6/7/8):

- Add `/shindan` and `/gyakuten` pages, including the `/gyakuten` variant roster (図鑑).
- Add client-only quiz scoring and result rendering (family + variant + axis breakdown + static rarity).
- Add occupation picker using existing static search or a narrowed diagnostic lookup.
- Add the self x job gap block.
- Add the active-spread engine (section 12): per-result deep-linked surfaces, pre-rendered `/api/og` share cards, one-tap pre-filled X share with the `#AI働き方診断` hashtag and consent line, the compare/同僚 loop, sitemap entries, SEO baseline updates, CSP hashes, and page-class coverage.
- Add light links from homepage, map, `/me`, and occupation detail pages.

P2 deferred backend:

- Premium report generation.
- Team or organization aggregate reports.
- Email capture tied to report delivery.
- Saved result history and any live taker counter.
- CRM or affiliate tracking beyond ordinary static outbound links.

P2 must not be smuggled into P1. If it becomes necessary, create a new issue with backend scope, data retention rules, privacy review, and verification gates.

## 12. Distribution & Share Mechanics

Growth depends on **active spread** — readers not only posting their own result, but pulling friends and colleagues in. Design the viral loop with the result as the unit of sharing.

Trophy -> dare (the core lever):

- The shared artifact must pose an open question that only the viewer's own test can answer. Every result card carries a compare/challenge hook — for example `あなたの同僚は何タイプ?`, `私のタイプ、当ててみて` — so the share is addressed to others, not a passive broadcast. This is the single highest-leverage mechanic for turning a viewer into a new taker.

Result as the share unit:

- Each result (family + variant) is its own shareable, deep-linkable surface with a pre-rendered card. The share points at the result, not the landing page.

Dual-channel (Japan):

- X (Twitter): the public cascade engine — the repost graph reaches strangers beyond the user's followers. Optimize the result for a one-tap, pre-filled tweet.
- LINE / Instagram Stories: the private peer/coworker relay (screenshot culture). The 会社/同期 group chat is where `やってみて` actually lands on colleagues. Optimize the card for screenshotting.
- The result surface must win both the auto-tweet and the screenshot.

One-tap share and hashtag:

- Pre-fill the X share text client-side; own one branded hashtag `#AI働き方診断` that brands the result, creates a discovery stream, and clusters all results.
- Show a brief `Xに投稿します` consent line before posting, to avoid auto-post backlash.
- Canonical JA share pattern: `#AI働き方診断 私は【◯◯】でした！` plus the result URL. One to two hashtags maximum; leave headroom for the user's own comment.
- Use the Web Share API where available; provide a Copy Link fallback; generate X and LINE text links without backend calls.

Share-card anatomy (the viral artifact; DIAG-5 builds it via the stateless `/api/og`):

- Big type name (the self-introduction label) + a per-family character/icon + a per-family color (thumbnail-recognizable) + a one-line `言語化` punch copy + the static family rarity percentage (neutral) + the AIOIS-10 grounding + a government-data trust mark.
- Two renders, with the name and character inside a center-safe zone: 1080x1080 square (Instagram / profile icon / screenshot relay) and 1200x630 (1.91:1 OGP link preview for X and LINE). Use absolute HTTPS image URLs.
- Every result is flattering-but-true; there is no "loser" or doom tier, because shame kills sharing.

Compare / 相性 loop (viewer -> new taker):

- Provide `結果を比べる` plus a compare-link or QR so the original poster recruits the next taker in person or in a group chat. Family-level 相性 (which families work well together) keeps combinatorial interest without thin per-variant data.

Friction reduction (ranked by impact):

- No login; instant on-screen result; one question per screen; the share button is the primary CTA directly below the result; mobile-first; no name/email capture before the result; one-tap save image.

Privacy:

- The share URL carries `self` (family + variant) and optional `job` and `gap`, never the 9 raw answers. If answer-level reconstruction is needed for debugging, it stays local only and is not shared.
- The `/api/og` Edge function must remain parameter-driven and stateless: no saved result ID, database, session, backend scoring, or runtime LLM call.

Analytics:

- Allowed event fields: family code, variant, gap class, selected occupation ID, source surface.
- Not allowed: raw answers, free text, user identifiers, or inferred sensitive attributes.

## 13. Risks & Honesty Guardrails

DIAG-9 must follow these copy rules:

- Always state that the diagnostic is a reflection and navigation tool, not a psychological test or career guarantee.
- Keep `あなたのタイプ` and `この職業のタイプ` visually and verbally separate.
- Do not say a person "is" a type as a fixed identity. Prefer "leans toward" or Japanese copy such as `この結果では...タイプです`.
- Do not say an occupation is safe, doomed, future-proof, obsolete, or replaceable as a whole.
- When discussing AI, use task-change and agency language: `AIで変わりやすい`, `AIが補助しやすい`, `人が残る価値`, `今できる一手`.
- Frame every type, including high-exposure families, as a role with a next step — never a victim or a verdict.
- For `hidden_risk`, use action language: add judgment, add human contact, learn AI-assisted workflow, compare adjacent occupations.
- Rarity is a neutral distribution fact, never status. Low-frequency types are "less common in this occupation dataset," not better or worse, and never "elite", "genius", "safe", or "rare genius".
- Do not imply hiring suitability, mental health insight, school guidance authority, or legal/financial advice.
- Make model-output limits visible near occupation verdicts that use AIOIS-derived data.
- Keep public copy JA only and avoid English product UI except stable codes such as `CPK`.

Disclaimer placement: present the disclaimer as a calm, confident one-liner adjacent to the result (a credibility flex versus pseudo-science rivals), not as buried legal text.

Required disclaimer concept in Japanese:

`この診断は、仕事の好みと職業データを比べるための目安です。性格検査や適職保証ではありません。AI 影響度は AIOIS-10 に基づくモデル出力であり、統計的な将来予測ではありません。`

## 14. Verification & Gates

Issue #58 verification:

- Human review confirms all 15 sections are present.
- Human review confirms no unfinished markers remain except explicit `pending DIAG-1`.
- Human review confirms `docs/README.md` indexes this document.
- Human review confirms docs-only changes.

Future DIAG implementation gates:

- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run verify:gates`
- `bun run check:page-class`
- `bun run check:csp-hashes`

SEO and static-route gates:

- Add `/shindan` and `/gyakuten` to sitemap only after implementation.
- Re-record SEO baseline with `bun run capture:seo-baseline` when indexable pages are added.
- Verify intentional baseline drift with `bun run check:seo-baseline`.
- Ensure JSON-LD page classes pass `verify:jsonld` through `verify:gates`.
- Ensure no query-specific personalized result pages enter sitemap.

CSP gates:

- Any inline script used for the diagnostic must be static byte-for-byte or externalized.
- If a static inline script is used, update CSP hashes through the existing hash workflow.
- Do not add runtime string interpolation inside inline script bodies.

## 15. Open Items

DIAG-1 thresholds and variants:

- Exact A1, A2, and A3 occupation medians are pending DIAG-1.
- Tie-break rules after distribution audit are pending DIAG-1.
- The high-transformation threshold for the `RDK` aligned-watch case is pending DIAG-1.
- The final 8-family occupation distribution table is pending DIAG-1.
- The margin -> variant mapping (~3 variants per family, ~24 total) and any per-variant rarity are pending DIAG-1.
- Whether to extend the test from 9 to 12 questions for cleaner variant separation is pending DIAG-1.

Type visual direction:

- P1 should choose a restrained visual system that fits the existing site rather than a separate personality-test brand, while still giving each result a recognizable, screenshot-worthy card.
- Per-family color accents derived from the existing warm editorial palette, plus a distinct icon or character per family (and ideally per variant), so a timeline of shared cards looks varied rather than cloned.
- The shared card is a deliberate viral artifact (section 12); design it to be legible at thumbnail size.
- Do not use visual language that implies hierarchy, rarity prestige, or danger.

Premium report:

- Premium report generation is P2 only.
- It needs a separate issue covering data retention, payment or affiliate flow, email delivery, report format, privacy copy, and backend verification.
- P1 must not collect email addresses or store diagnostic results for a future premium report unless that backend scope is explicitly approved.
