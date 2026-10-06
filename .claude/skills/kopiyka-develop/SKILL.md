---
name: kopiyka-develop
description: Builds an approved kopiyka plan one slice at a time — implement, test, run the quality gates, self-review the diff, then make one atomic commit — and handles deviations from the plan. Use when implementing an approved docs/features/*/plan.md in the kopiyka repo, when resuming a partly built plan, or for any code change in kopiyka that should land as atomic, tested commits.
---

# Kopiyka develop

Build exactly the approved plan, in small green steps. The plan is the
scope; `kopiyka-conventions` is the style; the gates are the definition of
"works". Speed comes from never having to undo a slice.

## Preconditions (check, don't assume)

- `plan.md` says `Status: approved` (or the user said in this
  session to build without one, for a trivial change).
- On the feature branch, tree clean except plan bookkeeping:
  `git status --short`, `git rev-parse --abbrev-ref HEAD`.
- Author is right: `git config user.email` →
  `7248180+dimuch@users.noreply.github.com`.
- Resuming? The first unticked slice in `plan.md` is the next one; check
  `git log --oneline origin/main..HEAD` agrees.

## The slice loop

For each unticked slice, in order:

1. **Load context**: re-read the slice, the contracts it touches, and the
   files listed. Load the library skill for the surface (conventions §8a)
   — only the one(s) this slice needs.
2. **Test first where logic lives** (`test-driven-development`): for pure
   logic and routes, write the failing test(s) named in the slice, run
   them, see them fail for the right reason.
3. **Implement the minimum** that makes them pass and meets the slice.
   Copy the shape of the nearest sibling (route, hook, component) rather
   than inventing a new one.
4. **Run the gates** (conventions §7), narrow first, then all:
   ```bash
   yarn api test <file>      # while iterating
   yarn format && yarn lint && yarn typecheck && yarn test
   ```
5. **UI slices — see it run.** Start launch configs `api` and `web`
   (`preview_start`), open the screen at phone width (~390×844), walk the
   happy path plus loading, error and empty states, read the console for
   errors. If the change is iOS-specific, say what the user should check
   on the iPhone; don't claim it.
6. **Self-review the diff** (`git diff`, then `git diff --staged`) as a
   reviewer would:
   - only this slice's files and intent; no stray edits, debug logs,
     commented-out code, TODOs without an owner;
   - placement (§2) and invariants (§3) hold; names say what things are;
     comments explain _why_;
   - could this be simpler or shorter with the same behaviour? If yes,
     simplify now (`code-simplification`).
7. **Commit** — stage only this slice's files plus the ticked checkbox in
   `plan.md`:
   ```bash
   git add <files> docs/features/<slug>/plan.md
   git commit -m "<slice subject from the plan>"   # body: why, if non-obvious
   ```
   No `Co-Authored-By` trailer. Never `--no-verify`, never amend a pushed
   commit.
8. **Report in one or two lines**: slice n/N done, commit sha + subject,
   what was verified. Continue to the next slice unless the orchestrator
   or user asked to pause.

## Deviations

The plan was approved; changing it silently breaks that approval.

- **Minor** (same slice, same contracts, no new dependency or file outside
  the plan, ≤ ~30 extra lines): do it, and add a line to the plan's
  `## Deviations` (`slice n: <what> — <why>`) in the same commit.
- **Material** (new/changed contract, new dependency, extra slice,
  different approach, an AC that can't be met as planned): **stop**.
  Describe the delta and why, and hand back to the orchestrator for a
  re-plan of the delta (planner → skeptic → user). Don't build ahead.
- **Found an unrelated problem** (bug, smell, missing test elsewhere):
  don't fix it here. Note it under `## Follow-ups` in the plan and
  mention it at the end.

## When stuck

- A gate fails and the cause isn't obvious after one look → follow
  `debugging-and-error-recovery` (reproduce, isolate, root cause). No
  shotgun edits.
- Same slice fails its gates after 3 real attempts → stop and report what
  was tried; don't weaken a test, rule or type to get green.
- Integration tests skipped because MySQL isn't reachable → say so
  explicitly; route slices are not verified until they run (CI will run
  them; mark the slice "verified in CI" only after it has).

## Red flags

- Writing code for slice n+1 "while I'm here".
- A commit that only passes because a later commit fixes it.
- `any`, `!`, `eslint-disable`, `skip`, or a loosened assertion added to
  make a gate pass.
- A new helper/abstraction with one caller that the plan didn't ask for.
- "Verified" in a report without the command or check that verified it.
