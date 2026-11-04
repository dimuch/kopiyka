# Kopiyka

Shared budget app: Fastify + MySQL API (`apps/api`), an Expo app for iOS + web
(`apps/mobile`, see its `AGENTS.md`) and an MCP connector for Claude (`apps/mcp`, kept apart: it
only calls the API). Setup and commands: `README.md`.

- Engineering rules (where logic lives, money/date invariants, gates, git):
  `.claude/skills/kopiyka-conventions/SKILL.md`. Read it before writing code.
- New work starts from a brief in `docs/features/` and runs through `/kopiyka-hos`
  (plan → skeptic → your approval → atomic commits → review → your approval → PR).
  Behaviour-preserving cleanups run through `/kopiyka-hos-refactoring` instead
  (rules: `.claude/skills/kopiyka-refactoring/SKILL.md`).
- Before every commit: `yarn format:check && yarn lint && yarn typecheck && yarn test`.
- Commits are authored by `dimuch` with no `Co-Authored-By` trailer; never push without
  the user's explicit OK.
