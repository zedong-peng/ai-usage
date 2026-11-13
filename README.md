# ai-usage

My coding-agent usage (Claude Code, Codex, Grok, OpenCode, …), published at
<https://zedongpeng.com/ai-usage/>.

The numbers come from [T3 Code](https://github.com/pingdotgg/t3code)'s usage reader, the same
one behind its Usage page. It scans local agent transcripts (`~/.claude/projects`,
`~/.codex/sessions`, …), so it runs on each machine that has them, and the page shows their sum.
GitHub only hosts the result.

- `export-usage.ts` runs T3 Code's `UsageService` and merges the last 90 days into this
  machine's file, `site/data/hosts/<key>.json`. Older days are kept, since Claude Code prunes
  old transcripts. The file holds per-day, per-model token counts and costs only: no paths,
  hostnames or session ids, and `<key>` is a hash of the scanner's random host id.
- `merge-usage.mjs` adds the machines' files into `site/data/usage.json`, which the page reads.
  It is built, not committed, so two machines never touch the same file.
- `publish.sh` runs the export, then commits and pushes this machine's file when it changed.
- `.github/workflows/pages.yml` runs the merge and deploys `site/` to GitHub Pages on push.
- A timer on each machine (systemd `ai-usage.timer` on Linux, a launchd agent on macOS) runs
  `publish.sh` every few hours. To add a machine, clone this repo there and install the timer.

Costs are API list-price equivalents from LiteLLM rates, not what a subscription bills.

Needs a T3 Code checkout with dependencies installed (`vp i`). Point `T3CODE_DIR` at it if it
is not `~/au-linux-workspace/t3code`.
