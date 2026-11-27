# Category icons

Type: feature

## Why

A category is shown as a coloured tile with its first letter. Letters repeat (several "S" or "T" categories) and say
little at a glance. An icon per category makes the chips, Budget and Expenses lists faster to scan.

## What

- Each category can have an icon chosen from a built-in list of about **100 icons**, grouped by theme (food, home,
  transport, health, kids, pets, fun, travel, bills, shopping, money…), so a typical category has 2–3 fitting choices.
- The icon belongs to the **category**: in a shared ledger every member sees the same icon, like the category's name.
  Any member who can rename a category can change its icon.
- A category with no icon shows its letter, as today. Existing and new categories start with no icon; nothing is
  guessed by migration.
- Where an icon is set, `CategoryTile` draws it instead of the letter, in the tile's existing colours, everywhere the
  tile appears (chip, picker sheet, Budget, Expenses, category screen).
- Picking: the category create/edit form (`CategoryForm`) gets an "Icon" field that opens a picker: a scrollable grid
  of the icons by theme, plus a "Letter" choice that clears the icon. The current choice is marked. Saving the form
  saves the icon with the rest.

## Icon source (decided at intake)

- **No new package.** `@expo/vector-icons` is not installed here, and the app already draws its own 24×24 round-cap
  stroke icons as SVG paths (`apps/mobile/src/components/Icon.tsx`, react-native-svg). The category icons follow that
  model: SVG path data kept in the repo, drawn with react-native-svg, so iOS and web look the same and no icon font
  has to load on web.
- Drawing ~100 icons by hand isn't realistic. The planner should check taking the path data from an open-source set in
  the same 24×24 stroke style (for example Lucide, ISC licence) copied into the repo with its licence notice, rather
  than depending on the package. Confirm the licence terms against the source before copying.
- Icons are stored by a stable **key** (e.g. `shopping-cart`), never by path data or a list index, so the set can be
  reordered or redrawn later.

## Acceptance criteria

- [ ] Given a category with no icon, then its tile shows the letter as today.
- [ ] Given the category form, when a member opens "Icon", then a grid of ~100 icons grouped by theme is shown with the
      current choice marked, plus a "Letter" choice.
- [ ] When a member picks an icon and saves, then the API stores its key on the category, and every tile of that
      category (chip, picker sheet, Budget, Expenses, category screen) shows the icon, for every member of the ledger.
- [ ] When a member picks "Letter" and saves, then the icon is cleared and the letter shows again.
- [ ] The API rejects an icon key that isn't in the known list (400), and accepts `null` to clear it.
- [ ] The API's category responses include the icon key (or `null`); older app builds that ignore it keep working.
- [ ] The MCP connector keeps working (it may ignore the new field).
- [ ] The picker works on web at phone width and on iPhone, with each icon labelled for screen readers.

## Out of scope

- Per-member icons (one icon per category, shared by the ledger).
- Custom uploads, emoji, or colour choice per category (colours stay derived from `techName`).
- Guessing icons for existing or default categories.
- Changing the tile's shape (brief 113, `round-category-tile`).

## Notes

- Schema: `categories` (`apps/api/migrations/001_initial.sql`); next migration is `019_…`. A nullable
  `icon VARCHAR(…)` column on `categories` is the obvious fit; the key list must live where both API validation and the
  app can agree (shared constant or API-owned list — planner's call per conventions on where logic lives).
- Code: `CategoryTile.tsx`, `CategoryForm.tsx`, `CategorySheet.tsx`, `CategoryPicker.tsx`,
  `apps/api/src/categories/routes.ts` (already over 200 lines — see the 092 follow-up in BACKLOG).
- Bundle size: ~100 icons of path strings is small, but the planner should note the size.
- Version: new user-visible feature, likely a minor bump (conventions §8b).

## Open questions

- Should the icon field also appear when creating a category from the expense form's category sheet, or only in the
  category form? (Default: wherever `CategoryForm` is used.)
