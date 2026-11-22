# No text selection when picking up a category row on web

Type: fix

## Why

The category reorder (brief 092) picks a row up on long-press. In a phone browser a long-press on text is also the
browser's own gesture: it selects the words under the finger and shows its own UI (iOS Safari's magnifier and
Copy / Look Up callout, Android Chrome's context menu). So a long-press on a category's name or amount selects text
and opens a menu along with picking the row up, and the drag feels broken. A long-press on empty space in the row works,
which is why it shows up most when people press the text.

## What

On web only, in the reorderable list (`ReorderList`, used by Budget and Expenses):

1. The rows' text can't be selected (`user-select: none` on the list, inherited by every row).
2. iOS Safari shows no long-press callout over the list (`-webkit-touch-callout: none`).
3. Android Chrome (and desktop right-click) opens no context menu over the list (`contextmenu` default prevented).

So a long-press on any part of a row, text included, only picks the row up.

## Acceptance criteria

- [ ] On web, the list's element has `user-select: none` (including the `-webkit-` form Safari reads) and
      `-webkit-touch-callout: none`.
- [ ] On web, a `contextmenu` event inside the list has its default prevented; outside the list it doesn't.
- [ ] On iOS (native) nothing changes: no new styles or listeners.
- [ ] A tap on a row still opens it, a long-press still picks it up and a drag still moves it, as before.
- [ ] Holding a row near the bottom (or top) of the screen still scrolls the list so the row can be dropped anywhere,
      as before.

## Out of scope

- Blocking the browser's own page scrolling or bounce while a row is held (`touchmove` `preventDefault`). Left out on
  purpose; a follow-up if the drag still jumps on a phone.
- Any change to native iOS behaviour.
- Text selection elsewhere in the app.

## Notes

- `react-native-web` prefixes `userSelect`; `-webkit-touch-callout` has no React Native style, so it goes on the DOM
  node through the list's ref, web only. Conventions: branch on `Platform.OS` at the edge, not in screens — this belongs
  in `ReorderList` (or a small web-only helper it calls), not in the Budget/Expenses screens.
- The fix can't be seen in the in-app preview the way a phone shows it; the user checks on their phone after the build.
