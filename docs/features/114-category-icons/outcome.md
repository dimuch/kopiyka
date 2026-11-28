# Outcome: Category icons

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#182](https://github.com/dimuch/kopiyka/pull/182) Category icons, part A: the API — v1.25.0
- [#183](https://github.com/dimuch/kopiyka/pull/183) Category icons, part B: the app — v1.26.0

## Decided

- Split into two PRs at Gate A because of the size: the API first (migration 019 adds a nullable `categories.icon`,
  responses carry `icon`, add and edit take an optional key or `null`), then the app.
- The icon belongs to the category, so every member sees it in every month. It rides on the form's existing add and
  edit requests, so one Save stays one request; an ended month refuses it (`409 month_ended`), as accepted.
- 101 icons were copied from Lucide, with its licence next to the data in the repo and no licences screen. The
  picker sits inside the category form, not in a sheet; the Icon field shows the chosen icon's name beside it.
- The conversion script re-wrote every path with a space between all numbers, so no arc flags run together for the
  native parser: the same drawing, about 9.8 KB gzipped instead of 7.5 KB.
- PR A was rebased onto 113 (#181), so its bump was 1.24.2 → 1.25.0, still minor.

## Left out

- Icon search, recently used icons, emoji, uploads, per-member icons or a colour per category.
- Guessed icons for existing, default or demo categories; the icon in the MCP connector's output.
- Committing the conversion script, and a shared package for the key list.

## Follow-ups

- `categories/monthLists.ts` is past the ~200-line split point (410 lines) and could be split with `routes.ts`'s 092
  follow-up — in BACKLOG.md

Full plan: `git show a89a588e:docs/features/114-category-icons/plan.md`
