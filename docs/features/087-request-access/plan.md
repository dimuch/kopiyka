# Plan: Ask for access from the login page

Status: skeptic-approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/request-access
Base: origin/main (e6e3ca0, version 1.7.0)

## Approach

One screen change in `apps/mobile/src/app/login.tsx`. Below the existing `styles.actions` group (Sign in + "Try it now"),
on web only, add a second group: a "Request access" link built exactly like "Try it now" (`Link href asChild` around
`@/components/Pressable`, reusing `styles.demoLink` / `styles.demoLinkText`), and directly under it a plain `Text`,
"Full access: €5 a month", in the page's muted label look. The new group is its own child of `styles.body`, so it gets the
body's `gap: 32` from the actions group, against the `gap: 8` between Sign in and "Try it now". That gives the "more
space" with no new spacing value.

"Web only" is a single `Platform.OS === 'web' ? (…) : null` around that group, with a one-line why comment (store
payment rules, brief 087). It's the same kind of screen-level read the file already has (`KeyboardAvoidingView` on
line 43), and it's one branch, not branches spread through the screen, so it fits conventions §5. The `mailto:` URL is a
module constant next to `DEMO_URL`, written once already encoded, exactly as the brief gives it:
`mailto:dmytro.kostylov@gmail.com?subject=Kopiyka%20access%20request`. There's no helper and no unit test for it. The
URL is a fixed literal, so a builder would have one caller and its test would only repeat the string. The web check
reads the real `href` and the URL the click opens instead.

Alternative considered: a web-only `components/RequestAccess.tsx` returning `null` off web, like `FocusStyles`. It lost
because it would copy the `demoLink`/`demoLinkText` and muted-text styles into a second file (they'd drift apart) for a
one-caller module, and it hides one branch that reads fine inline. A `RequestAccess.web.tsx` / `.tsx` pair would keep
the strings out of the native bundle, but it starts a platform-extension pattern the repo doesn't use yet, and no AC
needs it.

## Contracts

- DB: none
- API: none
- App: `login.tsx` only. New module constant `ACCESS_REQUEST_URL` (above). New styles in its `makeStyles`: `access`
  (the group: `alignItems: 'center'`, no gap, so the price sits right under the link's 44pt box) and `price`
  (`fonts.bodyMedium`, 13, `colors.muted`, centred: the same font, size and colour as `styles.label`). Routes unchanged.
- Reuses: `Link` from `expo-router`, `@/components/Pressable`, `styles.demoLink` (44pt `minHeight`/`minWidth`),
  `styles.demoLinkText`, `useThemedStyles(makeStyles)`, theme tokens `colors.accent`/`colors.muted`
- New dependencies: none

## Version

Bump: minor — 1.7.0 → 1.8.0
Why: §8b `minor`, "new … user action". A visitor on the web login page can now ask for an account. Nothing that
exists changes: no API, no schema, no MCP, and the native login stays the same.

## Slices

- [x] 0. Bump version to 1.8.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.8.0
- [x] 1. Add a "Request access" email link and the price to the web login page
  - Files: apps/mobile/src/app/login.tsx (~+25 lines)
  - Change: add the `ACCESS_REQUEST_URL` constant. After the `styles.actions` `View`, add the web-only
    `<View style={styles.access}>` holding a copy of the "Try it now" `Link`/`Pressable`/`Text` block, with
    `href={ACCESS_REQUEST_URL}`, `accessibilityLabel` and text "Request access", and the same `demoLink`/`demoLinkText`
    styles. Under it, `<Text style={styles.price}>Full access: €5 a month</Text>`. Add the `access` and `price` styles.
  - Tests: none new. No pure logic, and `login.tsx` can't load in the Node test environment. Gates:
    `yarn format:check && yarn lint && yarn typecheck && yarn test`, plus
    `yarn mobile export:web && yarn mobile check-builds` (no `--accept`) and
    `git diff --exit-code apps/mobile/demo-modules.txt`.
  - Verify: the web check below.

**Web check (slice 1).** You don't need the API, because with no `/api/auth/me` answer the app lands on the login page.
Start Metro from the worktree on a free port: `yarn mobile expo start --web --port 8084`. Ports 3000, 8081 and 8082 are
in use by others, so don't use the `web` launch config, which is fixed to 8081. Open `http://127.0.0.1:8084/login` at
390×844 and check `document.hasFocus()` first.

1. The order is Sign in, "Try it now", "Request access", then "Full access: €5 a month". In the DOM, the gap from the
   "Try it now" box's bottom to the "Request access" box's top (about 32) is larger than the gap from Sign in's bottom to
   "Try it now"'s top (about 8). The price `Text`'s top equals the link box's bottom (`getBoundingClientRect`).
2. The "Request access" element is an `<a>` whose `href` is exactly `ACCESS_REQUEST_URL`, with link semantics
   (`<a href>`, `aria-label="Request access"`). The price element has no `role` and no `href`.
3. The link box is at least 44 × 44.
4. Stub `window.open` to count calls, then click the link. The page stays on `/login`, no tab opens and `window.open` is
   never called: the router sets `window.location` to the mailto URL (expo-linking `RNLinking.web.js`), the same path
   "Try it now" takes. Whether a mail app opens is check 6. The preview may hand the mailto to the Mac's own mail app.
5. Compared side by side, the link looks like "Try it now" (`colors.accent`, semibold 15) and the price looks like the
   field labels (muted, 13). If the preview can emulate `prefers-color-scheme: dark`, repeat 1 and 5 in dark mode.
6. Left to the user, in both Safari and Chrome on the Mac: click "Request access". A new mail message opens to
   `dmytro.kostylov@gmail.com` with the subject "Kopiyka access request". Safari opens Mail; Chrome only does so with a
   registered mail handler.

**Not on iOS/Android, without a device.** There's one render path for the group, and it sits behind
`Platform.OS === 'web'`. The reviewer reads that branch, `rg -n "Request access|Full access|ACCESS_REQUEST_URL"
apps/mobile/src` shows every use inside it, and typecheck and lint pass. An Expo Go look at the login page on the iPhone
is optional and left to the user. It's one instruction, at their pace.

## AC → evidence

| AC                                                                               | Evidence                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Below "Try it now", more space than Sign in → "Try it now"; price directly below | Web check 1                                                                                                                                                                         |
| Tap opens a mail message to the address with the subject                         | Web check 2 (`href`) and 4 (same tab, no `window.open`); check 6 by the user in Safari and Chrome                                                                                   |
| Screen reader: the link reads as a link, the price as text                       | Web check 2 (`<a href>` with `aria-label`; the price has no role). Code: `accessibilityRole="link"` on the `Pressable`, plain `Text` for the price                                  |
| Touch target ≥ 44 × 44                                                           | Web check 3 (`styles.demoLink` has `minHeight`/`minWidth` 44)                                                                                                                       |
| Not on the iPhone or Android app                                                 | The single `Platform.OS === 'web'` branch, read in review, and the `rg` above. Optional Expo Go check by the user                                                                   |
| Demo unchanged, its module list the same                                         | `yarn mobile check-builds` passes without `--accept`; `git diff --exit-code apps/mobile/demo-modules.txt`. `login.tsx` is already in `BANNED_IN_DEMO`, and the slice adds no module |

## Not doing (YAGNI)

- A `mailto` builder helper or a unit test that repeats a literal.
- Getting the price from the API or config, a sign-up form or a contact page (out of scope).
- Keeping the strings out of the native JS bundle with `.web.tsx` files. The brief asks that the page not show them, and
  the stores review what the app shows.
- Renaming `demoLink`/`demoLinkText` now that two links share them. It's a mechanical rename no AC needs.
- An accessibility hint ("opens your email app").

## Risks

- A plain click sets `window.location` to the mailto URL (same tab, no `window.open`), the path brief 081 saw for "Try
  it now", so no empty tab or pop-up prompt. A modifier click is left to the browser. If the visitor has no mail handler
  (e.g. webmail only, nothing registered), nothing visible happens: that comes with the brief's `mailto:` choice, not a
  bug. Check 6 shows the real behaviour. A `target` on `Link asChild` doesn't reach react-native-web's anchor
  (`useHrefAttrs` passes it as a plain prop), so there's no one-prop way to change the path.
- CSP: production's policy has `form-action 'self'` and no navigation directive, so a `mailto:` navigation isn't covered
  by it, and `Permissions-Policy` doesn't list it. Check 6 runs against local Metro, so after deploy the
  user can repeat it once on `kopiyka.englishplus.com.ua`.

## Open questions

- no — The brief says "visibly more space". The plan uses the page's existing 32 between groups, against 8 inside
  Sign in's group. Assumed fine. If it looks too loose at 390×844, a smaller `marginTop` inside `actions` is a
  one-line change.
- no — The address ends up in the public repo and on the public page. That was the user's choice (brief Notes: it may
  draw spam). Nothing in the plan changes it.

## Follow-ups

- none

## Revision 1

The skeptic's edits. On web an external `Link asChild` click sets `window.location`
(expo-linking `RNLinking.web.js`), not `window.open`. Web check 4 and risk 1 were rewritten to match. Check 6 now runs
in both Safari and Chrome. The CSP risk now says "a `mailto:` navigation". The AC row for the mail link points to the
new check 4. Nothing that ships changed, so the version stays 1.8.0.

## Deviations

- Web check 4 (click with `window.open` stubbed) wasn't run: in the preview a click could open a real Mail draft on the
  Mac. The click path is the skeptic's reading of expo-router and expo-linking (`window.location`, same tab), and check 6
  (a real click in Safari and Chrome) is the user's.

## Consolidate

CONSOLIDATE: skipped (no new function, hook, component, route or query; the second `Link` block is a twin of "Try it
now", and the rule of three isn't reached).
