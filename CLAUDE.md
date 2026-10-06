# Kopiyka

Shared budget app: Fastify + MySQL API (`apps/api`) and an Expo app for iOS + web
(`apps/mobile`, see its `AGENTS.md`). Setup and commands: `README.md`.

- Engineering rules (where logic lives, money/date invariants, gates, git):
  `.claude/skills/kopiyka-conventions/SKILL.md`. Read it before writing code.
- New work starts from a brief in `docs/features/` and runs through `/kopiyka-hos`
  (plan → skeptic → your approval → atomic commits → review → your approval → PR).
- Before every commit: `yarn format:check && yarn lint && yarn typecheck && yarn test`.
- Commits are authored by `dimuch` with no `Co-Authored-By` trailer; never push without
  the user's explicit OK.
