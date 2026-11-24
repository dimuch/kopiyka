# Put login, Members and no-ledger on design tokens, and lint every screen

Type: chore

## Why

The last part of brief 103. 103 (#145), 103b (#147) and 103c (#149) moved the tabs, the shared components and five
screens onto the `space`, `radius`, `size` and `text` tokens. Three screens are still on the lint rule's
`notOnTokensYet` list and hard-code their numbers: login, Members and no-ledger. While they're there, the rule needs an
ignore list, and the new look (brief 105) can't be a `theme.ts` change for those screens.

## What

- Move `src/app/login.tsx`, `src/app/members.tsx` and `src/app/no-ledger.tsx` onto the tokens, with the snapping rules
  in `docs/features/103-design-tokens/plan.md` (Contracts → Snapping rules) and the 16pt `input` role from 103b.
- Delete `notOnTokensYet` and its comment from `apps/mobile/eslint.config.js`, so the rule covers all of `src` except
  `theme.ts`.
- The outline in `docs/features/103c-design-tokens-screens/plan.md` ("Later part: 103d") is the starting point.

Known cases:

| Screen    | Known cases                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login     | the title 40 → `display` 28 (>1pt); the username input 17 → `input` 16; the code input keeps `fontSize: 26` and `letterSpacing: 8`, allowlisted (one-time code) |
| Members   | local names called `text` are renamed first (`LabelForm`'s state and four failure strings); its two inputs → `input`; the confirm and primary radii → `pill`    |
| No-ledger | the title 28 → `display`; the check button → `size.iconButton`                                                                                                  |

## Acceptance criteria

- [ ] None of the 3 screens sets `fontSize`, `lineHeight`, `letterSpacing`, `borderRadius`, `padding*`, `margin*` or
      `gap` to a number literal, except allowlisted cases with a reason on the line above.
- [ ] `notOnTokensYet` is gone: the token rule covers every file in `apps/mobile/src` except `theme.ts`, and
      `yarn lint` passes.
- [ ] Every text input on these screens renders at 16px or more on web (login username and code, Members' two inputs).
- [ ] Before and after layout snapshots at 390×844, light and dark (web), of: login (signed out), Members as owner,
      and no-ledger where it can be set up. The only differences are spacing shifts up to 2pt and font sizes up to 1pt,
      plus anything over that which is listed in the PR and approved. Views that can't be set up locally are listed as
      checked from the code only.
- [ ] The demo build renders with no console errors.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- New shared components (`ScreenHeader`, `Button`, `Card` and the rest): brief 104.
- Colours, Inter, shadows, borders, the caution colour change: brief 105.
- Any change to behaviour, copy or accessibility labels.

## Notes

- Base: main at v1.18.1 (after #149). Version: patch, 1.18.1 → 1.18.2, unless main moves first.
- Size: about 210 changed lines by the 103c plan's outline; 103–103b ran up to ~35% over, 103c ran under.
- Test data: `claude-qa-103b` (#168, ledger #165) owns a ledger. Members' Remove row and confirm panel need a second
  member; a pending invite shows Revoke; no-ledger needs a user in no ledger. Creating a second test user (and deleting
  it after) is fine for local checks.
- `dangerText` already moved in 103c, so Members' Remove/Revoke text is on the body role on main.
- Check on iPhone (Expo Go) at Gate B: login's code input, and the text placement in every input.

## Open questions

- Login's title 40 → 28: accept it (the spec's `display` role), or keep 40 allowlisted until brief 105? It's the
  biggest single text change in the 103 chain; 103c's Gate A left it to this brief.
