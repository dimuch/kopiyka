# Put the remaining screens on design tokens

Type: chore

## Why

Part 3 of brief 103, the last one. 103 (PR #145) put the six tab screens on the `space`, `radius`, `size` and
`text` tokens, and 103b (PR #147) did the 22 shared components and added the 16pt `input` role. Eight screens are
still on the lint rule's `notOnTokensYet` list and hard-code their numbers. Until they move, the new look (brief 105) can't be a `theme.ts` change, and the lint rule still needs its ignore list.

## What

Move these 8 screens and `theme.dangerText` onto the tokens, with the snapping rules in
`git show b70a5d48:docs/features/103-design-tokens/plan.md` (Contracts → Snapping rules) and the `input` role from 103b. When the last
one moves, `notOnTokensYet` is empty and the rule's `ignores` drops it.

| Screen                                    | File                                | Known cases (from the 103 plan's outline)                                                                                                            |
| ----------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category detail                           | `src/app/category/[categoryId].tsx` | hero figure 32 → `amountLg` 28 (>1pt); the toast clearance `paddingBottom: 104` stays allowlisted as on Budget                                       |
| Category form screen (add / edit wrapper) | `src/app/category-form.tsx`         | —                                                                                                                                                    |
| Delete category                           | `src/app/delete-category.tsx`       | question 24 → `title` 22 (>1pt); the warning 16/24 → `body` 15/20 is −4pt per line, so it's listed                                                   |
| Expense (add / edit)                      | `src/app/expense.tsx`               | the note input → `input`                                                                                                                             |
| Income item                               | `src/app/income-item.tsx`           | its inputs → `input`                                                                                                                                 |
| Login                                     | `src/app/login.tsx`                 | title 40 → `display` 28 (>1pt); the username input 17 → `input`; the code input's 26 and `letterSpacing: 8` stay allowlisted (a one-time-code field) |
| Members                                   | `src/app/members.tsx`               | its two inputs → `input`                                                                                                                             |
| No ledger                                 | `src/app/no-ledger.tsx`             | —                                                                                                                                                    |

Also:

- `theme.dangerText` (15, `bodyMedium`) moves onto `text.body` with its face kept.
- `CategoryInMonth`'s `spinnerMargin` default (32) becomes `space.xxxl`, and its caller on the category screen
  passes a token.

## Acceptance criteria

- [ ] None of the 8 screens sets `fontSize`, `lineHeight`, `letterSpacing`, `borderRadius`, `padding*`, `margin*`
      or `gap` to a number literal, except allowlisted layout maths with a reason on the line above.
- [ ] `notOnTokensYet` is gone from `apps/mobile/eslint.config.js`: the rule covers all of `src` except `theme.ts`.
- [ ] Every money figure on these screens has tabular digits.
- [ ] Every text input on these screens renders at 16px or more on web (login, expense note, income item, members).
- [ ] Before and after layout snapshots at 390×844, light and dark (web), of: the category screen (and its compact
      header when scrolled), add and edit category, delete category, add and edit expense, add and edit income, login,
      members and no-ledger. The only differences are spacing shifts up to 2pt and font sizes up to 1pt, plus anything
      over that which is listed in the PR and approved.
- [ ] The demo build renders its screens with no console errors.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- New shared components (`Card`, `Button` and the rest): brief 104.
- Colours, Inter, shadows, removing borders, the caution colour change: brief 105.
- `DateField`'s hidden web date input and iOS Safari zoom (a 103b follow-up); it can join 105.
- Any change to behaviour, copy or accessibility labels.

## Notes

- Base: main at v1.18.0 (after #147 and brief 107). Version: patch, 1.18.0 → 1.18.1, unless main moves first.
- Size: about 148 literal lines across the 8 screens, similar to 103b (~440 changed lines). If the plan comes to
  more than ~400, split it into two sequential briefs (for example the money screens, then login, members and
  no-ledger). Don't stack PRs.
- Before snapshots need a fresh baseline from main before any code changes. The 103b recipe works: test user
  `claude-qa-103b` (#168, ledger #165) with seeded November data on `http://localhost:8081`, the demo on `:8084`, and
  layout snapshots in local storage. Members needs a second member or a pending invite to show everything; no-ledger
  needs a user without a ledger. The plan says how far to go, and lists anything checked from the code only.
- Check on iPhone (Expo Go) at Gate B: login's code input and every input's text placement without a line height.

## Open questions

- Login's code input: keep 26 and `letterSpacing: 8` allowlisted (recommended), or add a role for it?
- The three >1pt changes (category hero 32 → 28, delete question 24 → 22, login title 40 → 28) and the delete
  warning's −4pt line height: accept, or allowlist some until 105?
