# Kopiyka

Shared budget app: Fastify + MySQL API (`apps/api`), an Expo app for iOS + web
(`apps/mobile`, see its `AGENTS.md`) and an MCP connector for Claude (`apps/mcp`, kept apart: it
only calls the API). Setup and commands: `README.md`.

This file is the Copilot twin of `CLAUDE.md`; keep the two in step. How Copilot is set up here:
`docs/copilot.md`.

- Engineering rules (where logic lives, money/date invariants, gates, git, versioning and releases):
  `.github/skills/kopiyka-conventions/SKILL.md`. Read it before writing code.
- New work starts from a brief in `docs/features/` and runs through the `/kopiyka-hos` skill
  (plan → skeptic → your approval → atomic commits → review → your approval → PR).
  Behaviour-preserving cleanups run through `/kopiyka-hos-refactoring` instead
  (rules: `.github/skills/kopiyka-refactoring/SKILL.md`).
- The planner, plan skeptic and reviewers are custom agents in `.github/agents/`; the
  orchestrator skills run them as subagents.
- `.github/skills/kopiyka-*/SKILL.md` and `.github/agents/` are generated: never edit them by hand. Edit
  `.claude/skills/kopiyka-*` or `.claude/agents/`, then run `yarn skills:build` (how: `docs/copilot.md`).
- Where things stand (open PRs of a brief, planned briefs, follow-ups): `docs/features/BACKLOG.md`.
  Read it before suggesting what to do next, and update it when a brief ships or is planned.
- Before every commit: `yarn format:check && yarn lint && yarn typecheck && yarn test`.
- Commits are authored by `dimuch` (`7248180+dimuch@users.noreply.github.com`) with no
  `Co-Authored-By` trailer; never push without the user's explicit OK.
