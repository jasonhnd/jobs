#!/bin/bash
# Sequentially sync, CI-check and merge approved PRs into preview.
# One line per PR in /tmp/merge-queue.log. Up to 3 sync attempts per PR if preview moves meanwhile.
# Stops a PR (not the queue) on conflict or red CI.
cd __REDACTED_LOCAL__ || exit 1
LOG=/tmp/merge-queue.log
echo "=== start $(date '+%F %T')" >> "$LOG"
q() { gh pr view "$1" --json "$2" --jq ".$2"; }
merge_one() {
  local p=$1 ms old new head result ms2
  ms=$(q "$p" mergeStateStatus)
  if [ "$ms" = "DIRTY" ]; then echo "#$p CONFLICT dirty" >> "$LOG"; return 0; fi
  if [ "$ms" = "BEHIND" ] || [ "$ms" = "BLOCKED" ]; then
    old=$(q "$p" headRefOid)
    if ! gh pr update-branch "$p" >/dev/null 2>&1; then echo "#$p CONFLICT update-branch failed" >> "$LOG"; return 0; fi
    for j in $(seq 1 18); do sleep 10; new=$(q "$p" headRefOid); [ "$new" != "$old" ] && break; done
    sleep 15
  fi
  head=$(q "$p" headRefOid)
  result=""
  for i in $(seq 1 45); do
    result=$(gh api "repos/__REDACTED_IDENTIFIER__/jobs/commits/$head/check-runs" --jq '[.check_runs[]|select(.name=="quality")][0]|"\(.status) \(.conclusion)"' 2>/dev/null)
    case "$result" in "completed "*) break;; esac
    sleep 20
  done
  if [ "$result" != "completed success" ]; then echo "#$p CI not green: $result" >> "$LOG"; return 0; fi
  ms2=$(q "$p" mergeStateStatus)
  [ "$ms2" = "BEHIND" ] && return 1
  if gh pr merge "$p" --merge --delete-branch --match-head-commit "$head" >/dev/null 2>&1; then
    echo "#$p MERGED head=${head:0:8}" >> "$LOG"
  else
    echo "#$p MERGE-FAILED ms=$ms2" >> "$LOG"
  fi
  return 0
}
for p in "$@"; do
  state=$(q "$p" state)
  if [ "$state" != "OPEN" ]; then echo "#$p skip state=$state" >> "$LOG"; continue; fi
  ok=0
  for attempt in 1 2 3; do merge_one "$p" && { ok=1; break; }; done
  [ $ok = 0 ] && echo "#$p BEHIND after 3 attempts, skipped" >> "$LOG"
done
echo "DONE $(date '+%F %T')" >> "$LOG"
