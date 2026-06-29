# Work-Type Diagnostic Design

This is the canonical design document for the work-type diagnostic. It gates DIAG-1 through DIAG-9. Issue #58 is documentation-only; no data files, routes, scripts, or UI are implemented by this issue.

## 1. Purpose & Strategic Fit

The diagnostic is the top of the B2B and affiliate funnel for mirai-shigoto.com. It gives readers a fast, shareable answer to "what kind of work pattern fits me, and how does that compare with my current or target occupation?" and then routes them deeper into existing occupation pages, rankings, comparisons, and future partner offers.

It is not a separate product. It should feel like a guided entry point into the existing AIOIS-10 occupation map, not a standalone personality brand. The diagnostic must reuse the site's core assets: Japanese occupation data, AIOIS-10 scoring, occupation detail pages, ranking pages, and static delivery.

Primary business fit:

- B2C reader entry: short quiz, clear result, shareable type card.
- B2B lead path: team/workforce aggregate framing can be offered in P2 without changing the public MVP.
- Affiliate path: result pages can recommend occupation pages, learning categories, or career-transition content without implying endorsement or certainty.

The diagnostic should make the main site easier to enter. It should not dilute the core proposition: Japan Jobs x AI Impact is an evidence-based static visualization of Japanese occupations with model-generated AI-impact scores.

## 2. Concept

The diagnostic returns two separate outputs:

1. Personal type: a reader's self-reported work preference across three binary axes.
2. Occupation verdict: the selected occupation's work-type code derived from the occupation dataset and AIOIS-10 dimensions.

These outputs must stay separate in UI, copy, data, and analytics. The personal type is not inferred from the occupation. The occupation verdict is not a psychological label for the reader. The product value comes from comparing the two cleanly:

- "Your work type": the reader's 3-letter code from the 9-question test.
- "This occupation's type": the occupation's 3-letter code from occupation data.
- "Gap verdict": the relationship between the two: hidden strength, hidden risk, or aligned.

Japanese product strings:

- Feature name: `仕事タイプ診断`
- Personal result label: `あなたのタイプ`
- Occupation verdict label: `この職業のタイプ`
- Gap label: `自分 x 仕事のギャップ`

## 3. Non-Goals & Constraints

Non-goals:

- No clinical, psychological, aptitude-test, hiring, or employee-screening claim.
- No account system, saved history, team dashboard, paid report, CRM integration, or email capture in the static MVP.
- No backend scoring, database, LLM call, server session, or personalized server-rendered result.
- No English UI in the public product surface. The diagnostic is JA only.
- No fear-first positioning such as "your job will disappear" or "AI will replace you."

Constraints:

- 100% static product runtime. All quiz scoring, occupation lookup, result rendering, and share-link construction must work with prebuilt static assets and browser JavaScript. The only runtime function allowed in P1 is the existing stateless `/api/og` Edge renderer for social-card images; it receives display parameters and does not compute, store, or personalize diagnostic results.
- Rigor over entertainment. The test can be light, but it must not contradict AIOIS-10, occupation data, or the site's model-output disclaimers.
- The diagnostic must preserve AIOIS-10's separation between Transformation and Displacement-Risk. Work type is a classification lens, not a new risk score.
- The diagnostic must be JA only in UI copy, meta copy, share copy, and result copy.
- No new backend dependency may be introduced in DIAG-1 through DIAG-9 unless the deferred P2 backend scope is explicitly reopened.

## 4. The 3 Axes Mapped To AIOIS-10

The public diagnostic uses three reader-friendly axes. Each axis maps to AIOIS-10 dimensions so occupation verdicts remain grounded in the existing scoring system.

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

## 5. The 9-Question Test + Scoring To 3-Letter Code

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

Scoring:

- A1: `C` if C answers >= 2, otherwise `R`.
- A2: `P` if P answers >= 2, otherwise `D`.
- A3: `B` if B answers >= 2, otherwise `K`.
- Code: concatenate A1 + A2 + A3, for example `CPK`.

The result page must show the axis breakdown before the narrative label so readers can see why the code was assigned.

## 6. The 8 Types + Anchor Copy

The type system is intentionally coarse. It is a navigation and reflection tool, not a fine-grained personality taxonomy.

| Code | 型名 | Representative occupations | AI relation | Coarse camp | Anchor copy |
| --- | --- | --- | --- | --- | --- |
| `CPB` | `現場共創タイプ` | 美容師, 保育士, インテリアコーディネーター | AI can support references, plans, and preparation; the value stays in hands-on creation and trust. | Field + people | `人と現場に触れながら、新しい形をつくるタイプ。AIは下調べや案出しの相棒になります。` |
| `CPK` | `共感企画タイプ` | 経営コンサルタント, 教師, キャリアカウンセラー | AI drafts and summarizes; the reader's value is framing, empathy, judgment, and facilitation. | People + knowledge | `人の意図を読み取り、言葉や企画に変えるタイプ。AIで準備を速くし、人間の判断に時間を使えます。` |
| `CDB` | `現物設計タイプ` | 建築士, 工業デザイナー, 3Dプリンター技術者 | AI expands design options; physical constraints, materials, and site reality remain decisive. | Creative systems | `データと現物を行き来しながら、使える形に落とし込むタイプ。AIは試作と比較を広げます。` |
| `CDK` | `構想分析タイプ` | ソフトウェア開発者, 研究者, データサイエンティスト | AI is a high-leverage co-pilot; transformation is often high, but strong abstraction raises upside. | Knowledge creation | `情報を読み解き、新しい仕組みや仮説をつくるタイプ。AIを使うほど発想と検証の速度が上がります。` |
| `RPB` | `ケア実行タイプ` | 訪問介護員, 看護助手, 接客スタッフ | AI can reduce admin and scheduling load; embodied service and trust are resilient. | Human service | `決まった流れを大切にしながら、人と現場を支えるタイプ。AIは記録や段取りを軽くできます。` |
| `RPK` | `調整運用タイプ` | 医療事務, 人事労務, カスタマーサポート | AI handles drafts, templates, and routing; quality depends on accurate human coordination. | Service operations | `人とのやりとりを、正確な手順で前に進めるタイプ。AIは定型文や確認作業を助けます。` |
| `RDB` | `現場運用タイプ` | 倉庫作業員, 配送員, 検査員 | AI and automation optimize flow; robotics cost, safety, and site variance slow full replacement. | Physical operations | `現場の流れを安定して回すタイプ。AIは配置・予測・確認を助け、現場判断は残ります。` |
| `RDK` | `情報処理タイプ` | 一般事務, データ入力, 経理事務 | Routine information work has high AI transformation; durable value comes from domain context, checks, and exception handling. | Data operations | `情報を正確に整理し、安定して処理するタイプ。AIで定型作業を短くし、確認と改善に移れます。` |

Type rarity, rank, or superiority must not be implied. Each anchor must connect to practical next steps and occupation pages.

## 7. Signature Feature: Self x Job Gap

The signature feature compares the personal type with a selected occupation verdict. It must be displayed as a gap explanation, not a pass/fail judgment.

Inputs:

- `selfCode`: 3-letter result from the 9-question test.
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

Occupation threshold method:

- Use median split per axis over the active 556 scored occupations.
- Compute continuous A1, A2, and A3 occupation scores from normalized AIOIS-10 dimensions as defined in section 4.
- Assign each occupation to the high-side pole above the median and the low-side pole below the median.
- If an axis score equals the median, DIAG-1 must use a deterministic tie-break based on the strongest raw AIOIS dimension for that axis.

Distribution guardrails:

- No type may represent less than 3% of the 556 scored occupations.
- No type may represent more than 35% of the 556 scored occupations.
- If a type falls outside the range, DIAG-1 must adjust axis tie-breaks or threshold smoothing, then record the resulting distribution in this document or in a linked generated calibration note.
- The known tight cell is `CDB`: on the real Fable 5 data it is about 2.5%, just under the 3% floor. DIAG-1 must smooth that cell via deterministic tie-breaks or threshold adjustments while keeping exact medians pending DIAG-1.

Current status:

- Exact medians: pending DIAG-1.
- Type distribution table: pending DIAG-1.
- Tie-break rules after distribution audit: pending DIAG-1.

Rarity framing:

- Allowed: `このタイプは現在の職業データでは少なめです。`
- Not allowed: "rare genius", "elite", "safe type", "dangerous type", or any status hierarchy.

## 9. Architecture: 100% Static, No Backend

The diagnostic product must be static at runtime. It may use browser JavaScript and prebuilt JSON, but it must not require server scoring, a database, a session store, or a runtime LLM call. The existing `/api/og` Vercel Edge function is an allowed stateless rendering endpoint for social-card images; it must remain parameter-driven and must not become a scoring, persistence, or saved-result backend.

| Concern | Live/backend version | Static MVP version |
| --- | --- | --- |
| Quiz scoring | Server receives answers and returns type. | Browser scores 9 answers locally from static question data. |
| Occupation verdict | Server computes occupation type on request. | Build step precomputes occupation work-type codes into static JSON. |
| Result rendering | Personalized server-rendered page. | Static route renders shell; browser enhances with query/hash state. |
| Share links | Saved result ID in database. | URL carries `self`, `job`, and `gap` parameters or omits job for privacy. |
| Result images | Saved-result image generated from database state. | Existing stateless `/api/og` Edge function renders per-result cards from URL parameters, for example `/api/og?worktype=CPK&gap=hidden_strength`. |
| Analytics | Server event stream tied to user account. | Existing client analytics events only, with no answer payload beyond aggregate type/gap labels. |
| Premium report | Generated and stored server-side. | Deferred to P2 backend; not part of static MVP. |

Shared static data and copy contract for DIAG-2/3/4/5:

- `public/data.worktypes.json`: emitted by DIAG-1 with `{ thresholds, types, occupations }`. It contains thresholds, per-type meta, and per-occupation records `{ code, typeId, exposure, rarityPct }`.
- `src/site/worktype-copy.ts`: JA copy module from DIAG-9 for public labels, questions, type anchors, gap copy, and share copy.

Recommended route shape for DIAG implementation:

- `/gyakuten`: static front door and 8-type overview surface for `CPB`, `CPK`, `CDB`, `CDK`, `RPB`, `RPK`, `RDB`, `RDK`.
- `/shindan`: static quiz and result surface.
- Query parameters may add selected occupation and result context, for example `/shindan?self=CPK&job=0133&gap=hidden_strength`.
- Query-specific results must not be added to sitemap.

## 10. Per-Page Modification Plan

| Surface | Current | Change | Type | Backend |
| --- | --- | --- | --- | --- |
| `/shindan` | Does not exist. | Add static quiz shell, question flow, occupation picker, and result handoff. | New static page | No |
| `/gyakuten` | Does not exist. | Add static front door with 8 type anchors, type copy, representative occupations, and handoff into `/shindan`. | New static page | No |
| `/` | Homepage routes readers to map/search and existing content. | Add a restrained `仕事タイプ診断` entry point near existing search or CTA area. | Copy/link update | No |
| `/map` | Interactive occupation treemap with search and `診断` search button. | Add optional link from selected occupation sheet to `/shindan?job=<id>`. | Link/client update | No |
| `/me` | Static self-positioning tool based on selected occupation. | Add cross-link to `/shindan?job=<id>`; do not merge `/me` and diagnostic logic. | Link/client update | No |
| Occupation detail `/{id}` | Shows AIOIS-10, stats, transfer paths, FAQ, JSON-LD. | Add static badge for occupation work type and link to `/shindan?job=<id>`. | Static data/render update | No |
| `/rankings` and `/rankings/[type]` | Ranking hubs and ranking detail pages. | Add light entry cards where relevant, especially high-transformation routine/data pages. | Copy/link update | No |
| `/compare` and `/compare/[pair]` | Occupation comparison surfaces. | Optionally show each occupation's work type once DIAG data exists. | Static data/render update | No |
| `/standard` | AIOIS-10 definition. | Add no diagnostic-specific content in P1; link only if needed after launch. | Deferred docs/copy | No |
| `/methodology` and `/data` | Explain scoring and public data. | Document work-type derived data only after DIAG-1 creates the data artifact. | Docs/copy update | No |
| `sitemap.xml` and SEO baselines | Current route set excludes diagnostic pages. | Include `/shindan` and `/gyakuten` only; exclude personalized query states. | Generated static update | No |

## 11. Phasing

P0 data:

- Define question data and type metadata, with public JA copy owned by `src/site/worktype-copy.ts`.
- Emit `public/data.worktypes.json` with thresholds, per-type meta, and per-occupation `{ code, typeId, exposure, rarityPct }` records for DIAG-2/3/4/5.
- Implement DIAG-1 calibration over active AIOIS-10 scores.
- Record medians, type distribution, and guardrail results.
- Keep data generation deterministic and covered by tests.

P1 static MVP:

- Add `/shindan` and `/gyakuten` pages.
- Add client-only quiz scoring and result rendering.
- Add occupation picker using existing static search or a narrowed diagnostic lookup.
- Add self x job gap block.
- Add share mechanics, parameter-driven `/api/og` result share cards, sitemap entries, SEO baseline updates, CSP hashes, and page-class coverage.
- Add light links from homepage, map, `/me`, and occupation detail pages.

P2 deferred backend:

- Premium report generation.
- Team or organization aggregate reports.
- Email capture tied to report delivery.
- Saved result history.
- CRM or affiliate tracking beyond ordinary static outbound links.

P2 must not be smuggled into P1. If it becomes necessary, create a new issue with backend scope, data retention rules, privacy review, and verification gates.

## 12. Distribution & Share Mechanics

Share goals:

- Make the 8 type labels easy to share.
- Keep occupation-specific context optional.
- Avoid storing or exposing raw answer choices.
- Route shared clicks back into static pages.

MVP share URL formats:

- Type only: `/shindan?self=CPK`
- Type plus occupation context: `/shindan?self=CPK&job=0133`
- Type plus explicit gap state: `/shindan?self=CPK&job=0133&gap=hidden_strength`

The URL must not include the 9 raw answers. If answer-level reconstruction is needed for debugging, it stays local only and is not shared.

Share UI:

- Use Web Share API where available.
- Provide Copy Link fallback.
- Provide X and LINE text links only if they can be generated without backend calls.
- Share copy must include the type name and one short Japanese anchor line, not fear-first risk language.

Stateless OG:

- P1 uses the existing stateless `/api/og` Vercel Edge function for per-result share cards. DIAG-5 should add `worktype` and `gap` dispatch, for example `/api/og?worktype=CPK&gap=hidden_strength`; `job=0133` may be included only to display occupation context, not raw answers.
- The Edge function must remain parameter-driven and stateless: no saved result ID, database, session, backend scoring, or runtime LLM call.

Analytics:

- Allowed event fields: type code, gap class, selected occupation ID, source surface.
- Not allowed: raw answers, free text, user identifiers, or inferred sensitive attributes.

## 13. Risks & Honesty Guardrails

DIAG-9 must follow these copy rules:

- Always state that the diagnostic is a reflection and navigation tool, not a psychological test or career guarantee.
- Keep `あなたのタイプ` and `この職業のタイプ` visually and verbally separate.
- Do not say a person "is" a type as a fixed identity. Prefer "leans toward" or Japanese copy such as `この結果では...タイプです`.
- Do not say an occupation is safe, doomed, future-proof, obsolete, or replaceable as a whole.
- When discussing AI, use task-change language: `AIで変わりやすい`, `AIが補助しやすい`, `人が残る価値`.
- For `hidden_risk`, use action language: add judgment, add human contact, learn AI-assisted workflow, compare adjacent occupations.
- Never use rarity as status. Low-frequency types are "less common in this occupation dataset," not better or worse.
- Do not imply hiring suitability, mental health insight, school guidance authority, or legal/financial advice.
- Make model-output limits visible near occupation verdicts that use AIOIS-derived data.
- Keep public copy JA only and avoid English product UI except stable codes such as `CPK`.

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

DIAG-1 thresholds:

- Exact A1, A2, and A3 occupation medians are pending DIAG-1.
- Tie-break rules after distribution audit are pending DIAG-1.
- The high-transformation threshold for the `RDK` aligned-watch case is pending DIAG-1.
- The final 8-type occupation distribution table is pending DIAG-1.

Type visual direction:

- P1 should choose a restrained visual system that fits the existing site rather than a separate personality-test brand.
- Candidate approach: one compact icon or geometric motif per type, plus color accents derived from the existing warm editorial palette.
- Do not use visual language that implies hierarchy, rarity prestige, or danger.

Premium report:

- Premium report generation is P2 only.
- It needs a separate issue covering data retention, payment or affiliate flow, email delivery, report format, privacy copy, and backend verification.
- P1 must not collect email addresses or store diagnostic results for a future premium report unless that backend scope is explicitly approved.
