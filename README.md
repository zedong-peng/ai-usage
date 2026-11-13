# ai-usage

My coding-agent usage (Claude Code, Codex, Grok, OpenCode, …), published at
<https://zedongpeng.com/ai-usage/>.

The numbers come from [T3 Code](https://github.com/pingdotgg/t3code)'s usage reader, the same
one behind its Usage page. It scans local agent transcripts (`~/.claude/projects`,
`~/.codex/sessions`, …), so it can only run on the machine that has them. GitHub only hosts
the result.

- `export-usage.ts` runs T3 Code's `UsageService` and merges the last 90 days into
  `site/data/usage.json`. Older days are kept, since Claude Code prunes old transcripts.
  The published file holds per-day, per-model token counts and costs only: no paths,
  hostnames or session ids.
- `publish.sh` runs the export, then commits and pushes when the data changed.
- `.github/workflows/pages.yml` deploys `site/` to GitHub Pages on push.
- A systemd user timer (`ai-usage.timer`) runs `publish.sh` every few hours.

Costs are API list-price equivalents from LiteLLM rates, not what a subscription bills.

Needs a T3 Code checkout with dependencies installed (`vp i`). Point `T3CODE_DIR` at it if it
is not `~/au-linux-workspace/t3code`.
