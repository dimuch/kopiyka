# Feature briefs

Kopiyka has no issue tracker: each piece of work starts as a brief in this folder.

```
docs/features/
  _template.md            # copy this to start
  _outcome-template.md    # the shape of outcome.md
  001-<slug>/
    brief.md              # you write it: why, what, acceptance criteria, out of scope
    plan.md               # kopiyka-planner writes it; the skeptic and you approve it
    outcome.md            # replaces plan.md once the brief's last PR merges
```

## Flow

Run `/kopiyka-hos docs/features/<NNN>-<slug>/brief.md` in Claude Code from the repo root.
A path to any other `.md`/`.txt` file also works; it is copied here first. A one-line
description works too, and Claude drafts the brief for you to confirm.

1. **Plan**: `kopiyka-planner` reads the brief and the code it touches, then writes `plan.md`.
   The plan covers the approach, contracts, and slices, where each slice is one atomic, tested
   commit. It also maps each acceptance criterion to evidence and lists what is not being done.
2. **Skeptic**: `kopiyka-plan-skeptic` checks the plan in a fresh context. It verifies the plan
   against the code and hunts for over-engineering and gaps. It returns APPROVE or REVISE, with
   up to 2 revision rounds.
3. **You approve the plan** (Gate A). The brief and plan become the branch's first commit.
4. **Build**: one slice at a time. For each slice: test, implement, then run format, lint,
   typecheck and test. UI slices are also checked in the browser. Each slice is one commit.
5. **Review**: `kopiyka-reviewer` reviews `origin/main...HEAD` against the brief, the plan and
   the conventions. Findings are fixed as new commits and re-reviewed, for up to 3 rounds.
6. **You approve the push** (Gate B). Then Claude pushes and opens the PR.
7. **After merge**: once the brief's last PR merges, a short `outcome.md` (from
   `_outcome-template.md`) replaces `plan.md`, `BACKLOG.md` moves the brief to "Recently
   finished", and the worktree is cleaned up. It lands as its own small `chore/outcome-<slug>`
   PR. The full plan stays in git history, named on the outcome's last line.

In GitHub Copilot the same `/kopiyka-hos` skill runs from `.github/skills/`, with the agents in
`.github/agents/`; see `docs/copilot.md`. What's next and what's in flight: `BACKLOG.md`.

Flags: `dry-run` (plan only), `auto` (no pauses between slices; the two gates still apply).
Resume a run with `/kopiyka-hos resume <slug>`.

Each role is also usable on its own: the `kopiyka-plan`, `kopiyka-develop`, and
`kopiyka-review` skills, or the agents in `.claude/agents/`. The rules they share live in
`.claude/skills/kopiyka-conventions/SKILL.md`.

## Writing a good brief

- Acceptance criteria are the contract. If you can't say how you'd check one, rewrite it.
- "Out of scope" is how you keep the plan small. List the tempting extras.
- One brief, one PR, plus its after-merge outcome PR. If it needs more than ~400 changed lines, split it into briefs that
  can each ship on their own.
