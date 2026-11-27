# Plan: Category icons

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: PR A `feat/category-icons` (API); PR B `feat/category-icons-app` (app), stacked on PR A
Base: origin/main (ac5a1036, version 1.24.1)

## Approach

**Split into two PRs.** The estimate is ≈ 560 hand-written lines (code and tests) plus ≈ 770 copied or generated lines
(the API's key table, the app's path data and Lucide's licence). That is over the 400-line budget, so the plan proposes
two PRs that each ship on their own:

- **PR A, API (≈ 190 hand-written lines + the 101-line key table).** Migration 019 adds a nullable
  `categories.icon`. The API's list, single-category and add responses carry `icon`. The add and edit bodies take an
  optional `icon`, which is a key from `apps/api/src/categories/icons.ts` or `null`. Nothing sends it yet, so PR A
  changes nothing people see.
- **PR B, app (≈ 370 hand-written lines + ≈ 665 generated and verbatim lines).**
  - The path data for 101 icons is copied from Lucide.
  - `CategoryTile` draws the icon when one is set.
  - `CategoryForm` gets an "Icon" field that opens a picker in the form.
  - The demo store follows the API.

**Where the icon is written.** The icon belongs to the category. It rides on the two category writes the form already
makes, so one Save is still one all-or-nothing request:

- `PATCH /categories/:categoryId/months/:month` (edit),
- `POST /months/:month/categories` (add).

Each sets `categories.icon`, which is the same in every month and for every member. The writes are in `monthLists.ts`,
next to the other category writes, so `routes.ts` (208 lines) grows by about 8 lines of schema and plumbing.

**Where the key list lives** (conventions §2: no shared package across the API/app boundary):

- The API owns the list of valid keys: `CATEGORY_ICONS` in `categories/icons.ts`, read by `z.enum`.
- The app owns what it draws: keys, theme, label and paths in `components/categoryIcons.ts`.
- One app unit test imports the API's tuple and checks that the two key lists are equal, in the same order.
- An app build that doesn't know a key draws the letter. Installed builds lag the API, so this case is real.

**Icon source.** The paths come from Lucide 1.81.0, ISC licence; 115 of Lucide's icons are derived from Feather and
are under MIT. I confirmed the licence in Lucide's `LICENSE` at
`https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE`:

- **ISC part:** "Copyright (c) 2026 Lucide Icons and Contributors". It allows use, copying, modification and
  distribution as long as the copyright and permission notice appear in all copies.
- **MIT part:** "Copyright (c) 2013-present Cole Bemis", for the Feather-derived icons. It has the same notice
  condition.

The icons are 24×24 with round caps and joins and stroke 2, the same model as `Icon.tsx`. All 101 picked names exist
at tag 1.81.0; I checked by downloading them.

**How the paths get in.**

- A **one-off conversion script**, not committed, run from the system temp dir. It reads
  `https://raw.githubusercontent.com/lucide-icons/lucide/1.81.0/icons/<name>.svg` and writes the data file. Each SVG
  element becomes path strings, because `Icon.tsx` only draws `<Path>`. The rules are under Contracts. I ran them on
  the 101 SVGs: the inputs are 316 paths, 42 circles, 14 rects, 5 lines and 1 polyline; there are no ellipses or
  polygons.
- **Size:** ≈ 21.3 KB of path text, ≈ 7.5 KB gzipped, in both web flavours and the native bundle.
- **Licence:** Lucide's `LICENSE` is copied verbatim from the same tag to
  `apps/mobile/src/components/categoryIcons.LICENSE.txt`. Prettier skips `.txt`, so it stays byte-identical. The data
  file's header names the source, the tag, the conversion rules and that file.
- Adding one icon later is a hand copy, using the same rules.

**The picker** opens inside the form's existing `ScrollView`, not in a sheet:

- The "Icon" field is a button with `aria-expanded`. Pressing it opens a radiogroup: a "Letter" choice, then 12
  themes, each with a heading and a wrap grid of 44pt radio cells.
- Picking closes the grid. Saving sends the icon with the name and amount.

Alternatives considered:

- **(a) A separate `PUT …/categories/:id/icon` route.** Not month-scoped. Lost because one Save would become two
  requests that aren't all-or-nothing, and an add would need the reply's id first.
- **(b) The picker in a bottom-sheet `Modal`, like `CategorySheet`.** Lost because it puts an RN `Modal` over the iOS
  modal route `category-form`, which the repo has never done, and it needs `PhoneColumn` on web. It is also more code
  for the same choice.
- **(c) Rendering Lucide's circle, rect and line elements as they are**, with react-native-svg's `Circle`, `Rect` and
  `Line`. Lost because it makes the data larger and the renderer different from `Icon.tsx`'s path-only model. Any
  conversion slip shows in the full-grid visual check.

**Bolt-on check.** `CategoryTile` gets a required `icon` prop next to `techName` and `label`. Passing the whole
category would have been the shape had icons existed from the start, but it touches the same 5 callers for the same
diff. The required prop makes typecheck find every caller. `Icon.tsx`'s `<Svg>` wrapper becomes an exported
`StrokeIcon({ paths, … })`, which both `Icon` and the category icons use. That is a behaviour-preserving reshape with
two callers.

## Contracts

- **DB:** migration `apps/api/migrations/019_category_icons.sql`:
  ```sql
  -- Brief 114. A category's icon: one per category, so every member of the ledger sees it, like its tech_name. A key
  -- from apps/api/src/categories/icons.ts, never path data or a list index. NULL draws the first letter, as before;
  -- nothing is guessed for existing categories.
  ALTER TABLE categories
    ADD COLUMN icon VARCHAR(40) NULL; -- 'shopping-cart'; NULL: the letter
  ```
  - **Additive.** The previous release runs on it: its `INSERT INTO categories` lists its columns, so `icon` gets
    NULL.
  - **Re-runs:** see Risks.
- **API key list:** `apps/api/src/categories/icons.ts` exports `CATEGORY_ICONS`, a readonly `as const` tuple of the 101
  keys below, in picker order. A key may be added; removing one leaves categories holding it, and the app then draws
  their letter. That is written as a comment in the file.
- **API reads:** `CategoryDto` (and so `CategoryWithTotalsDto`) gains `icon: string | null`, documented as "a key from
  `categories/icons.ts`; null shows the letter (brief 114)".
  - It comes from `c.icon` in both SELECTs: `GET /api/ledgers/:id/categories?month=` and
    `GET /api/ledgers/:id/categories/:categoryId?month=`.
  - It is also in the reply of `POST …/months/:month/categories` (201).
  - `AddedCategory` in `monthLists.ts` gains `icon: string | null`.
- **API add body:** `POST /api/ledgers/:id/months/:month/categories`.
  - The body becomes `{ name, amount?, icon? }`, where `icon` is `z.enum(CATEGORY_ICONS).nullable().optional()`.
  - **Left out:** a new category gets NULL, and a category reused by name keeps its icon.
  - **Given** (a key or null): it is written to the new or reused category, and the 201 reply carries it.
  - The existing codes are unchanged.
  - A key not in the list gets `400 { error: 'invalid_request' }` from the global Zod handler, and nothing is added.
- **API edit body:** `PATCH /api/ledgers/:id/categories/:categoryId/months/:month`.
  - The body becomes `{ name?, amount?, icon? }`, with `icon` the same as in the add body.
  - The refine changes to "expected a name, an amount or an icon", so `{}` is still a 400.
  - `icon` is written with `UPDATE categories SET icon = ? WHERE category_id = ? AND ledger_id = ?`, in
    `editInMonth`'s transaction after every check. So `name_taken` (400), an over-income refusal (409), `not_found`
    (404) and `month_ended` (409) store no icon either.
  - An unknown key gets 400 `invalid_request`, and nothing is stored.
- **API signatures:**
  - `editInMonth`'s `CategoryEdit` gains `icon?: string | null`.
  - `addToMonth(db, ledgerId, month, name, amount, icon?: string | null)`.
  - `findByName` also selects `c.icon`.
- **MCP:** no change. `apps/mcp/src/mcp/summary.ts`'s `ApiCategory` reads only `categoryId`, `displayName` and
  `plannedEur`, and ignores the new field.
- **App DTO:** in `apps/mobile/src/api/types.ts`, `Category` gains `icon: string | null`. It is not a literal union,
  because the API may know keys this build doesn't.
- **App icon set:** `apps/mobile/src/components/categoryIcons.ts`.
  ```ts
  export interface CategoryIcon {
    key: string;
    label: string;
    paths: readonly string[];
  }
  /** Brief 114: the picker's themes in order; the icons from Lucide 1.81.0 (see header). */
  export const CATEGORY_ICON_THEMES: readonly { title: string; icons: readonly CategoryIcon[] }[];
  /** The icon for a stored key; null for null or a key this build doesn't know (a newer API's): the tile shows its letter. */
  export function findCategoryIcon(key: string | null): CategoryIcon | null; // a Map built once at module load
  ```
- **Keys, themes and labels (101).** Each key is Lucide's name at 1.81.0. The default label is the key with dashes
  turned into spaces, the first letter upper-case and a trailing `-2` dropped. The overrides are in brackets.
  1. **Food & drink (13):** shopping-basket, shopping-cart, apple, carrot, sandwich, pizza, utensils [Cutlery], coffee,
     wine, beer, croissant, cake-slice [Cake], ice-cream-cone [Ice cream].
  2. **Home (9):** house, sofa, bed, key-round [Key], hammer, wrench, paint-roller, washing-machine, bath.
  3. **Bills (8):** zap [Electricity], droplet [Water], flame [Gas], wifi [Wi-Fi], smartphone [Phone], receipt, tv [TV],
     plug.
  4. **Transport (8):** car, car-taxi-front [Taxi], fuel, parking-meter [Parking], bus, train-front [Train], bike,
     scooter.
  5. **Health (9):** pill [Pills], stethoscope [Doctor], heart-pulse [Heartbeat], syringe, hospital, thermometer,
     glasses, toothbrush, dumbbell [Gym].
  6. **Kids & learning (8):** baby, graduation-cap, book-open [Book], school, backpack, pencil, puzzle, blocks [Toys].
  7. **Pets (6):** dog, cat, paw-print, bone, fish, bird.
  8. **Fun (10):** gamepad-2 [Games], eighth-notes [Music], film, ticket, popcorn, palette [Art], camera, headphones,
     guitar, party-popper [Party].
  9. **Travel (7):** plane, luggage, map, tent, hotel, tree-palm [Palm tree], globe.
  10. **Shopping (9):** shirt [Clothes], shopping-bag, gift, gem [Jewellery], watch, scissors [Haircut],
      sparkles [Beauty], tag, package [Parcel].
  11. **Money & work (9):** wallet, piggy-bank [Savings], coins, banknote [Cash], credit-card, landmark [Bank],
      hand-coins [Payment], briefcase [Work], laptop.
  12. **Other (5):** heart, users [Family], flower-2 [Flowers], shield [Insurance], cigarette.

  Every default category has 2–3 fitting choices:
  - rent: house, key-round
  - groceries: shopping-basket, shopping-cart, carrot
  - eating out: utensils, pizza, coffee
  - utilities: zap, droplet, flame
  - medication: pill, syringe
  - gym: dumbbell
  - Sviat: baby, blocks
  - and so on for the rest.

- **Conversion rules** (all numbers as in the SVG; the script throws on any other element):
  - `path`: its `d`, unchanged.
  - `circle`: `M{cx−r} {cy}a{r} {r} 0 1 0 {2r} 0a{r} {r} 0 1 0 {−2r} 0`, `Icon.tsx`'s own two-arc form.
  - `rect` with no `rx`: `M{x} {y}h{w}v{h}h{−w}z`.
  - `rect` with `rx` (always equal to `ry` here): the same box with four `a{rx} {rx} 0 0 1 …` corners, closed with `z`.
  - `line`: `M{x1} {y1}L{x2} {y2}`.
  - `polyline`: `M{p0}` then `L{pi}` for each further point.
- **App components:**
  - **`StrokeIcon`** (new export of `Icon.tsx`):
    `StrokeIcon({ paths, size, color, strokeWidth = 2 }: { paths: readonly string[]; size: number; color: ColorValue; strokeWidth?: number })`.
    `Icon` becomes `<StrokeIcon paths={PATHS[name]} … />`.
  - **`CategoryTile`:** takes `{ techName, label, icon: string | null, size? }`.
    - With `findCategoryIcon(icon)` it draws `StrokeIcon` at `size * 0.55`, in `tile.fg`. The ratio fits today's
      rounded square and brief 113's circle.
    - Otherwise it draws the letter, as today.
  - **`CategoryIconPicker`** (new, `components/CategoryIconPicker.tsx`):
    `({ value: string | null; onChange: (icon: string | null) => void; disabled?: boolean })`.
    - A `View` with `accessibilityRole="radiogroup"` and `accessibilityLabel="Icon"`.
    - First a "Letter" radio, labelled "Letter, no icon".
    - Then each theme: a heading `Text`, then `Pressable` radios with `accessibilityRole="radio"`,
      `accessibilityLabel={icon.label}` and `aria-checked`, 44×44pt (`size.iconButton`). Each holds a 22pt
      `StrokeIcon` in `colors.text`; the checked one is on `accentTint` in `colors.accentText`.
    - Conditional rendering uses ternaries, not `&&`.
- **App data:**
  - `CategoryFields` gains `icon: string | null`. `checkFields` returns `Omit<CategoryFields, 'icon'> | { error }`,
    because it checks only the typed text.
  - `changedFields` adds `icon` when it differs from `current.icon`.
  - `addToMonth(ledgerId, month, name, amount, icon: string | null)` sends `icon` only when it isn't null. So an add
    that reuses a category by name keeps that category's icon unless one was picked.
  - `editInMonth` is unchanged; its `Partial<CategoryFields>` now carries `icon`.
- **Demo** (conventions §2: the demo repeats DTO and rule changes):
  - `DemoCategory` gains `icon?: string`; absent means the letter, as every sample category has none.
  - `toDto` and the POST reply carry `icon: category.icon ?? null`.
  - POST and PATCH take `icon` like the API: they refuse `400 invalid_request` when it is neither null nor a key
    `findCategoryIcon` knows. That check runs first, before `refuseIfEnded`, matching the API, whose Zod parse comes
    before the month check: a bad key is a 400 even in an ended month.
  - PATCH and POST write it to the category.
- **Reuses:**
  - `Icon.tsx`'s Svg setup, via `StrokeIcon`.
  - `categoryTile()` colours.
  - `Pressable`, `Text`, `useThemedStyles` and the `space`, `size` and `radius` tokens.
  - `AppearancePicker`'s radio pattern (`radiogroup`, `radio` with `aria-checked`).
  - The existing `editInMonth`/`addToMonth` transactions in both the API and the app; `changedFields`; the demo's
    `refuse`; the test helpers `storeMonthList`, `addMember`, `makeUser` and `authHeader`.
- **New dependencies:** none. Lucide's paths are copied into the repo, not installed.

## Version

- **PR A.** Bump: minor, 1.24.1 → 1.25.0. Why: the §8b `minor` row, "new … optional field; additive migration". The
  category responses gain `icon` and the bodies accept an optional `icon`; migration 019 only adds a nullable column.
  Installed apps, the connector and rollback keep working.
- **PR B.** Bump: minor, 1.25.0 → 1.26.0. Why: the §8b `minor` row, "new user action". Members can pick an icon, and
  tiles draw it.
- If the round tile (brief 113, `round-category-tile`) merges first, each PR rebases and bumps from `main`'s number
  (§8b step 4).

## Slices

### PR A: API (`feat/category-icons`)

- [x] 0. Bump version to 1.25.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.25.0.
- [x] 1. Add a nullable icon column to categories (≈ 25 lines)
  - Files: `apps/api/migrations/019_category_icons.sql`, `apps/api/test/categoryIcons.migration.int.test.ts`
  - Change: the migration under Contracts.
  - Tests: modelled on `monthActualEnds.migration.int.test.ts`.
    - `SHOW COLUMNS FROM categories WHERE Field = 'icon'` gives `['icon', 'varchar(40)', 'YES']` with a NULL default.
    - Running `runMigrations` again returns `[]`.
- [x] 2. Return each category's icon key, or null, from the category routes (≈ 45 lines)
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/src/categories/monthLists.ts`,
    `apps/api/test/categories.int.test.ts`, `apps/api/test/categories.test.ts`
  - Change:
    - `c.icon` goes into both SELECTs; `CategoryDto.icon` and `toDto`.
    - `AddedCategory.icon`: `findByName` selects `c.icon`, and a created category gives `null`.
  - Tests:
    - The two add tests that use `toEqual` gain `icon: null`: "creates a category …" and "reuses the category a name
      has in any month, latest first" (≈ line 1066).
    - New: "lists every seeded category with no icon".
    - New: "gives a category's icon in the list and on its own, to every member". It sets
      `UPDATE categories SET icon = 'dog'` in SQL, then reads with the owner and with a member added via `addMember`.
    - The `categories.test.ts` fixture gains `icon: null`.
- [x] 3. Let a category's add and edit set or clear its icon (≈ 120 lines + the 101-line key table)
  - Files: `apps/api/src/categories/icons.ts` (new), `routes.ts`, `monthLists.ts`, `categories.int.test.ts`
  - Change: `CATEGORY_ICONS`; the `IconKey` schema in the `AddBody` and `EditBody` schemas; the writes in
    `editInMonth` and `addToMonth` as under Contracts, with their doc comments updated.
  - Tests: `describe('icons (brief 114)')`:
    - "sets the icon on the category, in every month and for every member": PATCH October `{ icon: 'shopping-cart' }`
      gives 204. The October and November lists (`storeMonthList`), GET one and a member's list all show it; the name
      and amount don't change.
    - "clears it with null".
    - "rejects a key not in the list, storing nothing": `'rocket'`, `'Shopping-Cart'`, `''`, `5`, and
      `{ name: 'home', icon: 'rocket' }`. Each gives 400 `invalid_request`; the name and icon are unchanged.
    - "stores no icon when the edit is refused": `name_taken` 400, `month_ended` 409 (2026-09), `not_found` 404 (a
      removed category), and over income 409 (in the brief 060 block).
    - "adds a category with an icon": 201, with `icon` in the body and stored.
    - "keeps a reused category's icon unless one is sent", then "… replaces it when one is sent". The second asserts
      that the 201 reply carries the new icon, as well as the stored one.
    - "rejects an add with an unknown key, adding nothing".
    - The existing `{}` → 400 still holds. The `describe.each` guard tests cover 401 and 404 for a non-member on edit,
      and "needs a session and a ledger of mine" on add.

### PR B: app (`feat/category-icons-app`, stacked on PR A)

- [x] 4. Bump version to 1.26.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.0.
- [x] 5. Add the category icon set, copied from Lucide with its licence (≈ 45 hand-written lines + ≈ 620 generated +
      ≈ 45 verbatim)
  - Files: `apps/mobile/src/components/categoryIcons.ts` (generated data, plus `findCategoryIcon`),
    `apps/mobile/src/components/categoryIcons.LICENSE.txt` (Lucide's `LICENSE` at 1.81.0, verbatim),
    `apps/mobile/test/categoryIcons.test.ts`
  - Change: run the one-off script described under Approach and Contracts, from the system temp dir. Then
    `yarn format`. This commit is mechanical (§8).
  - Tests:
    - 101 icons in 12 themes.
    - Keys and labels are unique and non-empty.
    - Each key is in exactly one theme.
    - Every path matches `/^[Mm][-0-9.,\sMmLlHhVvCcSsQqTtAaZz]+$/`. A leading lowercase `m` is absolute per the SVG
      spec, and Lucide uses it (50 of the 316 path `d`s start with `m`, toothbrush among them).
    - No arc has run-together flags, after the script's normalisation (see Risks).
    - The keys in order equal `CATEGORY_ICONS`, imported from `../../api/src/categories/icons`.
    - `findCategoryIcon(null)` and `findCategoryIcon('rocket')` return null; `findCategoryIcon('dog')` returns its
      paths.
- [x] 6. Carry the icon in the app's category types, form fields and demo store (≈ 120 lines)
  - Files:
    - `apps/mobile/src/api/types.ts`, `src/data/categories.ts`, `src/data/categoryForm.ts`
    - `src/components/CategoryForm.tsx`: `save({ ...fields, icon: current?.icon ?? null })`, with no UI yet
    - `src/app/category-form.tsx`: the add passes `icon`
    - `src/demo/state.ts`, `src/demo/categoryRoutes.ts`
    - Tests: `test/categoryForm.test.ts`, `test/demoCategories.test.ts`, `test/quick.test.ts`,
      `test/monthSummary.test.ts`; the last two only get `icon: null` in their fixtures.
  - Tests:
    - `changedFields` rows: an icon added, changed, cleared to null and unchanged.
    - Demo: a list `toEqual` gains `icon: null`.
    - Demo: PATCH `{ icon: 'dog' }` shows in the list and on GET one.
    - Demo: `{ icon: null }` clears it.
    - Demo: an unknown key gives `refusal(400, 'invalid_request')`, with nothing changed, even in an ended month.
    - Demo: POST with an icon returns it.
  - Check: run `yarn mobile export:web` and `yarn mobile check-builds --accept`; commit the `demo-modules.txt` diff,
    which adds `src/components/categoryIcons.ts`.
- [x] 7. Draw a category's icon in its tile instead of the letter (≈ 45 lines)
  - Files: `apps/mobile/src/components/Icon.tsx` (extract `StrokeIcon`; `Icon` unchanged in output),
    `CategoryTile.tsx`, `CategoryPicker.tsx`, `CategorySheet.tsx`, `src/app/(tabs)/budget.tsx`,
    `src/app/(tabs)/expenses.tsx`, `src/app/category/[categoryId].tsx`
  - Change:
    - The `icon` prop, passed from `c.icon`, `category.icon` or `row.icon`.
    - The `0.55` ratio is allowlisted with a reason comment if lint flags it. `size` isn't a style key, so it
      probably won't.
  - Verify: web at phone width, launch configs `web` and `api`, in light and dark.
    - Set an icon on one category with `curl` (PATCH, as under Contracts).
    - It shows in the Add expense quick row chip, the "N more" sheet, Budget, Expenses and the category screen.
    - The other categories keep their letter.
    - The tab bar and header icons look unchanged.
- [x] 8. Let members pick a category's icon, or the letter, in the category form (≈ 150 lines)
  - Files: `apps/mobile/src/components/CategoryIconPicker.tsx` (new), `CategoryForm.tsx`
  - Change:
    - `CategoryForm` keeps `icon` state, starting at `current?.icon ?? null`.
    - Under "Planned amount" sits an "Icon" field: label "Icon", then a `Pressable` with role `button`,
      `accessibilityLabel` `Icon: ${findCategoryIcon(icon)?.label ?? 'Letter'}` and `aria-expanded`. It shows the
      chosen icon (`StrokeIcon`) or "Letter", plus a `down` chevron, and is disabled while `busy || gone`.
    - Pressing it calls `Keyboard.dismiss()` and toggles the picker below it.
    - Picking sets `icon`, closes the picker and clears the error.
    - Save sends `{ ...fields, icon }`.
    - Under the field's label, a caption: "Same in every month". The form's own caption says changes are only for this
      month, and the icon isn't.
  - Check: run `yarn mobile export:web` and `yarn mobile check-builds --accept`; commit the `demo-modules.txt` diff,
    which adds `src/components/CategoryIconPicker.tsx`.
  - Verify: web at phone width, and iPhone through Expo Go.
    - Add a category with an icon, then edit it to another icon and to "Letter".
    - Check that 12 headings and all 101 icons draw, with none blank or garbled. Compare a sample against
      lucide.dev/icons.
    - The current choice is marked; "Letter" is marked for a new category.
    - Each tile follows (chip, sheet, Budget, Expenses, category screen).
    - VoiceOver reads "Shopping cart, radio button, selected" and the like.
    - Web's accessibility tree shows `role=radio`, `aria-label` and `aria-checked`.
    - A second member signed in sees the same icon.
    - An ended month's form refuses the save (`month_ended`), as for names.
- [x] 9. Record brief 114 in the backlog (≈ 10 lines; docs only)
  - Files: `docs/features/BACKLOG.md`
  - Change: a "114 · Category icons (done: #A, #B, v1.26.0)" entry. The 092 `routes.ts` follow-up line notes 114's
    growth.

## AC → evidence

| AC                                                                                          | Evidence                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No icon → the letter, as today                                                              | API "lists every seeded category with no icon"; app `findCategoryIcon(null)` is null; slice 7's manual check that untouched categories keep their letter                                                                                                       |
| Form → "Icon" opens a grid of ~100 icons by theme, the current choice marked, plus "Letter" | `categoryIcons.test.ts` (101 icons, 12 themes, each key in one theme); slice 8's manual check on web and iPhone                                                                                                                                                |
| Pick + save → the key is stored; every tile shows it, for every member                      | API "sets the icon on the category, in every month and for every member" and "adds a category with an icon"; `changedFields` icon rows; demo PATCH test; slices 7–8 manual checks of chip, sheet, Budget, Expenses and category screen, and of a second member |
| "Letter" + save → cleared, the letter again                                                 | API "clears it with null"; `changedFields` null row; demo null test; slice 8 manual                                                                                                                                                                            |
| API: 400 for an unknown key, accepts null                                                   | API "rejects a key not in the list, storing nothing", "rejects an add with an unknown key, adding nothing" and "clears it with null"                                                                                                                           |
| Responses carry `icon` or `null`; older builds keep working                                 | API list, one and add tests (`toEqual` with `icon`); the field is additive, and installed builds read only the fields they type; the migration is additive and nullable (rollback)                                                                             |
| The MCP connector keeps working                                                             | `apps/mcp` is unchanged; `ApiCategory` destructures three fields; `yarn test` runs the MCP suites unchanged in both PRs                                                                                                                                        |
| Picker works on web at phone width and on iPhone; each icon labelled for screen readers     | `categoryIcons.test.ts`: unique, non-empty labels; slice 8's manual VoiceOver and web accessibility-tree checks                                                                                                                                                |

## Not doing (YAGNI)

- A sheet or modal for the picker, icon search, or "recently used" icons.
- Per-member icons, uploads, emoji, or a colour choice per category.
- Guessing icons for existing or default categories, or for the demo's sample categories.
- The icon in the MCP connector's tool output.
- An in-app "open-source licences" screen (see Open questions).
- Committing the conversion script.
- A shared package for the key list.
- Changing the icon in an ended month (see Open questions).
- Splitting `categories/routes.ts` into a `service.ts`: it stays the 092 follow-up, for `/kopiyka-hos-refactoring`.
- The tile's shape (brief 113, `round-category-tile`).

## Risks

- **The app test's import of `../../api/src/categories/icons` trips mobile's typecheck or lint**, for example on a
  cross-workspace path. Slice 5 proves or disproves it. Fallback: read the file with `node:fs` and take the quoted keys
  with a regex, as a test-only guard.
- **A conversion slip draws a wrong or blank icon.** The slice 5 test checks the path syntax, and slice 8's full-grid
  visual check catches the drawing; compare the 20 circle- and rect-heavy icons against lucide.dev.
- **Strokes look thin in the 26pt chip tile** (≈ 14pt icon, ≈ 1.2pt stroke). Slice 7's visual check decides. Fallback:
  a thicker `strokeWidth` for small tiles only, chosen at that check.
- **The inline picker in the iOS modal route fights the keyboard or the swipe-to-dismiss.** Slice 8 checks this on
  iPhone; `Keyboard.dismiss()` runs on open.
- **Migration re-runs.** MySQL 8 has no `ADD COLUMN IF NOT EXISTS`. If a crash lands between the `ALTER` and the
  `schema_migrations` row, the re-run fails on a duplicate column. That's the same as 009 and 011, and `migrate.ts`'s
  stated fix-forward applies: record the row by hand. Slice 1's re-run test covers the normal path.
- **Brief 113 (`round-category-tile`) conflicts in `CategoryTile.tsx`.** 113 changes the radius and 114 changes the
  child, so it's a small rebase. Nothing here depends on 113.
- **Compact arc flags.** About 22 Lucide paths among the 101 icons write an arc's flags with no separators
  (`a2 2 0 00-1.999-2`). The SVG grammar allows this, but react-native-svg's native parser may not read it the way the
  browser does. Preferred fix: the conversion script normalises every arc to separated flags
  (`a2 2 0 0 0-1.999-2`), and slice 5's test asserts that no arc in the data has run-together flags. If the
  normalisation can't be made reliable, slice 8's iPhone check looks at each of those icons on the native parser
  instead, and the PR lists them.
- **PR B needs PR A deployed.** Web and API deploy together; the order is PR A merged before PR B.

## Open questions

- **Not blocking. Where does the icon field appear?** (The brief's question.) Default: wherever `CategoryForm` is used,
  which is Add and Edit on `/category-form`. On Base, the expense form's category sheet only picks; `addToMonth` is
  called only from `category-form.tsx`, so there is nothing to add there.
- **Not blocking. Should this be two PRs (API, then app stacked on it) or one?** Default: two, because of the size.
  With one PR, it's one bump to 1.25.0.
- **Not blocking. An icon change rides on the month's edit, so an ended month refuses it (`409 month_ended`).** Default:
  accept that. A category is changed from a month that's still open.
- **Not blocking. What happens to the icon when an add reuses a category by name?** Default: the form sends an icon
  only when one is picked. A picked icon replaces the reused category's icon; "Letter" leaves it alone.
- **Not blocking. Where does Lucide's licence notice live?** Default: in the repo only, next to the copied data. The app
  shows no licences screen.
- **Not blocking. Picker inside the form, or in a sheet?** Default: inside the form, which is less code and avoids a
  Modal over the iOS modal route.

## Follow-ups

- `apps/api/src/categories/routes.ts` (208 → ≈ 216 lines) and `monthLists.ts` (364 → ≈ 380 lines) are both past the
  ~200-line split point. The existing 092 follow-up covers `routes.ts`; `monthLists.ts` is worth adding to it.

## Deviations

- PR A: rebased onto main after #181 (brief 113, 1.24.2) merged; the bump is now 1.24.2 → 1.25.0, still minor.
- slice 7: checked on the demo web build that letters, tab bar and header icons are unchanged; the icon in each tile
  is checked in slice 8, where the picker can set one, instead of by `curl` against a local API.
- slice 8: the Icon field shows the chosen icon's name beside it ("Paw print"), not the icon alone, so it reads
  without the picker open; a few lines in the same component.
- slice 5: the script re-writes every path from its parsed commands with a space between all numbers, not only the
  arcs, so no arc flags run together and the native parser reads one simple form. Same drawing; ≈ 9.8 KB gzipped
  rather than ≈ 7.5 KB, and ≈ 1,000 formatted lines rather than ≈ 620.

## Consolidate

PR A (slices 0–3): reused 0 · extracted 0 · left 3.

- `storeIcon` (`monthLists.ts`): LEAVE. Its nearest twin, `storePlanned`, writes `category_budgets` per month with an
  upsert; this is one `UPDATE` of the category's own column.
- `CATEGORY_ICONS` / `IconKey`: LEAVE. No other key list or enum of the kind in the API.
- `categoryIcons.migration.int.test.ts`: LEAVE. One test per migration is the repo's pattern (018's is its template).

## Revision 1

Skeptic verdict: APPROVE WITH EDITS. Origin/main moved to ac5a1036 (1.24.1), and the brief became 114. Applied:

- **Numbering:** the brief is renumbered 114 everywhere. The round tile is now brief 113 (`round-category-tile`).
- **Base:** ac5a1036; PR A goes 1.24.1 → 1.25.0. The Expenses tile line (`expenses.tsx` l.162) and the
  `monthSummary.test.ts` fixtures (l.86, l.116) are re-checked against 41192d0c and are unchanged.
- **Slice 5:** the path regex allows a leading `m`, and the test asserts no run-together arc flags.
- **Slices 6 and 8:** each runs `export:web` plus `check-builds --accept`, and commits the `demo-modules.txt` diff.
- **Slice 8:** the Icon field gets a caption, "Same in every month".
- **Risks:** added compact arc flags, normalised in the conversion script.
- **Contracts and slice 3:** when an add reuses a category and an icon is sent, the 201 reply carries the icon. The
  second add test that uses `toEqual` is updated too.
- **Demo:** the unknown-key check runs before `refuseIfEnded`, as in the API.
