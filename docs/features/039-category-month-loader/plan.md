# Plan: Share the category-in-a-month loader

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/category-month-loader
Base: origin/main (f7a45a8)

## Approach

The split is a data hook plus a presentational component, following conventions §2. Screens parse params and call
hooks. `components/` gets props in and doesn't fetch or read auth.

- `useCategoryTotals` accepts `null` ids. A bad link then fetches nothing and reads as `status: 'invalid'`, so screens
  can call the hook at the top level without their own inner `CategoryLoader` component.
- The new `components/CategoryInMonth.tsx` renders every non-ready state once:
  - bad link;
  - spinner;
  - "Category not found.";
  - the Retry error;
  - `“<name>” isn’t in <Month>.`

  For an in-month category it calls `children(category, month)`.

- **The two modals** drop their `CategoryLoader` and the bad-link ternary.
- **The Category screen** replaces only its `NotInMonth` body, with `spinnerMargin={24}`.
- **What stays in the Category screen:**
  - its month default (`params.month || thisMonth`), which `ended` and the header also need;
  - its `useMonth` first-load spinner and error, which belong to a different request;
  - its "Couldn't refresh" banner.

Alternative considered: one component that takes the parsed ids and calls `useSession` + `useCategoryTotals` itself.
That's about 6 fewer lines and leaves the hook unchanged, but a component that reads auth and fetches breaks §2's
`components/` rule. `app/` can't hold it either, because every file there becomes a route.

## Contracts

- DB: none.
- API: none.
- App:
  - `apps/mobile/src/data/useCategoryTotals.ts`:
    ```ts
    export type CategoryTotals = { reload: () => void } & (
      | { status: 'invalid' } // a null id or month (bad link): nothing was fetched
      | { status: 'loading' }
      | { status: 'error'; error: unknown }
      | { status: 'ready'; category: CategoryWithTotals; month: string } // month: the checked 'YYYY-MM' it loaded
    );
    export function useCategoryTotals(
      ledgerId: number,
      categoryId: number | null,
      month: string | null,
    ): CategoryTotals;
    ```
    - The effect returns early on `null`.
    - After the hooks, `null` returns `{ status: 'invalid', reload }`.
    - The fetch is unchanged otherwise. It still loads on mount and on `reload`, not on focus.
    - `month` sits on `ready` so a screen that holds a `string | null` month gets a checked one in `children`, with no
      `!`.
  - `apps/mobile/src/components/CategoryInMonth.tsx`:

    ```ts
    export function CategoryInMonth(props: {
      totals: CategoryTotals;
      /** Spinner's top margin: 32 in the modals, 24 under the Category screen's header. */
      spinnerMargin?: number; // default 32
      children: (category: CategoryWithTotals, month: string) => ReactNode;
    }): ReactNode;
    ```

    Branches, in order, with the texts exactly as they are today:

    | State                           | Renders                                                                                                             |
    | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
    | `invalid`                       | `<LoadError message="That link isn’t valid." />`                                                                    |
    | `loading`                       | `<ActivityIndicator color={colors.accent} style={{ marginTop: spinnerMargin }} />`                                  |
    | `error`, `ApiError` `not_found` | `<LoadError message="Category not found." />`                                                                       |
    | `error`, anything else          | `<LoadError message="Couldn’t load this category. Check your connection and try again." onRetry={totals.reload} />` |
    | `!category.inMonth`             | `<LoadError message={`“${displayName}” isn’t in ${monthName(month)}.`} />`                                          |
    | otherwise                       | `children(category, month)`                                                                                         |

    Consumers: `delete-category.tsx`, `planned-amount.tsx`, `category/[categoryId].tsx` (`NotInMonth`).
- New dependencies: none.

## Slices

- [x] 1. Share the category loading states with the Remove category modal
  - Files:
    - `apps/mobile/src/data/useCategoryTotals.ts`
    - `apps/mobile/src/components/CategoryInMonth.tsx` (new)
    - `apps/mobile/src/app/delete-category.tsx`
  - Change:
    - Apply the hook contract above and add the component.
    - In `DeleteCategoryScreen`, call `useSession` + `useCategoryTotals(ledger.ledgerId, categoryId, month)`. Render
      `<CategoryInMonth totals={totals}>{(category, month) => <Confirm … />}</CategoryInMonth>` under the header.
    - Delete `CategoryLoader` and its "only two uses" comment.
  - Size: ~95 lines.
  - Verify: gates, then web at 390×844 with the `api` and `web` launch configs. Check these links and states:
    - `/delete-category?categoryId=abc&month=2026-10` shows "That link isn’t valid.", and Network shows no category
      request.
    - `?categoryId=999999&month=2026-10` shows "Category not found." with no Retry.
    - An existing id with `month=2020-01` shows "“<name>” isn’t in January.".
    - A valid link reaches the confirm view.
    - With DevTools "Offline", the Retry error appears. Going back online and pressing Retry loads the category.
    - With "Slow 4G", the spinner shows with `margin-top: 32px`.
- [x] 2. Share the category loading states with the Planned amount modal
  - Files: `apps/mobile/src/app/planned-amount.tsx`
  - Change:
    - Do the same as slice 1, rendering `<Editor … />` in `children`.
    - Delete `CategoryLoader`.
    - `leave(month)` keeps the screen's parsed month.
  - Size: ~35 lines.
  - Verify: gates, then the same six checks on `/planned-amount?...`. The editor opens with the stored amount, and
    Cancel on a bad link still goes to `/budget`.
- [x] 3. Share the category loading states with the Category screen
  - Files: `apps/mobile/src/app/category/[categoryId].tsx`
  - Change: `NotInMonth` keeps its `useSession` + `useCategoryTotals` (still mounted only when the month's list lacks
    the category) and returns `<CategoryInMonth totals={totals} spinnerMargin={24}>{() => null}</CategoryInMonth>`.
    Above `{() => null}`, add a one-line why-comment: it renders only when another member adds the category between
    the two requests, and the next focus reload shows it. Remove the `ApiError` import. Nothing else in the file
    changes.
  - Size: ~20 lines.
  - Verify: gates, then web at 390×844:
    - `/category/abc` shows the "Back" header and "That link isn’t valid.".
    - `/category/999999?month=2026-10` shows "Category not found.".
    - An existing id with `?month=2020-01` shows "“<name>” isn’t in January.".
    - Under "Slow 4G", the not-in-month spinner shows with `margin-top: 24px`.
    - With "Offline" after the month loads, the Retry error appears. To reach it, navigate to a not-in-month link
      in-app, or block only `/categories/` in DevTools request blocking.
    - `/category/<id>` with no month opens on this month's breakdown.
    - The loaded breakdown looks unchanged.

Total: ~150 changed lines.

## AC → evidence

| AC                                                         | Evidence                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All three screens use the shared piece, with no own copies | Slices 1–3. After slice 3, `rg -n -F -e 'Category not found' -e '” isn’t in ${monthName(month)}.' -e 'Couldn’t load this category' apps/mobile/src/app` matches only the Category screen's `useMonth` first-load error line. The one remaining bad-link line is in the Category screen (Open questions). |
| Same text and controls in every state                      | Each slice's web checks (bad link, loading with spinner margin, not found, Retry error and recovery, not in month), done per screen.                                                                                                                                                                     |
| Gates pass                                                 | `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped, before each commit.                                                                                                                                                                                                            |
| Web check at 390×844                                       | The slice 1–3 checks, recorded in the PR test plan.                                                                                                                                                                                                                                                      |

No unit test. The app's Vitest runs `test/**/*.test.ts` in Node with no React renderer, and this change adds no pure
logic. Rendering the component or `renderHook` would need a new test dependency that no AC asks for (§6 verifies UI on
the web build).

## Not doing (YAGNI)

- Changing the Category screen's `useMonth` loading and error, its "Couldn't refresh" banner, header or loaded view.
  These are a different request, and brief 037 may edit the name display.
- Making the spinner margins the same, or a `spinnerStyle` prop. A single number keeps today's 24 and 32 px.
- A component test setup (`@testing-library/react-native`, jsdom).
- Sharing the modals' header, Cancel or busy lock.

## Risks

- **A merge conflict with 037 in `category/[categoryId].tsx`.** Slice 3 touches only `NotInMonth` (lines 204–218)
  and one import, while 037's name display is in lines 84–121 and 154. Whoever merges second rebases. A conflict in
  the imports is the likely worst case.
- **React Compiler / `react-hooks` lint on the hook's early return.** All hooks run before `return { status: 'invalid'
}`, and the effect bails inside. Slice 1's `yarn lint` proves it.
- **The modals now hold the hook at screen level, so `busy` re-renders call it.** It's keyed by
  `ledgerId/categoryId/month/version`, so a re-render doesn't refetch. Slice 1's web check confirms it: only one
  category request in Network while removing.

## Open questions

- **Not blocking. The Category screen keeps its own `<LoadError message="That link isn’t valid." />`.** Its bad-link
  view has a different header ("Back", no Add or ⋯), chosen before any loader mounts, and calling the hook there
  would fetch on every valid open. Assumed: AC1 accepts this one line. Its parse step already uses the shared
  `linkParams`.
- **Not blocking. A race in the Category screen.** If its `useMonth` list lacks the category but the follow-up fetch
  finds it in the month (another member added it between the two requests), today it wrongly says "isn't in". After
  slice 3 it shows an empty body until the next focus reload. Assumed: acceptable. Today nothing can add a category to
  a month (that comes in 038), and only a restore by another member in that gap reaches it.

## Follow-ups

- Brief 037's rename modal (if it's a `/…?categoryId&month` modal) can use `useCategoryTotals` + `CategoryInMonth`
  directly.

## Deviations

- Slices 1–3 landed as one commit. Widening `useCategoryTotals`'s return type with `invalid` stops the other two
  screens' old loaders from type-checking, so slice 1 alone can't be green without throwaway guards that slices 2–3
  would delete. Same files, contracts and checks as planned.
