# Plan: Put login, Members and no-ledger on design tokens, and lint every screen (part 4 of 103)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/design-tokens-last
Base: origin/main (02b27ed, version 1.20.0; rebased from 89d43f7 after main moved)

## Approach

The last three screens on `notOnTokensYet` (`src/app/login.tsx`, `members.tsx`, `no-ledger.tsx`) move onto `space`,
`radius`, `size` and `text` from `apps/mobile/src/theme.ts`, by the 103 snapping rules
(`docs/features/103-design-tokens/plan.md`, Contracts → Snapping rules) and the 103b `input` role. This is the 103c
plan's "Later part: 103d" outline (slices 5–7 there, 1–3 here), checked against Base. Each slice deletes its files from
`notOnTokensYet`, so `yarn lint` proves the slice. The last slice deletes the list and its comment, which leaves the
rule's `ignores` as `['src/theme.ts']`. There's no new token, role, component or module, and `theme.ts` doesn't change.

**Size, checked on Base.** I ran the rule's selector with `eslint --rule` over all of `src`. It flags only these three
files (login 19 literals on 17 lines, Members 45 on 36, no-ledger 9 on 7: 73 on 60 lines), plus `theme.ts`, which stays
ignored. Every allowlisted line elsewhere is already suppressed. So removing the list breaks no other file. Adding up
the edits (literal lines, `size` swaps on unguarded 44/48 lines, imports, Prettier breaking `demoLink`, `check`, `back`
and `remove`, one allowlist, Members' renames) comes to **about 215 changed lines**. At 103's +35% overrun that's
about 290, still under 400, so it's one PR.

Alternative considered: **fold the Members renames into slice 3.** That saves a commit, but the renames are mechanical
and §8 wants mechanical changes on their own. Both 103 and 103b needed a late fix-up for a missed `text` local, and 103c
avoided it with the same separate slice.

## Contracts

- DB / API / DTOs / `theme.ts` / components: none. `dangerText` already moved in 103c, so Members' Remove/Revoke text
  doesn't change here.
- **Lint**, `apps/mobile/eslint.config.js`: after slice 3, the `// Files not moved onto tokens yet; brief 103d empties
this list.` comment and the `const notOnTokensYet = [...]` line are gone, and the third config object reads
  `ignores: ['src/theme.ts']`. Nothing else in the file changes, including the comment about repeating
  `noAccessibilityState`.
- **Text roles used** (103 rules; "+ face" means today's face stays as a `fontFamily` override after the spread):
  `bodyMedium` 15 → `body` + face; `bodySemi` 15/16 → `bodyStrong`; `bodyMedium` 13/14 → `label`; `body` 13/14 →
  `label` + `fonts.body`; display 28 (and 40, Open question 1) → `display`; typed text → `input` + `fonts.bodyMedium`
  (both screens type in `bodyMedium` today).
- **Login** (`makeStyles` and one inline style):
  - inline `{ gap: 14 }` → `{ gap: space.lg }`
  - `body`: `padding: space.xxl`, `gap: space.xxxl` (same values); `maxWidth: 420` isn't guarded
  - `title` → `{ ...text.display, color }` (Open question 1)
  - `field` gap 6 → `space.sm`; `label` → `{ ...text.label, color }`
  - `input` → `{ ...text.input, fontFamily: fonts.bodyMedium, height: 52, borderRadius: radius.md,
paddingHorizontal: space.lg, ... }`. `height: 52` isn't a control height and isn't guarded, so it stays.
  - `passwordInput` keeps `fontFamily: fonts.display, fontSize: 26, letterSpacing: 8, fontVariant`, allowlisted
    (103c Open question 3, which the brief takes as decided). Reason on the line above: "The one-time code: big, spaced
    digits that the scale has no role for (one caller; brief 105 picks its face with Inter)." It's applied after
    `input`, so it still overrides the role's 16 and −0.2.
  - `error` → `{ ...text.label, color: colors.over }`
  - `button` radius 28 → `radius.pill` (half its 56pt height, so it looks the same); `height: 56` stays
  - `buttonText`, `demoLinkText` → `text.bodyStrong`; `actions` gap → `space.sm`
  - `demoLink`: `minHeight`/`minWidth: size.iconButton`, `paddingHorizontal: space.lg`
  - `price` → `{ ...text.label, color, textAlign }`
- **No-ledger**: inline `{ gap: 8 }` → `space.sm`; `body` → `xxl`/`xxxl`; `title` → `{ ...text.display, color }`;
  the `text` style → `{ ...text.body, color }` (a style key named `text` spreading `text.body` is the existing pattern
  in `PendingInvites`, `EmptyMonth` and `DateField`); `check` → `minHeight: size.iconButton, marginLeft: -space.sm,
paddingHorizontal: space.sm`; `checkText` → `text.bodyStrong`.
- **Members**:
  - inline `{ gap: 2 }` → `space.xxs`; the loading spinner `{ marginTop: 24 }` → `space.xxl`
  - `screen` → `xl`/`xl`; `header` `paddingBottom` 6 → `sm`
  - `back` → `height: size.iconButton, gap: space.xs, marginLeft: -space.sm, paddingHorizontal: space.sm`
  - `backText`, `name`, `dismissText` → `text.body` + `bodyMedium`
  - `content` → `lg`/`sm`/`huge`; `title` → `display`
  - `caption`, `role`, `detail` → `label` + `fonts.body` (`detail` loses its explicit `lineHeight: 20`)
  - `list` radius 18 → `radius.lg`; `row` → `paddingVertical: space.sm, paddingHorizontal: space.lg, gap: space.sm`
  - `line` gap → `md`; `who` → `minHeight: size.iconButton, gap: space.xxs`
  - `remove` → `minHeight`/`minWidth: size.iconButton, paddingHorizontal: space.xs`
  - `panel` → `gap: space.sm, padding: space.lg, borderRadius: radius.md`
  - `question`, `confirmText`, `primaryText` → `text.bodyStrong`; `failure` → `{ ...text.label, color: colors.over }`
  - `panelButtons`, `section` gap → `sm`; `dismiss` → `size.iconButton`/`md`
  - `confirm` → `minHeight: size.iconButton, gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.lg`
  - `input` → `{ ...text.input, fontFamily: fonts.bodyMedium, height: size.control, borderRadius: radius.md,
paddingHorizontal: space.lg, ... }`
  - `primary` → `height: size.control, gap: space.sm, borderRadius: radius.pill`
- **Members renames** (slice 1, mechanical): `LabelForm`'s `[text, setText]` → `[draft, setDraft]` (6 lines: the state,
  `unchanged`, `normalizeLabel(draft)`, `setDraft(label)`, `value`, `onChangeText`), and the four failure strings'
  `const text =` → `const message =` in `remove`, `revoke`, `invite` and `leave` (3 lines each). `LabelForm`'s
  `fail(message)` parameter is in another function, so nothing clashes. Login and no-ledger have no `text` locals.
- **Allowlist count**: `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` lists 9 entries on Base and 10
  after this PR (11 if Open question 1 keeps the login title at 40).
- Reuses: `fonts`, `useThemedStyles`, `outlinedDangerButton`/`outlinedDangerText`, `dangerText`, the 103 tokens and
  rule, the 103b `input` role, the 103b snapshot recipe.
- New dependencies: none.

## Version

Bump: patch — 1.20.0 → 1.20.1
Why: §8b `patch` ("styling, behaviour-preserving refactor"). Shipped app styles shift slightly on three screens. There's
no new capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set on Base (Visual check). Slice 0 only touches the version.

- [x] 0. Bump version to 1.20.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.20.1
- [ ] 1. Rename Members' local text names that would hide the text tokens (~36 lines)
  - Files: `apps/mobile/src/app/members.tsx`
  - Change: the renames in Contracts. No style changes.
  - Verify: gates. `rg -n "(const|let) text\b|\[text,|\(text\b|, text\b" apps/mobile/src/app/{login,members,no-ledger}.tsx`
    finds nothing.
- [ ] 2. Put the login and no-ledger screens on design tokens (~75 lines)
  - Files: `apps/mobile/src/app/{login,no-ledger}.tsx`, `apps/mobile/eslint.config.js` (−2 paths from the list)
  - Change: Contracts → Login and No-ledger, and the one allowlist.
  - Verify: `yarn lint` with both files guarded. In the browser, views l and n (Visual check), light and dark. AC3 on
    `/login`: `[...document.querySelectorAll('input')].map((i) => getComputedStyle(i).fontSize)` gives
    `["16px", "26px"]`.
- [ ] 3. Put Members on design tokens and lint every screen (~105 lines)
  - Files: `apps/mobile/src/app/members.tsx`, `apps/mobile/eslint.config.js`
  - Change: Contracts → Members, then Contracts → Lint (AC2).
  - Verify: `yarn lint`. `rg -n notOnTokensYet apps/mobile` finds nothing. The allowlist count (Contracts). AC3 on
    `/members` as the owner gives `["16px", "16px"]`. Then the full **after** set (views l–n, both themes) and the demo
    check (AC5).

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, without piping. In this worktree,
export `DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. Only `@/theme` imports
change, and none of the three screens is in the demo (`src/demo-app` has no login, Members or no-ledger route, and
`demo-modules.txt` lists none of them). So `check-builds` needs no `--accept`.

## What moves (the PR lists this)

Natural line heights are 1.3× for Plex and 1.2× for Bricolage (measured in 103). The sums are estimates for web at
390×844, and the developer records the measured values under Deviations.

**Type over 1pt**

- Login title 40 → 28 (`display`); its box goes 48 → 34 and tracking −0.8 → −1. Open question 1.

**Type −1pt**

- Login: username input 17 → 16, Sign in 16 → 15, the error line 14 → 13.
- Members: the failure lines 14 → 13, and the Leave panel's `detail` 14/20 → 13/18 (its line height −2pt per line;
  member view only).

**Spacing ±2pt**

- 6 → 8: login field gap (label to input), Members header `paddingBottom`.
- 14 → 16: login fields gap, Members panel padding, Members input padding (typed text 2pt right).
- 10 → 8: Members row `paddingVertical` and row gap (the gap only shows with the confirm panel open).
- 18 → 16: Members confirm button `paddingHorizontal`, so Remove/Leave in the panel is 4pt narrower.

**Radius**

- 18 → 20: the Members list. The 22, 24 and 28 radii → `pill`: each is half its box already, so no visible change.

**Line heights and tracking**

- body +0.5, label +1.1, display +0.4 (no-ledger and Members titles).
- Tracking: no-ledger title −0.4 → −1 (about 14pt narrower over the line), Members title −0.3 → −1 (about 5pt
  narrower), login title −0.8 → −1. Role tracking is new where none was set: body −0.2, label −0.1, input −0.2. Login's
  code input keeps its 8.

**Sums over 2pt (estimated)**

- Login (web, no error; the block is centred): with the title at 28 the block is about 4.7pt shorter (title −14, field
  gaps +4, labels +2.2, fields gap +2, price +1.1). The title sits 2.4pt lower, the Username label about 12pt higher,
  the Password input about 3.5pt higher, and Sign in and everything below it about 3.5pt higher. With the title kept
  at 40, the block is about 9.3pt taller: everything from the title to the Username input moves 1.5–4.7pt up, and
  from the Password input down about 3.5pt lower.
- Members as owner (2 members, 1 invite): the label input about 4.6pt lower, Save and the list top about 5.7pt lower.
  Each row is 4pt shorter (60 instead of 64; `who`'s 44pt sets it), so the Invited caption sits about 2.3pt higher and
  the Invite button about 3pt higher.
- Members with Remove tapped: the panel is 4.5pt taller (padding +4, question +0.5), the row 6pt shorter (padding −4,
  gap −2), and its text 2pt further in.
- No-ledger: under 1pt, unless the title's tighter tracking changes its wrapping (Risks).

## Visual check (AC4; not counted in the line estimates)

**Before set (the orchestrator, on Base 89d43f7, before slice 1).** Use the 103b recipe: `api` and `web` (port 8081)
from `.claude/launch.json` in this worktree, the in-app browser at 390×844, and layout snapshots in local storage keyed
`snap:before:d:<view>:<scheme>`. Keep the older `snap:before:*` keys. Set the scheme with
`localStorage.setItem('kopiyka.theme', 'light')` (then `'dark'`) and reload. It's per origin, not per user, so it
also holds on the signed-out login and on no-ledger. Get TOTP codes from a scratch script in the system temp dir, and
don't print the secrets. A wrong code counts against the IP's limit (5 in 24 hours), so don't guess.

Set-up, once, from this worktree (`apps/api/.env` is present). The owner is `claude-qa-103b` (ledger #165):

1. `yarn api create-user --username claude-qa-103d-b --email claude-qa-103d-b@example.com --join claude-qa-103b`:
   the second member (Remove row). It never signs in.
2. The same with `claude-qa-103d-c`: the no-ledger user. Keep its secret in the scratch file for its codes.
3. The same with `claude-qa-103d-d`: the invite target. It never signs in.
4. As the owner, on `/members`, Remove `claude-qa-103d-c` and `claude-qa-103d-d` (Remove, then the panel's Remove).
   Both are now in no ledger. (Or in SQL: `DELETE FROM ledger_members WHERE role = 'member' AND user_id IN (…)`.)
5. Right before view m, invite `claude-qa-103d-d` from Members' "Invite by username". An invite lasts an hour, so
   invite again before the after set if it expired (an expired invite doesn't block a new one).

`--join` needs the owner to own exactly one ledger. I checked the local database read-only while planning:
`claude-qa-103b` (#168) owns only #165, and is its only member today, so there are no other members to clean up.

Views, each in Light and then Dark (10 snapshots):

- l. `/login`, signed out (web shows Request access and the price).
- m1. `/members` as the owner: the owner and `claude-qa-103d-b` in the list, `claude-qa-103d-d` under Invited.
- m2. The same with Remove tapped on `claude-qa-103d-b` (the confirm panel). Then tap Back: don't confirm.
- m3. The same after Invite with an unknown username, `nobody-103d`, which shows the `cannot_invite` failure line.
  Nothing is written. Clear the field afterwards.
- n. `/no-ledger`, signed in as `claude-qa-103d-c` (no ledger, no invites). Sign out after.

Also record AC3's `getComputedStyle` values on `/login` and `/members` (Base: `["17px", "26px"]` and
`["16px", "16px"]`).

**Checked from the code only** (listed as such in the PR):

- login's busy spinner and its error line (a wrong code feeds the throttle; "Can't reach the server" needs the API
  stopped)
- Members' loading spinner (24, same value) and its `LoadError` states; the Remove, Revoke, Save and Leave failure
  lines (network failures; m3 shows the same `failure` style)
- the member's view: Leave ledger and its panel with `detail`. `claude-qa-103d-b` could show it, but it would need its
  codes, and it uses the same `ConfirmPanel` as m2.
- no-ledger with an invite (`PendingInvites` moved in 103b), its spinner, and its `LoadError`
- every native-only difference (iPhone at Gate B)

**After set:** after slice 3, the same views on the same port and data, compared with What moves. Anything else is a
bug in the slice that caused it. The screenshots go in the PR, not the repo.

**Clean-up after Gate B:** `DELETE FROM users WHERE username IN ('claude-qa-103d-b', 'claude-qa-103d-c',
'claude-qa-103d-d')` on the local database. Memberships, invites, sessions and known devices cascade, and none of them
wrote expenses or income.

**Gate B, iPhone (Expo Go):** login's code input (26pt, spaced, display face), the text placement in every input (login
username, Members' label and invite fields), and the login block's centring with the keyboard up.

## AC → evidence

| AC                                               | Evidence                                                                                                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 no number literals in the 3 screens          | Slices 2–3: `yarn lint` with each file guarded; `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` → 10 entries (11 if the title stays 40), each with a reason above                                                  |
| AC2 `notOnTokensYet` gone, rule covers all `src` | Slice 3: `rg -n notOnTokensYet apps/mobile` finds nothing; `ignores: ['src/theme.ts']`; `yarn lint` passes. On Base, the selector over all of `src` flags only these 3 files and `theme.ts` (checked while planning)                |
| AC3 inputs ≥ 16px on web                         | Slice 2 Verify on `/login` → `["16px", "26px"]`; slice 3 Verify on `/members` → `["16px", "16px"]`                                                                                                                                  |
| AC4 before/after snapshots                       | Visual check: before set l, m1–m3, n on Base (orchestrator, with the three local users), after set after slice 3, light and dark, compared with What moves; >2pt sums and the title listed in the PR; the code-only list in PR      |
| AC5 demo, no console errors                      | Slice 3: demo (`web-demo`, port 8084 as in 103b/103c) with the console open, Light and Dark: Home, Budget, Expenses, Income and the expense form. No red screen, no errors. The 3 screens aren't in the demo, so it's a smoke check |
| AC6 gates                                        | Every slice                                                                                                                                                                                                                         |

## Not doing (YAGNI)

- No `ScreenHeader`, `Button` or `Card` component, though Members' back header and the 48/56pt buttons repeat the
  modal ones: brief 104.
- No role for the code input, no token for the 52pt login field or the 56pt Sign in button.
- No colours, Inter, shadows or borders (105). No copy, behaviour or label changes.
- No new test users kept after Gate B.

## Risks

- **No-ledger's title wraps differently.** "You’re not in any ledger" at Bricolage 28 is close to the 342pt line;
  tracking −0.4 → −1 narrows it about 14pt. If it's on two lines on Base and fits on one after, the block is 34pt
  shorter. Slice 2's view n shows it; if so, it's listed in the PR as over 2pt, not fixed.
- **The login title** (Open question 1): the answer changes slice 2 by 3 lines and the login sums above.
- **The before set needs the local users first.** If `create-user --join` or the Members Remove fails, m1–m2 and n
  fall back to code-only and the PR says so (the brief allows it). Proven before slice 1.
- **A missed `text` local hides the import.** Slice 1's `rg` check, and typecheck where `text.` is used inside it.
- **Main moves.** Another PR could add a literal elsewhere (slice 3's lint catches it; it gets fixed in that file) or
  take 1.18.2 (rebase, take main's number and bump once more, §8b).
- **Prettier reflow** pushes slices past the estimates, as in 103. Each is well under 150.

## Open questions

1. **Blocking: yes (Gate A). Login's title 40 → 28 (`display`), or keep 40 allowlisted until 105?**
   - Recommended: accept 28.
   - The spec's `display` (28/34) is the "screen title" role, and the other two screens' titles are already 28.
   - 103's and 103c's Gates A accepted the same kind of change (Expenses total 34 → 28, category hero 32 → 28).
   - Keeping 40 means 105 edits login again, which this chain exists to avoid, and adds the 11th allowlist.
   - Against: it's the biggest single text change in the 103 chain, and on login "Kopiyka" works more as a wordmark
     than a screen title. Keeping it is 3 lines (allowlist, reason, the literals) and leaves the choice to 105's look.
   - Assumed: accept 28.
2. **Blocking: no. Local test users.** The brief allows creating test users and deleting them after. Assumed: the three
   `claude-qa-103d-*` users above, deleted after Gate B.

## Follow-ups

- None new. Still open from 103b/103c: `DateField`'s hidden web date input (105), and `amountLg`'s single caller.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Gate A (2026-11-24)

Approved by the user: the plan (slices 0–3, one PR), the login title 40 → 28 (`display`), and three temporary local
test users for the Members and no-ledger views, deleted after Gate B.
