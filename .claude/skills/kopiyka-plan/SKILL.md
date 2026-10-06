---
name: kopiyka-plan
description: Turns a kopiyka feature brief (a .md/.txt file) into an implementation plan of small, ordered, independently testable commits, and defines the approval checklist a plan must pass. Use when planning a feature, fix or refactor in the kopiyka repo, when revising a plan after skeptic or user feedback, or when judging whether a plan is ready to build.
---

# Kopiyka plan

A plan is a contract between the brief and the commits. It is good when a
developer who never saw the conversation can build it slice by slice, every
slice ends green, and nothing in it exists "just in case".

Apply `kopiyka-conventions` throughout — placement (§2), invariants (§3),
tests (§6), gates (§7), commits (§8).

## Inputs and output

- **Input**: the brief, `docs/features/<NNN>-<slug>/brief.md` (or a path
  the orchestrator gives you), plus any skeptic/user feedback to address.
- **Output**: `docs/features/<NNN>-<slug>/plan.md` (or the path the
  caller gives — the caller's path wins) in the template below, and a
  ≤10-line summary back to the caller: approach, base, slice count,
  estimated changed lines, new dependencies (or none), open questions,
  and any deliberate departure from official docs or library skills
  (what + why).
- **Verifying facts**: you may run repo code read-only to check behaviour
  or compute expected test values (e.g. a scratch script under the system
  temp dir run with `tsx`). Never write inside the repo except the plan.
- **Bugs found while planning** that no AC covers: don't plan a fix; list
  them under `## Follow-ups` (and in Open questions if they affect an AC).

## Process

1. **Read the brief twice.** Extract: the problem, each acceptance
   criterion (AC), out-of-scope items, constraints. If ACs are missing or
   untestable, write testable ones as _assumptions_ and list them under
   Open questions.
2. **Read the code the change touches** — not the whole repo. For each
   surface (API domain, screen, hook) read the current files and 1–2
   sibling examples to copy patterns from. Find dependents of anything
   you'll change: `rg -n "from '.*<module>'" apps` / `rg -n "<symbol>" apps`.
   Check migrations for the current schema. For Expo/RN APIs, check the
   versioned docs or the matching skill (conventions §8a) — don't plan
   against remembered APIs.
3. **Choose the approach.** Start from the smallest change that meets every
   AC using what the repo already has. Write down one real alternative
   (often "smaller" or "reuse X") and why it lost. Anything beyond the ACs
   goes to _Not doing_, not into slices.
4. **Define contracts first**: migration (columns + types + comments),
   endpoint (method, path, params, body, response, error codes), DTO
   mirror in `apps/mobile/src/api/types.ts`, hook signature, component
   props. These are what the skeptic and reviewer check most.
5. **Slice it.** Each slice = one commit that passes all gates alone and
   leaves `main`-quality code even if the next slice never lands. Default
   order, skipping what doesn't apply:
   1. migration (+ integration test proving it applies),
   2. pure domain logic + unit tests,
   3. route(s) + integration tests (happy, 400, 401, 404 non-member, each
      error code),
   4. app types + data hook,
   5. UI components, then the screen wiring,
   6. docs/README/.env.example if user-facing setup changed.

   Target ≤ ~150 changed lines per slice (tests included) and ≤ ~400 for
   the whole plan; bigger → propose splitting the brief into separate
   PRs, each shippable. Mechanical refactors that the feature needs go in
   their own earlier slice.

6. **Map every AC to evidence**: a named test, or an exact manual check
   (web at phone width / iPhone) for UI-only behaviour.
7. **List risks** that would change the plan if true, each with how the
   first relevant slice proves or disproves it.
8. **Self-check** against the Approval checklist below; fix what fails
   before handing over. Set `Status: draft`.

When revising: change only what the feedback is about, add a short
`## Revision N` note at the bottom (what changed, why), keep slice numbers
stable where possible.

## Plan template

```markdown
# Plan: <feature title>

Status: draft <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: <feat|fix|chore>/<slug>
Base: origin/main <!-- or: stacked on <branch> — then the PR says so -->

## Approach

<3–6 lines: what changes, where, why this way.>
Alternative considered: <one line + why not>.

## Contracts

- DB: <migration NNN_name.sql: table/columns/types/indexes | none>
- API: <METHOD /api/... → 2xx body; errors: code→status | none>
- App: <types, hook signature, component props, routes | none>
- New dependencies: <name@range — why — or none>

## Slices

- [ ] 1. <commit subject, imperative>
  - Files: <paths>
  - Change: <what, in 1–3 lines>
  - Tests: <test file → cases> | Verify: <manual check for UI>
- [ ] 2. ...

## AC → evidence

| AC    | Evidence                   |
| ----- | -------------------------- |
| <AC1> | <test name / manual check> |

## Not doing (YAGNI)

- <tempting extras deliberately left out>

## Risks

- <risk> — proven/disproven by slice <n> via <how>

## Open questions

- <blocking? yes/no> — <question> — <assumption used meanwhile>

## Follow-ups

<out-of-scope bugs or ideas found while planning or building>

## Deviations

<filled by the developer during build>
```

## Approval checklist (the skeptic enforces this; self-check first)

A plan is **blocked** if any of these fail:

1. **Complete**: every AC has a slice that implements it and evidence that
   proves it; nothing in the brief's scope is silently dropped.
2. **In scope**: no slice, contract, option or dependency that no AC needs.
   Every abstraction (new module, hook, generic component, service) has
   ≥2 real callers now, or is required by §2 placement.
3. **Right place**: each change sits where conventions §2 says; no domain
   logic in screens or route handlers that another domain needs.
4. **Invariants**: money stays integer cents/decimal strings; dates are
   Kyiv `YYYY-MM-DD`; ledger routes are guarded and scoped; soft-delete
   respected; error codes snake_case.
5. **Testable slices**: each slice compiles, passes gates and has its own
   tests or exact verification; no "tests in the last slice".
6. **Ordered**: contracts before consumers; no slice depends on a later one.
7. **Sized**: slices ≤ ~150 lines, total ≤ ~400, or a split is proposed.
8. **Grounded**: APIs, files and functions referenced exist **on the
   plan's Base** (or are created in an earlier slice); Expo/RN usage
   matches SDK 57 docs, or the plan states why it departs from them.
9. **Contracts explicit**: request/response/error shapes, migration
   columns and DTO changes are written down, with their consumers.
10. **Risks and questions honest**: blocking questions are marked; no
    assumption that changes behaviour is hidden in a slice.

Docs updates are part of the change when it makes a stated fact stale
(e.g. adding a test runner updates conventions §6) — in their own slice
or commit. Other convention changes are proposals, not plan slices.

Not reasons to block: style preferences, alternative designs of similar
complexity, naming that conventions don't decide.

## Red flags

- A slice named "refactor", "cleanup" or "polish" with no AC behind it.
- "Add tests" as a separate final slice.
- New package, state library, generic `utils`, or config option "for later".
- Contracts described as "TBD" or "similar to X".
- Plan longer than the code it describes.
