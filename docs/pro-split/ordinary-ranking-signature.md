# Ordinary ranking owner-signature package

**Unsigned sample, JOB_0231 / Issue #901. Do not merge before owner signature.**

Source candidates: roadmap section 10.6 and first-screen-copy-draft section 2. The draft is corrected to actual salary-safe displayed-score <=5 filtering and high-demand tier / salary / ID ordering (Issue correction comment). No scores, sort rules, RANKING_META, Pro text or global navigation are changed.

All nine routes retain HTTP 200. These exact strings apply to ordinary page H1/breadcrumb, title, description, OG/Twitter text and card occurrences as listed. Pro uses the previous copy. The complete Pro index becomes self-canonical under PS-02; eight equivalent detail tables keep their previous canonical policy.

## Reused and added labels

| Occurrence | Old | New candidate |
| --- | --- | --- |
| Search CTA on each first screen | `自分の現在地を確認 → (below the full analysis)` | `自分の仕事を探す` |
| Score reading on each detail | `— (new)` | `点数は0〜10。7以上は「変化 大きい」、4未満は「変化 小さい」です。` |
| Index score reading | `— (new)` | `点数は、AIで仕事の中身が変わる度合い（0〜10）です。仕事がなくなる順位ではありません。` |
| Hourly conversion note on first screen | `求人賃金 ÷ 160h 推計 (folded chapter)` | `時給は、求人の月額賃金を160時間で割った換算値です。実測の時給ではありません。` |
| Complete Pro index exit | `— (new)` | `全39ランキングは Pro で` |
| Matching Pro detail exit | `Pro で詳しく見る` | `Pro で詳しく見る` |
| Row metric labels | `Mixed salary / workers / extras` | `AI変化度 / 就業者数 / 求人需要 / 年収 / 月間労働時間 / 換算時給` |

Signed bands remain `変化 小さい` / `変化 中くらい` / `変化 大きい`, selected by the displayed score (<4.0 / 4.0–6.9 / >=7.0). Scores and bands use the shared formatter. These signed strings are unchanged.

Metric placeholder rules: workers = grouped integer + `人`; salary = truncated annual salary + `万円`; monthly hours = truncated value + `時間`; converted hourly wage = graph-owned value, grouped with existing precision + `円/時`; demand = existing `高需要` / `通常` / `低需要`; null/nonfinite = `—`. First-place summary uses that same metric; AI rankings retain the shared score/band and TOP-N mean. Date is the content month.

## /rankings

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `職業ランキング｜AI影響度・年収・就業者数・初任給・労働時間で比較 \| 未来の仕事` | `職業ランキング` |
| Meta description | `日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに代替されやすい仕事、年収が高くAIに代替されにくい仕事などを日本の職業データで一覧。` | `仕事の変化・働く人の数・収入など、8つのランキングで仕事を比べられます。` |
| OG / Twitter title | `職業ランキング｜AI影響度・年収・就業者数・初任給・労働時間で比較 \| 未来の仕事` | `職業ランキング` |
| OG / Twitter description | `日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに代替されやすい仕事、年収が高くAIに代替されにくい仕事などを日本の職業データで一覧。` | `仕事の変化・働く人の数・収入など、8つのランキングで仕事を比べられます。` |
| H1 / breadcrumb / index-card title | `職業ランキング` | `職業ランキング` |
| First-screen lead / index-card description | `日本の職業データを様々な視点でランキング。AIに代替されやすい仕事ランキング、年収が高くAIに代替されにくい仕事、なくならない仕事の候補を一覧できます。` | `仕事の変化・働く人の数・収入など、8つのランキングで仕事を比べられます。` |
| Index subheading | `556 職業 を AI 影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点で比較` | `点数は、AIで仕事の中身が変わる度合い（0〜10）です。仕事がなくなる順位ではありません。` |
| OG image eyebrow | `RANKINGS · 39 視点` | `RANKINGS · 8 視点` |
| OG image title | `AI × 仕事 ランキング` | `職業ランキング` |
| OG image subtitle | `39 視点で見る "変わる仕事" / "変わらない仕事"` | `仕事の変化・働く人の数・収入など、8つのランキングで仕事を比べられます。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/index-1440-rejected.png`, `/tmp/JOB_0231/screenshots/index-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/index-768-rejected.png`, `/tmp/JOB_0231/screenshots/index-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/index-375-rejected.png`, `/tmp/JOB_0231/screenshots/index-375-first-visit.png`

## /rankings/ai-risk-high

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `AIに奪われる仕事ランキング TOP30【2026年版】\| 未来の仕事` | `AIで大きく変わる仕事 TOP30【2026年版】\| 未来の仕事` |
| Meta description | `AI影響度が最も高い職業TOP30。平均スコア7.6/10 変化 大きい。AI代替リスク・年収・就業者数を一覧比較。複数のAIモデルによる採点の総合値（独自分析・非公式）。` | `仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。` |
| OG / Twitter title | `AIに奪われる仕事ランキング TOP30【2026年版】\| 未来の仕事` | `AIで大きく変わる仕事 TOP30` |
| OG / Twitter description | `AI影響度が最も高い職業TOP30。平均スコア7.6/10 変化 大きい。AI代替リスク・年収・就業者数を一覧比較。複数のAIモデルによる採点の総合値（独自分析・非公式）。` | `仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。` |
| H1 / breadcrumb / index-card title | `AIに奪われる仕事 TOP30` | `AIで大きく変わる仕事 TOP30` |
| First-screen lead / index-card description | `厚労省の職業データに基づき、複数のAIが AIOIS-10 で AI 影響を分析し、公開値はそれらの総合値です。0〜10 のスコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。` | `仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。` |
| First-place subtitle | `1位はデータ入力（9.2/10 変化 大きい） · TOP30平均 7.6/10 変化 大きい · 2026年10月更新` | `1位はデータ入力（9.2/10 変化 大きい） · TOP30平均 7.6/10 変化 大きい · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `AIに奪われる仕事 TOP30` | `AIで大きく変わる仕事 TOP30` |
| OG image subtitle | `AI影響度が高い職業ランキング` | `仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/ai-risk-high-1440-rejected.png`, `/tmp/JOB_0231/screenshots/ai-risk-high-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/ai-risk-high-768-rejected.png`, `/tmp/JOB_0231/screenshots/ai-risk-high-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/ai-risk-high-375-rejected.png`, `/tmp/JOB_0231/screenshots/ai-risk-high-375-first-visit.png`

## /rankings/workers

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `就業者数が多い職業ランキング TOP30【2026年版】\| 未来の仕事` | `就業者数が多い職業ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `日本で最も就業者が多い職業TOP30。合計15,907,206人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。` | `就業者数が多い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| OG / Twitter title | `就業者数が多い職業ランキング TOP30【2026年版】\| 未来の仕事` | `就業者数ランキング TOP30` |
| OG / Twitter description | `日本で最も就業者が多い職業TOP30。合計15,907,206人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。` | `就業者数が多い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| H1 / breadcrumb / index-card title | `就業者数ランキング TOP30` | `就業者数ランキング TOP30` |
| First-screen lead / index-card description | `厚労省の職業情報データベース（job tag）に基づく就業者数ランキング。最も多くの人が従事している職業をAI影響度・年収データと共に一覧できます。` | `就業者数が多い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| First-place subtitle | `1位は一般事務（8.1/10 変化 大きい） · TOP30平均 5.0/10 変化 中くらい · 2026年10月更新` | `1位は一般事務（2,639,330人） · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `就業者数ランキング TOP30` | `就業者数ランキング TOP30` |
| OG image subtitle | `日本で最も就業者が多い職業` | `就業者数が多い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/workers-1440-rejected.png`, `/tmp/JOB_0231/screenshots/workers-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/workers-768-rejected.png`, `/tmp/JOB_0231/screenshots/workers-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/workers-375-rejected.png`, `/tmp/JOB_0231/screenshots/workers-375-first-visit.png`

## /rankings/ai-risk-low

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `AI影響が少ない仕事ランキング TOP30【2026年版】\| 未来の仕事` | `AI影響が少ない仕事ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `AIに代替されにくい職業TOP30。平均スコア2.8/10 変化 小さい。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。` | `AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。` |
| OG / Twitter title | `AI影響が少ない仕事ランキング TOP30【2026年版】\| 未来の仕事` | `AI影響が少ない仕事 TOP30` |
| OG / Twitter description | `AIに代替されにくい職業TOP30。平均スコア2.8/10 変化 小さい。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。` | `AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。` |
| H1 / breadcrumb / index-card title | `AI影響が少ない仕事 TOP30` | `AI影響が少ない仕事 TOP30` |
| First-screen lead / index-card description | `身体性・対人関係・創造性が求められる職業はAIによる代替が難しく、スコアが低くなる傾向があります。「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。` | `AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。` |
| First-place subtitle | `1位は潜水士（2.2/10 変化 小さい） · TOP30平均 2.8/10 変化 小さい · 2026年10月更新` | `1位は潜水士（2.2/10 変化 小さい） · TOP30平均 2.8/10 変化 小さい · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `AI影響が少ない仕事 TOP30` | `AI影響が少ない仕事 TOP30` |
| OG image subtitle | `AIリスクが低く将来性のある職業` | `AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/ai-risk-low-1440-rejected.png`, `/tmp/JOB_0231/screenshots/ai-risk-low-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/ai-risk-low-768-rejected.png`, `/tmp/JOB_0231/screenshots/ai-risk-low-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/ai-risk-low-375-rejected.png`, `/tmp/JOB_0231/screenshots/ai-risk-low-375-first-visit.png`

## /rankings/high-demand

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `人手不足の職業ランキング TOP30【2026年版】\| 未来の仕事` | `人手不足の職業ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `求人需要が最も高い職業TOP30。全556職業のうち「需要高」は270件・「安定」は105件。転職・就活の参考に。` | `求人需要の区分が高い順です。同じ区分では、年収が高い順に並べています。右の点数はAIで変わる度合い（0〜10）で、順位とは別です。` |
| OG / Twitter title | `人手不足の職業ランキング TOP30【2026年版】\| 未来の仕事` | `人手不足の職業 TOP30` |
| OG / Twitter description | `求人需要が最も高い職業TOP30。全556職業のうち「需要高」は270件・「安定」は105件。転職・就活の参考に。` | `求人需要の区分が高い順です。同じ区分では、年収が高い順に並べています。右の点数はAIで変わる度合い（0〜10）で、順位とは別です。` |
| H1 / breadcrumb / index-card title | `人手不足の職業 TOP30` | `人手不足の職業 TOP30` |
| First-screen lead / index-card description | `人手不足が深刻な職業を求人需要の高い順にランキング。採用されやすく待遇改善も期待できる職業を年収・AI影響度と共に確認できます。` | `求人需要の区分が高い順です。同じ区分では、年収が高い順に並べています。右の点数はAIで変わる度合い（0〜10）で、順位とは別です。` |
| First-place subtitle | `1位は歯科医師（3.5/10 変化 小さい） · TOP30平均 4.7/10 変化 中くらい · 2026年10月更新` | `1位は歯科医師（高需要） · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `人手不足の職業 TOP30` | `人手不足の職業 TOP30` |
| OG image subtitle | `求人需要が高い職業` | `求人需要の区分が高い順です。同じ区分では、年収が高い順に並べています。右の点数はAIで変わる度合い（0〜10）で、順位とは別です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/high-demand-1440-rejected.png`, `/tmp/JOB_0231/screenshots/high-demand-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/high-demand-768-rejected.png`, `/tmp/JOB_0231/screenshots/high-demand-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/high-demand-375-rejected.png`, `/tmp/JOB_0231/screenshots/high-demand-375-first-visit.png`

## /rankings/salary-safe

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `高年収×低AIリスクの職業ランキング TOP30【2026年版】\| 未来の仕事` | `高年収×低AIリスクの職業ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `年収が高くAI代替リスクが低い職業TOP30。平均年収976万円・平均AI影響4.2/10 変化 中くらい。将来性と収入を両立できる仕事を一覧。` | `AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。` |
| OG / Twitter title | `高年収×低AIリスクの職業ランキング TOP30【2026年版】\| 未来の仕事` | `高年収×低AIリスク TOP30` |
| OG / Twitter description | `年収が高くAI代替リスクが低い職業TOP30。平均年収976万円・平均AI影響4.2/10 変化 中くらい。将来性と収入を両立できる仕事を一覧。` | `AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。` |
| H1 / breadcrumb / index-card title | `高年収×低AIリスク TOP30` | `高年収×低AIリスク TOP30` |
| First-screen lead / index-card description | `高い年収を得ながらAIに代替されにくい——そんな職業を探している方へ。AI影響度5以下（10段階）かつ年収が高い順にランキングしました。` | `AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。` |
| First-place subtitle | `1位はパイロット（4.3/10 変化 中くらい） · TOP30平均 4.2/10 変化 中くらい · 2026年10月更新` | `1位はパイロット（1697万円） · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `高年収×低AIリスク TOP30` | `高年収×低AIリスク TOP30` |
| OG image subtitle | `年収が高くAI代替リスクが低い職業` | `AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/salary-safe-1440-rejected.png`, `/tmp/JOB_0231/screenshots/salary-safe-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/salary-safe-768-rejected.png`, `/tmp/JOB_0231/screenshots/salary-safe-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/salary-safe-375-rejected.png`, `/tmp/JOB_0231/screenshots/salary-safe-375-first-visit.png`

## /rankings/short-hours

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `労働時間が短い職業ランキング TOP30【2026年版】\| 未来の仕事` | `労働時間が短い職業ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `月間労働時間が最も短い職業TOP30。平均151時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。` | `労働時間が短い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| OG / Twitter title | `労働時間が短い職業ランキング TOP30【2026年版】\| 未来の仕事` | `労働時間が短い職業 TOP30` |
| OG / Twitter description | `月間労働時間が最も短い職業TOP30。平均151時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。` | `労働時間が短い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| H1 / breadcrumb / index-card title | `労働時間が短い職業 TOP30` | `労働時間が短い職業 TOP30` |
| First-screen lead / index-card description | `ワークライフバランスを重視する方向けに、月間労働時間が短い職業をランキング。年収やAI影響度も合わせて確認できます。` | `労働時間が短い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| First-place subtitle | `1位は保険営業（生命保険、損害保険）（5.7/10 変化 中くらい） · TOP30平均 5.4/10 変化 中くらい · 2026年10月更新` | `1位は保険営業（生命保険、損害保険）（141時間） · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `労働時間が短い職業 TOP30` | `労働時間が短い職業 TOP30` |
| OG image subtitle | `ワークライフバランスに優れた職業` | `労働時間が短い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/short-hours-1440-rejected.png`, `/tmp/JOB_0231/screenshots/short-hours-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/short-hours-768-rejected.png`, `/tmp/JOB_0231/screenshots/short-hours-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/short-hours-375-rejected.png`, `/tmp/JOB_0231/screenshots/short-hours-375-first-visit.png`

## /rankings/hourly-wage

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `時給が高い職業ランキング TOP30【2026年版】\| 未来の仕事` | `時給が高い職業ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `時給ベースで報酬が高い職業 TOP30。平均時給 ¥3,441。AI 影響度・年収と共に一覧。` | `換算時給が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。時給は、求人の月額賃金を160時間で割った換算値です。実測の時給ではありません。` |
| OG / Twitter title | `時給が高い職業ランキング TOP30【2026年版】\| 未来の仕事` | `時給が高い職業 TOP30` |
| OG / Twitter description | `時給ベースで報酬が高い職業 TOP30。平均時給 ¥3,441。AI 影響度・年収と共に一覧。` | `換算時給が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。時給は、求人の月額賃金を160時間で割った換算値です。実測の時給ではありません。` |
| H1 / breadcrumb / index-card title | `時給が高い職業 TOP30` | `時給が高い職業 TOP30` |
| First-screen lead / index-card description | `時給ベースで報酬が高い職業をランキング。求人賃金 (月) を 160 時間で割った推計値で、フルタイム前提の参考値です。AI 影響度・年収も合わせて確認できます。` | `換算時給が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| First-place subtitle | `1位は外科医（2.8/10 変化 小さい） · TOP30平均 4.9/10 変化 中くらい · 2026年10月更新` | `1位は外科医（6,850円/時） · 2026年10月更新` |
| OG image eyebrow | `RANKING · 時給` | `RANKING · 時給` |
| OG image title | `時給が高い職業 TOP30` | `時給が高い職業 TOP30` |
| OG image subtitle | `時給ベースで報酬が高い職業` | `換算時給が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/hourly-wage-1440-rejected.png`, `/tmp/JOB_0231/screenshots/hourly-wage-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/hourly-wage-768-rejected.png`, `/tmp/JOB_0231/screenshots/hourly-wage-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/hourly-wage-375-rejected.png`, `/tmp/JOB_0231/screenshots/hourly-wage-375-first-visit.png`

## /rankings/salary

| Occurrence | Old | New candidate |
| --- | --- | --- |
| HTML title | `年収が高い職業ランキング TOP30【2026年版】\| 未来の仕事` | `年収が高い職業ランキング TOP30【2026年版】\| 未来の仕事` |
| Meta description | `日本で最も年収が高い職業TOP30。平均年収1044万円。AI影響度・就業者数も合わせて比較。` | `年収が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| OG / Twitter title | `年収が高い職業ランキング TOP30【2026年版】\| 未来の仕事` | `年収ランキング TOP30` |
| OG / Twitter description | `日本で最も年収が高い職業TOP30。平均年収1044万円。AI影響度・就業者数も合わせて比較。` | `年収が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| H1 / breadcrumb / index-card title | `年収ランキング TOP30` | `年収ランキング TOP30` |
| First-screen lead / index-card description | `厚労省の職業情報データベースに基づく年収ランキング。年収が高い職業をAI影響度・就業者数と共に一覧できます。` | `年収が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |
| First-place subtitle | `1位はパイロット（4.3/10 変化 中くらい） · TOP30平均 4.9/10 変化 中くらい · 2026年10月更新` | `1位はパイロット（1697万円） · 2026年10月更新` |
| OG image eyebrow | `RANKING · TOP 30` | `RANKING · TOP 30` |
| OG image title | `年収ランキング TOP30` | `年収ランキング TOP30` |
| OG image subtitle | `年収が最も高い職業` | `年収が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。` |

Local Microsoft Edge first-screen screenshots (PNG, 900px height):

- 1440px: `/tmp/JOB_0231/screenshots/salary-1440-rejected.png`, `/tmp/JOB_0231/screenshots/salary-1440-first-visit.png`
- 768px: `/tmp/JOB_0231/screenshots/salary-768-rejected.png`, `/tmp/JOB_0231/screenshots/salary-768-first-visit.png`
- 375px: `/tmp/JOB_0231/screenshots/salary-375-rejected.png`, `/tmp/JOB_0231/screenshots/salary-375-first-visit.png`

## Removed ordinary analysis

The full intro, AI-fact summary, stats, highlights, sector chart, FAQ, cross-hub links, escape suggestions, movers and insight cards are omitted from ordinary HTML and matching structured data. They remain in Pro. No hidden full-analysis DOM or stale FAQPage is retained.

## Approval and verification boundary

Owner signature: **pending**. Independent review: **pending**. Local acceptance and three-width evidence are reported in the PR. Screenshot files expire with card temporary cleanup; this exact text package remains in git. Deployment rendering, advertisements, GSC experiment results, and production promotion are not verified by this sample.
