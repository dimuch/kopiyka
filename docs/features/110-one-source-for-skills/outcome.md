# Outcome: One source for the kopiyka skills and agents

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#187](https://github.com/dimuch/kopiyka/pull/187) One source for the kopiyka skills and agents — v1.26.2

## Decided

- `.claude` is the only source. `scripts/build-copilot-skills.mjs` (`yarn skills:build`) writes Copilot's
  `.github/skills/kopiyka-*/SKILL.md` and `.github/agents/*.agent.md`, formatted with the repo's Prettier.
- `yarn skills:check` runs in CI's `check` job and fails, naming the files, when the copies differ.
- Claude-only text sits in `<!-- claude -->` blocks; Copilot-only text sits in labelled front-matter comments.
- The generated-by line is the first YAML comment inside the front matter, since line 1 must be `---`.
- The script came to 261 lines, not about 150, mostly from Prettier's line breaks and the review's error-path fixes.

## Left out

- Generating `CLAUDE.md`, `AGENTS.md` or the vendored skills (already links).
- Unit tests for the script, a pre-commit hook, and `skills:check` in the local gates.
- Changing skills-sync's config.

## Follow-ups

- skills-sync's commits to `.claude/skills/kopiyka-*` or `.claude/agents` also need `yarn skills:build` — in
  BACKLOG.md
- The brief's "no edits since c9832d6" was wrong — dropped: a note only, with no drift left.

Full plan: `git show 62ca655b:docs/features/110-one-source-for-skills/plan.md`
