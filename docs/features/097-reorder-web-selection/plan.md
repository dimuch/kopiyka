# Plan: No text selection when picking up a category row on web

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/reorder-web-selection
Base: origin/main (ba52749, version 1.15.2)

## Approach

A new web-only helper, `blockTextGestures(node)`, sets `user-select`, `-webkit-user-select` and `-webkit-touch-callout`
to `none` on the DOM node and adds a `contextmenu` listener that calls `preventDefault`. It returns a function that
removes the listener. `ReorderList` calls it once from a mount effect on its `listRef`, behind `Platform.OS === 'web'`,
so the platform check stays in the component that owns the list (conventions §5) and the Budget and Expenses screens
don't change. Rows inherit the styles: RNW `Text` sets `user-select` only when it gets a `selectable` prop
(`react-native-web/dist/exports/Text/index.js`, `notSelectable`/`selectable`), and no file in `apps/mobile/src` passes
`selectable`. A computed `auto` under a `none` parent comes out as `none`.

Facts checked on the Base (react-native-web 0.21.4):

- On web, `listRef.current` is the list's DOM `div`. RNW `View` merges its own `hostRef` (the element) with the
  forwarded ref and adds `measureInWindow` to it, which `ReorderList` already calls.
- React handles events at the root container, so a native listener on the list runs before RNW `Pressable`'s
  `onContextMenu`. That handler (`usePressEvents/PressResponder.js`) prevents the menu only for touch, and only
  `if (!event.defaultPrevented)`. Once our listener has prevented it, `Pressable` no longer calls `stopPropagation`.
  The event then reaches RNW's responder system, which asks the current responder to end. The row's `Pressable`
  (touch + `onLongPress`) and the list's pan responder (`onPanResponderTerminationRequest: () => false`) both say no.
  See Risks.
- A scratch script (tsx, Node 24) ran the helper against `Object.assign(new EventTarget(), { style })`. It set the
  three properties. A cancelable `contextmenu` dispatched on that node came back `defaultPrevented: true`. One
  dispatched on another target, or after the cleanup ran, came back `false`. With a node type of
  `{ style: Pick<CSSStyleDeclaration, 'setProperty'> } & Pick<EventTarget, 'addEventListener' | 'removeEventListener'>`
  the script typechecks under the app's `lib: ["DOM", "ESNext"]`, and `HTMLElement` fits that type.

Why a separate module with one caller: Vitest runs the app's tests in Node and can't load `react-native`, so the
behaviour behind AC1 and AC2 can only get a unit test if it lives outside `ReorderList.tsx`. Chromium also ignores
`-webkit-touch-callout`, so the browser preview can't show that property (see AC → evidence).

Alternative considered: RN styles (`userSelect: 'none'` through RNW's prefixer) plus RNW `View`'s forwarded
`onContextMenu` prop, with only the callout set through the ref. That spreads the fix over three mechanisms. RN's TS
types also don't allow `userSelect` on a `ViewStyle` or `onContextMenu` on a `View`, so it would need casts in two places,
and none of it could be unit-tested. One DOM helper is smaller and gets tested.

## Contracts

- DB: none
- API: none
- App:
  - New `apps/mobile/src/components/blockTextGestures.ts`:
    `export function blockTextGestures(node: ListNode): () => void`, where
    `type ListNode = { style: Pick<CSSStyleDeclaration, 'setProperty'> } & Pick<EventTarget, 'addEventListener' | 'removeEventListener'>`.
    It sets the three style properties to `none` and adds the `contextmenu` listener. The function it returns removes
    the listener and leaves the styles in place, since a second run sets the same values. It doesn't import
    `react-native`.
  - `ReorderList` props: unchanged.
- Reuses: `ReorderList`'s existing `listRef`; the `Platform.OS !== 'web'` early-return pattern from `FocusStyles` /
  `PhoneColumn`.
- New dependencies: none

## Version

Bump: patch — 1.15.2 → 1.15.3
Why: §8b `patch` row, a bug fix in shipped app code (web reorder list) with no new capability; nothing is removed or
reshaped.

## Slices

- [x] 0. Bump version to 1.15.3
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.15.3
- [x] 1. Stop text selection and the browser menu when holding a row on web
  - Files: `apps/mobile/src/components/blockTextGestures.ts` (new, ~20 lines),
    `apps/mobile/src/components/ReorderList.tsx` (~10 lines), `apps/mobile/test/blockTextGestures.test.ts` (new, ~40
    lines), `apps/mobile/demo-modules.txt` (+1 line)
  - Change: add the helper with a why-comment (brief 097: the browser's long-press would select text and open its
    menu along with the pick-up). In `ReorderList`, add a mount effect (`[]` deps) that returns early unless
    `Platform.OS === 'web'` and `listRef.current` is set. React sets the ref before effects run, so the null check only
    narrows the type. The effect returns `blockTextGestures(listRef.current as unknown as HTMLElement)`, with a comment
    that on web the host instance is the DOM node (react-native-web). Importing `Platform` is the only other change.
    The helper now reaches the demo build, so run `yarn mobile export:web && yarn mobile check-builds --accept`. The
    only diff to `demo-modules.txt` should be the new module's line.
  - Tests: `test/blockTextGestures.test.ts`, fake node = `Object.assign(new EventTarget(), { style })` with a recording
    `setProperty`. Write it first: it fails before the fix because the module doesn't exist.
    - sets `user-select`, `-webkit-user-select` and `-webkit-touch-callout` to `none`, and nothing else
    - a cancelable `contextmenu` on the node → `defaultPrevented === true`
    - a cancelable `contextmenu` on another target → `false` ("outside the list")
    - after the returned cleanup runs, a `contextmenu` on the node → `false`
  - Verify (in-app browser, launch configs `web` + `api`, phone width, Budget and Expenses):
    - in the console, pick a category-name element in the list:
      `getComputedStyle(el).userSelect === 'none'`. Dispatching `new MouseEvent('contextmenu', { bubbles: true,
cancelable: true })` on it gives `defaultPrevented === true`. The same event on the "Categories" section title
      (outside the list) gives `false`.
    - a mouse long-press on a category name selects no text. A right-click on a row opens no menu, and a right-click on
      the section title still does.
    - tap a row → it opens. Long-press → it lifts. Drag → it moves and the order holds after a reload.
    - in a month with enough categories to scroll, hold a row near the bottom and then the top edge. The list scrolls,
      and the row drops at the far end.
    - drop a row (a re-render), then check `userSelect` again: still `none`.
  - Gates: `yarn format:check && yarn lint && yarn typecheck && yarn test`; `yarn mobile export:web && yarn mobile
check-builds` passes after the `--accept` above.

The real phone check is left to the user after the build: on iOS Safari and on Android Chrome, long-press a row's name
and amount. No text gets selected, no callout or menu opens, and the row lifts and drags. The PR's test plan lists this
as an unchecked box for the user.

## AC → evidence

| AC                                                                                 | Evidence                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web: list has `user-select: none` (+ `-webkit-`) and `-webkit-touch-callout: none` | Unit test "sets the three properties". Browser console: computed `userSelect` is `none` on a row's text, before and after a drop. The callout can't be seen in Chromium, so the unit test plus the user's iPhone Safari check stand in for it. |
| Web: `contextmenu` inside the list is prevented, outside it isn't                  | Unit tests (on the node → prevented; another target / after cleanup → not). Browser console: a bubbling event from a row's text is prevented, one from the section title isn't. Right-click by hand.                                           |
| iOS native: no new styles or listeners                                             | `ReorderList`'s effect returns before calling the helper unless `Platform.OS === 'web'`, and the helper is the only thing that sets styles or adds listeners (reviewer reads the diff). Typecheck + lint. iPhone check left to the user.       |
| Tap opens, long-press picks up, drag moves, as before                              | Slice 1 browser check (tap / long-press / drag / reload) on Budget and Expenses. Phone check by the user.                                                                                                                                      |
| Edge auto-scroll still works                                                       | Slice 1 browser check (hold near the bottom and top edges in a scrolling month). Phone check by the user.                                                                                                                                      |

## Not doing (YAGNI)

- `touchmove` `preventDefault` or blocking page scroll or bounce while a row is held (out of scope in the brief).
- Removing the three styles in the cleanup: the list's node goes away with the list, and setting them twice gives the
  same result.
- Turning the block on and off with `disabled`: the brief asks for it on the list at all times.
- Any change in Budget or Expenses, or anywhere else in the app.

## Risks

- **The responder system now sees touch `contextmenu`.** Before, RNW `Pressable` called `stopPropagation` on it. Now
  the event reaches the responder system, which asks the current responder to end. Both possible responders refuse
  (see Approach), so nothing should change, but this runs only on a real touch device. On desktop with a mouse,
  `Pressable` never stopped it, so nothing changes there. Checked as far as it can be by the slice 1 drag check. The
  user's Android Chrome check proves it fully. If a held row drops on its own there, the fallback is to call
  `stopPropagation` in the listener as well.
- **The inline styles might not survive a re-render.** React DOM updates `style` property by property, and the list's
  `style` is a static `StyleSheet` class, so they should stay. Proven by slice 1's "after a drop" `userSelect` check.
- **The in-app preview is not a phone.** Chromium with a mouse doesn't show the iOS callout or Android's long-press
  menu. The unit tests cover what the code sets, and the user's phone check covers what the browser does with it.

## Open questions

- no: placing the helper. It sits in `components/` next to its only caller, as a UI-level web edge. `src/` root
  (like `pushOnce.ts`) would also fit. Assumption: `components/`.
- no: AC2's "inside the list" means any element in the list, which the event reaches by bubbling. The unit
  test can only dispatch on the node itself, because Node has no DOM tree, so the browser console check covers bubbling
  from a row's text. Assumption: that split counts as evidence.
- no: desktop right-click over the list stops opening the browser menu. The brief's "What" asks for this ("and desktop
  right-click"). Assumption: intended.

## Follow-ups

- None found.

## Deviations

- slice 1: the browser check ran on the demo build (`web:demo`, served from this worktree) instead of `web` + `api`,
  because MySQL wasn't reachable here; it renders the same `ReorderList`. The order-after-reload check is the demo's
  own reload reset, so it wasn't repeated (unchanged by this fix). On Expenses the "outside the list" element was the
  month switcher (Expenses has no "Categories" title).
- slice 1: `contextmenu` listener is one module-level function (skeptic suggestion), so StrictMode's repeated add is a
  no-op.

## Consolidate

CONSOLIDATE: reused 0 · extracted 0 · left 1

- LEAVE `blockTextGestures`: no twin. Nothing else in `apps/mobile/src` calls `addEventListener`, `setProperty`,
  `preventDefault` or sets `userSelect`/`contextmenu`. The `ReorderList` effect reuses the existing `listRef` and the
  `Platform.OS !== 'web'` early return already used by `FocusStyles`.
