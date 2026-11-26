# Plan: The fresh look, part 2: Inter and the type mapping

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Gate A: skeptic APPROVE WITH EDITS (applied); approved 2026-11-26 under the user's standing OK, open questions as assumed.
Brief: ./brief.md
Branch: feat/inter-type
Base: origin/main (1e6f6f5, version 1.23.12)

## Approach

All the role and site moves land first, while the app is still drawn in Bricolage Grotesque and IBM Plex Sans (slices
1–5). Then one slice changes only the faces, to Inter (slice 6). Splitting it this way lets the visual check tell
layout moves from text-metric moves:

- **Base → slice 5** is a like-for-like box comparison: only the listed sites may differ.
- **Slice 5 → slice 6** has one cause, the new font. Every element, tag, text, colour, size, line height and tracking
  must match. Only the boxes and the font family can change (Visual check).

The pieces:

- **Faces.** `fonts` becomes four Inter faces named by weight (`regular`, `medium`, `semiBold`, `extraBold`). Each
  `text` role takes its weight from the doc's table, and `Text.tsx`'s pairs keep their weights in Inter. AppShell
  loads the four faces and registers them under the names in `fonts`, so the two can't drift apart. Each face is
  imported from its own subpath, as the package's README does: the package index `require`s all 18 TTFs (6.2 MB),
  and every build would ship them.
- **Sites.** The weight fixes, the two trackings, the `headingDisplay` sites and the digit-free `tabular` flags move
  as in the Inventory. DateField's hidden web input gets `text.input.fontSize`.
- **Docs.** The design doc's `Text` row names the pairs, and the backlog records 105 part 1 as done.

Alternative considered: one commit that swaps the font and moves the sites together, as the outline reads. It's the
same diff and one commit fewer. But then every box moves for two reasons at once, and the check can't show which
moves came from layout. A bolt-on check doesn't apply here: nothing gains a flag or a branch.

## Inventory (measured on Base)

**`headingDisplay`**: 10 sites, all `heading` (17/22) in Bricolage 700 today. In Inter, `heading` is 600, and the pair
goes (brief open question 1).

| Site                                                                                                         | What it is                   | → role (recommended)                                                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------- |
| `ScreenHeader.tsx` modal title (5 screens: expense, delete-category, actual-end, income-item, category-form) | form title                   | **`title`** (doc: "sheet title"; the doc's `ScreenHeader` row says `title`) |
| `CategorySheet.tsx` "All categories"                                                                         | sheet title                  | **`title`**                                                                 |
| `budget.tsx:202`, `expenses.tsx:102` "Categories"                                                            | section heads                | `heading`                                                                   |
| `income.tsx:140` "Income"                                                                                    | section head                 | `heading`                                                                   |
| `income.tsx:143` the month's total                                                                           | figure beside the head (107) | `heading` + `tabular` (stays as big as the head)                            |
| `statistics.tsx:108`, `:144` "By category", "By month"                                                       | section heads                | `heading`                                                                   |
| `CollapsingSummary.tsx:72` the collapsed total                                                               | figure in a compact header   | `heading` + `tabular`                                                       |
| `settings.tsx:54` the account initial                                                                        | letter in a 40pt avatar      | `heading` (no doc role; its size stays)                                     |

- Measured in Inter 800 at 22pt with −0.8 tracking: the widest title, "Remove category", is 180pt. The modal row has
  about 238pt between Back and the 52pt spacer.
- Both title rows are 44pt high (Back, and the sheet's close IconButton). So a 28pt line still fits, and nothing
  under them moves.

**`labelSemi`**: 11 sites. The brief says 10; 104f counted LedgerPicker's checked line as a state switch.

| Site                                                                                                                                                                                                  | Field label? | →                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------- |
| `expense.tsx` Date, Category, What was it? (3); `AmountFields.tsx` "Amount in {currency}"; `income-item.tsx` Title; `actual-end.tsx` "Actual end in EUR"; `CategoryForm.tsx` Name, Planned amount (2) | yes (8)      | `label`                      |
| `category/[categoryId].tsx:154` the day label                                                                                                                                                         | no           | `caption` (slice 2)          |
| `DemoStrip.tsx` "Sign in" link; `LedgerPicker.tsx:51` checked owner line                                                                                                                              | no           | stay `labelSemi` (Inter 600) |

- Members' two field labels, "Your label" and "Invite by username", are `labelRegular` (400) and move to `label`
  (AC3 names Members). "Invited" heads a list, not a field, so it stays.
- Login's labels are `label` already.

**Inputs with the medium face** (`fontFamily: fonts.bodyMedium` over `...text.input`): AmountFields, CategoryForm
(name and planned amount share one style), Members (label and invite share one style), login (username; the code
field's `passwordInput` sets its own face), and DateField's value. The expense name, income title and actual End
inputs are `input` at 400 already.

**`tabular` on text with no digits**: 4 sites go.

- `budget.tsx:308`: IncomeFigures' "Income", "Budgeted", "Remaining".
- `category/[categoryId].tsx:136`: "Spent".
- `category/[categoryId].tsx:147`: "No expenses in {month}".
- `income.tsx:157`: "Added by {username}", a name rather than a figure.

The other 15 `tabular` texts hold amounts, counts or dates, and keep it.

**Text styled directly** (104h's searches, from `apps/mobile`):

- `fontFamily` overrides: 7 today, 4 after this plan. The ones left are login's `passwordInput`, CategoryTile's
  letter, TabBar's badge (new) and the tab layout's `tabBarBadgeStyle` (new).
- `...text.` spreads: 8, unchanged.
- React Native `Text` imports: 4, unchanged.
- `fontWeight`: 0, before and after.

**The font files**, measured from the packages:

- The five old faces are 0.84 MB; the four Inter faces are 1.37 MB.
- At the same size, Inter is about 6% wider than IBM Plex Sans. For example, "They’ll see it in the app for an hour."
  measures 228.6pt in Plex and 243.0pt in Inter, at 15pt with −0.2 tracking.
- 16px with no line height (`input`) is 20.8pt tall in Plex Medium and 19.4pt in Inter Regular.

## Contracts

- DB: none
- API: none
- App:
  - `theme.ts`: `fonts = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semiBold: 'Inter_600SemiBold',
extraBold: 'Inter_800ExtraBold' }`. The keys `display`, `displayMedium`, `body`, `bodyMedium` and `bodySemi` are
    gone, so typecheck finds any caller left behind. The `text` roles become `{ fontFamily, fontSize, lineHeight,
letterSpacing }`, using the doc's values and these faces:
    - `display`, `title`: `extraBold`
    - `heading`, `bodyStrong`: `semiBold`
    - `label`: `medium`
    - `body`, `caption`, `input`: `regular`

    `input` keeps no `lineHeight`. `amount` and `amountLg` are unchanged (they spread `bodyStrong` and `display`). No
    role has a `fontWeight`.

  - `Text.tsx`: `TextVariant` loses `headingDisplay`. `bodyMedium` = body + `medium`, `labelRegular` = label +
    `regular`, `labelSemi` = label + `semiBold`, `captionMedium` = caption + `medium`.
  - `AppShell`: `useFonts({ [fonts.regular]: Inter_400Regular, [fonts.medium]: Inter_500Medium, [fonts.semiBold]:
Inter_600SemiBold, [fonts.extraBold]: Inter_800ExtraBold })`. Each face is imported from
    `@expo-google-fonts/inter/<weight>` (for example `…/400Regular`). The pre-load view is unchanged.
  - Exceptions: CategoryTile's letter `fonts.extraBold`; login's `passwordInput` `fonts.extraBold`, 26pt and 8
    tracking. Both badges use `fonts.regular`, the weight `Badge.js` takes from `fonts.regular`: TabBar's badge, and
    the library bar's `tabBarBadgeStyle` in `(tabs)/_layout.tsx` (Open question 4).
  - DateField's hidden `<input type="date">` style gains `fontSize: text.input.fontSize` (16).
- Reuses: `text.input` for the hidden input's size; the existing `__snapSrc`, `__scrollSrc` and `__cmpSrc` (104h) for
  the Visual check.
- New dependencies: `@expo-google-fonts/inter` (MIT and OFL; 0.4.2, published 2025-09-11, so Yarn's 24-hour gate
  doesn't hold it), installed with `npx expo install @expo-google-fonts/inter` in `apps/mobile`. It's required by AC1,
  and nothing in the repo provides it. It's the same Expo-maintained family of packages as the two it replaces, with no
  native code. Removed: `@expo-google-fonts/bricolage-grotesque` and `@expo-google-fonts/ibm-plex-sans`. Size: the
  four faces the app loads are 1.37 MB, against 0.84 MB today (Risks).

## Version

Bump: patch — 1.23.12 → 1.23.13
Why: §8b `patch` ("styling, … dependency update"). Every change is a face, weight, size or tracking, plus one hidden
input's font size. Nothing new to do, nothing that works today stops working, and no API, data or connector change.

## Slices

- [x] 0. Bump version to 1.23.13
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.13
- [x] 1. Type every input at the input weight and every field label in label (≈ 34 lines)
  - Files: `apps/mobile/src/components/AmountFields.tsx`, `CategoryForm.tsx`, `DateField.tsx`;
    `apps/mobile/src/app/members.tsx`, `login.tsx`, `expense.tsx`, `income-item.tsx`, `actual-end.tsx`
  - Change: delete the 5 `fontFamily: fonts.bodyMedium` lines, and drop `fonts` from the four imports that no longer
    use it (login keeps it for `passwordInput`). The 8 field labels go from `labelSemi` to `label`, and Members' 2 from
    `labelRegular` to `label`.
  - Verify: `rg -n "fonts\.bodyMedium" apps/mobile/src` finds only `theme.ts` and `Text.tsx`.
    `rg -n -A1 'variant="labelSemi"' apps/mobile/src` finds only DemoStrip, LedgerPicker and the day label.
- [x] 2. Set MonthSwitcher's eyebrow and the category page's day labels in caption (≈ 12 lines)
  - Files: `apps/mobile/src/components/MonthSwitcher.tsx`, `apps/mobile/src/app/category/[categoryId].tsx`
  - Change: the eyebrow loses `style={styles.eyebrow}`, and the style goes with its comment and `eslint-disable`. The
    day label becomes `<Text variant="caption" color="muted">`, and the `dayLabel` style goes in the same way (the `dayLabel(d.date)` function stays).
  - Verify: `rg -n "letterSpacing" apps/mobile/src --glob '!**/src/theme.ts'` finds only login's `passwordInput`.
- [ ] 3. Stop setting tabular digits on captions with no digits (≈ 8 lines)
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`, `apps/mobile/src/app/(tabs)/income.tsx`,
    `apps/mobile/src/app/category/[categoryId].tsx`
  - Change: drop `tabular` from the 4 sites in the Inventory.
  - Verify: `rg -n -A2 "\btabular\b" apps/mobile/src` shows only texts with figures.
- [ ] 4. Give form and sheet titles the title role, and section heads heading (≈ 21 lines)
  - Files: `ScreenHeader.tsx`, `CategorySheet.tsx`, `CollapsingSummary.tsx` (in `apps/mobile/src/components/`);
    `budget.tsx`, `expenses.tsx`, `income.tsx`, `statistics.tsx`, `settings.tsx` (in `apps/mobile/src/app/(tabs)/`);
    `apps/mobile/src/components/Text.tsx`
  - Change: as the Inventory table (2 sites to `title`, 8 to `heading`), and the `headingDisplay` pair goes.
  - Verify: typecheck. `rg -n headingDisplay apps/mobile/src` finds nothing.
- [ ] 5. Size DateField's hidden web date input like a field, so iOS Safari doesn't zoom (≈ 3 lines)
  - Files: `apps/mobile/src/components/DateField.tsx`
  - Change: `fontSize: text.input.fontSize` in the hidden input's style. The comment above it says why (under 16px,
    iOS Safari zooms into a focused input; 103c's hand-off).
  - Verify: Visual check, `expense-new`: the hidden `INPUT` row's font size is `16px`, and its box is unchanged. Gate
    B, iOS Safari: focusing the date field doesn't zoom.
- [ ] 6. Draw the app in Inter (≈ 125 lines, excluding `yarn.lock`)
  - Files: `apps/mobile/package.json`, `yarn.lock`, `apps/mobile/demo-modules.txt`, `apps/mobile/src/theme.ts`,
    `apps/mobile/src/components/AppShell.tsx`, `Text.tsx`, `CategoryTile.tsx`, `TabBar.tsx`,
    `apps/mobile/src/app/login.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/test/theme.test.ts`
  - Change:
    - Run `npx expo install @expo-google-fonts/inter` (in `apps/mobile`), then
      `yarn workspace @kopiyka/mobile remove @expo-google-fonts/bricolage-grotesque @expo-google-fonts/ibm-plex-sans`.
    - Set `fonts`, the roles, the pairs, AppShell and the exceptions as in Contracts.
    - Update the comments that point at 105b: theme.ts's header, "the face carries the weight"; Text.tsx's
      role-and-weight pairs; login's code field.
    - Then run `yarn mobile export:web` and `yarn mobile check-builds --accept`. In `demo-modules.txt`, the two old
      packages leave and `@expo-google-fonts/inter` arrives; that diff is the review.
  - Tests: `theme.test.ts`, new `describe('text')`:
    - "sets each type role from the design system": an `it.each` over the doc's 8 rows plus `amount` and `amountLg`,
      each `[role, face, size, line, tracking, fontVariant?]` (`amount` and `amountLg` take `['tabular-nums']`), asserting `toEqual` on the whole style, which also proves there's no
      `fontWeight` key.
    - "has one Inter face per weight": `Object.values(fonts)` equals the four names.
  - Verify: `rg -n -i "bricolage|plex" apps/mobile/package.json apps/mobile/src apps/mobile/demo-modules.txt yarn.lock`
    finds nothing. `find apps/mobile/dist apps/mobile/dist-demo -name '*.ttf'` lists the four Inter faces. Any other
    font file is recorded in Deviations.
- [ ] 7. Name the Text pairs in the design system and mark 105 part 1 done in the backlog (≈ 20 lines, docs)
  - Files: `docs/design/design-system.md`, `docs/features/BACKLOG.md`
  - Change:
    - The doc's `Text` row names the four pairs and their weights: `bodyMedium` 500, `labelRegular` 400, `labelSemi`
      600, `captionMedium` 500. The Type section's first line says Inter replaced the old faces, in the past tense.
    - In the backlog, 105 part 1 moves to Recently finished (#173, v1.23.12). "In progress" becomes 105b on
      `feat/inter-type`, v1.23.13. The roll-out table's 105 and 105b rows follow, and the Snapshot line moves to
      1e6f6f5.

## What moves (the PR lists this)

**Base → slice 5** (the old faces):

- Field labels go from 600 to 500, and Members' two from 400 to 500. They fill their column, so no box moves.
- Inputs and DateField's value go from 500 to 400. The value's width changes; the field's box doesn't.
- The eyebrow loses its +0.5 tracking: it is narrower, and still centred.
- The day label goes from 13/18 at 600 with +0.5 tracking to `caption`, 12/16 at 400. Its row is baseline-aligned
  with the day's total (`labelRegular`, 18), so the row stays about the same height. Any shift is listed.
- `title` sites go from 17/22 to 22/28: the title box is 3pt higher and 6pt taller, and its 44pt row doesn't move.
  `heading` sites go from Bricolage 700 to Plex 600 at the same size: widths only.
- The 4 `tabular` flags go. Only "Added by claude-qa-105b" changes, since its digits become proportional.
- The hidden date input's font size goes from 13.33px to 16px, with its box unchanged.

**Slice 5 → slice 6** (Inter):

- Every text is about 6% wider. One-line texts that already fill their space (row names, `numberOfLines={1}`)
  truncate a little sooner, and texts near the edge of their width may wrap differently.
- Display, title and figures go from 700 to 800.
- Text with no line height is about 1.4pt shorter: the € and ₴ inside the amount fields, DateField's value and
  CategoryTile's letters.

## Visual check (AC7, AC8; not counted in the line estimates)

**Set-up.** As in 105's plan, Visual check, and its Deviations:

- **Servers:** the API (`api`, 3000), the web app on :8084 opened at `http://127.0.0.1:8084`, and `web-demo` (8082),
  with the two git-ignored `.env` files copied in. Use `innerWidth === 390` and a 390×844 viewport.
- **Install:** run `yarn install` in the worktree first; it has no `node_modules`.
- **Test database:** in a worktree, `DATABASE_URL_TEST` comes from the main checkout's `apps/api/.env`.
- **Three sets, all on one Kyiv day before 1 December.** After 30 November, seed `2026-12` and take all three on one
  December day.
  - `before`: a detached copy of Base (1e6f6f5) on :8084.
  - `mid`: a detached copy of slice 5's commit on :8084.
  - `after`: the branch at its last code slice.
  - Stop one server before starting the next on :8084. Build every slice first; the sets need no pause in the build.
- **Clear old keys:** before the first set, clear every older brief's `snap:*` key from localStorage on :8084.
- **QA users**, created before the `before` set and deleted when the brief is done (members first):
  - `claude-qa-105b`, the owner;
  - `claude-qa-105b-m`, made with `--join claude-qa-105b`;
  - `claude-qa-105b-n`, made with `--join claude-qa-105b`, then removed by the owner for the no-ledger views.
- **Seeding**, once, as the owner, through the API, after checking that November has no expenses or income. Use the
  same steps as 105:
  - income `Salary` €1000;
  - categories 0, 1 and 2 (U, N, O) planned at €100 each, with expenses of €10, €95 and €109 on 2026-11-03;
  - an actual End of €900;
  - the invite to `-n`, made just before the no-ledger views.
- **API calls:** login sends a `deviceId` of 8–64 characters. A DELETE with no body sends no JSON content type.
- **TOTP:** codes come from a scratch script outside the repo and are never printed. Wait for a fresh 30-second window
  between sign-ins.

**Views:** the same 27 as 105, each in Light then Dark.

- Owner: `home`, `budget`, `budget-ended`, `income`, `expenses`, `expenses-scrolled`, `statistics`,
  `statistics-menu`, `category`, `category-menu`, `category-undo`, `settings`, `members-owner`, `members-confirm`,
  `actual-end`, `actual-end-error`, `delete-category`, `expense-new`, `expense-sheet`, `expense-added`,
  `income-item-edit` and `category-form-add`.
- Signed out: `login`, `login-error`.
- No ledger: `no-ledger-invite`, `no-ledger`.
- Member: `members-member`.

Screenshots of `before` and `after` go in the PR, side by side with the doc's Type table. `mid` is snapshots only.

**Snapshots.** Install 104h's `__snapSrc` and `__scrollSrc` as they are.

To stay under localStorage's quota, record each result outside the repo before deleting its keys. At most two sets
are stored at once.

1. **Before → mid: layout moves.** Run 104h's `__cmpSrc` with its keys changed to `snap:before:105b:` and
   `snap:mid:105b:`. It compares every column. Check:
   - `width: 390` and an unchanged accessibility record (`a11yAdded` and `a11yRemoved` empty) on every view;
   - `rows` equal, so no element appears or disappears;
   - each diff is one of the "Base → slice 5" moves above, on its site, or a sibling's `x` in the same row.

   Any other diff is a finding, fixed before the PR. Once a view's result is recorded, delete its `before` key.

2. **Mid → after: text metrics only.** `__fontSrc` takes the `after` snapshot and compares it with `mid`:

```js
localStorage.setItem(
  '__fontSrc',
  `(view, scheme) => { const get = (k) => JSON.parse(localStorage.getItem(k)); const mid = get('snap:mid:105b:' + view + ':' + scheme); const shot = eval(localStorage.__snapSrc)('snap:after:105b:' + view + ':' + scheme); const after = get('snap:after:105b:' + view + ':' + scheme); const KEEP = [5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19]; const INTER = ['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_800ExtraBold']; const out = { view, scheme, width: shot[3], rows: [mid.rows.length, after.rows.length], structure: [], styleDiffs: [], notInter: [], widthOnly: 0, sideways: [], down: [], causes: [], a11ySame: JSON.stringify(mid.a11y) === JSON.stringify(after.a11y) }; for (let i = 0; i < Math.max(mid.rows.length, after.rows.length); i++) { const a = (mid.rows[i] || '').split('|'); const b = (after.rows[i] || '').split('|'); const name = i + ' ' + b[0] + ' ' + (b[20] || ''); if (a[0] !== b[0] || a[20] !== b[20]) { out.structure.push(i + ': ' + a[0] + ' ' + a[20] + '  =>  ' + b[0] + ' ' + b[20]); continue; } const changed = KEEP.filter((c) => a[c] !== b[c]); if (changed.length) out.styleDiffs.push(name + ': ' + changed.map((c) => a[c] + ' => ' + b[c]).join(', ')); const face = b[13].split(',')[0].replace(/["']/g, '').trim(); if ((b[20] || b[0] === 'INPUT') && b[9] !== '0' && !INTER.includes(face)) out.notInter.push(name + ': ' + b[13]); const [dx, dy, dw, dh] = [1, 2, 3, 4].map((c) => b[c] - a[c]); if (Math.abs(dy) > 2 || Math.abs(dh) > 2) out.down.push(name + ': dy ' + dy + ', dh ' + dh); else if (Math.abs(dx) > 2) out.sideways.push(name + ': dx ' + dx); else if (dw && !dx && !dy && !dh) out.widthOnly++; if (dh && b[20]) out.causes.push(name + ': h ' + a[4] + ' => ' + b[4] + ', line ' + b[15]); } return out; }`,
);
```

The script was tried in Node on made-up rows, with a stubbed localStorage and `__snapSrc`. Its column numbers are
104h's: 0 tag, 1–4 box, 5–12 background to stroke, 13 family, 14–19 size to alignment, 20 text. What it separates:

- **The same elements:** `structure` is empty, since each row keeps its tag and text, and `rows` are equal.
- **Nothing but the face changes:** `styleDiffs` is empty. Colour, padding, radius, opacity, size, line height,
  tracking, tabular, weight (`400` on every row, so nothing fakes a bold) and alignment all match.
- **Inter everywhere:** `notInter` is empty. Every visible text and input is drawn in one of the four faces.
- **The accessibility record is unchanged:** `a11ySame` is true.
- **Moves from metrics:**
  - `widthOnly` counts text that just got wider.
  - `sideways` lists boxes pushed more than 2pt sideways by a wider text before them.
  - `down` lists boxes that moved or grew more than 2pt vertically.
  - `causes` lists the text leaves whose height changed. Every role but `input` sets a line height, so a cause is
    either a wrap change (the height changes by whole lines) or a box with no line height (`input` Texts and
    CategoryTile letters, |dh| ≤ 2).
- **Findings:** any row in `down` that has no wrap cause above it is a finding. So is any `structure`, `styleDiffs`
  or `notInter` row.

Delete each `mid` key once its result is recorded.

**3. Faces in use (AC2).** Over every `snap:after:105b:*` key, count the distinct tuples of family, size, line height,
tracking and weight, over visible text and input rows (columns 13–16 and 18, opacity ≠ 0). The expected set is:

- the 8 roles and the 4 pairs, at the doc's values;
- the code field (`Inter_800ExtraBold 26px normal 8px`);
- CategoryTile letters (`Inter_800ExtraBold`, 0.43 × tile size);
- weight `400` on every row.

Any other tuple is a finding.

**4. Loaded fonts (AC1).** On `after`,
`[...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)` lists the four Inter faces, and
nothing from Bricolage or Plex. On `before`, it lists the five old ones.

**In the PR (AC7):** list every `down` and `sideways` row, and every `before → mid` diff over 2pt, grouped by cause
(Open question 6). A text that only got wider is summarised by view, with the measured 6%.

**Checked from the code only** (listed so in the PR):

- LedgerPicker (it needs two ledgers);
- both tab badges and PendingInvites on Home and Settings (they need an invite to a user who has a ledger);
- the category page's "No expenses" line (U has an expense);
- a disabled IconButton.

**Demo:** `web-demo`, in Light and Dark, with the console open. Check Home, Budget, Income, Expenses, a category page,
the expense form with its sheet, and an income item: no errors. Run `yarn mobile export:web`, then
`yarn mobile check-builds`; the `--accept` diff is in slice 6.

**Gate B, iPhone (Expo Go):**

- Inter loads with no flash of the old font or of the system font;
- both themes;
- the eyebrow and day labels read well at 0 tracking. If they read too tight, the fallback is a doc-first `overline`
  role (Risks);
- login's code field;
- in iOS Safari on the web app, focusing the expense form's date field doesn't zoom.

## AC → evidence

| AC                                                                                                               | Evidence                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 only Inter; old packages gone from package.json, yarn.lock, code                                             | slice 6's `rg` and `.ttf` list; Visual check 4 (`document.fonts`)                                                                                                                                                                                                                                                                 |
| AC2 every role and variant: one Inter face, doc values; no `fontWeight`                                          | `theme.test.ts` "sets each type role from the design system"; Visual check 3 (tuples, weight 400 everywhere); `rg -n fontWeight apps/mobile/src` finds nothing                                                                                                                                                                    |
| AC3 field labels `label`, inputs `input` 400                                                                     | slice 1's `rg`; `before → mid` diffs on those rows (family only); Visual check 3 (`Inter_400Regular 16px normal -0.2px` on every input but the code field)                                                                                                                                                                        |
| AC4 eyebrow and day label in `caption`; no tracking `eslint-disable`                                             | slice 2's `rg`; `before → mid` diffs on `budget`, `income`, `expenses`, `category`; Gate B                                                                                                                                                                                                                                        |
| AC5 hidden web input 16px                                                                                        | `before → mid` on `expense-new` (the `INPUT` row `16px`); Gate B in iOS Safari                                                                                                                                                                                                                                                    |
| AC6 104h's search finds only `Text.tsx`, `theme.ts`, the exceptions                                              | after slice 6, from `apps/mobile`: `rg -n "\.\.\.text\." src --glob '!src/theme.ts' --glob '!src/components/Text.tsx'` gives the same 8 lines as 104h; `rg -n fontFamily` (same globs) gives 4: login's `passwordInput`, CategoryTile, TabBar, `(tabs)/_layout.tsx`; the React Native `Text` import search gives the same 4 files |
| AC7 before/after screenshots, light and dark; metrics-only moves; accessibility unchanged; moves over 2pt listed | Visual check: 27 views × 2 themes × (`before`, `after`) screenshots; comparisons 1 and 2; the PR's list                                                                                                                                                                                                                           |
| AC8 demo with no console errors; `check-builds --accept`, diff reviewed                                          | Visual check, Demo; slice 6's `demo-modules.txt` diff                                                                                                                                                                                                                                                                             |
| AC9 gates                                                                                                        | every slice                                                                                                                                                                                                                                                                                                                       |

## Not doing (YAGNI)

- An `overline` role: the brief makes it the fallback only if Gate B finds the 0 tracking too tight.
- A lint rule against `fontWeight` or `fontFamily` outside `theme.ts` and `Text.tsx` (104f's follow-up, not briefed).
- Turning DateField's value, TabBar's badge or CategoryTile's letter into `Text` variants: they stay the listed
  exceptions.
- Smaller fonts: WOFF2, subsetting, or one variable Inter face with `fontDefinitions` and `fontWeight`, which SDK 58's
  expo-font supports. The brief asks for one face per weight and no `fontWeight` at all.
- Re-tuning the amount fields' € position (`top: 13`) for Inter's metrics: that's 105d's inputs. It moves under 2pt.
- Changing `heading` for the Settings initial to match CategoryTile's 800: no doc role, and sizes the doc doesn't set
  are out of scope.

## Risks

- **Wider text wraps or truncates differently.** Inter is about 6% wider. This shows in comparison 2: `causes` and
  `down` list every wrap change, and the screenshots show it. A new truncation of a row name, or a wrap that breaks a
  layout, is a finding.
- **Form titles at 22pt crowd the modal row.** The widest is 180pt of about 238pt (measured). The after screenshots of
  the 5 modal screens and `expense-sheet` prove it.
- **The subpath imports don't resolve.** The package has no `exports` field, and `moduleResolution: bundler` reads
  `400Regular/index.d.ts`. Slice 6's typecheck and `export:web` prove it. If they fail, use the root import (same
  lines), and the build ships all 18 faces (recorded in Deviations).
- **A heavier first load on web.** The app renders nothing until its fonts load (AppShell), and they now weigh
  1.37 MB, up from 0.84 MB. Not mitigated here (Not doing); the PR states it. Gate B looks at the iPhone start.
- **The eyebrow and day labels read too tight at 0 tracking.** This shows at Gate B. The fallback is the brief's own:
  an `overline` role, added to the doc first, in a new commit on this branch, listed in the PR.
- **localStorage quota.** Three sets of 54 snapshots don't fit at once, so the steps delete each key once it has been
  compared. A `QuotaExceededError` shows at the first failing `__snapSrc` call.
- **The day.** All three sets on one Kyiv day (Set-up).
- **Main moves:** if another PR takes 1.23.13, rebase, take main's number and bump once more (§8b).

## Open questions

1. **Blocking: yes (Gate A, slice 4). Which `headingDisplay` sites become `title` (brief open question 1)?**
   - Recommended: the Inventory table. `title` goes to ScreenHeader's modal title (5 screens) and CategorySheet's "All
     categories": the doc gives `title` to sheet titles, and its `ScreenHeader` row to the header's title. `heading`
     goes to the other 8: section heads, the Income total beside its head, the collapsed total and the Settings
     initial.
   - Visible effect: 6 screens' titles grow from 17 to 22pt, and nothing under them moves.
   - Assumed: as recommended.
2. **Blocking: no. `captionMedium` (brief open question 2).**
   - Recommended: **keep it**, as caption at 500. It's the Expenses rows' "€9 over" and "€5 left". The doc's
     `caption` is the role for notes. The extra weight is what lifts a 12pt coloured warning above the muted 12pt
     captions around it, and slice 7 names it in the doc's `Text` row.
   - Moving it to `label` (13/18) makes each flagged row 2pt taller and puts a note in the role for buttons and field
     labels. Plain `caption` (400) leaves only the colour to signal.
   - Assumed: keep. Either change is one line in slice 6.
3. **Blocking: no. Members' two field labels** ("Your label", "Invite by username") move from `labelRegular` (400)
   to `label` (500). The brief lists only the `labelSemi` labels, but AC3 names Members. "Invited", a list's heading,
   stays. Assumed: they move.
4. **Blocking: no. The library tab bar's badge** (`tabBarBadgeStyle` in `(tabs)/_layout.tsx`) takes `fonts.regular`
   too. The brief names only TabBar's badge, but TabBar is the copy that lines up with the library bar, so the two
   badges would otherwise differ in font. Both use 400, the weight `Badge.js` uses. Assumed: both, one line each.
5. **Blocking: no. "Added by {username}"** loses `tabular`: a name, even one with digits, isn't a figure. Assumed:
   it goes, with the other three.
6. **Blocking: no. "Any row that moves more than 2pt"** (AC7) is read as a box whose position or height changes by
   more than 2pt. A text that only got wider in place is summarised by view rather than listed, since nearly every
   text does. Assumed: as read.
7. **Blocking: no. "The doc's `Text` row names the pairs"** is read as a doc edit (slice 7), following 104f's
   follow-up. Assumed: slice 7.
8. **Blocking: no. Corrections to the brief:**
   - there are 11 `labelSemi` sites, not 10 (LedgerPicker's checked line);
   - 8 of them are field labels.

## Follow-ups

- 104f's optional lint rule could also ban `fontWeight` in `apps/mobile/src`, which would keep AC2 true for new code.
- The web build's fonts could move to WOFF2 or a subset to win back the first-load weight (Risks), if the first web
  load proves slow.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>
