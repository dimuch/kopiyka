# Plan: Replace shipped plans with short outcomes

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/plan-outcomes
Base: origin/main (b0e5aef5, v1.26.19)

## Approach

Docs and skills only. First the template, the after-merge step in `kopiyka-hos` (and by reference in
`kopiyka-hos-refactoring`), a lasting home for the one plan section still in use (the layout snapshot script), and
an up-to-date `BACKLOG.md`. Then twelve batch commits by number range. Each batch writes `outcome.md` for every
finished brief in its range, deletes the `plan.md`, settles that range's unticked boxes, and repoints every link to
those plans. So every commit leaves no dead link and passes the gates.

The brief's snapshot (2026-11-25) is overtaken. On Base every one of the 135 `plan.md` files belongs to a merged
brief: `gh pr list --state open` is empty, and 104f, 105, 106, 110, 112–116 and 117–133 (R1–R17, #189–#205) are all
merged. **Kept:** this brief's own `plan.md` until it merges, and the folders with no plan: 014 and 015 (replaced
by 033 and 092), 086 (planned, not briefed for build) and 111's brief. Outside `docs/features/` on `main`, and
untouched: 082/083 (`../kopiyka-pwa`), 073–078, and `017-ci-security-checks` on the unpushed local branch
`chore/ci-security-checks`.

**After-merge commit: its own small PR** (`chore/outcome-<slug>`), not folded into the next brief's branch, because:

- the repo already does this: #164, #172 and #186 were small backlog PRs after a merge
- the next brief may start days later, or in another worktree or session, and `BACKLOG.md` would be wrong meanwhile
- a docs commit on a feature branch mixes concerns in that PR's review and ties two briefs together
- it is docs-only (`none`), so CI is quick and it can merge at once. The cost is one more PR per brief.

Alternative considered: keep the plans and add an outcome at the top of each. Rejected: the size and the search
noise stay, so AC7 fails. Moving the plans to a `docs/features/_archive/` folder was rejected too: the size stays,
and the brief puts the history in git.

## Contracts

- DB: none
- API: none
- App: none
- Docs contract, `docs/features/<dir>/outcome.md`, from `docs/features/_outcome-template.md`, at most 40 lines:

  ```markdown
  # Outcome: <brief title>

  Brief: ./brief.md · Finished <YYYY-MM-DD, the last PR's merge date>

  ## PRs

  - [#<n>](https://github.com/dimuch/kopiyka/pull/<n>) <PR title> — v<x.y.z>
  - [#<n>](…) <PR title> — before versioning <!-- PRs below #101 -->

  ## Decided

  - <Gate A decisions, and what the build changed from the plan (its Deviations)>

  ## Left out

  - <what was deliberately not done, and why>

  ## Follow-ups

  - <item> — in BACKLOG.md | done in <brief, #PR> | dropped: <why>; or "None."

  Full plan: `git show <sha>:docs/features/<dir>/plan.md`
  ```

  - **Version** is `package.json` at the PR's merge commit (`gh pr view <n> --json mergeCommit`), not the release
    tag. PRs below #101 predate versioning. #150 merged into #148's branch, so it takes #148's version, `(via #148)`.
  - **`<sha>`** is `git log -1 --format=%h origin/main -- docs/features/<dir>/plan.md`. That is a commit already on
    `main`, so it survives this PR's rebase-merge. Plans are only ever deleted, never edited, so this commit still
    holds the full plan.
  - **The PRs** come from three sources, and the orchestrator confirms each by its head branch and title:
    `gh pr list --state merged --search "<dir> in:body"`, which also finds PRs that only mention the brief (092 →
    #141, 102 → #159), the plan's own PR mentions, and `BACKLOG.md`.

- After-merge step (`kopiyka-hos` new **Phase 7 — After merge**, about 25 lines). It runs when the user says the PR
  merged, or on "next step" when `gh pr view` shows it merged:
  1. Confirm with `gh pr view <n> --json state,mergedAt,mergeCommit` that the PR is `MERGED`. A brief with more PRs
     waits for its last one. A brief split into parts (104–104h) writes one outcome per part, as each part merges.
  2. Work in the merged feature's worktree, and leave the main checkout on `main`. After the same clean-status and
     author checks as Phase 0, run `git fetch origin` and `git switch -c chore/outcome-<slug> origin/main` there.
  3. Write `outcome.md` from the template. The decisions come from the plan's Gate A notes, Deviations, Not doing
     and Follow-ups. Then delete `plan.md`.
  4. Find every link to the plan (`rg -n --fixed-strings '<dir>/plan.md' docs .claude .github deploy CLAUDE.md AGENTS.md README.md`). Point each
     at the outcome, or at the `git show` line where the exact text matters.
  5. In `BACKLOG.md`, move the brief to "Recently finished" (`Brief and outcome: …`), and add each follow-up the
     outcome marks "in BACKLOG.md".
  6. Run the gates, then make one commit, `Record the outcome of <NNN> <title>`. Push and open the PR only with the
     user's OK, as Gate B.
  7. After the switch, delete the merged feature branch (`git branch -D`, since a rebase-merge leaves it unmerged to
     git). Remove the worktree only after the outcome PR merges. The remote branch stays unless the user asks.
  - `kopiyka-hos-refactoring` gets **Phase 8 — After merge: as `kopiyka-hos` Phase 7.**
  - The diagram gets a line, `─► 7 AFTER MERGE (outcome.md, BACKLOG, cleanup)`, and so does the front matter
    description.
  - Hard rules: "one brief = one PR" gains "plus its after-merge outcome PR".
- Reuses: `yarn skills:build` (brief 110) for the Copilot copies; `gh` and `git log` for PRs, versions and SHAs.
- New dependencies: none.

## Version

Bump: none — 1.26.19 → 1.26.19
Why: conventions §8b `none` row. Only `docs/`, `.claude/`, `.github/` and a README (`deploy/README.md`, two links)
change. Nothing reaches production, so there is no slice 0.

## Slices

Each slice ends with `yarn format` (Prettier formats Markdown), then the four gates and `yarn skills:check`.

- [x] 1. Add the outcome template and describe outcomes in the features README (~45)
  - Files: `docs/features/_outcome-template.md` (new), `docs/features/README.md`
  - Change: add the template above, with one-line comments on where each part comes from. The README's folder tree
    gets `outcome.md` ("replaces plan.md once the brief's last PR merges"), and Flow gets step 7, After merge. Line 46's "One brief, one PR" gets "plus its after-merge outcome PR".
  - Verify: `yarn format:check`; the template is ≤ 40 lines.
- [x] 2. Add the after-merge step to the brief and refactoring flows (~35 source, ~35 generated)
  - Files: `.claude/skills/kopiyka-hos/SKILL.md`, `.claude/skills/kopiyka-hos-refactoring/SKILL.md`, and the copies
    `yarn skills:build` writes in `.github/skills/kopiyka-hos*/SKILL.md`
  - Change: Phase 7 and Phase 8 as in Contracts, plus the diagram, description and hard-rule lines.
  - Verify: `yarn skills:check` passes. `rg -n 'After merge' .claude/skills/kopiyka-hos* .github/skills/kopiyka-hos*`
    finds both skills in both trees.
- [ ] 3. Give the layout snapshot script a lasting home (~75)
  - Files: `docs/design/layout-snapshots.md` (new), `docs/features/refactor-roadmap-2026-11.md` (line 17),
    `docs/features/BACKLOG.md` (line 103)
  - Change: copy the generic part of 104h's "Visual check", with the script block verbatim:
    - the `__snapSrc`, `__cmpSrc` and `__scrollSrc` script
    - the key scheme, with prose saying that `104h` in the keys (also inside `__cmpSrc`) is the brief number to replace
    - the 390×844, Light-then-Dark method, and the expected `cmp` result
  - Left in git history: 104h's own views, QA users and seeds, and 104's older "Snapshot script", which 104h's
    replaced. The roadmap and BACKLOG then point at the new file.
  - Verify: the copied `js` block is byte-identical to the one in
    `git show b0e5aef5:docs/features/104h-text-other-screens/plan.md` (`diff` of the two extracted fenced blocks).
- [ ] 4. Bring BACKLOG.md up to date before any plan goes (~50)
  - Files: `docs/features/BACKLOG.md`
  - Change:
    - Snapshot line: v1.26.19, `b0e5aef5`.
    - 110 (#187) and 116 (#185) move from "In progress" to "Recently finished", and 112 (#179) is added there.
    - 110 and 111 leave "Planned: repo tooling"; 112 leaves "Planned: small fixes".
    - "In progress" holds only 111.
    - "This file and the plans in `docs/features/` are the record to work from" (lines 230–231) names the briefs and
      outcomes instead.
    - The "Releases" line ("the newest tag is v1.20.0") names the tags `git tag` shows: v1.20.0, v1.26.2 and
      v1.26.19.
    - Every state is checked against `gh pr list --state merged`, not the old text.
  - Why first: AC2 reads `BACKLOG.md`'s in-progress and planned lists. Fixing them before the batches means no
    batch deletes a plan that `BACKLOG.md` still calls open.
  - Verify: each brief named under "In progress" or "Planned" has its `plan.md`, or never had one (086).
- [ ] 5–16. Replace the plans of briefs `<range>` with outcomes. One commit per batch, below.
  - Files per batch: the range's `outcome.md` (new) and `plan.md` (deleted), plus the link fixes and `BACKLOG.md`
    edits listed for it.
  - Drafting: one read-only subagent per batch. It gets the range, the template, these rules and the PR candidates,
    and returns each outcome's text. The orchestrator writes the files, then checks every PR number, version and SHA
    against `gh` and `git` before committing.
  - `BACKLOG.md`: "Brief and plan:" becomes "Brief and outcome:" for the range. A follow-up the outcome marks "in
    BACKLOG.md" and that isn't there yet is added under "Small follow-ups".
  - Verify, all output must be empty:
    - `check-outcomes.sh docs/features/<range>/outcome.md` (below). Batch 14 prints only `CHECK BY HAND #150 (108)`,
      checked by hand as #148's version
    - the dead-link search (below)
    - `git diff --stat HEAD~1 -- docs/features | grep -v -e outcome.md -e plan.md -e brief.md -e BACKLOG.md` shows
      no other feature file

| #   | Range    | Plans | Links to repoint and boxes to settle in the same commit                                                                                                                                                                                                                                                    |
| --- | -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | 001–013  | 13    | 013 brief `./plan.md`                                                                                                                                                                                                                                                                                      |
| 6   | 016–027  | 13    | (016's only link is in 067's plan, deleted in 9)                                                                                                                                                                                                                                                           |
| 7   | 028–041  | 13    | only links between plans of the same batch                                                                                                                                                                                                                                                                 |
| 8   | 042–053  | 12    | 045 brief → 044; 052, 053, 054, 055 briefs → 052. **052's 11 boxes** were built as 053, 054 and 055 (#67, #68, #70): done                                                                                                                                                                                  |
| 9   | 054–065  | 12    | 058, 060 briefs → 058; 059, 061 briefs → 059; `deploy/README.md`:674 "063 plan, slice 14" → `git show <sha>:docs/features/063-mcp-connector/plan.md`, slice 14. **058's 10** (→ 059 #78, 060 #84) and **059's 3** (→ 061 #81): done                                                                        |
| 10  | 066–081  | 10    | 071 brief → 068; `deploy/README.md` → 068 (the runbook to repeat the tests) and → 072 "Owner steps", both as `git show` lines. **068's C1–C9**: done, as reported by the owner (its Deviations). **071's 4b**: dropped, since 4a shipped (#100). Then remove BACKLOG's "Plans with unticked boxes" section |
| 11  | 084–096  | 12    | 095 brief → 094                                                                                                                                                                                                                                                                                            |
| 12  | 097–103d | 10    | 103b, 103c, 103d briefs → 103; 103d, 105 briefs → 103c                                                                                                                                                                                                                                                     |
| 13  | 104–104h | 8     | 104b–104f briefs → 104; 104g, 104h, 105 briefs → 104f; 105 brief → 104h                                                                                                                                                                                                                                    |
| 14  | 105–110  | 10    | 105b, 105c, 105d briefs → 105 ("Later parts", as `git show`); 105e brief → 105d. 108's #150 is checked by hand: `CHECK BY HAND #150`, given #148's version                                                                                                                                                 |
| 15  | 112–122  | 11    | **115's two boxes**: stale, shipped as #184                                                                                                                                                                                                                                                                |
| 16  | 123–133  | 11    | none. A rehearsal of the after-merge step: built by following slice 2's Phase 7 text, steps 3–5                                                                                                                                                                                                            |

Total: 135 plans, so 135 outcomes. Estimated lines: about 2,950 added and about 40,000 deleted.

- **Added:** outcomes about 2,700 (135 × ~20), template and README 45, skills 70, snapshots doc 75, BACKLOG and
  links about 60.
- **Deleted:** the plans, 39,834 lines.

**`check-outcomes.sh`** is a scratch script in the system temp dir, not in the repo. Run it from the repo root after
`git fetch origin`. It prints nothing when every outcome passes:

```bash
#!/usr/bin/env bash
# usage: check-outcomes.sh <outcome.md>...   (run from the repo root, after git fetch)
for o in "$@"; do
  d=$(dirname "$o"); dir=$(basename "$d")
  n=$(wc -l < "$o" | tr -d ' '); [ "$n" -le 40 ] || echo "LONG $o: $n lines"
  [ -e "docs/features/$dir/plan.md" ] && echo "PLAN LEFT $dir"
  spec=$(sed -nE 's/^Full plan: `git show ([0-9a-f]{7,40}:docs\/features\/[^`]+\/plan\.md)`$/\1/p' "$o")
  [ -n "$spec" ] || { echo "NO HISTORY LINE $o"; continue; }
  [ "${spec#*:}" = "docs/features/$dir/plan.md" ] || echo "WRONG PATH $o"
  sha=${spec%%:*}
  git cat-file -e "$spec" 2>/dev/null || echo "NOT IN HISTORY $spec"
  [ "$(git rev-parse "$sha")" = "$(git log -1 --format=%H origin/main -- "${spec#*:}")" ] || echo "NOT LAST COMMIT WITH PLAN $o"
  grep -E '^- \[#[0-9]+\]' "$o" | while read -r line; do
    pr=$(sed -E 's/^- \[#([0-9]+)\].*/\1/' <<<"$line")
    read -r state merge < <(gh pr view "$pr" --json state,mergeCommit --jq '"\(.state) \(.mergeCommit.oid)"')
    [ "$state" = MERGED ] || echo "PR #$pr $state ($o)"
    if [ "$pr" -lt 101 ]; then grep -q ' — before versioning$' <<<"$line" || echo "VERSION #$pr: want 'before versioning' ($o)"; continue; fi
    want=$(sed -nE 's/.* — v([0-9]+\.[0-9]+\.[0-9]+)( .*)?$/\1/p' <<<"$line")
    if git merge-base --is-ancestor "$merge" origin/main 2>/dev/null; then
      got=$(git show "$merge:package.json" | sed -nE 's/^  "version": "([^"]+)".*/\1/p')
      [ "${want:-none}" = "${got:-none}" ] || echo "VERSION #$pr: outcome ${want:-none}, main ${got:-none} ($o)"
    else echo "CHECK BY HAND #$pr: merge commit not on main ($o)"; fi
  done
done
```

Checked against Base on a sample outcome. It catches a wrong version (#134 given as 1.14.1 gives `main 1.14.0`), a
plan left in place, and a PR whose merge commit was lost in the 2026-11-02 history rewrite. That only happens below
#101, where the rule is "before versioning", and for #150.

**Dead-link search**, empty when done:

```bash
git diff --name-only --diff-filter=D origin/main...HEAD -- 'docs/features/*/plan.md' | while read -r p; do
  rg -n --fixed-strings "$(basename "$(dirname "$p")")/plan.md" docs .claude .github deploy CLAUDE.md AGENTS.md README.md \
    | grep -v 'git show [0-9a-f]\{7,40\}:'
done
rg -n '\./plan\.md' $(git diff --name-only --diff-filter=D origin/main...HEAD -- 'docs/features/*/plan.md' | sed 's/plan\.md$/brief.md/')
```

On Base, the first loop run over all 135 plans finds 31 links outside the plans, and the second finds 4 relative
ones. The table above places every one of them.

## AC → evidence

| AC                                        | Evidence                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Template; outcomes ≤ 40, links, history | Slice 1's file. `check-outcomes.sh docs/features/*/outcome.md` prints nothing on HEAD except `CHECK BY HAND #150 (108)`, checked by hand as #148's version, and its output goes in the PR                                                                                                                                                                     |
| 2 Open briefs keep plans                  | Slice 4's check, run again on HEAD. Every brief under "In progress" or "Planned" in `BACKLOG.md` (111; 086 has none) still has `plan.md`, and `git diff --diff-filter=D --name-only origin/main...HEAD` lists no plan of theirs                                                                                                                               |
| 3 Sample of five match                    | The PR gets a side-by-side table for 092, 102, 104, 063 and 080: PRs, versions and follow-ups from the outcome, beside the plan and `gh` (the last three have the most PRs). Then `git show <sha>:<path> \| head -3` on each outcome's line prints the plan's title                                                                                           |
| 4 Unticked boxes settled                  | Each of 052, 058, 059, 068 and 071 has a "Decided" line saying where its boxes went (batches 8–10). `rg -n 'Plans with unticked boxes' docs` finds nothing                                                                                                                                                                                                    |
| 5 No dead links                           | The dead-link search prints nothing on HEAD, and its output goes in the PR                                                                                                                                                                                                                                                                                    |
| 6 Flow step and its first run             | Before merge: slice 2's `rg` and `yarn skills:check`, and batch 16 built from the step's text. **After merge only:** the first real run is this brief. The step runs for 111 and writes `111-plan-outcomes/outcome.md` in PR `chore/outcome-plan-outcomes`, and `check-outcomes.sh` passes on it. It stays an open box in this PR's test plan                 |
| 7 Size drops ≥ 2/3                        | `git ls-tree -r -l <commit> docs/features \| awk '{s+=$4} END {print s}'` on Base and HEAD. **Before (b0e5aef5): 3,685,713 bytes in 278 files**, of which the plans are 3,127,783. The target is ≤ 1,228,571, and the estimate is about 0.8 MB (−78%). The PR also states `du -sk docs/features` (4124 before), though it rounds every file up to 4 KB blocks |
| 8 Gates                                   | `yarn format:check && yarn lint && yarn typecheck && yarn test` and `yarn skills:check`, on every commit                                                                                                                                                                                                                                                      |

## Not doing (YAGNI)

- **No committed checker script, CI rule or lint for outcomes.** The checks are one-off and live in this plan and
  the PR. The after-merge step's own `rg` covers the next ones.
- **No edits to `CLAUDE.md`, `AGENTS.md`, `docs/copilot.md`, the agents, or `kopiyka-plan`/`kopiyka-develop`.** Their
  statements stay true: plans still exist while a brief is built.
- **No changes to `brief.md` beyond its plan links**, and no changes to `docs/audits/` or `docs/design/design-system.md`.
- **No outcomes for folders with no plan** (014, 015, 086).
- **No cleanup of old worktrees or branches** from earlier briefs. That is the user's call, outside this PR.
- **No remote branch deletion** in the after-merge step.

## Risks

- **An outcome drops something still in use.** Proved by each batch's dead-link search, which finds every reference
  in `docs`, `.claude`, `.github` and `deploy`. The snapshot script, the 068 runbook and 072's owner steps are the
  only live uses found on Base, and slice 3 and batch 10 handle them.
- **PR lists are wrong or incomplete,** because body search finds mentions too. Proved by the orchestrator's check of
  each candidate's head branch and title, `check-outcomes.sh`, and AC3's five-brief table.
- **A history SHA doesn't hold the plan after the rebase-merge.** Disproved by design: the SHA is the last commit on
  `origin/main` that touched the plan, from before this branch. `check-outcomes.sh` checks that it is still the last
  one, and that `git cat-file -e` resolves it.
- **Prettier rewraps tables or lists in outcomes.** Each batch runs `yarn format` before its gates, so this shows up
  in batch 5.
- **Another session merges a brief mid-build.** That brief is planned at Base, so its plan stays. Its outcome comes
  from the step's first real run, after this merges, or the branch is rebased and the batch redone.
- **Size.** The budget is far over (~2,950 added lines against ~400). The added lines are docs from one template,
  read one batch at a time, and the deletions are mechanical. See Open question 1.

## Open questions

1. Not blocking. One PR with 16 commits, or 3 PRs? The 3 PRs would be: slices 1–4; batches 5–10; batches 11–16.
   Each would ship and be consistent on its own. Assumption: one PR, since the brief asks for one pass, and every
   commit already leaves the tree consistent.
2. Not blocking. The snapshot script's home is `docs/design/layout-snapshots.md`, although the brief puts
   `docs/design/` out of scope. The brief names this exact place as an example, and `design-system.md` is not
   touched. Assumption: the new file there.
3. Not blocking. "Every `brief.md` stays as it is" and "Links … point to the outcome" pull against each other.
   Assumption: only the plan-link text in about 20 briefs changes.
4. Not blocking. In an outcome, "the version each PR shipped in" is taken as `package.json` at its merge commit, not
   the deploy tag, which many versions don't have (§8b).
5. Not blocking. The brief's keep-list (104f, 105, 106, "anything else still open on 2026-11-25") is overtaken. All
   of them have merged, so their plans go too. Assumption: "kept" means open on Base, which is only 111's own plan.

## Follow-ups

None found while planning.

## Deviations

## Consolidate
