# Plan: Shared components, part 6: Text (Text and the components; screens in 104g and 104h)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/text-component
Base: origin/main (137a9eb, version 1.23.8)

## Approach

Add `src/components/Text.tsx`. It renders React Native's `Text` with a `variant` (the `text` roles plus four named
role-and-face pairs), a palette `color` (by key, `text` by default, inherited when nested) and a `tabular` flag for
money digits. Each variant is built from today's `text` role and `fonts` face, so every site draws exactly today's
type (Contracts), and **nothing moves**. Sites that switch looks on a state pass the state into `variant` or `color`
(LedgerPicker's open ledger, Statistics' checked period, the over/danger figures), not a style.

**Size: the whole brief is 837 changed lines, so it splits into three PRs.** I moved all 137 sites (plus DemoStrip's
link) in a scratch copy of `apps/mobile` and ran the repo's Prettier, `tsc` and ESLint on it: all clean, no warnings.
That's 485 added and 352 removed in 35 files.

| Part               | What ships                                                                               | Sites | ≈ lines |
| ------------------ | ---------------------------------------------------------------------------------------- | ----- | ------- |
| **104f (this PR)** | `Text`, and every text in `components/` and `demo/` (Button, ScreenHeader and 17 others) | 37+1  | 362     |
| 104g               | Home, Budget, Income, Expenses, Statistics, the category page, the demo's Home           | 50    | 256     |
| 104h               | Settings, Members, the forms' screens, login, no-ledger; the final AC2 search            | 50    | 220     |

- Each part is a separate brief and PR from `origin/main` after the previous one merges, with its own patch bump and
  before/after set, as 104–104e were (Open question 1).
- This plan builds 104f in full. 104g and 104h are outlined under "Later parts".
- Why components first (the brief's own cut): Button and ScreenHeader draw text on almost every screen, so 104f's
  before/after set already covers every screen once. 104g and 104h then touch only their own screens' files, and each
  needs a smaller set.

Alternatives considered:

- **Two PRs, components (362) and all screens (474).** The screens' PR would be 74 over the limit, more than 104b and
  104d (408, 411), which were approved over it. Three PRs cost one more bump and set.
- **Value colours (`color={colors.muted}`)** instead of palette keys (Open question 3).
- **Use names** (`rowName`, `meta`, `fieldLabel`, `screenTitle`), as the brief suggests, instead of role + face names.
  They don't fit the sites they'd cover (Open question 2).
- **Tabular digits as a `style` override** at each of the 19 sites instead of a `tabular` prop (Open question 2).

## Inventory (measured on Base)

Every `<Text>` in `apps/mobile/src`, its style traced to its role, face and colour by a TypeScript-AST script (in the
scratch copy). **140 `<Text>` elements in 37 files** (the brief says 38): 98 in `app/`, 39 in `components/`, 1 in
`demo/`, 2 in `demo-app/`. There are **118 `...text.*` spreads and 61 `fontFamily` overrides** outside `theme.ts`, as
the brief says.

**Role + face + colour, by site** (the 138 that go through `Text`: 137 `<Text>` sites and DemoStrip's link; a site
whose colour follows a state is counted under its usual colour):

| Variant (role + face)               | Sites | Colours (sites)                                                                                                        |
| ----------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `labelRegular` (label, regular)     | 23    | muted 20 (captions, notes, LoadError), text 3 (Members' detail, the expense's "Added" note, DemoStrip)                 |
| `label` (its own medium face)       | 23    | over 14 (every `alert`), muted 6, text 3                                                                               |
| `bodyMedium` (body, medium)         | 18    | text 15 (row names, toast, EmptyMonth…), muted 1 (ScreenHeader Back), danger 1 (⋯ menu row), muted/text 1 (Appearance) |
| `caption`                           | 16    | muted 16 (one is over when the plan gap is over)                                                                       |
| `labelSemi` (label, semibold)       | 10    | muted 9 (the forms' field labels), accent 1 (DemoStrip's Sign in)                                                      |
| `headingDisplay` (heading, display) | 10    | text 9 (section titles, sheet and form titles, totals), accent 1 (Settings' initial)                                   |
| `amount`                            | 9     | text 5, text switching to danger (or muted while loading) 4                                                            |
| `title`                             | 8     | text 7, text/muted 1 (Home card figure)                                                                                |
| `bodyStrong`                        | 5     | accent 3 (login links, Undo), text 2                                                                                   |
| `display`                           | 4     | text                                                                                                                   |
| `body`                              | 4     | text 2, muted 2 (no-ledger, the nested " of €…" in Expenses)                                                           |
| `input`                             | 2     | muted (the € and ₴ drawn inside an amount field)                                                                       |
| `captionMedium` (caption, medium)   | 1     | danger (Expenses' "€9 over")                                                                                           |
| `amountLg`                          | 1     | text                                                                                                                   |
| **State switches**                  | 4     | Button's label (6 looks), LedgerPicker's name and owner (checked: semibold + `active`), Statistics' period menu        |

- **Faces only change through a variant.** "body in the semibold face" (Statistics' checked period, LedgerPicker's
  checked name) is exactly `bodyStrong`; "label in the semibold face" is `labelSemi`. No new pair is needed for them.
- **Tabular digits:** 19 sites add `fontVariant: ['tabular-nums']` to a role other than `amount`/`amountLg`
  (`caption` 8, `labelRegular` 6, `headingDisplay` 2, `captionMedium`, `title` and `label` 1 each). 3 are in this part
  (CollapsingSummary 2, HomeCards 1).
- **Other one-offs**, which stay a `style` override: `textAlign: 'center'` (EmptyMonth, login's price line, Button's
  label), the two +0.5 trackings, and layout (`flex`, `flexShrink`, `maxWidth`, margins, padding, absolute position).

**Exceptions** (they keep React Native's `Text`, or a style that spreads a role or sets a face):

| Site                                                                                                                                                          | Why                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `CategoryTile`'s letter (raw `Text`)                                                                                                                          | Size from the tile (`size * 0.43`, already allowlisted) and colour from `categoryTile()`, not the palette |
| `DateField`'s value (raw `Text`, `text.input` in the medium face)                                                                                             | It draws a field's typed text, like the TextInputs around it (the brief's exception); inputs are 105/106  |
| `TabBar`'s badge (raw `Text`, size from `BADGE_SIZE`)                                                                                                         | TabBar belongs to brief 106                                                                               |
| TextInput styles: `input` in actual-end, income-item, expense (NameCombobox's), Members, login (+ `passwordInput`'s display face), CategoryForm, AmountFields | Not `Text` (brief: out of scope)                                                                          |

- **Not exceptions, though the brief lists them:** MonthSwitcher's eyebrow and the category day labels render
  through `Text` (`caption`/`labelSemi`, `muted`). Only their `letterSpacing: 0.5` stays as a `style`, with its
  existing `eslint-disable` and reason. So 105 still reaches their role and face.
- **Found while planning, and not exceptions:**
  - The € and ₴ inside the amount fields (AmountFields, CategoryForm) are `Text`s in `text.input`. They take
    `variant="input"` (Open question 8).
  - DemoStrip's "Sign in" is an expo-router `Link` styled as text. It becomes `<Link asChild>` around a `Text`: the
    same `Link asChild` pattern login uses with Pressable (Open question 7).

## Contracts

- DB / API / DTOs / `theme.ts`: none. No new token.
- **`src/components/Text.tsx`** (new; drafted at 50 lines in this part, 52 with 104g's `captionMedium`):

  ```ts
  // The type roles (`input` draws the € and ₴ inside an amount field), plus the role-and-face pairs the screens use,
  // named role + face. A face is never a screen's style: brief 105 retunes every face here and in theme.ts.
  const variants = StyleSheet.create({
    ...text,
    bodyMedium: { ...text.body, fontFamily: fonts.bodyMedium },
    labelRegular: { ...text.label, fontFamily: fonts.body },
    labelSemi: { ...text.label, fontFamily: fonts.bodySemi },
    headingDisplay: { ...text.heading, fontFamily: fonts.display },
  });
  const styles = StyleSheet.create({ tabular: { fontVariant: ['tabular-nums'] } });

  export type TextVariant = keyof typeof variants;

  /** True inside a Text, so a nested Text with no `color` keeps the colour it inherits. */
  const InText = createContext(false);

  /** Text in one of the type roles or named pairs (`variant`), in a palette colour: `text` by default, or the
   *  parent's when nested. `style` is for layout and the one-offs the 104f plan lists; it comes last. */
  export function Text({ variant, color, tabular, style, ...props }: TextProps & {
    variant: TextVariant;
    color?: keyof Palette;
    /** Digits line up: money in a role other than `amount`/`amountLg`, which have them already. */
    tabular?: boolean;
  }) {
    const colors = useColors();
    const nested = useContext(InText);
    const tint = color ?? (nested ? undefined : 'text');
    return (
      <InText.Provider value>
        <NativeText {...props} style={[variants[variant], tabular && styles.tabular, tint && { color: colors[tint] }, style]} />
      </InText.Provider>
    );
  }
  ```

  - `variant` is required, so a top-level `Text` can't fall back to the system font.
  - **Pass-through:** every React Native `Text` prop (`numberOfLines`, `accessibilityRole="header"`/`"alert"`,
    `accessibilityLabel`, and `href`, `role` and `onClick` from `Link asChild`) reaches `NativeText` unchanged through
    `...props`. React 19 passes `ref` as a prop, so `Link asChild`'s ref reaches it too.
  - **Nested colour:** only `Text` sets `InText`. A nested `Text` without `color` sets no colour and inherits its
    parent's. With `color`, it uses that colour. The one nested site today (Expenses' " of €…", 104g) passes
    `color="muted"`, as it does today.
  - **Order:** variant, tabular, colour, then the caller's `style`. No caller style sets a face, size or colour
    (checked in the draft: every remaining `style` is layout, `textAlign`, or the 0.5 tracking).
  - The variants hold no colour, so they're a plain `StyleSheet.create`. The colour is a small inline object from
    `useColors()` (conventions §5), so it follows a theme change.
  - Imports: `react`, `react-native`, `@/appearance/AppearanceContext` and `@/theme` (`fonts`, `text`, `Palette`).
  - `captionMedium` (`{ ...text.caption, fontFamily: fonts.bodyMedium }`, with the comment "The Expenses rows' "€9
    over": its one caller, here because it's a face.") arrives in 104g with its caller.

- **Sites in this part, measured on Base.** Before: role · face · colour · extras. After: the `Text` props. Layout
  styles stay in the file, cut down to their layout keys.

  | File                | Site                          | Before                                                                                   | After                                                                                                                                        |
  | ------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
  | `Button`            | label                         | `${variant}Label`: 6 looks                                                               | `variant={labels[variant].variant} color={labels[variant].color} style={styles.label}`                                                       |
  | `ScreenHeader`      | modal title (`header`)        | heading · display · text                                                                 | `headingDisplay`, role kept                                                                                                                  |
  |                     | page Back label               | body · medium · muted                                                                    | `bodyMedium muted`                                                                                                                           |
  | `MonthSwitcher`     | eyebrow                       | caption · muted · +0.5                                                                   | `caption muted`, `style={styles.eyebrow}` (`letterSpacing: 0.5`, allowlisted)                                                                |
  |                     | month                         | title                                                                                    | `title`                                                                                                                                      |
  | `CollapsingSummary` | label (`numberOfLines={1}`)   | label · muted · flexShrink 1, marginRight 8                                              | `label muted`, style kept for layout                                                                                                         |
  |                     | spent                         | heading · display · text (over: `over`) · tabular                                        | `headingDisplay color={over ? 'over' : 'text'} tabular`                                                                                      |
  |                     | " / €…"                       | label · muted · tabular                                                                  | `label muted tabular`                                                                                                                        |
  | `LoadError`         | message (`alert`)             | label · regular · muted                                                                  | `labelRegular muted`, role kept                                                                                                              |
  | `EmptyMonth`        | text                          | body · medium · text · centred                                                           | `bodyMedium`, `style={styles.text}` (`textAlign: 'center'`)                                                                                  |
  | `UndoToast`         | message (`numberOfLines={2}`) | body · medium · text · flex 1 (+ refused padding)                                        | `bodyMedium`, `style={[styles.toastText, refused && styles.refusedText]}`                                                                    |
  |                     | Undo / Retry                  | bodyStrong · accent                                                                      | `bodyStrong accent`                                                                                                                          |
  | `HomeCards`         | card title                    | body · medium · text                                                                     | `bodyMedium`                                                                                                                                 |
  |                     | figure (`numberOfLines={1}`)  | title · text (none yet: muted) · tabular                                                 | `title color={card.figure === null ? 'muted' : 'text'} tabular`                                                                              |
  | `PlaceholderPage`   | title, "Coming soon."         | title; label · regular · muted                                                           | `title`; `labelRegular muted`                                                                                                                |
  | `AppearancePicker`  | option label                  | body · medium · muted (checked: text)                                                    | `bodyMedium color={checked ? 'text' : 'muted'}`                                                                                              |
  | `LedgerPicker`      | name (`numberOfLines={1}`)    | body · medium · text; checked: semibold · active                                         | `variant={checked ? 'bodyStrong' : 'bodyMedium'} color={checked ? 'active' : 'text'}`, flexShrink                                            |
  |                     | owner (`numberOfLines={1}`)   | label · regular · muted; checked: semibold · active                                      | `variant={checked ? 'labelSemi' : 'labelRegular'} color={checked ? 'active' : 'muted'}`, layout                                              |
  | `PendingInvites`    | "Invites"; invite; failure    | caption · muted; body · medium · text; label · over (`alert`)                            | `caption muted`; `bodyMedium`; `label over`, role kept                                                                                       |
  | `AmountFields`      | label; € / ₴                  | label · semibold · muted; input · muted · absolute                                       | `labelSemi muted`; `input muted`, `style={styles.symbol}` (position only)                                                                    |
  | `CategoryForm`      | caption; 2 labels; €; error   | label · regular · muted; label · semibold · muted; input · muted; label · over (`alert`) | `labelRegular muted`; `labelSemi muted`; `input muted` + symbol; `label over`, role kept                                                     |
  | `CategoryPicker`    | chip name; "N more"           | label · text · flex 1; label · muted · flex 0                                            | `label`, `style={styles.catText}`; `label muted style={{ flex: 0 }}`                                                                         |
  | `CategorySheet`     | title; hint; item             | heading · display; caption · muted; label · text · flex 1                                | `headingDisplay`; `caption muted`; `label`, `style={styles.itemText}`                                                                        |
  | `DateChips`         | chip label                    | label · text                                                                             | `label`                                                                                                                                      |
  | `NameCombobox`      | option (`numberOfLines={1}`)  | body · text                                                                              | `body`                                                                                                                                       |
  | `DemoStrip`         | note                          | label · regular · text · flexShrink 1                                                    | `labelRegular`, `style={styles.text}`                                                                                                        |
  |                     | "Sign in" (`Link`)            | `Link style`: label · semibold · accent, minHeight 44, padding 20, lineHeight 44         | `<Link href asChild><Text variant="labelSemi" color="accent" style={styles.link}>`; `link` keeps minHeight, paddingHorizontal and lineHeight |

  Button's map (module level, typed `Record<ButtonVariant, { variant: TextVariant; color: keyof Palette }>`):
  `primary`/`danger` → `bodyStrong onAccent`, `outlinedDanger` → `bodyStrong danger`, `dangerText` →
  `bodyMedium danger`, `mutedText` → `bodyMedium muted`, `accentText` → `bodyStrong accent`. The six `*Label` styles go.

- **Caller clean-up** (from the draft; lint doesn't catch unused StyleSheet keys):
  - Styles go: every style whose keys were only role, face and colour; the rest keep only their layout keys (table).
  - `import { Text } from 'react-native'` becomes `import { Text } from '@/components/Text'` (after the last
    `@/components/*` import that sorts before it). `fonts` and `text` leave each `@/theme` import that no longer uses
    them. `useColors` leaves CollapsingSummary.
  - DemoStrip's `link` must stay a single style object: expo-router's `Slot` throws in development when `asChild`'s
    child gets a style array.
- **The list is complete** (searched on the draft of this part):
  - `rg -n "\.\.\.text\.|fontFamily" apps/mobile/src/components apps/mobile/src/demo --glob '!Text.tsx'` finds only
    CategoryTile's letter, DateField's value and the `input` styles of AmountFields and CategoryForm.
  - `rg -U -n "import \{[^}]*\bText\b[^}]*\} from 'react-native'" apps/mobile/src/components apps/mobile/src/demo`
    (`-U`, so imports over several lines count, like NameCombobox's) finds only CategoryTile, DateField, TabBar and `Text.tsx` itself (`Text as NativeText`).
- **Demo:** `Text` reaches the demo in slice 1, through Button. Slice 1 runs `yarn mobile export:web && yarn mobile
check-builds --accept`, and `demo-modules.txt` gains one line, `src/components/Text.tsx`, between `TabBar.tsx` and
  `TextField.tsx`. Nothing leaves it. `Text.tsx` has none of the demo's banned strings.
- Reuses: `useColors`, the `text` roles and `fonts`; expo-router's `Link asChild`, the same pattern login uses with Pressable; the
  104–104e snapshot script, extended (Visual check). I searched `src/components` for an existing text component, and
  there isn't one.
- New dependencies: none.

## Version

Bump: patch — 1.23.8 → 1.23.9
Why: §8b `patch`. It's a behaviour-preserving refactor of shipped app code: the same type, colours, roles and labels.
There's no new capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set (Visual check). The line counts come from the scratch draft;
each stage was checked on its own with `tsc` and ESLint.

- [ ] 0. Bump version to 1.23.9
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.9
- [ ] 1. Add Text and draw the buttons' labels and the headers' text with it (~88 lines)
  - Files: `src/components/Text.tsx` (new), `src/components/Button.tsx`, `src/components/ScreenHeader.tsx`,
    `apps/mobile/demo-modules.txt`
  - Change: Text as in Contracts, whole, as the earlier parts' components shipped. Button's label map; ScreenHeader's
    title and Back label.
  - Verify: gates; `export:web` + `check-builds --accept`, with only the Text line added. Snapshots: `login`,
    `settings`, `members`, `category-form-add`, `expense-edit`, `delete-category`, `category`, `category-bad-link`.
- [ ] 2. Draw the month switcher, summaries, errors, empty month, toast and Home cards with Text (~87 lines)
  - Files: `src/components/MonthSwitcher.tsx`, `CollapsingSummary.tsx`, `LoadError.tsx`, `EmptyMonth.tsx`,
    `UndoToast.tsx`, `HomeCards.tsx` (all under `src/components/`)
  - Change: their rows in the table, and the clean-up.
  - Verify: gates. Snapshots: `home`, `budget`, `budget-empty`, `budget-error`, `income`, `expenses`,
    `category-scrolled`, `category-undo`, `category-bad-link`.
- [ ] 3. Draw Settings' pickers, the invites and the demo strip with Text (~90 lines)
  - Files: `src/components/PlaceholderPage.tsx`, `AppearancePicker.tsx`, `LedgerPicker.tsx`, `PendingInvites.tsx`,
    `src/demo/DemoStrip.tsx`
  - Change: their rows in the table; DemoStrip's link moves to `Link asChild`.
  - Verify: gates. Snapshots: `settings`, `no-ledger`, `demo-home`; on `demo-home`, the Sign in row is still an `A`
    and `document.querySelector('a[href$="/login"]')` finds it.
- [ ] 4. Draw the expense and category forms' fields, chips and lists with Text (~97 lines)
  - Files: `src/components/AmountFields.tsx`, `CategoryForm.tsx`, `CategoryPicker.tsx`, `CategorySheet.tsx`,
    `DateChips.tsx`, `NameCombobox.tsx`
  - Change: their rows in the table.
  - Verify: gates; the two `rg` searches under "The list is complete". Snapshots: `category-form-add`,
    `category-form-error`, `income-item-add`, `expense-new`, `expense-sheet`, `expense-names`. Then every view of the
    set in both schemes, and the demo check.

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped. In this worktree, export
`DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. No unit tests are added: no
pure logic changes, and `Text.tsx` imports `react-native`, which the app's Node test environment can't load
(conventions §6: UI is checked in the browser).

**Scratch draft.** The planner drafted every edit of all three parts in a scratch copy outside the repo. It holds:

- an untouched copy of Base's `src`, the full draft (all three parts) and this part's draft, with slices 1–3 staged
- the full diff, this part's diff and the diffs per stage
- the inventory script and its tables, and the snapshot snippet for Visual check

The orchestrator has its location. The temp dir can be cleared, so Contracts is the source of truth.

## What moves (the PR lists this)

- **Expected: nothing.** Every view in both themes should be identical in every row, including the new type columns,
  with the same accessibility records. Any difference is a bug in the slice that caused it, and it gets fixed, not
  listed.
- **Not caught by the snapshots, and listed:**
  - Each `Text` wraps its children in a context provider. It renders no element.
  - The style is now an array (variant, tabular, colour, layout) instead of one object. The flattened values are the
    same.
  - CategoryPicker's "N more" had `flex: 1` then `flex: 0`; it now gets `flex: 0` only. The same flattened value.
  - LedgerPicker's open ledger: `bodyStrong` and `labelSemi` hold the same values as today's `textOn` face on `body`
    and `label`. It shows only with two ledgers (checked from the code).
  - DemoStrip's Sign in is drawn by `Text` under `Link asChild` instead of by `Link`'s own `Text`. The `<a>`, its
    `href` and its role stay (`demo-home` shows it).

## Visual check (AC3–AC5; not counted in the line estimates)

**Set-up.**

- This worktree has `node_modules`, but no `.env` files. Copy the two git-ignored files in, or run `api` from the main
  checkout (this PR doesn't change the API). Check `git status` is clean before the before set.
- **Same day, in November.** The expense form shows today's date, so take both sets on the same Kyiv day. From
  1 December, November has ended: the "+" buttons, ⋯, Delete and Save disappear. In either case take both sets again
  on that day's data; the view names stay the same.
- **Two QA users**, created by the orchestrator before the before set and deleted when the brief is done (the member
  first) (Open question 5):
  - **Owner:** `yarn api create-user --username claude-qa-104f --email …`. Its ledger gets the default November list.
  - **No ledger:** `claude-qa-104f-n`, created with `--join claude-qa-104f` and then removed by the owner (Members →
    Remove → Remove), as in 104c. The CLI has no flag for a user without a ledger.
- **Seed through the API as the owner** (signed in from the page, credentials included), before the before set, as in
  104e:
  - `GET /api/ledgers` gives the ledger id. `GET /api/ledgers/<id>/categories?month=2026-11` gives `quickCategoryIds`.
    Note the first as **C** and the second as **D**.
  - Ten expenses in C with `POST /api/ledgers/<id>/expenses`, dated 2026-11-01 to 2026-11-10:
    `{ categoryId: C, expenseDate, name: 'qa', amount: '12.50', currency: 'EUR' }`. Note the 10 November one as **E**.
  - One expense in D, dated 2026-11-03.
  - One income item with `POST /api/ledgers/<id>/months/2026-11/income`: `{ title: 'Salary', amount: '1000.00' }`.
- **The invite.** Invites expire after an hour, so each set makes its own: as the owner, `POST
/api/ledgers/<id>/invites` with `{ username: 'claude-qa-104f-n' }` just before signing out. If the before set's
  invite is still live, the API refuses a second one, and the view looks the same.
- TOTP codes come from a scratch script in the system temp dir, and the secret is never printed. Wait for a fresh 30 s
  window between sign-ins. Wrong codes count against the limit (5 in 24 hours), so don't guess.
- Another session may share the MySQL test database: if the integration tests fail in the schema reset, wait until
  the other run is idle and run again, and never commit after a failed `yarn test`.

**Snapshot script:** 104e's version, with these changes. The full snippet is in the scratch draft.

- **Each row adds the element's tag name and its computed type:** `fontFamily`, `fontSize`, `lineHeight`,
  `letterSpacing`, `fontVariantNumeric`, `fontWeight` and `textAlign`, after 104d's `color` and 104e's `zIndex`. A face,
  size, tracking, tabular or colour change on any text then shows up, even where no box moves.
- Keys: `snap:before:104f:<view>:<scheme>` and `snap:after:104f:*`. Install it on both origins (app and demo).
- `cmp` returns `a11yAdded` and `a11yRemoved` as in 104e, and `innerWidth` (must be 390).
- Use 390×844 and take Light, then Dark, for each view. Don't click in the Browser pane while sets are compared.

**Views, in this order, the same in both sets** (navigate, wait about 2 s, snapshot):

1. **Owner** (signed in as `claude-qa-104f`):

   | View                  | Where / how                                                                                                                                                             | Shows (this part's text)                                              |
   | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
   | `home`                | `/`                                                                                                                                                                     | HomeCards' titles and figures                                         |
   | `budget`              | `/budget?month=2026-11`                                                                                                                                                 | MonthSwitcher's eyebrow (+0.5) and month                              |
   | `budget-empty`        | `/budget?month=2026-12`. Don't press Copy                                                                                                                               | EmptyMonth's text, a primary Button                                   |
   | `budget-error`        | On `budget`, `window.fetch = () => Promise.reject(new TypeError('offline'))`, then press Previous month. Reload afterwards                                              | LoadError's message (`alert`) and its Retry (`accentText`)            |
   | `income`              | `/income?month=2026-11`                                                                                                                                                 | MonthSwitcher                                                         |
   | `expenses`            | `/expenses?month=2026-11`                                                                                                                                               | MonthSwitcher                                                         |
   | `settings`            | `/settings`                                                                                                                                                             | PlaceholderPage's title, AppearancePicker (one checked), Sign out     |
   | `members`             | `/members`                                                                                                                                                              | ScreenHeader's page Back, Save and Invite                             |
   | `category`            | `/category/C?month=2026-11`                                                                                                                                             | ScreenHeader's page Back ("November")                                 |
   | `category-scrolled`   | On `category`, `eval(localStorage.__scrollSrc)()` (must return 400), take a screenshot, then snapshot. Reload afterwards                                                | CollapsingSummary's label, spent and " / €…" at opacity 1             |
   | `category-undo`       | On `category`, open E, press Delete expense; back on the category page, take a screenshot and snapshot within the toast's 10 s. Then press Undo, and check 10 days show | UndoToast's message and Undo                                          |
   | `category-bad-link`   | `/category/abc`                                                                                                                                                         | LoadError (`alert`), ScreenHeader's "Back"                            |
   | `category-form-add`   | `/category-form?month=2026-11`                                                                                                                                          | modal title (`header`), CategoryForm's caption, labels and €, Save    |
   | `category-form-error` | On `category-form-add`, press Save with the fields empty (nothing is sent). Reload afterwards                                                                           | CategoryForm's error (`alert`)                                        |
   | `income-item-add`     | `/income-item?month=2026-11`                                                                                                                                            | AmountField's label and €                                             |
   | `expense-new`         | `/expense`                                                                                                                                                              | DateChips, CategoryPicker (and "N more"), AmountFields (€ and ₴), Add |
   | `expense-sheet`       | On `expense-new`, tap "N more"; take a screenshot, then snapshot. Don't pick. Reload afterwards                                                                         | CategorySheet's title, hint and items                                 |
   | `expense-names`       | On `expense-new`, click the name field; the list opens with "qa". Don't pick. Reload afterwards                                                                         | NameCombobox's option                                                 |
   | `expense-edit`        | `/expense?expenseId=E`. Don't press anything                                                                                                                            | Update (primary), Delete expense (`dangerText`)                       |
   | `delete-category`     | `/delete-category?categoryId=C&month=2026-11`. Don't press Remove                                                                                                       | Remove (`danger`), the modal title                                    |
   | `actual-end`          | `/actual-end?month=2026-11`. Don't save                                                                                                                                 | Save                                                                  |

   Then invite `claude-qa-104f-n` (Set-up) and sign out with `POST /api/auth/logout` (credentials included).

2. **Signed out:** `login`, at `/login` after the reload: Sign in (primary, disabled).
3. **No ledger** (signed in as `claude-qa-104f-n`, within the invite's hour): `no-ledger`, at `/`: PendingInvites'
   "Invites", the invite and Decline/Accept, Check for invites (`accentText`) and Sign out (`outlinedDanger`). Sign out
   afterwards.
4. **Demo** (`web-demo`, port 8082, no sign-in): `demo-home`, at `/`: DemoStrip's note and Sign in, the demo's
   HomeCards.

- Before comparing `category-scrolled`, confirm the summary row shows opacity 1; before `expense-sheet`, that the sheet
  has stopped sliding (snapshot twice, 1 s apart); before `category-undo`, that the toast is in the record. If not,
  take them again.
- If the toast times out before Undo, restore E with `POST /api/ledgers/<id>/expenses/E/restore`, so both sets start
  from the same data.

**After set:** per slice as listed in Slices, and all 24 views × 2 schemes after slice 4, compared with
`eval(localStorage.__cmpSrc)('<view>', '<scheme>')`. Expected everywhere: `diffs: 0`, `a11ySame: true`, empty
`a11yAdded` and `a11yRemoved`, `width: 390`. The screenshots go in the PR, not the repo.

**Not snapshotted in this part:** Statistics. None of this part's components draws on it in its loaded state (its
EmptyMonth and LoadError show the same components as `budget-empty` and `budget-error`). 104g snapshots it.

**Checked from the code only** (listed as such in the PR; Open question 6):

- **LedgerPicker**: it shows only with two ledgers, and the QA user has one. The table's values are identical to
  today's.
- **PendingInvites on Home and Settings**: the same component as `no-ledger`. Its failure line is the same `label over`
  `alert` as the other errors.
- **UndoToast's refused and failed states**, Button's busy states (the label path is unchanged; the spinner isn't
  text), LoadFailed's Back (the same `mutedText` Button as the modal Back).
- **A nested `Text` without `color`**: no site has one today. The rule is the three lines under Contracts.

**Demo (AC5):** `web-demo` (port 8082), Light and Dark, with the console open. Check the Home strip, Budget, Expenses,
a category page scrolled, the expense form with its sheet, the category form and the income item. There should be no
errors. `yarn mobile check-builds` (no `--accept`) passes on the last commit.

**Gate B, iPhone (Expo Go):** Home, Budget and the expense form in both themes, then the same at a large Dynamic Type
size (Settings → Accessibility → Larger Text). `Text` keeps React Native's `allowFontScaling` default, so the text
should scale as before.

## AC → evidence

| AC                                                                                   | Evidence                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 `Text` exists, reads only `theme.ts`'s roles and the palette, no new token       | Slice 1. Its imports are those in Contracts; each named variant is `{ ...text.<role>, fontFamily: fonts.<face> }`; `git diff origin/main -- apps/mobile/src/theme.ts` is empty                                                                                        |
| AC2 every `<Text>` through it; no role spread or `fontFamily` outside the exceptions | This part: `components/` and `demo/`, by slice 4's two searches (Contracts › The list is complete). The screens: 104g and 104h, whose last slice runs the same searches over `src` (Later parts). Exceptions and reasons: Inventory                                   |
| AC3 before/after snapshots of every screen with text; nothing moves                  | This part's set: 24 views × Light and Dark, covering Home, Budget, Income, Expenses, Settings, a category page, the 5 forms, Members, login, no-ledger and the demo strip, with errors, an empty month and the Undo toast. Expected: `diffs: 0` with the type columns |
| AC4 roles and labels unchanged, incl. `header` and `alert`                           | `a11ySame: true`, empty `a11yAdded`/`a11yRemoved` on every view. `header`: the 5 modal titles (`category-form-add`, `delete-category`…). `alert`: `budget-error`, `category-bad-link`, `category-form-error`                                                          |
| AC5 demo renders the touched screens with no console errors; `check-builds` passes   | Slice 1: `check-builds --accept` adds one line. After slice 4: `demo-home` and the demo screens in both themes with a clean console; `check-builds` without `--accept` passes                                                                                         |
| AC6 gates                                                                            | Every slice                                                                                                                                                                                                                                                           |

## Not doing (YAGNI)

- **105's look**: Inter, new sizes, tracking and colours; an overline role for the two +0.5 trackings.
- **TextInput styling** (106/105), and TabBar (106).
- **The weight fixes**, unless chosen at Gate A (Open question 4).
- **A lint rule** banning `...text.` and `fontFamily` outside `Text.tsx` (Follow-ups).
- **A narrower colour type** (only the 7 text colours): one more list to keep in step, for a mistake review catches.
- **Dropping `tabular` from digit-free text** (the category page's "Spent"): it's today's style, and invisible.
- **Docs.** `docs/design/design-system.md`'s Components row ("`variant` prop from the type roles; colour defaults to
  `text`") stays true. The BACKLOG rows are the orchestrator's.

## Risks

- **A computed type value changes where no box moves** (a face or tracking lost in the move). The new type columns
  catch it on every row, in slice 1's views first.
- **`StyleSheet.create` with `...text` drops or changes a value on web** (for example `fontVariant` arrays). Slice 1's
  Button labels and slice 2's HomeCards figure show it in the rows.
- **`Link asChild` changes DemoStrip's link** (tag, `href`, role, focus ring) or throws in development. Slice 3's
  `demo-home` compares the row (tag `A`) and the record (`link`); the console shows any Slot error.
  - Fallback: keep DemoStrip's `Link` as it is, as a listed exception (its style spreads `text.label` and sets the
    semibold face). About 6 lines fewer.
- **The Undo toast times out before its snapshot** (10 s). Take the screenshot and snapshot first, then Undo; restore
  through the API if it's missed.
- **The day changes, or November ends, between the sets.** Covered in Set-up.
- **Main moves.** Rebase, take main's version and bump once more (§8b). If the move changes a snapshotted view, take a
  fresh baseline (104 script, step 7).

## Open questions

1. **Blocking: yes (Gate A). One PR or a split, and where to cut (brief open question 3).**
   - Recommended: three PRs, as in the Approach: 104f, `Text` and `components/` + `demo/` (362 lines); 104g, the tab
     screens and the category page (256); 104h, Settings, Members, the forms' screens, login and no-ledger (220).
   - Each is a brief of its own, written after the previous one merges, with its own patch bump and before/after set.
   - The brief's two-way cut leaves the screens at 474 lines.
   - Assumed: three PRs.
2. **Blocking: yes (Gate A). The variant set and names, and one-offs (brief open question 1).**
   - Recommended: the 10 `text` roles (with `input`) plus four pairs: `bodyMedium` (18 sites + 2 states + 2 Button
     looks), `labelRegular` (23 + 1), `labelSemi` (10 + 1) and `headingDisplay` (10). 104g adds `captionMedium` (1).
   - **Names are role + face**, not use. The brief's use names fit only some of their sites: `screenTitle` would cover
     1 of the 10 heading-in-display sites (the rest are section titles, the sheet title, two totals and Settings'
     initial); `rowName` would also name the toast, EmptyMonth, the ⋯ menu row and the header Back.
   - **One-offs:** a different face always becomes a variant, so `fontFamily` never appears outside `Text.tsx` (that's
     `captionMedium`, one caller). Everything else (centring, the +0.5 tracking, layout) stays a `style`.
   - **Tabular digits: a `tabular` prop** (19 sites, 3 in this part). As a `style`, it would need its own entry in 8
     files' StyleSheets, and the money rule (§5: "its role plus tabular digits") would hide in layout styles.
   - The snapshots show no difference either way.
   - Assumed: as recommended.
3. **Blocking: yes (Gate A). `color` as a palette key or a value (brief open question 2)?**
   - Recommended: a key, `color="muted"`, typed `keyof Palette`.
   - `Text` reads the palette itself, so it follows a theme change, and callers don't need `useColors()` for text
     (Budget's IncomeFigures and CollapsingSummary drop it in the draft).
   - A key can't be a hex or a one-off value. The one computed colour, CategoryTile's letter, is an exception anyway.
   - It matches IconButton's `tone`, which names the colour rather than passing it.
   - A value would let any colour in, and 105's palette renames would chase every call site.
   - Assumed: key.
4. **Blocking: yes (Gate A). The two weight inconsistencies (brief open question 4).**
   - **Correction to the brief:** the amount fields (AmountFields, in the expense and income forms) type in the
     medium face, like `DateField`. The regular-weight inputs are the expense's name, the income's title and the
     actual End amount. The category form, Members and login inputs are medium too.
   - Recommended: **keep both** as they are.
     - Both are TextInput looks or labels whose target 105 already sets: the design doc gives `input` weight 400 and
       `label` (field labels) 500. Login's medium labels and the three regular inputs already match it; "fixing" them
       towards today's majority would move them away from 105 and back again.
     - Inputs are out of this brief's scope.
   - If you choose to fix them now, both land in 104h, where those styles live, and are listed in its PR:
     - **Inputs to medium:** the snapshots show `fontFamily` `IBMPlexSans_400Regular` → `IBMPlexSans_500Medium` on the
       three input rows (`expense-new`'s name, `income-item-add`'s title, `actual-end`'s amount). No box moves: the
       fields are 48pt high and the typed text isn't measured.
     - **Login's labels to `labelSemi`:** `IBMPlexSans_500Medium` → `IBMPlexSans_600SemiBold` on the two label rows
       of `login`. The labels fill the column's width, so no box moves.
   - Assumed: keep both.
5. **Blocking: no. A second QA user.** The brief's test data has one user, but AC3 lists no-ledger, which needs a user
   with no ledger. Assumed: `claude-qa-104f-n` (joined, then removed), as 104c did, deleted with the owner.
6. **Blocking: no. LedgerPicker and PendingInvites on Home/Settings are checked from the code only**, as 104's Gate A
   chose. LedgerPicker would need a third user with their own ledger who accepts the owner's invite. Assumed: code only.
7. **Blocking: no. DemoStrip's link through `Text`** (`Link asChild`, the same pattern login uses with Pressable)
   rather than a new exception. It's not on the brief's list. `styles.link` stays a single object, since `Slot` throws
   on a style array in development. Assumed: through `Text`, with the exception as the fallback (Risks).
8. **Blocking: no. `input` as a variant** for the € and ₴ inside the amount fields. The brief's variant list omits
   `input`, but it's a `theme.ts` role and these are `Text`s. `DateField`'s value stays the brief's exception (input
   in the medium face, a one-off beside the TextInputs). Assumed: `input` is a variant.
9. **Blocking: no. Other corrections to the brief:** 140 `<Text>` in **37** files; MonthSwitcher's eyebrow and the day
   labels go through `Text`, keeping only their tracking as a `style` (Inventory). Assumed: as written.

## Follow-ups

- **A lint guard** (`no-restricted-syntax` on `...text.*` spreads and `fontFamily` outside `Text.tsx` and `theme.ts`,
  with the exceptions allowlisted) would keep AC2 true for new code. It's not in the brief; propose it after 104h.
- **After 104h** (the brief's note): conventions §5 could point new code at the seven 104 components, and say text
  goes through `Text` (a proposal, not a slice).
- **For 105:** map each variant to an Inter weight in `Text.tsx`; decide an overline role for the two +0.5 trackings;
  the `tabular` on digit-free captions can go; `docs/design/design-system.md`'s `Text` row can name the pairs.

## Later parts (outline; each brief is written after the previous part merges)

Each: base `main` after the previous part, a patch bump, before/after snapshots of its own screens with this plan's
script, "nothing moves". The line counts come from the full draft and are measured again in each part's plan.

- **104g, the tab screens and the category page (≈ 256 lines, 50 sites):**
  - Files: `app/(tabs)/index.tsx`, `budget.tsx`, `income.tsx`, `expenses.tsx`, `statistics.tsx`,
    `app/category/[categoryId].tsx`, `demo-app/(tabs)/index.tsx`, and `Text.tsx` (+2: `captionMedium`).
  - State switches: Budget's and Expenses' figure colours, Statistics' negative amounts, over gaps and checked period
    (`bodyStrong`). The nested " of €…" becomes `<Text variant="body" color="muted">`: the same size as its `amount`
    parent, in the regular face, inheriting the tabular digits.
  - The comments on removed styles move to the JSX (Expenses' "€9 over" contrast note, Income's total, the ⋯ menu
    row's "not a button").
  - Views: `home`, `budget`, `budget-ended`, `income`, `expenses`, `expenses-scrolled`, `statistics`,
    `statistics-menu`, `category`, `category-scrolled`, `category-menu`, a category with no expenses, `demo-home`.
- **104h, Settings, Members, the forms' screens, login and no-ledger (≈ 220 lines, 50 sites):**
  - Files: `app/(tabs)/settings.tsx`, `members.tsx`, `actual-end.tsx`, `delete-category.tsx`, `expense.tsx`,
    `income-item.tsx`, `login.tsx`, `no-ledger.tsx`.
  - The weight fixes, if chosen at Gate A (Open question 4).
  - Its last slice runs AC2's searches over all of `src`: role spreads and `fontFamily` only in `Text.tsx`,
    `theme.ts` and the exceptions; React Native's `Text` imported only by CategoryTile, DateField, TabBar and
    `Text.tsx`, with `rg -U -n "import \{[^}]*\bText\b[^}]*\} from 'react-native'" apps/mobile/src` (`-U` sees
    multi-line imports such as `expense.tsx`'s).
  - Views: `settings`, `members` (with an invite and its confirm panel), the 5 forms with their errors, `login`,
    `no-ledger`.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

After the skeptic's APPROVE WITH EDITS (no change to what ships or to the line estimates):

1. The AC2 import search uses `rg -U`, so it also finds `Text` in imports split over several lines (NameCombobox's and
   `expense.tsx`'s). Changed in Contracts › The list is complete and in Later parts › 104h.
2. DemoStrip's `Link asChild` is described as the same pattern login uses with Pressable (login wraps a Pressable, not
   a Text), in Inventory, Contracts › Reuses and Open question 7, which also notes that `styles.link` stays a single
   object.

## Gate A (2026-11-25)

Approved by the user as recommended: three PRs (104f here: `Text`, the shared components and the demo strip; 104g
and 104h for the screens, each with its own brief and bump); the variant set (the 10 roles plus `bodyMedium`,
`labelRegular`, `labelSemi` and `headingDisplay`, named by role and weight, with the `tabular` flag); `color` as a
palette key; both weight inconsistencies kept for brief 105.
