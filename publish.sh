#!/usr/bin/env bash
# Scan this machine's agent transcripts with T3 Code's usage scanner, then push its file if it changed.
set -euo pipefail
cd "$(dirname "$0")"
T3CODE_DIR="${T3CODE_DIR:-$HOME/au-linux-workspace/t3code}"
export T3CODE_DIR
# Resolve effect and @t3tools/* from the T3 Code checkout.
ln -sfn "$T3CODE_DIR/apps/server/node_modules" node_modules
git pull -q --rebase --autostash
node export-usage.ts "${1:-90}" 2>/dev/null | tail -1
git add site/data/hosts
if git diff --cached --quiet; then echo "no change"; exit 0; fi
git commit -qm "data: usage $(date +%F)"
# Another machine may have pushed its own file meanwhile; the files never overlap.
for _ in 1 2 3; do
  if git pull -q --rebase --autostash && git push -q; then echo "pushed"; exit 0; fi
  sleep 5
done
echo "push failed" >&2; exit 1
