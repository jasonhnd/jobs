#!/bin/bash
# Launch local Claude Fable 5.1 for one 5-id pilot chunk. Orchestrator only.
# Compatible with macOS /bin/bash 3.2 (no mapfile).
set -euo pipefail
ROOT="__REDACTED_LOCAL__"
RUN="$ROOT/.cache/scoring/mms-8f-pilot"
CHUNK="${1:?chunk nn, e.g. 01}"
cd "$ROOT"

IDS_STR=$(python3 -c "
import json, sys
chunk = int(sys.argv[1])
ids = json.load(open('.cache/scoring/mms-8f-pilot/sample.json'))['ids']
start = (chunk - 1) * 5
picked = ids[start:start+5]
if not picked:
    raise SystemExit('no ids')
print(' '.join(str(i) for i in picked))
" "$CHUNK")
# shellcheck disable=SC2206
IDS=($IDS_STR)

PROMPT_LIST=""
for id in "${IDS[@]}"; do
  p=$(printf "%04d" "$id")
  PROMPT_LIST="${PROMPT_LIST}- \`.cache/scoring/mms-8f-pilot/prompts/${p}.txt\`
"
done
OUT=".cache/scoring/mms-8f-pilot/answers/chunk-${CHUNK}.jsonl"
mkdir -p "$RUN/logs" "$RUN/answers"

PROMPT="Read \`.cache/scoring/mms-8f-pilot/SCORING_INSTRUCTIONS.md\` and follow it exactly.

You ARE claude-fable-5-1. If you are any other model, write nothing and reply with exactly:
STOP: not claude-fable-5-1

Score only these occupation ids: ${IDS_STR}
Read only these files:
${PROMPT_LIST}
Write the JSONL (one object per line, no markdown fences) to:
\`${OUT}\`

Do not use structured-output / forced tool-schema features. Write the file as plain text JSONL.
Do not read data/scores, sample.json, other answer chunks, or baseline scores.
Do not spawn sub-agents. Do not edit src/, docs/, or data/.
After writing, print one line: path, n, ids, problems."

CLAUDE_BIN="${CLAUDE_BIN:-__REDACTED_LOCAL__}"
PROMPT_FILE="$RUN/logs/chunk-${CHUNK}.prompt.txt"
printf '%s\n' "$PROMPT" > "$PROMPT_FILE"
echo "[run-chunk] chunk=$CHUNK ids=${IDS_STR} out=$OUT model=claude-fable-5-1 effort=high bin=$CLAUDE_BIN pid=$$"
echo "$$" > "$RUN/logs/chunk-${CHUNK}.pid"
exec "$CLAUDE_BIN" -p \
  --model claude-fable-5-1 \
  --effort high \
  --permission-mode bypassPermissions \
  --output-format json \
  --disallowedTools "Agent,Task,WebSearch,WebFetch,NotebookEdit" \
  < "$PROMPT_FILE"
