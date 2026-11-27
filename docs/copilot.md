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

`.claude/` is the one source. The `SKILL.md` of each `.github/skills/kopiyka-*` skill, and every
`.github/agents/*.agent.md`, are generated from it by `scripts/build-copilot-skills.mjs`:

- Edit `.claude/skills/kopiyka-*/SKILL.md` or `.claude/agents/*.md`, then run `yarn skills:build` and commit both
  sides. Every `.github/agents/*.agent.md` comes from `.claude/agents/`: the build deletes any other, so a Copilot-only
  agent isn't possible. Never edit the generated files by hand: each says so on its second line, and CI's
  `yarn skills:check` fails when one differs from what the build writes.
- Wording that is the same rule for both tools (paths, "Spawn" → "Delegate to", Bash → the terminal) is a
  substitution list in the script. An agent's Copilot front matter and its "read these SKILL.md files first" line are
  built from its Claude front matter.
- Text that only one tool gets is marked in the source:
  - `<!-- claude -->…<!-- /claude -->` in the body: only Claude gets it. It can sit inside a line. For whole lines,
    put the opening marker at the end of the line before (`…opinion.<!-- claude -->`), so dropping the block leaves no
    blank line, which would break a list in Copilot's copy.
  - `<!-- copilot: <id> -->` in the body: Copilot gets the text named `<id>` there. The text itself sits in the front
    matter as YAML comment lines, `# copilot text <id>:` followed by `# | <line>` (`# |` alone is an empty line).
    Claude Code shows HTML comments in a skill body to the model, but never the front matter, so this keeps
    Copilot's text out of what Claude reads.
  - `# copilot: <key>: <value>` in the front matter: a key only Copilot gets.
- When you change text inside a `claude` block, update its `copilot` text too. No check can tell that the two still
  say the same thing.

Everything that is the same for both tools is a symlink into `.claude/skills/`, so it has one copy: the vendored skill
folders (`.github/skills/<name>` → `.claude/skills/<name>`) and the kopiyka skills' scripts and references. After
`npx skills update`, nothing needs copying. A new vendored skill gets its link with
`ln -s ../../.claude/skills/<name> .github/skills/<name>`.
