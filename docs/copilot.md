# Working on kopiyka with GitHub Copilot

The repo carries its Claude Code setup in `.claude/` and a Copilot copy in `.github/`. Both run the same flow:
brief → plan → skeptic → your approval → atomic commits → review → your approval → PR.

| What                        | Claude Code                | Copilot                                   |
| --------------------------- | -------------------------- | ----------------------------------------- |
| Always-on rules             | `CLAUDE.md`                | `AGENTS.md` (and `apps/mobile/AGENTS.md`) |
| Skills (`/kopiyka-…`)       | `.claude/skills/`          | `.github/skills/`                         |
| Planner, skeptic, reviewers | `.claude/agents/*.md`      | `.github/agents/*.agent.md`               |
| Where things stand          | `docs/features/BACKLOG.md` | the same file                             |

## First time on a new laptop

1. Clone the repo, then follow `README.md` for Node, Yarn and MySQL.
2. Open the repo in VS Code with GitHub Copilot signed in, or in the GitHub Copilot app. Start a new chat session in
   agent mode (the **Copilot** harness).
3. Check discovery: run **Chat: Open Customizations**. **Skills** should list the `kopiyka-*` skills and the
   vendored ones; **Agents** should list `kopiyka-planner`, `kopiyka-plan-skeptic`, `kopiyka-reviewer` and
   `kopiyka-refactor-reviewer`. If an agent shows twice, the editor is also reading `.claude/agents/`; use the
   `.github` one.
4. Optional: copy personal skills you used with Claude (`~/.claude/skills/…`) to `~/.copilot/skills/`.
5. Check the commit author once: `git config user.email` should be `7248180+dimuch@users.noreply.github.com`.

## Day to day

- Next piece of work: `docs/features/BACKLOG.md`.
- Build a brief: `/kopiyka-hos docs/features/<NNN>-<slug>/brief.md` (add `dry-run` to stop after the plan).
- Resume: `/kopiyka-hos resume <slug>`.
- Cleanup: `/kopiyka-hos-refactoring <path | module>`, or `… scan` for a list of candidates.
- Store check: `/kopiyka-store-audit`.
- One role on its own: pick the agent in the agents picker (for example `kopiyka-reviewer` on a branch).

## What differs from Claude Code

- **Subagents.** The orchestrator skills ask Copilot to run each role as a subagent. Check the tool activity shows a
  subagent run. If Copilot did the work in the main chat instead, ask it to delegate to that agent.
- **No resumed subagents.** A revision or re-review starts a fresh subagent with the previous output passed in.
- **No skeptic progress bar.** The Claude mod that showed the skeptic's checklist live doesn't exist here; the verdict
  arrives at the end.
- **Browser checks.** Start `yarn api dev` and `yarn mobile expo start --web --port 8081` (all commands are in
  `.claude/launch.json`) and use Copilot's browser tools or your own browser at phone width.
- **No deny list.** Claude's `.claude/settings.json` blocks `npx submit-expo-feedback`; Copilot doesn't read that
  rule, so the skills say not to run it.
- **The MCP connector (`apps/mcp`)** is for Claude's apps and works as before. It isn't a Copilot tool.

## Keeping the two copies in step

`.github/skills/kopiyka-*` and `.github/agents/` are adapted copies of the `.claude/` files. Only the parts about
tools differ (delegation, browser, web fetch, paths). When you change a rule, change both copies, or drop the
`.claude/` side once you've moved for good. Vendored skills are byte-identical copies: after `npx skills update`,
copy `.claude/skills/<name>/` over `.github/skills/<name>/`.
