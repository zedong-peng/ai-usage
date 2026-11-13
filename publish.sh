#!/usr/bin/env bash
# Scan local agent transcripts with T3 Code's usage scanner, then push the data if it changed.
set -euo pipefail
cd "$(dirname "$0")"
T3CODE_DIR="${T3CODE_DIR:-$HOME/au-linux-workspace/t3code}"
export T3CODE_DIR
# Resolve effect and @t3tools/* from the T3 Code checkout.
ln -sfn "$T3CODE_DIR/apps/server/node_modules" node_modules
node export-usage.ts "${1:-90}" 2>/dev/null | tail -1
git add site/data/usage.json
if git diff --cached --quiet; then echo "no change"; exit 0; fi
git commit -qm "data: usage $(date +%F)"
git pull -q --rebase && git push -q
echo "pushed"
