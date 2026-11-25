# One source for the kopiyka skills and agents

Type: chore

## Why

The repo carries its workflow twice: `.claude/` for Claude Code and `.github/` for Copilot (see `docs/copilot.md`).
PR #167 replaced the parts that were identical with symlinks. What's left are hand-kept forks:

- the 8 `kopiyka-*` `SKILL.md` files, which differ by 2–45 lines each
- the 4 agents (`.claude/agents/*.md` and `.github/agents/*.agent.md`), which differ by 14–26 lines each

Most of the differences are tool wording ("spawn" or "delegate", resuming a subagent, the browser, the deny list) and
paths (`.claude/skills` or `.github/skills`). A few are whole paragraphs: Copilot's "Delegating in Copilot" section,
and Claude's skeptic progress file. The agents' front matter differs completely.

Every rule change has to be made twice, and nothing checks it was. Skills-sync makes the drift worse, because its
`adapt` targets are `.claude/skills/kopiyka-*/**` and `.claude/agents/*.md` only. The `.github` copies have had no
edit since they were added (c9832d6), while the `.claude` side keeps changing.

## What

The `.claude` files stay the one source people and skills-sync edit. The Copilot files are generated from them, and
CI fails when the generated files differ from what's committed.

- **Source format.** A `.claude` skill or agent file can mark text that belongs to one tool only. For example:
  `<!-- copilot -->…<!-- /copilot -->` for text only Copilot gets, and `<!-- claude -->…<!-- /claude -->` for text
  only Claude gets. Claude Code reads the file as it is, so the markers must not change what Claude sees: Copilot-only
  text has to stay invisible to it, or be harmless. The planner picks the exact mechanism and proves it against how
  Claude Code loads skills (front matter, and whether HTML comments reach the model).
- **Substitutions.** Plain substitutions cover what is the same rule worded for another tool, kept in one small list
  in the generator: `.claude/skills/` → `.github/skills/`, "Spawn" → "Delegate to", and so on. Anything a
  substitution can't say cleanly gets a marked block instead.
- **Agents.** Each agent's Copilot front matter (`tools: ['read', 'search', 'execute']`, `skills: [...]`) and its
  "read these SKILL.md files first" line come from the same source file. They can be kept in a marked block, or built
  from the Claude front matter.
- **Generator.** A script (for example `scripts/build-copilot-skills.mjs`, Node, no new dependency) writes
  `.github/skills/kopiyka-*/SKILL.md` and `.github/agents/*.agent.md`. Each generated file starts with a line saying
  it is generated and naming its source. `yarn skills:build` writes them; `yarn skills:check` exits non-zero and names
  the files that differ.
- **CI.** The `check` job in `.github/workflows/ci.yml` runs `yarn skills:check`. Deploy reuses that job, so it runs
  there too.
- **First run.** Moving today's Copilot-only text into the source files must not change what either tool reads. The
  generated `.github` files equal today's, apart from the generated-file header and whitespace, and the `.claude`
  files read the same to Claude.
- **Docs.** `docs/copilot.md` ("Keeping the two copies in step") and `AGENTS.md` say: edit `.claude`, run
  `yarn skills:build`, and never hand-edit `.github/skills/kopiyka-*/SKILL.md` or `.github/agents/`. The conventions
  skill points there too.

## Acceptance criteria

- [ ] `yarn skills:build` on a clean checkout leaves `git status` clean.
- [ ] Adding a line to `.claude/skills/kopiyka-review/SKILL.md` and running `yarn skills:check` exits non-zero and
      names `.github/skills/kopiyka-review/SKILL.md`. After `yarn skills:build`, it passes.
- [ ] Hand-editing `.github/agents/kopiyka-reviewer.agent.md` makes CI's `check` job fail.
- [ ] The generated `.github` files say the same as today's, apart from the header line and whitespace. The PR shows
      that diff.
- [ ] No Copilot-only text shows in what Claude Code loads for a `kopiyka-*` skill or agent. The plan says how this
      was checked, for example `/kopiyka-hos` and the planner agent run once in Claude Code with no Copilot wording.
- [ ] Copilot still lists the `kopiyka-*` skills and the 4 agents (**Chat: Open Customizations**), checked once by the
      user.
- [ ] `docs/copilot.md`, `AGENTS.md` and the conventions skill describe the new way to edit, and no longer say to
      change both copies.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, and Prettier leaves the generated files
      alone (or formats them the same way the generator writes them).

## Out of scope

- Changing what any skill or agent says. This brief only moves where it is written.
- `CLAUDE.md` and `AGENTS.md`: they are short and differ on purpose. Keep them by hand.
- The vendored skills: they are already symlinks (PR #167).
- Making skills-sync aware of `.github`: once `.github` is generated, skills-sync only needs `.claude`.
- Copilot features Claude has no counterpart for, or the other way round, beyond what the files already say.

## Notes

- Today's differences, to size the work: `kopiyka-hos` 45 lines, `kopiyka-hos-refactoring` 18, `kopiyka-conventions`
  14, `kopiyka-develop` 8, `kopiyka-refactoring` 6, `kopiyka-plan` 4, `kopiyka-store-audit` 4, `kopiyka-review` 2.
  Agents: `kopiyka-plan-skeptic` 26, `kopiyka-refactor-reviewer` 18, `kopiyka-reviewer` 15, `kopiyka-planner` 14.
  Run `diff .claude/skills/<name>/SKILL.md .github/skills/<name>/SKILL.md` to see each.
- Some `.claude` text has changed since the copies were made (for example the skeptic's progress file, from
  ce752ec). Where the two sides disagree on a rule rather than on tool wording, the `.claude` side wins. List each
  such case in the plan, so the user can see what Copilot's copy gains.
- Brief 111 edits `kopiyka-hos`. Land this brief first, so 111 edits only the source.
- This is tooling, with no app or API change and no version bump (conventions §8b: no release for docs and tooling
  alone). The planner confirms that against §8b.

## Open questions

- Is `.claude` the right source, or should both trees be generated from a neutral folder (for example
  `skills-src/`)? The brief assumes `.claude`, because skills-sync and Claude Code both already work there.
