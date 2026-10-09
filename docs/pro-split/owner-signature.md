# 要オーナー署名 — Stage 1B ranking metadata

Issue #896 / PR #899 / JOB_0233. Pending owner signature; do not merge before signature.

All 39 Pro ranking details (31 migrated + eight retained copies) and `/pro/rankings`
reuse the original Japanese text with visible HTML metadata prefixes. Titles change
`{original title}` → `Pro | {original title}`; descriptions change
`{original description}` → `Pro · {original description}`. `og:title` and
`og:description` retain the original **unprefixed** strings; they differ from HTML
title/description. The title's existing 120-character OG limit remains unchanged.
There is no such prefix addition on `/pro/methodology`.

Original strings below were checked against the stage-1A preview baseline at
`fd3b7bb648ec41b8b5005abe4402c452dddc1292`. New strings and unchanged OG values were
read from built HTML. Screenshots use native local Microsoft Edge at all three widths.

Existing edition labels reused on new research surfaces also await signature:
no edition entrance → `Pro`; no return link → `通常版へ`; no landmark →
`版の切り替え`. Evidence: `pro-skills-{1440,768,375}.png` in the same directory.

## `/pro/rankings`

| Field | Old | New |
| --- | --- | --- |
| Title | 職業ランキング｜AI影響度・年収・就業者数・初任給・労働時間で比較 \| 未来の仕事 | Pro \| 職業ランキング｜AI影響度・年収・就業者数・初任給・労働時間で比較 \| 未来の仕事 |
| Description | 日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに代替されやすい仕事、年収が高くAIに代替されにくい仕事などを日本の職業データで一覧。 | Pro · 日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに代替されやすい仕事、年収が高くAIに代替されにくい仕事などを日本の職業データで一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-risk-high`

| Field | Old | New |
| --- | --- | --- |
| Title | AIに奪われる仕事ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| AIに奪われる仕事ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | AI影響度が最も高い職業TOP30。平均スコア7.6/10 変化 大きい。AI代替リスク・年収・就業者数を一覧比較。複数のAIモデルによる採点の総合値（独自分析・非公式）。 | Pro · AI影響度が最も高い職業TOP30。平均スコア7.6/10 変化 大きい。AI代替リスク・年収・就業者数を一覧比較。複数のAIモデルによる採点の総合値（独自分析・非公式）。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-risk-high-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-risk-low`

| Field | Old | New |
| --- | --- | --- |
| Title | AI影響が少ない仕事ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| AI影響が少ない仕事ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | AIに代替されにくい職業TOP30。平均スコア2.8/10 変化 小さい。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。 | Pro · AIに代替されにくい職業TOP30。平均スコア2.8/10 変化 小さい。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-risk-low-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/salary-safe`

| Field | Old | New |
| --- | --- | --- |
| Title | 高年収×低AIリスクの職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 高年収×低AIリスクの職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 年収が高くAI代替リスクが低い職業TOP30。平均年収976万円・平均AI影響4.2/10 変化 中くらい。将来性と収入を両立できる仕事を一覧。 | Pro · 年収が高くAI代替リスクが低い職業TOP30。平均年収976万円・平均AI影響4.2/10 変化 中くらい。将来性と収入を両立できる仕事を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-salary-safe-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/workers`

| Field | Old | New |
| --- | --- | --- |
| Title | 就業者数が多い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 就業者数が多い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 日本で最も就業者が多い職業TOP30。合計15,907,206人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。 | Pro · 日本で最も就業者が多い職業TOP30。合計15,907,206人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-workers-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/salary`

| Field | Old | New |
| --- | --- | --- |
| Title | 年収が高い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 年収が高い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 日本で最も年収が高い職業TOP30。平均年収1044万円。AI影響度・就業者数も合わせて比較。 | Pro · 日本で最も年収が高い職業TOP30。平均年収1044万円。AI影響度・就業者数も合わせて比較。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-salary-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/entry-salary`

| Field | Old | New |
| --- | --- | --- |
| Title | 初任給が高い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 初任給が高い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 初任給が最も高い職業TOP30。平均初任給55万円。年収・AI影響度も合わせて比較。就活・転職の参考に。 | Pro · 初任給が最も高い職業TOP30。平均初任給55万円。年収・AI影響度も合わせて比較。就活・転職の参考に。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-entry-salary-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/young-workforce`

| Field | Old | New |
| --- | --- | --- |
| Title | 平均年齢が若い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 平均年齢が若い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 平均年齢が最も低い職業TOP30。平均36.4歳。若手が活躍する職業を年収・AI影響度と共に一覧。 | Pro · 平均年齢が最も低い職業TOP30。平均36.4歳。若手が活躍する職業を年収・AI影響度と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-young-workforce-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/short-hours`

| Field | Old | New |
| --- | --- | --- |
| Title | 労働時間が短い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 労働時間が短い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 月間労働時間が最も短い職業TOP30。平均151時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。 | Pro · 月間労働時間が最も短い職業TOP30。平均151時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-short-hours-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/high-demand`

| Field | Old | New |
| --- | --- | --- |
| Title | 人手不足の職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 人手不足の職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 求人需要が最も高い職業TOP30。全556職業のうち「需要高」は270件・「安定」は105件。転職・就活の参考に。 | Pro · 求人需要が最も高い職業TOP30。全556職業のうち「需要高」は270件・「安定」は105件。転職・就活の参考に。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-high-demand-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/hourly-wage`

| Field | Old | New |
| --- | --- | --- |
| Title | 時給が高い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 時給が高い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 時給ベースで報酬が高い職業 TOP30。平均時給 ¥3,441。AI 影響度・年収と共に一覧。 | Pro · 時給ベースで報酬が高い職業 TOP30。平均時給 ¥3,441。AI 影響度・年収と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-hourly-wage-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/recruit-ratio`

| Field | Old | New |
| --- | --- | --- |
| Title | 求人倍率が高い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 求人倍率が高い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 求人倍率が最も高い職業 TOP30。平均 16.92 倍。人手不足が顕著な売り手市場の職業一覧。 | Pro · 求人倍率が最も高い職業 TOP30。平均 16.92 倍。人手不足が顕著な売り手市場の職業一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-recruit-ratio-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/aging-workforce`

| Field | Old | New |
| --- | --- | --- |
| Title | シニア中心の職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| シニア中心の職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 平均年齢が最も高い職業 TOP30。平均 53.0 歳。経験者が活躍する職業一覧。 | Pro · 平均年齢が最も高い職業 TOP30。平均 53.0 歳。経験者が活躍する職業一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-aging-workforce-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/monthly-hours-long`

| Field | Old | New |
| --- | --- | --- |
| Title | 労働時間が長い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 労働時間が長い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 月間労働時間が最も長い職業 TOP30。平均 173 時間。年収・AI 影響度と共に確認。 | Pro · 月間労働時間が最も長い職業 TOP30。平均 173 時間。年収・AI 影響度と共に確認。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-monthly-hours-long-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/recruit-ratio-low`

| Field | Old | New |
| --- | --- | --- |
| Title | 求人倍率が低い職業ランキング TOP30【2026年版】\| 未来の仕事 | Pro \| 求人倍率が低い職業ランキング TOP30【2026年版】\| 未来の仕事 |
| Description | 求人倍率が最も低い職業 TOP30。平均 0.20 倍。採用競争が厳しい買い手市場の職業一覧。 | Pro · 求人倍率が最も低い職業 TOP30。平均 0.20 倍。採用競争が厳しい買い手市場の職業一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-recruit-ratio-low-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-replaced-soon`

| Field | Old | New |
| --- | --- | --- |
| Title | AI 置き換えが進む職業 TOP5【2026年版】\| 未来の仕事 | Pro \| AI 置き換えが進む職業 TOP5【2026年版】\| 未来の仕事 |
| Description | AI 影響度 8/10 以上の職業 TOP5。業務再設計が急務な分野を AI 影響度・年収と共に一覧。 | Pro · AI 影響度 8/10 以上の職業 TOP5。業務再設計が急務な分野を AI 影響度・年収と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-replaced-soon-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-resistant-craft`

| Field | Old | New |
| --- | --- | --- |
| Title | 伝統技能で AI に強い職業 TOP19【2026年版】\| 未来の仕事 | Pro \| 伝統技能で AI に強い職業 TOP19【2026年版】\| 未来の仕事 |
| Description | 製造・建設・メンテ・農林系で AI 影響度が低い職業 TOP19。手技中心で AI 代替が難しい分野を一覧。 | Pro · 製造・建設・メンテ・農林系で AI 影響度が低い職業 TOP19。手技中心で AI 代替が難しい分野を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-resistant-craft-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-at-risk-but-paid`

| Field | Old | New |
| --- | --- | --- |
| Title | AI リスク高 × 高年収の職業 TOP20【2026年版】\| 未来の仕事 | Pro \| AI リスク高 × 高年収の職業 TOP20【2026年版】\| 未来の仕事 |
| Description | AI 影響度 7+ かつ年収 500 万円以上の「要注意組」TOP20。今は稼げるが業務再設計が前提の分野。 | Pro · AI 影響度 7+ かつ年収 500 万円以上の「要注意組」TOP20。今は稼げるが業務再設計が前提の分野。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-at-risk-but-paid-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-augmented`

| Field | Old | New |
| --- | --- | --- |
| Title | AI で補強される職業 TOP30【2026年版】\| 未来の仕事 | Pro \| AI で補強される職業 TOP30【2026年版】\| 未来の仕事 |
| Description | AI 影響度 4-6 で AI で業務が増強される職業 TOP30。年収順で並べた「AI 共存域」の職業一覧。 | Pro · AI 影響度 4-6 で AI で業務が増強される職業 TOP30。年収順で並べた「AI 共存域」の職業一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-augmented-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-frontier`

| Field | Old | New |
| --- | --- | --- |
| Title | AI を使いこなす側の職業 TOP19【2026年版】\| 未来の仕事 | Pro \| AI を使いこなす側の職業 TOP19【2026年版】\| 未来の仕事 |
| Description | IT・通信セクターで AI を活用する職業 TOP19。AI フロンティア職を年収・AI 影響度と共に一覧。 | Pro · IT・通信セクターで AI を活用する職業 TOP19。AI フロンティア職を年収・AI 影響度と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-frontier-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-stable-employment`

| Field | Old | New |
| --- | --- | --- |
| Title | AI 安全 × 正規雇用率高の職業 TOP30【2026年版】\| 未来の仕事 | Pro \| AI 安全 × 正規雇用率高の職業 TOP30【2026年版】\| 未来の仕事 |
| Description | AI 影響度 5 以下かつ正規雇用率 60% 以上の安定職業 TOP30。長期的なキャリア安定性が期待できる分野。 | Pro · AI 影響度 5 以下かつ正規雇用率 60% 以上の安定職業 TOP30。長期的なキャリア安定性が期待できる分野。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-stable-employment-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-safe-high-demand`

| Field | Old | New |
| --- | --- | --- |
| Title | 高需要 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 高需要 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 人手不足かつ AI 影響度が低い職業 TOP30。介護・建設・医療系を中心とした「鉄板」キャリア候補。 | Pro · 人手不足かつ AI 影響度が低い職業 TOP30。介護・建設・医療系を中心とした「鉄板」キャリア候補。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-safe-high-demand-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-safe-short-hours`

| Field | Old | New |
| --- | --- | --- |
| Title | 低労働時間 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 低労働時間 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 労働時間が短く AI 影響度も低い職業 TOP30。ワークライフバランスと将来性を両立する職業を一覧。 | Pro · 労働時間が短く AI 影響度も低い職業 TOP30。ワークライフバランスと将来性を両立する職業を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-safe-short-hours-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-safe-young-workforce`

| Field | Old | New |
| --- | --- | --- |
| Title | 若手中心 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 若手中心 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 平均年齢が若く AI 影響度も低い職業 TOP30。新卒・第二新卒の参考に。 | Pro · 平均年齢が若く AI 影響度も低い職業 TOP30。新卒・第二新卒の参考に。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-safe-young-workforce-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-safe-no-license`

| Field | Old | New |
| --- | --- | --- |
| Title | 無資格 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 無資格 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 関連資格不要で AI 影響度も低い職業 TOP30。資格に頼らず長く続けられる分野を一覧。 | Pro · 関連資格不要で AI 影響度も低い職業 TOP30。資格に頼らず長く続けられる分野を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-safe-no-license-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-safe-physical`

| Field | Old | New |
| --- | --- | --- |
| Title | 身体性 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 身体性 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 身体技能職で AI 影響度も低い職業 TOP30。製造・建設・農林等の現場職を一覧。 | Pro · 身体技能職で AI 影響度も低い職業 TOP30。製造・建設・農林等の現場職を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-safe-physical-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/ai-safe-interpersonal`

| Field | Old | New |
| --- | --- | --- |
| Title | 対人 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 対人 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 対人スキル中心で AI 影響度も低い職業 TOP30。医療・福祉・教育・販売・サービス系を一覧。 | Pro · 対人スキル中心で AI 影響度も低い職業 TOP30。医療・福祉・教育・販売・サービス系を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-ai-safe-interpersonal-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/high-salary-high-demand`

| Field | Old | New |
| --- | --- | --- |
| Title | 高年収 × 高需要の職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 高年収 × 高需要の職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 年収が高くかつ人手不足の職業 TOP30。賃金上昇圧力が働く分野を一覧。 | Pro · 年収が高くかつ人手不足の職業 TOP30。賃金上昇圧力が働く分野を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-high-salary-high-demand-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/high-salary-young-entry`

| Field | Old | New |
| --- | --- | --- |
| Title | 初任給が高い × 若手活躍の職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 初任給が高い × 若手活躍の職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 初任給が高くて平均年齢 40 歳以下の職業 TOP30。新卒キャリア設計の参考に。 | Pro · 初任給が高くて平均年齢 40 歳以下の職業 TOP30。新卒キャリア設計の参考に。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-high-salary-young-entry-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/license-required`

| Field | Old | New |
| --- | --- | --- |
| Title | 国家資格が必要な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 国家資格が必要な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 関連資格が多い職業 TOP30。参入のかべが明確な専門職を年収・AI 影響度と共に一覧。 | Pro · 関連資格が多い職業 TOP30。参入のかべが明確な専門職を年収・AI 影響度と共に一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-license-required-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/no-license-required`

| Field | Old | New |
| --- | --- | --- |
| Title | 無資格で就ける × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 無資格で就ける × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 関連資格不要で AI 影響度も低い職業 TOP30。実務経験ベースで勝負できる分野を一覧。 | Pro · 関連資格不要で AI 影響度も低い職業 TOP30。実務経験ベースで勝負できる分野を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-no-license-required-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/high-school-ok`

| Field | Old | New |
| --- | --- | --- |
| Title | 高卒で目指せる職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 高卒で目指せる職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 高卒比率が高い職業 TOP30。学歴ハードルが低く実務能力で評価される職業を一覧。 | Pro · 高卒比率が高い職業 TOP30。学歴ハードルが低く実務能力で評価される職業を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-high-school-ok-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/university-required`

| Field | Old | New |
| --- | --- | --- |
| Title | 大卒以上が中心の職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 大卒以上が中心の職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 大卒比率 50% 以上の職業 TOP30。学位が前提となる専門職を一覧。 | Pro · 大卒比率 50% 以上の職業 TOP30。学位が前提となる専門職を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-university-required-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/graduate-school-required`

| Field | Old | New |
| --- | --- | --- |
| Title | 大学院卒中心の職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 大学院卒中心の職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 修士・博士課程修了者が多い職業 TOP30。高度専門職を一覧。 | Pro · 修士・博士課程修了者が多い職業 TOP30。高度専門職を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-graduate-school-required-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/public-sector`

| Field | Old | New |
| --- | --- | --- |
| Title | 公的機関・公務員系の職業 TOP15【2026年版】\| 未来の仕事 | Pro \| 公的機関・公務員系の職業 TOP15【2026年版】\| 未来の仕事 |
| Description | 保安・公安セクターの公務員系職業 TOP15。安定雇用・年功的昇進・福利厚生が特徴の分野。 | Pro · 保安・公安セクターの公務員系職業 TOP15。安定雇用・年功的昇進・福利厚生が特徴の分野。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-public-sector-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/freelance-friendly`

| Field | Old | New |
| --- | --- | --- |
| Title | フリーランス向きの職業 TOP30【2026年版】\| 未来の仕事 | Pro \| フリーランス向きの職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 自営・フリーランス比率が高い職業 TOP30。独立しやすい分野を一覧。 | Pro · 自営・フリーランス比率が高い職業 TOP30。独立しやすい分野を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-freelance-friendly-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/self-employed-typical`

| Field | Old | New |
| --- | --- | --- |
| Title | 独立・開業が典型の職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 独立・開業が典型の職業 TOP30【2026年版】\| 未来の仕事 |
| Description | フリーランス + 経営層比率が高い職業 TOP30。独立がキャリアの自然な到達点となる職業を一覧。 | Pro · フリーランス + 経営層比率が高い職業 TOP30。独立がキャリアの自然な到達点となる職業を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-self-employed-typical-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/large-workforce-stable`

| Field | Old | New |
| --- | --- | --- |
| Title | 大規模就業 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 大規模就業 × AI 安全な職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 就業者数 5 万人以上かつ AI 影響度 5 以下の職業 TOP30。日本の労働市場の安定軸を一覧。 | Pro · 就業者数 5 万人以上かつ AI 影響度 5 以下の職業 TOP30。日本の労働市場の安定軸を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-large-workforce-stable-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/regulated-protected`

| Field | Old | New |
| --- | --- | --- |
| Title | 規制で守られた職業 TOP30【2026年版】\| 未来の仕事 | Pro \| 規制で守られた職業 TOP30【2026年版】\| 未来の仕事 |
| Description | 関連資格 2 個以上かつ AI 影響度 5 以下の職業 TOP30。参入のかべと AI への強さを併せ持つ高度専門職を一覧。 | Pro · 関連資格 2 個以上かつ AI 影響度 5 以下の職業 TOP30。参入のかべと AI への強さを併せ持つ高度専門職を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-regulated-protected-{1440,768,375}.png` (also `-full.png`).

## `/pro/rankings/low-stress-stable`

| Field | Old | New |
| --- | --- | --- |
| Title | 低ストレス安定職 TOP30【2026年版】\| 未来の仕事 | Pro \| 低ストレス安定職 TOP30【2026年版】\| 未来の仕事 |
| Description | 月間労働時間 165 時間以下かつ AI 影響度 5 以下の職業 TOP30。長く続けやすい安定職を一覧。 | Pro · 月間労働時間 165 時間以下かつ AI 影響度 5 以下の職業 TOP30。長く続けやすい安定職を一覧。 |

OG title/description retain the Old values above. Screenshot paths: `/tmp/JOB_0233/screenshots/pro-rankings-low-stress-stable-{1440,768,375}.png` (also `-full.png`).

