# Outcome: Floating tab bar with an add-expense button

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#178](https://github.com/dimuch/kopiyka/pull/178) Floating tab bar with an add-expense button — v1.24.0

## Decided

- Approved at Gate A under the user's standing OK, with the open questions as recommended.
- One `TabBar` draws a floating 56pt pill on the tab pages and on the pages above them, at the 20pt gutter. Each tab
  stays an `<a href>` link on web (Revision 1).
- The round "+" opened the add-expense form on the category last used on this device in this ledger, kept in local
  storage as `kopiyka.lastCategory.<ledgerId>` and written only after a successful add.
- The category page kept its own header "+". `useTabBarRoom` and `useToastRoom` keep content and the Undo bar above
  the pill.
- After this brief, #180 (v1.24.1, no brief) removed the round "+", since every page already has its own add.

## Left out

- Emitting `tabPress`, NativeTabs, and new tabs or a new order.
- Syncing the last used category, or keeping it per user.
- Hiding the bar while the keyboard is up.

## Follow-ups

- Lift iOS scroll indicators above the bar with `scrollIndicatorInsets` — in BACKLOG.md
- Give Home a ScrollView if its cards reach the bar — dropped: the check found Home's cards end above it.
- The design doc's 16pt gutter against the code's 20 — in BACKLOG.md

Full plan: `git show 3ab26da4:docs/features/106-floating-tab-bar/plan.md`
