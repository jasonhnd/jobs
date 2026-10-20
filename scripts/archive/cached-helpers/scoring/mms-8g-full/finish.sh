#!/bin/bash
# Run after 556/556 jsonl. Cache only. Does not write data/scores/.
set -euo pipefail
ROOT=__REDACTED_LOCAL__
DIR=$ROOT/.cache/scoring/mms-8g-full
DATE=${1:-2026-09-09}
cd "$ROOT"
python3 - <<'PY'
import json
from pathlib import Path
p=Path('.cache/scoring/mms-8g-full/raw-scores.jsonl')
ids=[]
anom=[]
for line in p.read_text().splitlines():
    if not line.strip(): continue
    o=json.loads(line)
    ids.append(o['id'])
    t=o.get('aiois',{}).get('transformation')
    c=o.get('confidence')
    r=o.get('rationale_ja') or ''
    if t==0 or (c is not None and c<0.7) or len(r)<12:
        anom.append(o['id'])
print('n', len(ids), 'unique', len(set(ids)), 'anomalies', anom)
dups=sorted({i for i in ids if ids.count(i)>1})
print('dups', dups)
PY
jq -r .caveat "$ROOT/data/scores/occupations_grok-4.6_2026-09-07.json" \
  | sed 's/grok-4\.6 がセッション内（in-agent）で/gpt-6-astra が Codex CLI 経由で/' \
  > "$DIR/caveat.txt"
bun scripts/assemble-scores.ts \
  --mode aiois --model gpt-6-astra --provider openai --date "$DATE" \
  --prompt-version AIOIS-10-v1.0-gpt-6-astra \
  --prompt-file data/prompts/2026-09-08_gpt-6-astra-aiois10.ja.md \
  --in "$DIR/raw-scores.jsonl" \
  --out "$DIR/occupations_gpt-6-astra_${DATE}.json" \
  --run-id "gpt-6-astra-codex-${DATE}" \
  --caveat "$DIR/caveat.txt" \
  --scoring-method "AIOIS-10 v1.0: Codex CLI single-pass per occupation; model-judged D1–D10, indices per /standard formulas (re-validated); reasoning effort high (explicit)"
bun run check:score-batch "$DIR/occupations_gpt-6-astra_${DATE}.json"
shasum -a 256 "$DIR/occupations_gpt-6-astra_${DATE}.json"
bun scripts/aiois-drift-report.ts \
  --baseline data/scores/occupations_gpt-5.6-sol_2026-07-12.json \
  --candidate "$DIR/occupations_gpt-6-astra_${DATE}.json" \
  --out "$DIR/drift_gpt-5.6-sol_vs_gpt-6-astra_${DATE}.md"
bun scripts/aiois-drift-report.ts \
  --baseline data/scores/occupations_claude-fable-5-1_2026-09-09.json \
  --candidate "$DIR/occupations_gpt-6-astra_${DATE}.json" \
  --out "$DIR/drift_claude-fable-5-1_vs_gpt-6-astra_${DATE}.md"
git status --short
