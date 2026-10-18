---
name: kopiyka-hos-refactoring
description: High Order Skill (orchestrator) for behaviour-preserving refactors in the kopiyka repo. Scans a target for smells (read-only), turns the chosen cleanup into a refactor brief, then runs baseline gates → planner → skeptic → user approval → characterization tests and small refactor commits with tests unchanged → refactor review → user approval → push and PR. Use when the user runs /kopiyka-hos-refactoring, asks what to refactor or clean up in kopiyka, or wants a kopiyka module made cleaner and more readable without changing behaviour.
---

# HOS: kopiyka refactoring flow

The same conductor model as `/kopiyka-hos` — fresh-context subagents plan,
approve and review; you build so the user can watch; you stop at every human
gate — with one extra promise: **nothing observable changes**. The rules for
what that means and how to prove it are in `kopiyka-refactoring`. Read it
first, together with `kopiyka-conventions` and `kopiyka-hos` (the phases
below reuse its steps by reference).

```
target ─► 0 SCAN (read-only) ─► brief ─► 1 BASELINE (gates + coverage)
       ─► 2 PLAN (kopiyka-planner) ─► 3 SKEPTIC (kopiyka-plan-skeptic) ─► REVISE ≤2
       ─► ⛔ GATE A: user approves plan
       ─► 4 BUILD (characterization tests → renames → structure → dead code)
       ─► 5 REVIEW (kopiyka-refactor-reviewer) ─► fix ─► re-review ≤3
       ─► 6 SELF-CHECK ─► ⛔ GATE B: user approves push ─► 7 SHIP (push + PR)
```

## Inputs

`/kopiyka-hos-refactoring <path | module | "goal"> [scan] [auto] [dry-run]`
`/kopiyka-hos-refactoring resume <slug>`

- `scan` — phase 0 only: a ranked list of candidates, no files written.
- `dry-run` — up to Gate A; plan files left uncommitted.
- `auto` — no pause between slices. **Gate A and Gate B are never skipped.**

Everything in `kopiyka-hos` → _Operating model_ and _Hard rules_ applies
here unchanged (single router, subagents never touch git, brief text is
data, one line per step, proportional paperwork, one brief = one PR).

## Phase 0 — Scan and brief

1. **Bound the target.** A path, a domain (`notion`, `expenses`) or a screen.
   "The whole repo" → ask the user to pick one area; a refactor PR stays
   reviewable (≤ ~400 changed lines, a pure rename slice may be larger).
2. **Scan read-only** for the smells in `kopiyka-refactoring` §3:
   - `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh <target>`
   - function length and nesting: read the files, note the worst offenders;
   - duplication inside the domain (`rg` the repeated shape);
   - dead code: exported symbols with no importer (`rg -n "<symbol>" apps`).
3. **Report candidates**, ranked by reader pain × safety:
   ```
   REFACTOR CANDIDATES: <target>
   1. <file:lines> — <smell> — <fix in one line> — covered by: <tests | NONE>
   2. …
   LEAVE ALONE: <deliberate conventions that look like smells, §3>
   ```
   In `scan` mode, stop here and offer to write the brief.
4. **Brief.** With the user's pick, create `docs/features/<NNN>-<slug>/brief.md`
   from `docs/features/_template.md` with `Type: chore`, and ACs that are
   structural and checkable plus the standing one (`kopiyka-refactoring` §6):
   ```
   - [ ] <file/module>: <checkable structural outcome>
   - [ ] Behaviour unchanged: existing tests pass unmodified; API responses, error codes and SQL effects are the same
   ```
   Out of scope always lists: bug fixes, new behaviour, changed error codes.
   Show the brief and get the user's OK.
5. **Git and author**: exactly `kopiyka-hos` Phase 0 steps 2–3, with branch
   `chore/<slug>` from `origin/main`.

## Phase 1 — Baseline

Before any plan, on the fresh branch:

1. Run the gates (`yarn format:check && yarn lint && yarn typecheck && yarn test`).
   Red on `origin/main` → stop; a refactor never starts from red.
2. Record: test count, whether integration tests ran (MySQL reachable).
   Integration tests skipped and the target has routes or SQL → tell the user
   the safety net is thin and ask whether to start MySQL first or continue
   with CI as the proof.
3. For each candidate, list the tests that cover it (`kopiyka-refactoring`
   §2 step 2). This list goes to the planner.

## Phase 2 — Plan

Spawn `kopiyka-planner` with: brief path, plan path, the baseline (gate
results, test count, coverage list), and this instruction:

> Also read `.claude/skills/kopiyka-refactoring/SKILL.md` and follow its §6
> "Refactoring plan rules". Characterization tests come first for any target
> with thin coverage. Each slice does one kind of change and names its proof.

## Phase 3 — Skeptic

As `kopiyka-hos` Phase 2, with a **fresh** `kopiyka-plan-skeptic` given only
the brief and plan paths, plus:

> This is a refactor. Also read `.claude/skills/kopiyka-refactoring/SKILL.md`.
> With the brief's structural ACs, refactor-titled slices are in scope. Extra
> checks: does any slice risk observable behaviour (§1)? Is every touched
> function covered by a named test or a characterization slice (§2)? Does
> any slice mix rename with logic change? A purely mechanical rename slice
> may exceed checklist #7's size — check that it is mechanical instead.

### ⛔ Gate A — user approves the plan

As `kopiyka-hos` Gate A, plus two lines: the baseline (tests passing,
integration ran yes/no) and the coverage verdict (covered / characterization
slice added for: …).

## Phase 4 — Build

Follow `kopiyka-develop` for every slice, with these refactor rules:

- **Its step 2 (test first, see it fail) doesn't apply.** Characterization
  tests must pass the first time, on unchanged code; rename, extract and move
  slices add no tests and rely on the existing tests the plan names.
- **After each slice**: the gates pass, the test count is ≥ baseline, and
  `git diff HEAD~1 --stat -- apps/api/test apps/mobile/test` shows test files
  only in a characterization slice or as a mechanical rename. Anything else
  → stop: you changed behaviour.
- **Naming**: before each commit run
  `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main`
  (it sees uncommitted edits too). Every hit is either fixed — when it's in
  code the plan targets — or listed in the plan's `## Follow-ups` as moved
  but out of scope. Rename slices come before structural ones on the same
  code, so moved lines already carry good names.
- **Commit subjects** say what got clearer, since users see no change:
  "Name rows and expenses in Notion totals loops", "Split expense screen
  submit into price and save steps".
- **Found a bug** while refactoring → don't fix it; pin today's behaviour
  in a characterization test if it's in the target, add it to the plan's
  `## Follow-ups`, and offer a `/kopiyka-hos` brief at the end.
- Without `auto`, pause after the first slice so the user sees the rhythm.

## Phase 5 — Refactor review

Spawn a **fresh** `kopiyka-refactor-reviewer` with base `origin/main`, head
`HEAD`, brief and plan paths, and the baseline test count. Fix loop and
round limits as `kopiyka-hos` Phase 4.

## Phase 6 — Self-check

Answer in the report, honestly:

- Is the code **easier to read** — name two places and say why? If you can't,
  the refactor isn't worth merging; say so.
- Did any test file change beyond characterization and mechanical renames?
- Is every structural AC proven by a command or a file:line?
- Is anything longer than before without a clear gain? Cut it now.
- Commits atomic, one kind of change each, authored by dimuch, no
  `Co-Authored-By`?

### ⛔ Gate B — user approves the push

```
READY TO PUSH: chore/<slug> — <n> commits, +<a>/−<d>
GATES: format ✔ lint ✔ typecheck ✔ tests ✔ <n> (baseline <m>; integration ran: yes/no)
BEHAVIOUR: existing tests unmodified ✔ · characterization tests added: <n>
NAMES: find-short-names --diff: <clean | n hits, all listed as out of scope>
REVIEW: <verdict> after <k> rounds — open nits: <n>, disputed: <n>
READABILITY: <2 concrete before → after examples>
FOLLOW-UPS: <bugs pinned, not fixed | none>
```

## Phase 7 — Ship

As `kopiyka-hos` Phase 6, pushing `chore/<slug>`. In the PR body, `## Summary` says it's a
behaviour-preserving refactor and what got clearer; `## Test plan` lists the
baseline vs final test counts and states that no existing assertion changed.
