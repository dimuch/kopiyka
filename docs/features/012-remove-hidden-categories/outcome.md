# Outcome: Remove hidden categories

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#24](https://github.com/dimuch/kopiyka/pull/24) Remove hidden categories — before versioning

## Decided

- At Gate A the "manage categories" brief was split into 012 (this), 013 delete with Undo, 014 create and rename,
  and 015 reorder.
- Migration 003 drops `categories.is_active`, which brings hidden categories back with their expenses, and adds
  `categories.deleted_at` here so 013 stayed under about 400 lines. Nothing wrote it yet.
- Reads filter `deleted_at IS NULL`, the month list skips expenses in deleted categories, and PUT always checks the
  category. The expense form lost its stand-in category. Built as planned.

## Left out

- Delete, restore and Undo (013), and an index on `deleted_at`.
- Edits to older docs that mention hidden categories; they record what was true then.

## Follow-ups

None.

Full plan: `git show 731c9e39:docs/features/012-remove-hidden-categories/plan.md`
