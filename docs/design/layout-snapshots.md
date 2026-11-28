# Layout snapshots

How a refactor or a look change proves that nothing on a screen moved. It records every element's box, look and
text, plus the accessibility attributes, on the base and again after each slice, and compares the two. Briefs
104f–104h and the refactor roadmap (`docs/features/refactor-roadmap-2026-11.md`) used it. Screenshots go in the PR,
not the repo.

## Set-up

- Run the API (`yarn api dev`, port 3000) and the web app (`yarn mobile expo start --web --port 8084`) from the
  brief's worktree, with the git-ignored `.env` files copied in. Open exactly `http://127.0.0.1:8084`: it is the
  origin the API's CORS list allows (`localhost:8084` is refused).
- Use QA users named `claude-qa-<NNN>` (`yarn api create-user`), and delete them when the brief is done. TOTP codes
  come from a scratch script outside the repo; never print the secret, and don't guess codes (5 wrong in 24 hours
  lock the account).
- Take the before set on the base, before the first code slice, and both sets on the same Kyiv day: the forms show
  today's date and rate, and a month that ends between the sets locks.
- Seed through the API once, before the before set, and check first that nothing is doubled (expense and income
  POSTs aren't idempotent).

## The script

Each row records the element's tag and box; background, top border, radius, padding and opacity; `zIndex`, colour
and stroke; font family, size, line height, tracking, `fontVariantNumeric`, weight and alignment; and a leaf's first
24 characters. Infinite animations (spinners) are paused at frame 0 first. The accessibility record holds `role`,
`aria-label`, `aria-busy`, `aria-disabled`, `aria-selected` and `aria-expanded`. `cmp` also returns the width (it
must be 390), `a11yAdded` and `a11yRemoved`.

The keys are `snap:before:<brief>:<view>:<scheme>` and `snap:after:<brief>:<view>:<scheme>`. The script below is
copied verbatim from brief 104h, so `104h` in its keys, also inside `__cmpSrc`, is the brief number: replace it with
yours.

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

Install it on the app's origin (paste it in the page's console or run it through the browser tools).

## Taking and comparing views

- Use 390×844, Light then Dark (`localStorage.setItem('kopiyka.theme', 'light')` or `'dark'`, then reload).
- Navigate, wait about 2 s, check that nothing is scrolled (`__scrollSrc` scrolls the first scroll area to 400 when
  a view needs it), then snapshot with `eval(localStorage.__snapSrc)('snap:before:<brief>:<view>:<scheme>')`.
- A view with an interaction (a panel, an error) repeats it after each scheme's reload. To show an error without
  reaching the API, run `window.fetch = () => Promise.reject(new TypeError('offline'))` first, and reload afterwards.
- Take the views in the same order in both sets. Don't click in the browser pane while sets are compared, and check
  `innerWidth === 390` in every result.
- Compare with `eval(localStorage.__cmpSrc)('<view>', '<scheme>')`. Expected on every view: `diffs: 0`,
  `a11ySame: true`, empty `a11yAdded` and `a11yRemoved`, and `width: 390`.
- List in the PR what was checked from the code only, because no view could reach it.

The full worked example, with 104h's views, QA users and seeds, is in
`git show b0e5aef5:docs/features/104h-text-other-screens/plan.md`, under "Visual check".
