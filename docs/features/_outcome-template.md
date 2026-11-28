# Outcome: <brief title>

<!-- Replaces plan.md once the brief's last PR merges. About 20 lines, at most 40. -->

Brief: ./brief.md · Finished <YYYY-MM-DD, the last PR's merge date>

## PRs

<!-- Version: package.json at the PR's merge commit. PRs below #101 say "before versioning". -->

- [#<n>](https://github.com/dimuch/kopiyka/pull/<n>) <PR title> — v<x.y.z>

## Decided

<!-- Gate A decisions, and what the build changed from the plan (its Deviations). -->

- <decision>

## Left out

<!-- What was deliberately not done, and why (the plan's Not doing). -->

- <item, and why>

## Follow-ups

<!-- Each one: "in BACKLOG.md", "done in <brief, #PR>" or "dropped: <why>". Or "None." -->

- <item> — in BACKLOG.md

<!-- The last main commit that had the plan: git log -1 --format=%h origin/main -- docs/features/<dir>/plan.md -->

Full plan: `git show <sha>:docs/features/<dir>/plan.md`
