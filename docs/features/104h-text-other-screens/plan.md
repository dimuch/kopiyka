# Plan: Shared components, part 8: Text on the remaining screens

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/text-other-screens
Base: origin/main (beddcd5, version 1.23.10)

## Approach

Move the 50 `<Text>` elements in the brief's 8 files onto 104f's `Text` (`src/components/Text.tsx`). Each site
passes its role and face as a `variant` and its colour as a palette key. The one money line also passes `tabular`.
Its local style keeps only layout. Every variant is one that 104f's Gate A approved and 104f or 104g shipped. Each is
built from today's `text` role and `fonts` face, so every site draws today's type, and **nothing moves**. `Text.tsx`
doesn't change: **no new variant is needed** (Open question 2). After this part, React Native's `Text` and the role
spreads are left only in the listed exceptions (AC → evidence, AC2).

**Size: 220 changed lines (123 added, 97 removed) in 8 files, so one PR in two slices.** I moved all 50 sites in a
scratch copy of the app outside the repo. Then I ran the repo's Prettier, `tsc` and ESLint (`--max-warnings 0`) on
it, and all three came back clean. No StyleSheet keys are left unused. The 104f outline estimated 220.

Alternative considered: three slices, one per screen group (account screens, forms, login), as 104g did. The
login-only slice would be 33 lines, and every extra slice costs another after set that needs the three users signed
in. The two slices below group by user: slice 1 needs only the owner, and slice 2 needs all three users.

## Inventory (measured on Base)

There are 50 `<Text>` elements in the 8 files (`rg -c "<Text\b"`): Settings 7, Members 16, actual End 3, Remove
category 3, the expense form 9, the income item 3, login 7 and no-ledger 2. Every one of them goes through `Text`,
with no exceptions.

| Variant          | Sites | Colours                                                                             |
| ---------------- | ----- | ----------------------------------------------------------------------------------- |
| `label`          | 15    | over 12 (every `alert` line), muted 3 (login's two field labels and its price line) |
| `labelRegular`   | 11    | muted 9 (Members' captions and role, actual End's and income's captions), text 2    |
| `labelSemi`      | 5     | muted 5 (the forms' field labels)                                                   |
| `bodyMedium`     | 4     | text 4 (Settings' Members row, Members' two name rows, the expense's locked note)   |
| `bodyStrong`     | 4     | text 2 (Settings' username, the confirm question), accent 2 (login's two links)     |
| `caption`        | 4     | muted 4 (Settings' three section captions; the expense's rate line, `tabular`)      |
| `display`        | 3     | text 3 (Members' and no-ledger's titles, login's "Kopiyka")                         |
| `body`           | 2     | text 1 (Remove category's warning), muted 1 (no-ledger's "Signed in as …")          |
| `title`          | 1     | text (Remove category's question)                                                   |
| `headingDisplay` | 1     | accent (Settings' initial)                                                          |

- **One site adds `tabular`**: the expense form's NBU rate line (caption, today's `fontVariant`). With 104f's 3 and
  104g's 15, that makes the 19 sites the 104f inventory counted.
- **No state switches here** (Open question 3). No `<Text>` in these files changes its style on a state:
  - Each error line is always `over`. It's either shown or not.
  - Busy and disabled looks are drawn by `Button` (104b, 104c, 104f).
  - The selected ledger is LedgerPicker's, which 104f moved.
- **Kept as decided at 104f's Gate A:** login's two field labels stay `label` in its own medium face. The other
  forms use `labelSemi`. The TextInput styles aren't touched.
- **Nothing else is a one-off.** The two remaining `style`s are layout: the expense's added note (`flex: 1`) and
  login's price line (`textAlign: 'center'`).

## Contracts

- DB / API / DTOs / `theme.ts` / `Text.tsx`: none. No new token, and no new variant.
- **Sites, measured on Base.** Before: role · face · colour · extras. After: the `Text` props. Line numbers are
  Base's. `labelRegular` is label in the regular face, `labelSemi` is label in the semibold face, `bodyMedium` is body
  in the medium face and `headingDisplay` is heading in the display face, as 104f named them. Each site's other props
  (`accessibilityRole`, `numberOfLines`) stay where they are. The `Text` props take the place of `style=`, as 104f's
  alert lines do (`accessibilityRole="alert" variant="label" color="over"`).

  | File · line                     | Site                                                                       | Before                              | After                                                             |
  | ------------------------------- | -------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
  | Settings 53                     | avatar initial                                                             | heading · display · accent          | `headingDisplay accent`                                           |
  | Settings 56, 73, 92             | "Signed in as"; "Ledger" (2+ ledgers); "Appearance"                        | caption · muted                     | `caption muted`                                                   |
  | Settings 57                     | username (`numberOfLines={1}`)                                             | bodyStrong · text                   | `bodyStrong`                                                      |
  | Settings 76                     | switch failure (`alert`, 2+ ledgers)                                       | label · over                        | `label over`, role kept                                           |
  | Settings 88                     | "Members" row                                                              | body · medium · text                | `bodyMedium`                                                      |
  | Members 38                      | "Members" (`header`)                                                       | display · text                      | `display`, role kept                                              |
  | Members 42                      | ledger caption                                                             | label · regular · muted             | `labelRegular muted`                                              |
  | Members 101, 113, 277, 347, 360 | "Your label", its hint, "Invited", "Invite by username", "They’ll see it…" | label · regular · muted             | `labelRegular muted`                                              |
  | Members 115, 303, 362, 471      | label, revoke, invite and panel failures (`alert`)                         | label · over                        | `label over`, role kept                                           |
  | Members 284, 385                | invitee name; member name (`numberOfLines={1}`)                            | body · medium · text                | `bodyMedium`                                                      |
  | Members 388                     | "Owner · you" / "Member"                                                   | label · regular · muted             | `labelRegular muted`                                              |
  | Members 468                     | confirm question                                                           | bodyStrong · text                   | `bodyStrong`                                                      |
  | Members 469                     | confirm detail (Leave only)                                                | label · regular · text              | `labelRegular`                                                    |
  | actual-end 135                  | "November started at …" caption                                            | label · regular · muted             | `labelRegular muted`                                              |
  | actual-end 141                  | "Actual end in EUR"                                                        | label · semibold · muted            | `labelSemi muted`                                                 |
  | actual-end 163                  | error (`alert`)                                                            | label · over                        | `label over`, role kept                                           |
  | delete-category 125             | question (`header`)                                                        | title · text                        | `title`, role kept                                                |
  | delete-category 128             | warning                                                                    | body · text                         | `body`                                                            |
  | delete-category 131             | error (`alert`)                                                            | label · over                        | `label over`, role kept                                           |
  | expense 278                     | locked note (ended month)                                                  | body · medium · text                | `bodyMedium`                                                      |
  | expense 281, 286, 317           | "Date", "Category", "What was it?"                                         | label · semibold · muted            | `labelSemi muted`                                                 |
  | expense 288, 301, 343           | no-budget, not-in-month and save errors (`alert`)                          | label · over                        | `label over`, role kept                                           |
  | expense 339                     | NBU rate line                                                              | caption · muted · tabular           | `caption muted tabular`                                           |
  | expense 369                     | "Added “…” to …" note                                                      | label · regular · text · flex 1     | `labelRegular`, `style={styles.addedText}` (`{ flex: 1 }`)        |
  | income-item 210                 | "Income for November"                                                      | label · regular · muted             | `labelRegular muted`                                              |
  | income-item 213                 | "Title"                                                                    | label · semibold · muted            | `labelSemi muted`                                                 |
  | income-item 236                 | error (`alert`)                                                            | label · over                        | `label over`, role kept                                           |
  | login 48                        | "Kopiyka"                                                                  | display · text                      | `display`                                                         |
  | login 52, 67                    | "Username", "Password"                                                     | label (its own medium face) · muted | `label muted` (kept, 104f Gate A)                                 |
  | login 84                        | error (`alert`)                                                            | label · over                        | `label over`, role kept                                           |
  | login 102, 113                  | "Try it now", "Request access" (in `Link asChild` › `Pressable`)           | bodyStrong · accent                 | `bodyStrong accent`                                               |
  | login 116                       | "Full access: €5 a month" (web only)                                       | label · muted · centred             | `label muted`, `style={styles.price}` (`{ textAlign: 'center' }`) |
  | no-ledger 25                    | "You’re not in any ledger" (`header`)                                      | display · text                      | `display`, role kept                                              |
  | no-ledger 28                    | "Signed in as …"                                                           | body · muted                        | `body muted`                                                      |

- **Caller clean-up.** Lint doesn't catch unused StyleSheet keys, and the draft leaves none.
  - **Styles that go:**
    - Settings: `initial`, `caption`, `username`, `error`, `membersText`.
    - Members: `title`, `caption`, `name`, `role`, `question`, `detail`, `failure`.
    - actual-end: `caption`, `label`, `error`.
    - delete-category: `question`, `warning`, `error`.
    - expense: `label`, `small`, `locked`, `error`.
    - income-item: `caption`, `label`, `error`.
    - login: `title`, `label`, `error`, `demoLinkText`.
    - no-ledger: `title`, `text`.
  - **Styles cut down to layout:** expense `addedText` becomes `{ flex: 1 }`, and login `price` becomes
    `{ textAlign: 'center' }`.
  - **TextInput styles stay as they are** (exceptions): `input` in Members, actual-end, income-item, expense and
    login, and login's `passwordInput`.
  - **`react-native` imports:** `Text` leaves each one. In expense.tsx, where the import spans several lines, only the
    `  Text,` line goes.
  - **The new import:** `import { Text } from '@/components/Text';` goes after the last `@/components/*` import that
    sorts before it:
    - after `Pressable` in Settings and login
    - after `ScreenHeader` in Members, actual-end, delete-category and income-item
    - after `TabBar` in expense
    - after `PendingInvites` in no-ledger
  - **`@/theme` imports:**
    - Settings drops `fonts` and `text`.
    - actual-end, expense and income-item drop `fonts`.
    - delete-category and no-ledger drop `text`.
    - Members and login keep both, for their inputs.
  - **`useColors`** stays in every file that has it today, for icons, spinners and placeholders.
- **Demo:** the demo build re-exports actual-end, delete-category, expense and income-item, and already holds
  `src/components/Text.tsx` (104f). So `demo-modules.txt` doesn't change, and `yarn mobile check-builds` passes
  without `--accept`. Settings, Members, login and no-ledger aren't in the demo.
- Reuses: 104f's `Text` and its variants, and the 104–104g snapshot method (Visual check). There's no new helper.
- New dependencies: none.

## Version

Bump: patch — 1.23.10 → 1.23.11
Why: §8b `patch`. This is a behaviour-preserving refactor of shipped app code, with the same type, colours, roles
and labels. There's no new capability, and no API, schema or connector change.

## Slices

The orchestrator takes the **before** set (Visual check) before slice 1. The line counts come from the scratch draft.
Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped. Export
`DATABASE_URL_TEST` from the main checkout's `.env` in this worktree, or the API integration tests skip. No unit tests
are added:

- no pure logic changes
- `Text` imports `react-native`, which the app's Node tests can't load (conventions §6)

- [ ] 0. Bump version to 1.23.11
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.11
- [ ] 1. Draw Settings' and the form screens' text with Text (~118 lines)
  - Files (under `apps/mobile`): `src/app/(tabs)/settings.tsx` (32), `src/app/actual-end.tsx` (16),
    `src/app/delete-category.tsx` (14), `src/app/expense.tsx` (38), `src/app/income-item.tsx` (18)
  - Change: their rows in the Contracts table, and the clean-up. The expense's added note keeps `flex: 1` as its style.
  - Verify: gates. Compare the owner's views (Visual check, step 1), both schemes.
- [ ] 2. Draw Members', login's and no-ledger's text with Text (~102 lines)
  - Files (under `apps/mobile`): `src/app/members.tsx` (56), `src/app/login.tsx` (33), `src/app/no-ledger.tsx` (13)
  - Change: their rows in the table, and the clean-up. Login's price keeps `textAlign: 'center'` as its style.
  - Verify:
    - gates
    - the AC1 and AC2 searches (AC → evidence)
    - every view of the set in both schemes, with the owner's views compared again on the final code
    - none skipped, `members-member-confirm` included: no test catches a wrong variant, and that view is the only
      place Members' `detail` line is drawn
    - the demo check and `check-builds`

## What moves (the PR lists this)

- **Expected: nothing.** Every view in both schemes should match in every row, type columns included, with the same
  accessibility record. A difference is a bug in the slice that caused it, and gets fixed rather than listed.
- **Not caught by the snapshots, and listed:**
  - Each site's style is now an array (variant, tabular, colour, layout) instead of one object. The flattened values
    are the same.
  - Settings' "Ledger" caption and switch failure, Members' revoke and invite failures, and the expense's locked note
    and no-budget alert aren't in any view (Checked from the code only).

## Visual check (AC4–AC6; not counted in the line estimates)

**Set-up.**

- Run the API (`api`, port 3000), the web app on port 8084 (`yarn mobile expo start --web --port 8084`) and
  `web-demo` (8082) from this worktree, with the two git-ignored `.env` files copied in. Open the web app at
  `http://127.0.0.1:8084`, which is the origin the API's CORS list allows (`localhost:8084` is refused). Check that
  `git status` is clean before the before set.
- **Same day, before 1 December (Kyiv).** Take both sets on the same Kyiv day, well before midnight. The expense form
  shows today's date and that day's NBU rate line, and the actual End caption names November.
  - From 1 December, November has ended: the forms lock, and Remove, Save and Delete disappear.
  - If the day changes between the sets, take both sets again on that day, with the same view names.
- **Three QA users**, created by the orchestrator before the before set and deleted when the brief is done (members
  first), as 104c did:
  - **Owner:** `yarn api create-user --username claude-qa-104h --email …`. Its ledger gets the default November list.
  - **Member:** `claude-qa-104h-m`, made with `--join claude-qa-104h`.
  - **No ledger:** `claude-qa-104h-n`, made with `--join claude-qa-104h`, then removed by the owner with
    `DELETE /api/ledgers/<id>/members/<its userId>` (the id comes from `GET /api/ledgers/<id>/members`). The CLI has no
    flag for a user without a ledger.
- **Seed through the API as the owner** (signed in from the page, credentials included), once, before the before set.
  First check that `GET …/expenses?month=2026-11` returns no expenses and `GET …/months/2026-11/income` no items, so
  nothing is doubled. The expense and income POSTs aren't idempotent; the actual End PUT is an upsert.
  - `GET /api/ledgers` gives the ledger id. From `GET /api/ledgers/<id>/categories?month=2026-11`, note
    `categories[0]` as **C**.
  - Income: `POST /api/ledgers/<id>/months/2026-11/income` with `{ title: 'Salary', amount: '1000.00' }`. Note its
    `incomeId` as **I**.
  - One expense in C: `POST /api/ledgers/<id>/expenses` with
    `{ categoryId: C, expenseDate: '2026-11-03', name: 'qa', amount: '12.50', currency: 'EUR' }`. Remove category's
    warning then names one expense.
  - Actual End: `PUT /api/ledgers/<id>/months/2026-11/balance/actual-end` with `{ amount: '900.00' }`, so the form
    shows Use calculated end.
- **The invite.** Invites expire after an hour, and `no-ledger`'s Decline removes it, so each set makes its own. As
  the owner, `POST /api/ledgers/<id>/invites` with `{ username: 'claude-qa-104h-n' }`, just before `members-owner`. If
  one is still live, the API refuses a second (`409 cannot_invite`), and the views look the same.
- TOTP codes come from a scratch script outside the repo, and the secret is never printed. Wait for a fresh 30 s
  window between sign-ins, and don't guess: wrong codes count against the limit (5 in 24 hours).
- Another session may share the MySQL test database. If the integration tests fail in the schema reset, wait until
  the other run is idle and run them again. Never commit after a failed `yarn test`.

**Snapshot script.** The exact script 104f and 104g ran (the 104f plan only listed its columns; it is written out
here so the next brief can copy it). It differs from the planner's first draft of this plan
only in column order (`zIndex` before colour), `cmp` reporting the snapshot's own width, and 104e's `__scrollSrc`:

- **Each row** records:
  - the element's tag and box
  - background, top border (width, style, colour), radius, padding and opacity
  - `zIndex`, colour and stroke
  - font family, size, line height, tracking, `fontVariantNumeric`, weight and alignment
  - a leaf's first 24 characters
- **Infinite animations** (spinners) are paused at frame 0 first.
- **The accessibility record** holds `role`, `aria-label`, `aria-busy`, `aria-disabled`, `aria-selected` and
  `aria-expanded`.
- **`cmp`** also returns the width (it must be 390), `a11yAdded` and `a11yRemoved`.
- **Keys:** `snap:before:104h:<view>:<scheme>` and `snap:after:104h:*`.

```js
localStorage.setItem(
  '__snapSrc',
  `(key) => { for (const a of document.getAnimations()) if (a.effect && a.effect.getTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; } const rows = []; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue; const s = getComputedStyle(el); const own = el.childElementCount === 0 ? (el.textContent || '').trim().slice(0, 24) : ''; rows.push([el.tagName, Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2, s.backgroundColor, s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, s.borderTopLeftRadius, s.padding, s.opacity, s.zIndex, s.color, el.getAttribute('stroke') || s.stroke, s.fontFamily, s.fontSize, s.lineHeight, s.letterSpacing, s.fontVariantNumeric, s.fontWeight, s.textAlign, own].join('|')); } const a11y = [...document.querySelectorAll('[role],[aria-label],[aria-busy],[aria-disabled],[aria-selected],[aria-expanded]')].map((e) => ['role', 'aria-label', 'aria-busy', 'aria-disabled', 'aria-selected', 'aria-expanded'].map((n) => e.getAttribute(n)).join('|')); localStorage.setItem(key, JSON.stringify({ rows, a11y })); return [key, rows.length, a11y.length, innerWidth, innerHeight]; }`,
);
localStorage.setItem(
  '__cmpSrc',
  `(view, scheme) => { const before = JSON.parse(localStorage.getItem('snap:before:104h:' + view + ':' + scheme)); const afterKey = 'snap:after:104h:' + view + ':' + scheme; const shot = eval(localStorage.__snapSrc)(afterKey); const after = JSON.parse(localStorage.getItem(afterKey)); const diffs = []; for (let i = 0; i < Math.max(before.rows.length, after.rows.length); i++) if (before.rows[i] !== after.rows[i]) diffs.push(i + ': ' + before.rows[i] + '  =>  ' + after.rows[i]); const minus = (a, b) => { const left = [...b]; return a.filter((x) => { const i = left.indexOf(x); if (i === -1) return true; left.splice(i, 1); return false; }); }; return { view, scheme, width: shot[3], rows: [before.rows.length, after.rows.length], diffs: diffs.length, first: diffs.slice(0, 4), a11ySame: JSON.stringify(before.a11y) === JSON.stringify(after.a11y), a11yAdded: minus(after.a11y, before.a11y), a11yRemoved: minus(before.a11y, after.a11y) }; }`,
);
localStorage.setItem(
  '__scrollSrc',
  `() => { const el = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); if (!el) return null; el.scrollTop = 400; el.dispatchEvent(new Event('scroll')); return el.scrollTop; }`,
);
```

Install it on the app's origin. The demo needs no snapshots in this part (AC6 is a console check).

**How to take each view:**

- Use 390×844, Light then Dark (`localStorage.setItem('kopiyka.theme', 'light')` or `'dark'`, then reload).
- Navigate, wait about 2 s, check that nothing is scrolled, then snapshot with
  `eval(localStorage.__snapSrc)('snap:before:104h:<view>:<scheme>')`.
- A view with an interaction (a panel, an error) repeats it after each scheme's reload.
- Don't click in the Browser pane while sets are compared, and check `innerWidth === 390` in every result.

**Views, in this order, the same in both sets:**

1. **Owner** (signed in as `claude-qa-104h`):

   | View                    | Where / how                                                                                                                                                                                                                                                | Shows (this part's text)                                                          |
   | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
   | `settings`              | `/settings`                                                                                                                                                                                                                                                | initial, "Signed in as", username, "Members", "Appearance"                        |
   | `actual-end`            | `/actual-end?month=2026-11`. Don't save                                                                                                                                                                                                                    | caption, field label (with Use calculated end below)                              |
   | `actual-end-error`      | On `actual-end`, click the field, select all, type `abc`, press Save (nothing is sent). Reload afterwards                                                                                                                                                  | "Enter an amount in euros, …" (`alert`)                                           |
   | `delete-category`       | `/delete-category?categoryId=C&month=2026-11`. Don't press Remove                                                                                                                                                                                          | question (`header`), warning                                                      |
   | `delete-category-error` | On `delete-category`, `window.fetch = () => Promise.reject(new TypeError('offline'))`, then press Remove (nothing reaches the API). Reload afterwards                                                                                                      | "Couldn’t remove. …" (`alert`)                                                    |
   | `expense-new`           | `/expense`                                                                                                                                                                                                                                                 | "Date", "Category", "What was it?", the NBU rate line (`tabular`)                 |
   | `expense-error`         | On `expense-new`, press Add with the fields empty (nothing is sent). Reload afterwards                                                                                                                                                                     | "Add a name and an amount first." (`alert`)                                       |
   | `expense-not-in-month`  | `/expense?categoryId=999999`                                                                                                                                                                                                                               | "That category isn’t in November." (`alert`, under the picker)                    |
   | `income-item-add`       | `/income-item?month=2026-11`                                                                                                                                                                                                                               | "Income for November", "Title"                                                    |
   | `income-item-error`     | On `income-item-add`, press Save with the fields empty (nothing is sent). Reload afterwards                                                                                                                                                                | "A title needs 1 to 40 characters." (`alert`)                                     |
   | `income-item-edit`      | `/income-item?month=2026-11&incomeId=I`. Don't press anything                                                                                                                                                                                              | the same, filled, with Delete item                                                |
   | `category-form-add`     | `/category-form?month=2026-11` (control: no code changes here; Open question 4)                                                                                                                                                                            | CategoryForm's text (104f)                                                        |
   | `category-form-error`   | On `category-form-add`, press Save with the fields empty (nothing is sent). Reload afterwards                                                                                                                                                              | CategoryForm's error (104f)                                                       |
   | `members-owner`         | Make the invite (Set-up), then `/members`                                                                                                                                                                                                                  | title (`header`), captions, the two member rows with roles, "Invited" and n's row |
   | `members-confirm`       | On `members-owner`, press Remove on `claude-qa-104h-m`. Don't press the panel's Remove. Reload afterwards                                                                                                                                                  | the panel's question                                                              |
   | `members-label-error`   | On `members-owner`, type 41 letters in Your label, press Save (nothing is sent). Reload afterwards                                                                                                                                                         | "A label can have up to 40 characters." (`alert`)                                 |
   | `expense-added`         | Last owner view. On `/expense`, type `qa-added` as the name and `1.00` in the € field, then press Add. Snapshot with the note shown. Then soft-delete that expense with `DELETE /api/ledgers/<id>/expenses/<its id>` (from `GET …/expenses?month=2026-11`) | "Added “qa-added” to … · €1.00 · …" (`labelRegular`, `flex: 1`)                   |

   Then sign out with `POST /api/auth/logout` (credentials included).

2. **Signed out:**

   | View          | Where / how                                                                                                                                                                                       | Shows                                                 |
   | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
   | `login`       | `/login`, after the reload                                                                                                                                                                        | "Kopiyka", the two labels, both links, the price line |
   | `login-error` | On `login`, type `claude-qa-104h` and `000000`, run `window.fetch = () => Promise.reject(new TypeError('offline'))`, then press Sign in. Nothing is sent, so no attempt counts. Reload afterwards | "Can’t reach the server. …" (`alert`)                 |

3. **No ledger** (signed in as `claude-qa-104h-n`, within the invite's hour). Take **both schemes of
   `no-ledger-invite` first**, then press Decline:

   | View               | Where / how                      | Shows                                                         |
   | ------------------ | -------------------------------- | ------------------------------------------------------------- |
   | `no-ledger-invite` | `/`. Don't press anything        | title (`header`), "Signed in as …", PendingInvites' invite    |
   | `no-ledger`        | `/`, after Decline, both schemes | the same text without the invite, Check for invites, Sign out |

   Then sign out.

4. **Member** (signed in as `claude-qa-104h-m`):

   | View                     | Where / how                                                                               | Shows                                                       |
   | ------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
   | `members-member`         | `/members`                                                                                | title, captions, Your label, Leave ledger                   |
   | `members-member-confirm` | On `members-member`, press Leave ledger. Don't press the panel's Leave. Reload afterwards | the Leave panel's question and detail (`labelRegular` text) |

   Then sign out.

- If a held or error view doesn't show its line, reload and repeat before comparing.
- **After set:**
  - After slice 1: the owner's 17 views in both schemes.
  - After slice 2: all 23 views in both schemes, the owner's again on the final code.
  - Before each after set, check `GET …/expenses?month=2026-11` still returns exactly the one `qa` expense (each
    scheme's added expense is deleted straight after its snapshot), and that the owner's invite is still inside its
    hour before `no-ledger-invite`.
  - Compare with `eval(localStorage.__cmpSrc)('<view>', '<scheme>')`.
  - Expected on every view: `diffs: 0`, `a11ySame: true`, empty `a11yAdded` and `a11yRemoved`, `width: 390`.
  - Screenshots go in the PR, not the repo.

**Checked from the code only** (listed as such in the PR):

- **Settings' "Ledger" caption and switch failure.** They show only with two ledgers. They have the same props as
  "Appearance" and the other alert lines.
- **Members' revoke and invite failures.** They're the same `label over` alert as `members-label-error`.
- **The expense's locked note and no-budget alert.**
  - An ended month's expense can't be seeded through the API, and no reachable date has a month without a list.
  - They're `bodyMedium`, and the same `label over` alert as `expense-not-in-month`.
- **Busy states.** No text of these files changes while saving: Button draws the spinner (104b).

**Demo (AC6):** `web-demo` (8082), Light and Dark, with the console open. Check these screens; there should be no
errors:

- actual End, from Budget's Start → End line
- Remove category, from a category form
- the expense form, new and edit
- the income item, add and edit

`yarn mobile check-builds` (no `--accept`) passes on the last commit, after `yarn mobile export:web`.

**Gate B, iPhone (Expo Go):** in both themes:

- Settings
- Members as owner, with its confirm panel open
- the expense form
- login

## AC → evidence

| AC                                                                                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 every `<Text>` in the 8 files through `Text`; no role spread or `fontFamily` outside a TextInput style | Slices 1–2. After slice 2, over the 8 files: `rg -c "<Text\b"` still counts 50, and each file imports `Text` from `@/components/Text`; `rg -U -n "import \{[^}]*\bText\b[^}]*\} from 'react-native'"` finds nothing; `rg -n "\.\.\.text\."` finds only the `input` styles of Members, actual-end, income-item, expense and login; `rg -n fontFamily` finds only Members' and login's `input` and login's `passwordInput` (searched on the draft)                                                                                                                                                                                                                                                                                                  |
| AC2 the final search over `apps/mobile/src` finds only `Text.tsx`, `theme.ts` and the exceptions           | From `apps/mobile`, after slice 2 (checked on the draft). (1) `rg -n "\.\.\.text\." src --glob '!src/theme.ts' --glob '!src/components/Text.tsx'` gives 8 lines: the 5 screen `input` styles above, plus DateField's value (`text`), AmountFields' and CategoryForm's `input`. (2) `rg -n fontFamily src --glob '!src/theme.ts' --glob '!src/components/Text.tsx'` gives 7 lines: Members' and login's `input`, login's `passwordInput`, DateField's value, AmountFields' and CategoryForm's `input`, CategoryTile's letter. (3) `rg -U -n "import \{[^}]*\bText\b[^}]*\} from 'react-native'" src` gives 4 lines: CategoryTile, DateField, TabBar, and `Text.tsx` (`Text as NativeText`). TabBar's badge appears only in (3): it spreads no role |
| AC3 `Text.tsx` adds no token; any new variant from an existing role and face                               | No variant is added. `git diff origin/main -- apps/mobile/src/components/Text.tsx apps/mobile/src/theme.ts` is empty                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| AC4 before/after snapshots at 390×844, light and dark, of the listed views; nothing moves                  | Visual check: 23 views × Light and Dark. The brief's list maps to them like this: Settings; Members as owner with an invite (`members-owner`), with its confirm panel (`members-confirm`) and as a member (`members-member`); the 5 forms idle and with an error (actual End, Remove category, expense, income item, category form); login and its error line; no-ledger with an invite and without. Expected `diffs: 0` with the type columns; any shift is listed in the PR for approval                                                                                                                                                                                                                                                        |
| AC5 roles and labels unchanged                                                                             | `a11ySame: true` and empty `a11yAdded`/`a11yRemoved` on every view. That covers the `header` titles (`members-*`, `delete-category`, `no-ledger*`), every `alert` line in the error views, login's two `link`s and the member rows' combined labels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AC6 the demo renders the touched screens with no console errors; `check-builds` passes                     | After slice 2: the four demo form screens in both themes with a clean console; `check-builds` passes without `--accept` (no module list change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| AC7 gates                                                                                                  | Every slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Not doing (YAGNI)

- **105's look**: Inter, new sizes, tracking and colours. **The two weight inconsistencies** stay as they are (104f's
  Gate A): login's medium labels, and the regular-weight inputs.
- **TextInput styles** (login's password input included) and **TabBar**, which belong to briefs 105 and 106.
- **A lint guard** against role spreads and `fontFamily`, and a conventions §5 line pointing at the 104 components.
  Both are proposals for after this part (Follow-ups), not slices.
- **Seeding a second ledger** for Settings' Ledger section, or an ended month's expense for the locked note.
- **Busy views.** No text in these files changes while saving (Open question 5).
- **Docs.** `docs/design/design-system.md`'s `Text` row stays true. The BACKLOG row belongs to the orchestrator.

## Risks

- **A computed type value changes where no box moves** (a face lost in the move). The type columns catch it, starting
  with slice 1's owner views.
- **Login's links change** inside `Link asChild` › `Pressable`. They shouldn't, since `Text` still renders React
  Native's `Text` under the same Pressable. Slice 2's `login` rows and the `link` entries in its record show it.
- **The invite expires or is declined before its view.** Make it just before `members-owner`. In `no-ledger-invite`,
  take both schemes before pressing Decline. If it's gone, invite again and retake the view.
- **`expense-added` changes the data** for the views after it. It's the last owner view, and each scheme's expense is
  soft-deleted straight after its snapshot.
- **The day changes, or November ends, between the sets.** Covered in Set-up.
- **Main moves.** Rebase, take main's version and bump once more (§8b). If the move changes a snapshotted view, take a
  fresh baseline of it from main's copy.

## Open questions

1. **Blocking: yes (Gate A). One PR, or split?** (brief open question 1)
   - Recommended: **one PR** in two slices. The scratch draft measures 220 lines, under the 400 limit, and the same
     as the 104f outline.
   - Assumed: one PR.
2. **Blocking: yes (Gate A). A new variant?** (brief open question 2)
   - Recommended: **none.** The existing variants cover all 50 sites (Inventory):
     - Settings' initial is `headingDisplay`.
     - The forms' labels are `labelSemi`, and the captions are `labelRegular`.
     - Login's labels and price line are `label`, in its own medium face.
     - The only extras are `tabular` on the rate line, `flex: 1` on the added note and `textAlign: 'center'` on
       the price line.
   - Assumed: none; `Text.tsx` is unchanged.
3. **Blocking: no. Correction to the brief: there are no state switches in this part.**
   - The brief lists error lines, busy or disabled text and the selected ledger.
   - In these files each error line is always `over`, and it's shown or not.
   - Busy and disabled looks are `Button`'s, and the selected ledger is LedgerPicker's (104f).
   - Assumed: every site takes fixed props.
4. **Blocking: no. "The 5 forms".** Four of the brief's files are forms: actual End, Remove category, expense and the
   income item. The fifth modal form, `app/category-form.tsx`, has no `<Text>` of its own; its text is CategoryForm's,
   which 104f moved.
   - Assumed: `category-form-add` and `category-form-error` are taken as control views. They can't change, since
     neither the screen nor `Text.tsx` changes.
5. **Blocking: no. "While saving where that changes text".** No `<Text>` in these files changes while a save is in
   flight. Only Button swaps its label for a spinner.
   - Assumed: no busy views. `expense-added` is added instead, for the note that appears after a save.
6. **Blocking: no. Views beyond the brief's list:** `members-label-error`, `members-member-confirm` (the only place the
   Leave panel's detail shows), `expense-not-in-month` and `income-item-edit`. Each one is a URL or a single press,
   and nothing is written. Assumed: added.
7. **Blocking: no. The snapshot script.** The 104f plan only lists its columns. The exact script 104f and 104g ran is
   now written out under Visual check (replaced at Gate A by the orchestrator, who still had it).

## Gate A (2026-11-26)

Approved by the user as recommended: one PR in two slices; no new variant (`Text.tsx` unchanged); the non-blocking
assumptions stand (no state switches; `category-form` as control views; no busy views, `expense-added` instead; the
four extra views). The snapshot script under Visual check is now the exact one 104f and 104g ran. Both sets are taken
before 1 December (Kyiv).

## Follow-ups

- **A lint guard**, proposed at 104f: `no-restricted-syntax` on `...text.*` spreads and `fontFamily` outside
  `Text.tsx` and `theme.ts`, with the exceptions allowlisted. After this part AC2 holds, so the guard could keep it
  true for new code.
- **Conventions §5** could say that text goes through `Text`, and point new code at the 104 components (104f's
  Follow-ups).

## Deviations

## Consolidate
