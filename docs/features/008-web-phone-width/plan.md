# Plan: Web app at phone width

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/web-phone-width
Base: origin/main @ ba84e5f

## Approach

The app goes into one centered column in the root layout. The category sheet's `Modal` gets the same column. The checks
behind this, done against the installed packages:

- **Screens, including the modal.** `Stack` on web is `layouts/Stack.web.js` → `_web-modal.js` → `BaseStack` (expo-router
  57.0.24). That stack renders every route, including `expense` with `presentation: 'modal'`, as an `absoluteFill` View
  inside the stack container (`react-navigation/native-stack/views/NativeStackView.js`). It uses no portal. So a wrapper
  around `<Screens />` in `app/_layout.tsx` constrains login, Home, Category and Add/Edit. The vaul web-modal portal is
  only swapped in when `EXPO_UNSTABLE_WEB_MODAL` is set, and the repo doesn't set it.
- **The Undo bar and the FAB** are `position: 'absolute'` inside each screen's `SafeAreaView`
  (`category/[categoryId].tsx` `toast`, `AddExpenseButton`). They are measured against the screen, so the column holds
  them with no change. Nothing uses `Dimensions` or `useWindowDimensions`, and nothing uses `position: 'fixed'`
  (checked with `rg`).
- **The category sheet.** On web, RN `Modal` portals into `document.body` and is `position: fixed` against the window
  (react-native-web 0.21.3, `Modal/ModalPortal.js` and `ModalContent.js`). So `CategorySheet` wraps its backdrop in the
  same column inside the `Modal`.
- **One `PhoneColumn` component** branches on `Platform.OS` (the edge, conventions §5) and has two callers. On native it
  returns `children` as they are, because a raw `maxWidth` would narrow a 440pt iPhone Pro Max. On web it is a View with
  `flex: 1, width: '100%', maxWidth: phoneWidth, alignSelf: 'center'`.
- **The page background.** The Expo web template sets no body background, so the space outside the column would be white.
  `SafeAreaProvider` gets `backgroundColor: colors.bg`. On native that equals `app.json` `backgroundColor` (#0E1013) and
  sits behind opaque screens, so it is invisible there.

Alternative considered: a global CSS rule on `#root`, with `transform` so that fixed children follow it. The `Modal`
portal is a sibling of `#root`, so the sheet would still span the window. It would also need a custom
`public/index.html`.

## Contracts

- DB: none. API: none.
- App:
  - `theme.ts`: `export const phoneWidth = 402;`, with the comment "web column width: iPhone 18 Pro, in CSS px/pt".
  - `components/PhoneColumn.tsx`: `export function PhoneColumn({ children }: { children: ReactNode })`. Its callers are
    `app/_layout.tsx` and `components/CategorySheet.tsx`.
- New dependencies: none.

## Slices

- [x] 1. Show the web app in a centered phone-width column
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/src/components/PhoneColumn.tsx` (new),
    `apps/mobile/src/app/_layout.tsx`
  - Change: add `phoneWidth` and `PhoneColumn`. In `RootLayout`, wrap `<AuthProvider>…</AuthProvider>` in `PhoneColumn`
    and give `SafeAreaProvider` `style={{ backgroundColor: colors.bg }}` (a `StyleSheet` entry). About 30 lines.
  - Verify: checks V1–V3 and V5 below, run on login, Home, Category and Add/Edit.
- [ ] 2. Keep the category sheet inside the web column
  - Files: `apps/mobile/src/components/CategorySheet.tsx`
  - Change: inside `<Modal>`, wrap the `backdrop` View in `PhoneColumn`, so the dimmed area and the sheet are both 402
    wide on web. About 3 lines.
  - Verify: check V4 below at all three sizes, plus V5.

### Verification

Run the gates first. Then launch the `api` and `web` configs, sign in, and run the checks below in the in-app browser
console. The column is
`col = [...document.querySelectorAll('#root div')].find(e => e.getBoundingClientRect().width === 402)`. At 390 wide,
match on `390` instead.

- V1 (1440×900, on each screen): the `col` rect is `{left: 519, width: 402, height: 900}`. This check must log `[]`:
  `[...col.querySelectorAll('*')].map(e => e.getBoundingClientRect()).filter(r => r.width && (r.left < 519 || r.right > 921))`.
  Take a screenshot. The area outside the column is plain #0E1013 with no white.
- V2 (1440×900): on Home and Category, the "Add expense" button
  (`[...document.querySelectorAll('[role=button]')].find(e => e.textContent.includes('Add expense'))`) has
  `right === 901`.
- V3 (1440×900): open an expense from Category, delete it in Edit expense and accept the confirm; back on Category, The Undo bar (`[aria-live=polite]`) has
  `left === 539` and `right === 901`. Then press Undo, which restores the data.
- V4 (1440×900): open Add expense → "All categories". The backdrop
  (`[...document.querySelectorAll('[aria-modal] div')].find(e => getComputedStyle(e).backgroundColor === 'rgba(5, 6, 8, 0.62)')`)
  has `{left: 519, width: 402, height: 900}`. The sheet sits inside it, and the area outside the column is not dimmed.
- V5 (390×844 and 402×874): `col` has `left === 0` and a width equal to the window. The FAB has `right === W - 20`. The
  sheet backdrop has `width === W`. The screenshots match the same screens on Base.
- V6 (Expo Go, iPhone): Home, Category, Add expense, the category sheet, the FAB and Undo look as they do on Base.
  `PhoneColumn` returns `children` on native.

## AC → evidence

| AC                                         | Evidence                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| 402px centered column at 1440×900          | V1 on login, Home, Category, Add and Edit expense                 |
| Sheet, Undo bar and FAB stay in the column | V4, V3, V2                                                        |
| 390×844 and 402×874 unchanged              | V5                                                                |
| Native iOS unchanged                       | V6. On native, `PhoneColumn` returns `children`                   |
| Width is one named value in `theme.ts`     | `rg -n "402" apps/mobile/src` finds only `phoneWidth` in theme.ts |

## Not doing (YAGNI)

- No breakpoints, `useWindowDimensions`, a frame or a device mockup (out of scope).
- `window.confirm` and the browser's own date-picker popup stay browser-positioned, because the app doesn't control them.
- No custom `public/index.html` and no global CSS.

## Risks

- `alignSelf: 'center'` might not center inside the RNW `Modal` container. Slice 2 proves or disproves this with V4. The
  fallback is `alignItems: 'center'` on a wrapping View.
- Hidden stack screens are `display: none`, so they give zero rects and V1 skips them. A screen that is visible but
  outside the column would still be caught.

## Open questions

- Not blocking: should the dimmed backdrop cover only the column? The brief says "nothing extends outside it". The plan
  assumes yes: only the column dims, and the outside stays the plain background.

## Follow-ups

- Conventions §2 lists `theme.ts` as "colors, fonts, category hues". Proposal: add "layout constants (`phoneWidth`)".
  That is not a plan slice.

## Deviations
