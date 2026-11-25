# Replace shipped plans with short outcomes

Type: chore

## Why

`docs/features/` holds 108 briefs and 103 plans: about 31,000 lines of plans, the largest 430–550 lines each. A plan
is the working document while its brief is being built. It names every slice, file and check, and agents and
reviewers read it closely. Once the brief ships, almost none of that is needed again: the code and git history hold
the detail.

The leftovers cost:

- **Searches are noisy.** On 2026-11-25, a repo search for "byte-identical" found 11 hits, and 9 were in old plans.
- **Agents read more than they need.** The planner and reviewers read old plans to learn what was decided before.
  Each plan is a long read, and most of it is history.
- **Stale ticks look like open work.** `BACKLOG.md` lists plans with unticked boxes (052, 058, 059, 068, 071) that
  are "probably stale ticks rather than missing work".

Moving the docs out of the repo was considered and rejected: the flow reads briefs, plans and `BACKLOG.md` from the
repo, in both Claude Code and Copilot.

## What

Once a brief's last PR is merged, its `plan.md` is replaced by a short `outcome.md`. The brief stays, and the full
plan stays in git history.

- **`outcome.md`** is about 20 lines, from a new template `docs/features/_outcome-template.md`:
  - the PRs, with links, and the version each one shipped in
  - what was decided, including Gate A decisions and anything the build changed from the plan
  - what was deliberately left out, and why
  - follow-ups, each also listed in `BACKLOG.md`, or marked done or dropped
  - one line saying where the full plan is: `git show <sha>:docs/features/<dir>/plan.md`, with the last commit that
    had it
- **A step in the flow.** `/kopiyka-hos` gets an after-merge step, run when the user says the PR merged, or on
  "next step" when the PR turns out to be merged:
  - confirm the merge
  - write `outcome.md` and delete `plan.md`
  - update `BACKLOG.md` (move the brief to "Recently finished", and add its follow-ups)
  - clean up the worktree and branch

  It lands as one small docs commit on a `chore/` branch, through a PR as usual, or folded into the next brief's
  branch if the user prefers. The plan picks one and says so. `/kopiyka-hos-refactoring` gets the same step. A brief
  split into parts (such as 104–104f) writes one outcome per part when that part merges.

- **One pass over the briefs that already shipped.** Every brief whose work is merged gets an `outcome.md`, and loses
  its `plan.md`:
  - The PR links come from git history and `gh`.
  - The decisions come from the plan's Gate A notes, "Decisions" and "Follow-ups" sections.
  - Where a plan holds something still in use, that part moves to a lasting home first. For example, 104's snapshot
    script, which `BACKLOG.md` sends readers to, could go to `docs/design/` or `scripts/`.
- **What stays as it is:**
  - plans of briefs not yet shipped: 104f, 105, 106, and anything else still open on 2026-11-25
  - every `brief.md`
  - folders with no plan
- **Links.** Briefs, `BACKLOG.md`, skills and docs that link to a plan this removes point to the outcome instead, or
  to the plan in git history where the exact text matters.

## Acceptance criteria

- [ ] `docs/features/_outcome-template.md` exists, and the outcome of every finished brief follows it: about 20 lines
      and at most 40, with the PR links and the line naming the git history.
- [ ] No brief that `BACKLOG.md` lists as in progress or planned loses its `plan.md`.
- [ ] For a sample of five finished briefs, including 092, 102 and 104, the outcome names the same PRs, versions and
      follow-ups as the plan it replaces. `git show` on the named commit prints the full plan.
- [ ] Unticked plan boxes (052, 058, 059, 068, 071) are settled: each is done, dropped, or a follow-up in
      `BACKLOG.md`. The "Plans with unticked boxes" section of `BACKLOG.md` is gone.
- [ ] Nothing under `docs/`, `.claude/` or `.github/` links to a deleted `plan.md` without a git-history reference
      (a repo-wide search for each removed path finds none).
- [ ] `/kopiyka-hos` and `/kopiyka-hos-refactoring` describe the after-merge step. A dry run on the next brief that
      merges writes its outcome.
- [ ] The total size of `docs/features/` drops by at least two thirds. The PR states it before and after.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Moving or deleting `brief.md` files, or moving `docs/features/` out of the repo.
- Rewriting history to shrink the `.git` folder. The plans stay in history on purpose.
- Briefs outside this repo (082, 083 in `../kopiyka-pwa`, and 073–078).
- `docs/audits/` and `docs/design/`.

## Notes

- Land brief 110 (one source for the skills and agents) first. This brief edits `kopiyka-hos` and
  `kopiyka-hos-refactoring`, and after 110 that is one edit in `.claude` plus `yarn skills:build`. Before 110, it is
  two hand edits.
- The backfill is large but mechanical: about 100 folders. A subagent per batch of about ten folders, each returning
  outcomes the orchestrator checks against `gh` before committing, keeps it reviewable. Commit in batches by number
  range, so a reviewer can read one batch at a time.
- `kopiyka-hos` says skills are not edited "as part of a feature". This brief is about the flow itself, so the
  edits are its subject, not a side change.
- No app or API change, so no version bump (conventions §8b). The planner confirms that.

## Open questions

- Should the after-merge commit go through its own small PR, or ride on the next brief's branch? The brief leaves it
  to the plan. Its own PR is simpler but adds one PR per brief.
