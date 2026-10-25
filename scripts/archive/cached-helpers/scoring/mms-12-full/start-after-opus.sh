#!/bin/zsh
# mms-12.4 trigger: wait for the mms-11.5 run_date on #610, then start the GPT-6 SOL 556 (owner decision on #614).
set -u
cd __REDACTED_LOCAL__
P=data/prompts/2026-09-23_gpt-6-sol-aiois10.ja.md
R=.cache/scoring/mms-12-full
log() { echo "[$(TZ=Asia/Tokyo date '+%F %H:%M:%S')] $*" >> $R/trigger.log; }
log "waiting for the mms-11.5 run_date on #610"
RA=""
while true; do
  RA=$(gh issue view 610 --comments --json comments --jq '.comments[].body' 2>/dev/null | grep -m1 '^run_date: ' | sed 's/^run_date: //; s/[`[:space:]]//g')
  [ -n "$RA" ] && break
  if gh issue view 605 --comments --json comments --jq '.comments[].body' 2>/dev/null | grep -qF 'mms-11 halted by the owner'; then RA=halted; break; fi
  sleep 60
done
TODAY=$(TZ=Asia/Tokyo date +%F)
log "RA=$RA today=$TODAY"
if [ "$RA" != "halted" ] && [[ "$RA" > "$TODAY" ]]; then log "ABORT: RA is later than today"; exit 1; fi
test -f "$P" || { log "ABORT: prompt missing"; exit 1; }
echo "$RA" > $R/opus_run_date.txt
NO_COLOR=1 nohup python3 -c 'import os,sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' \
  bun scripts/run-scoring.ts --provider codex --model gpt-6-sol --reasoning-effort high \
  --prompt-file "$P" --run-name mms-12-full --out $R/raw-scores.jsonl --concurrency 4 \
  > $R/runner.log 2>&1 < /dev/null &
echo $! > $R/runner.pid; date +%s > $R/runner.start; TZ=Asia/Tokyo date '+started JST %F %H:%M:%S' > $R/runner.started.txt
log "runner started pid=$(cat $R/runner.pid)"
