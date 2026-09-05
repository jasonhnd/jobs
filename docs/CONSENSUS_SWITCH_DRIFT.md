# Consensus switch drift — latest vote vs published median

Status: mms-6g local report (not a scoring-runbook batch-vs-batch drift).
Date: generated from current `data/scores/` occupation history.
Rule: previous canonical = `pickLatestScore()` (newest AIOIS-10 vote). New canonical = `pickConsensusScore()` (median of comparable votes).

## Headline

| Metric | Latest vote | Consensus | Design |
|---|---:|---:|---|
| Occupations compared | 556 | 556 | 556 |
| Mean Transformation | 5.23 | 4.68 | 5.23 → 4.68 |
| mean \|Δ\| | 0.58 | — | — |
| \|Δ\| ≥ 0.5 | 292 | — | — |
| \|Δ\| ≥ 1.0 | 100 | — | 100 |
| riskBand changes | 133 | — | 133 |

## Top 20 movers by \|latest − consensus\|

| id | 職業 | latest T | consensus T | Δ | band |
|---|---|---:|---:|---:|---|
| 111 | 観光バスガイド | 6.80 | 4.25 | +2.55 | mid→mid |
| 338 | インテリアコーディネーター | 6.50 | 4.50 | +2.00 | mid→mid |
| 339 | カラーコーディネーター | 7.00 | 5.15 | +1.85 | high→mid |
| 576 | 衛生管理者 | 6.50 | 4.65 | +1.85 | mid→mid |
| 332 | 広告デザイナー | 7.30 | 5.50 | +1.80 | high→mid |
| 273 | 電子機器技術者 | 6.30 | 4.55 | +1.75 | mid→mid |
| 427 | 受付事務 | 7.80 | 6.05 | +1.75 | high→mid |
| 29 | 鉄骨工 | 5.80 | 4.10 | +1.70 | mid→mid |
| 110 | ツアーコンダクター | 5.30 | 3.60 | +1.70 | mid→low |
| 572 | 下水道管路施設の点検・調査 | 6.30 | 4.60 | +1.70 | mid→mid |
| 62 | 印刷営業 | 6.50 | 4.85 | +1.65 | mid→mid |
| 474 | マンション管理フロント | 7.00 | 5.35 | +1.65 | high→mid |
| 422 | 葬祭ディレクター | 5.20 | 3.60 | +1.60 | mid→low |
| 423 | きもの着付指導員 | 4.50 | 2.90 | +1.60 | mid→low |
| 341 | パタンナー | 7.30 | 5.70 | +1.60 | high→mid |
| 106 | ソムリエ | 4.80 | 3.25 | +1.55 | mid→low |
| 114 | 通訳ガイド | 6.70 | 5.15 | +1.55 | mid→mid |
| 127 | ピアノ調律師 | 4.50 | 2.95 | +1.55 | mid→low |
| 274 | 電気通信技術者 | 6.50 | 4.95 | +1.55 | mid→mid |
| 539 | 営業課長 | 6.00 | 4.45 | +1.55 | mid→mid |

Δ is latest − consensus (positive = newest model scores higher than the published median).
