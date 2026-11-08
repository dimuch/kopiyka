# Put the demo online and link it from the login page

Type: feature. Needs brief 080 merged.

## Why

Brief 080 gives us a demo build that nobody can reach yet.

## What

- `https://demo.kopiyka.englishplus.com.ua` serves the demo's static files and nothing else: no `/api` proxy, no
  connector. Its Content Security Policy has `connect-src 'none'`, so the browser refuses any network call.
- Each deploy builds both flavours from the same commit into the same release folder, so a rollback moves both.
- The module check from brief 080 runs on the droplet before `current` switches. Source maps never go live.
- The login page gets a plain text link "Try it now" directly below the Sign in button. On web it opens the demo in the
  same tab, on iOS in the browser.

## Acceptance criteria

- [ ] Given the login page (web and iOS), when I tap "Try it now", then the demo opens.
- [ ] Given the demo domain, then `/api/ledgers`, `/mcp` and `/oauth/authorize` reach neither the API nor the connector.
- [ ] Given the demo domain, then it sends the security headers and a CSP with `connect-src 'none'`, and a full session
      in a browser shows no call to another host.
- [ ] Given the demo domain, then no `.map` file is served, on it or on production.
- [ ] Given a deploy where the module check fails, then `current` doesn't switch and production stays as it was.
- [ ] Given a deploy, then both sites serve the same commit. Given a rollback, then both go back.
- [ ] Given a release, then the production site behaves as before apart from the link.
- [ ] Given `deploy/README.md`, then it has the one-time steps: DNS, certificate, vhost, and their order.

## Out of scope

- Any API, database or MCP change.
- Analytics on demo use.

## Notes

- A second server block in `deploy/kopiyka.englishplus.com.ua.conf` reuses the `$kopiyka_cache_control` map.
- Order, so the link never points at nothing: merge, then DNS, certificate and vhost, then the Deploy run.
- The droplet has 2 GB of RAM and exports run one at a time, with the same memory cap. The second export costs time,
  not peak memory: measure it on the first deploy.
- This PR is the `minor` bump (new capability for visitors).
