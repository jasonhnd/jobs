# Stage 4: 要オーナー署名 (#900)

All candidates below are **unsigned**. This PR is a local review specimen;
merge requires owner signature. The scope follows the owner-requested ordinary
entry reduction, roadmap §10.6 and `first-screen-copy-draft.md` §§2.3, 3–4.
Existing Japanese is reused where possible. No prediction of certain job loss,
safety guarantee, endorsement or affiliation is added.

## Exact static replacements and new occurrences

| Surface | Old | New (unsigned unless already signed) |
| --- | --- | --- |
| Desktop home H1 | `AIの時代でも、あなたらしい働き方を。` | `あなたの仕事は、AIでどう変わる？` (existing mobile H1 reused) |
| Desktop home lead | `556 の職業を、AI 影響度・就業者数・年収・5 つの特性プロファイルで多角的に分析。新しい道を、いっしょに見つけましょう。` | `新しい道を、いっしょに見つけましょう。` (existing sentence retained) |
| Home ranking door count | `39 のランキング` | `8 のランキング` |
| Home second door | `比較する` / `2つの仕事を並べて見る` / `20 ペア` | `業種から探す` / `16 業界` |
| Home ranking subtitle | `39 のランキングで日本 556 職業を分析` | `8 のランキングで日本 556 職業を分析` |
| Home expanded research section | `あなたから・もっと深く` and the 17 classification/research cards | `Pro` and `Pro で詳しく見る` (approved CTA, new occurrence) |
| Ordinary desktop / drawer / footer occupation entry | `自分の現在地` (or absent in footer) | `自分の仕事を探す` |
| Ordinary desktop / drawer / footer Pro entry | Absent | `Pro` |
| Footer shared legal row | Absent | `このサイトについて` (existing mobile label reused; links to /about) |
| Diagnosis result continuation | Absent | `自分の仕事を探す` → /me |
| me selected-occupation continuation | Absent | `職業ページを見る` (existing diagnosis label reused) → selected ordinary occupation |
| Map lead | Absent | `日本の556の仕事を、AIでどれだけ変わるかで色分けした地図です。` |
| Map helper | Absent | `赤いほど変わる部分が多く、緑は変わりにくい仕事。大きさは働く人の数。` |
| Map search guidance | Absent | `まず、自分の仕事を探してみましょう。` |
| Map submit | `診断` | `探す` |
| Map legend | `面積 ≈ 就業者数` + `変化 小さい` / `変化 中くらい` / `変化 大きい` | Area label retained; signed band labels with explicit thresholds: `変化 小さい 4.0未満` / `変化 中くらい 4.0–6.9` / `変化 大きい 7.0以上`; exposed to assistive technology |
| Sectors index lead | `556 職業 を 16 業界に分類。クリックで業界別の AI 影響度ランキング・代表職業へ。` | `日本の556の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| Sectors index helper | `業界別に職業を一覧化したインデックスです。各業種を開くと、AI 影響度・就業者数・年収のランキング、その業界に属する全職業の一覧が確認できます。` | `同じ業界でも、仕事ごとに大きく違います。下の一覧で確かめてください。` |
| Sectors index / detail primary action | Absent | `自分の仕事を探す` (index → /me; detail → its occupation list) |
| Each sector detail | Existing count / average / workforce subtitle | Exact conclusion + matching helper below; existing numeric subtitle moves to small metadata without rewriting its values |

Existing ordinary diagnosis/ranking/map/sector labels stay exactly `診断`,
`ランキング`, `職業マップ`, `業種`. Pro research labels and legal/privacy/
compliance/attribution body copy are unchanged. HTML metadata and OG copy are
unchanged; only the visible desktop home H1 is replaced.

## Removed ordinary-only occurrences (subtraction, not replacement copy)

- Home diagnosis secondary action `図鑑を見る` is removed; diagnosis remains.
- The 31 non-retained ranking cards, their descriptive text, grouping headings
  and `ランキング一覧 (39)` link are removed from ordinary home; the full
  inventory remains at the Pro entrance. The eight retained cards keep their
  existing signed/unmodified title and description, including the existing
  ai-risk-high title. Stage 3 owns any ranking-copy replacement.
- The expanded 17 classification/research cards are removed from ordinary
  home and remain accessible through Pro. Their underlying Pro content is
  unchanged.
- Ordinary navigation removes `図鑑`, `比較`, `Q&A`, `探す方法`,
  `人類と AI の距離` and the expanded classification/data groups, including
  their legacy explanatory captions. Ordinary drawer now has only the six
  entries above. Full Pro navigation retains these labels.
- Ordinary footer research group labels `適職を探す`, `キャリア`,
  `データ・方法` and their research links are replaced by the six-entry
  ordinary reading navigation. Legal links remain in the shared legal row.

## Placeholder rules (no new scores)

`{業界名}` and `{職業数}` come from the unchanged knowledge graph.
`{帯}` follows the existing signed helper on the displayed one-decimal average:
<4.0 `変化 小さい`, 4.0–6.9 `変化 中くらい`, ≥7.0 `変化 大きい`.
Means are computed from raw occupation scores; averages are not averages of
rounded sector values. Missing/non-finite means produce no fabricated conclusion.
The map `{職業数}` is the shared scored count (currently 556).

| Band | New conclusion | New helper |
| --- | --- | --- |
| Small | `{業界名}の{職業数}の仕事は、平均するとAIで変わる部分が「小さい」業界です。` | `ただし、仕事ごとに差があります。下の一覧で確かめてください。` |
| Medium | `{業界名}の{職業数}の仕事は、平均するとAIで変わる部分が「中くらい」です。` | `同じ業界でも、仕事ごとに大きく違います。下の一覧で確かめてください。` |
| Large (future data only) | `{業界名}の{職業数}の仕事は、平均するとAIで変わる部分が「大きい」業界です。` | `仕事がなくなる、という意味ではありません。仕事ごとの違いは下の一覧で。` |

The sectors index uses the medium template with name `日本`, count `556` and
the shared full occupation mean. It is not an additional industry or a second
score dataset. The historical draft's proposal for an old industry band scale
is superseded by the owner-approved displayed-score rule.

## Three-width evidence

Native local Microsoft Edge, local built output, analytics variables empty.
Paths follow `/tmp/JOB_0232/screenshots/{surface}-{width}-{state}.png`, widths
1440 / 768 / 375. Surfaces: home, map, sectors, sectors-iryo, menu, diagnosis,
me, occupation-428 and pro-428. `evidence.json` records actual captured files,
head, viewport, conclusions and overflow measurements. Mobile menu opens at
768 / 375; at 1440 the real desktop navigation is the corresponding normal
surface. A separately labelled forced-drawer specimen, if present, is not
normal desktop responsive behaviour. Cookie-first-visit and rejected states,
dark system preference (the Design canon neutralizes both themes to cream),
keyboard focus, and per-sector text are retained as supplementary
specimens. No deployed preview or production acceptance is claimed.

## Rendered sector pairs

The table below records each unchanged old subtitle and exact new conclusion.
Matching helper text is selected from the table above.

| Route | Old subtitle (now metadata) | New conclusion |
| --- | --- | --- |
| `/sectors/iryo` | `36 職業 · 平均 AI 影響 4.0/10 変化 中くらい · 就業者数 計 3,409,451 人` | `医療・保健の36の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/fukushi` | `15 職業 · 平均 AI 影響 4.0/10 変化 中くらい · 就業者数 計 2,188,687 人` | `福祉・介護の15の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/kyoiku` | `20 職業 · 平均 AI 影響 4.1/10 変化 中くらい · 就業者数 計 2,610,464 人` | `教育・指導の20の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/hoan` | `15 職業 · 平均 AI 影響 3.6/10 変化 小さい · 就業者数 計 1,104,199 人` | `保安・公安の15の仕事は、平均するとAIで変わる部分が「小さい」業界です。` |
| `/sectors/noringyo` | `14 職業 · 平均 AI 影響 3.8/10 変化 小さい · 就業者数 計 1,847,992 人` | `農林・水産の14の仕事は、平均するとAIで変わる部分が「小さい」業界です。` |
| `/sectors/senmon` | `51 職業 · 平均 AI 影響 4.5/10 変化 中くらい · 就業者数 計 1,561,033 人` | `専門・技術の51の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/it` | `22 職業 · 平均 AI 影響 6.1/10 変化 中くらい · 就業者数 計 1,551,228 人` | `IT・通信の22の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/shigyo` | `63 職業 · 平均 AI 影響 5.2/10 変化 中くらい · 就業者数 計 1,820,677 人` | `士業・経営・コンサルの63の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/creative` | `37 職業 · 平均 AI 影響 5.2/10 変化 中くらい · 就業者数 計 778,380 人` | `クリエイティブ・メディアの37の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/jimu` | `57 職業 · 平均 AI 影響 6.4/10 変化 中くらい · 就業者数 計 11,534,069 人` | `事務・公務の57の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/hanbai` | `41 職業 · 平均 AI 影響 5.0/10 変化 中くらい · 就業者数 計 6,616,467 人` | `販売・営業の41の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/service` | `41 職業 · 平均 AI 影響 4.1/10 変化 中くらい · 就業者数 計 4,488,395 人` | `サービス・接客の41の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/seizo` | `59 職業 · 平均 AI 影響 4.4/10 変化 中くらい · 就業者数 計 4,537,008 人` | `製造・職人の59の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/maint` | `49 職業 · 平均 AI 影響 4.2/10 変化 中くらい · 就業者数 計 4,598,159 人` | `設備・保守の49の仕事は、平均するとAIで変わる部分が「中くらい」です。` |
| `/sectors/kensetu` | `20 職業 · 平均 AI 影響 3.1/10 変化 小さい · 就業者数 計 2,390,985 人` | `建設・土木の20の仕事は、平均するとAIで変わる部分が「小さい」業界です。` |
| `/sectors/keiseki` | `16 職業 · 平均 AI 影響 4.2/10 変化 中くらい · 就業者数 計 3,518,776 人` | `軽作業・清掃の16の仕事は、平均するとAIで変わる部分が「中くらい」です。` |

Each sector has three-width captures at `/tmp/JOB_0232/screenshots/sectors-{slug}-{width}-rejected.png`; medical/health also has first-visit, dark and full-page captures.
