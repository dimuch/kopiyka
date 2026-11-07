# Keep production-only logic out of the shared screens

Type: chore (behaviour-preserving, runs through `/kopiyka-hos-refactoring`)

## Why

Brief 080 builds a demo that must not contain any code it doesn't use. Today four shared places pull production-only
code into every screen, so nothing can be left out of a build:

- `app/(tabs)/index.tsx` (Home) imports invites and Notion sync, and holds the Statistics and Settings cards.
- `components/TabBar.tsx` and `app/(tabs)/_layout.tsx` import `data/invites` for the badge, and `tabs.ts` lists all six
  tabs.
- `app/_layout.tsx` mixes the app shell (fonts, theme, safe area, phone column) with sign-in routing and providers.
- `ApiError` lives in `api/client.ts`, so every screen that reads an error code imports the network client.

## What

The production app looks and works exactly as it does now. Only the code moves:

- **Home cards**: the card grid becomes a component that takes its cards as props. Production Home keeps its cards,
  invites and Notion panel.
- **Tab items**: one module gives the tab list with badges and labels, and the action to run when a tab gains focus.
  `TabBar` and the tabs layout read only that. Invites are imported only by that module.
- **App shell**: fonts, theme, safe area and phone column become one component. Sign-in routing stays in the root layout.
- **`ApiError`**: moves to its own file, and screens import it from there.

## Acceptance criteria

- [ ] `yarn format:check`, `lint`, `typecheck` and `test` pass, with no existing test changed apart from import paths.
- [ ] At phone width, Home, all six tabs, the invite badge, the Notion panel, sign in and sign out behave as before.
- [ ] `components/` and the shared screens no longer import `data/invites`, `useNotionSync` or `api/client` for
      `ApiError`, except production Home and the tab items module.

## Out of scope

- Anything about the demo: no demo files, build settings or flavour checks.
- Other cleanups in these files.
