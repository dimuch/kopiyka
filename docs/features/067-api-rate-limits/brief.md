# Rate limits on the app's API

Type: fix

From the OWASP review of 2026-11-02, which left nginx `limit_req` out of brief 057, and the MCP connector's brief 063,
which added limits for its own routes only.

## Why

`/api/` has no rate limit at the nginx level. The API throttles wrong login codes, but that runs in Node and costs a
database write per attempt, and nothing limits ordinary requests. One client in a loop, or a flood of login attempts,
reaches Node and MySQL on a 2 GB droplet shared with other sites. The connector's routes already have limits, so the app's
own API is now the softer target.

## What

nginx limits per client address on `location /api/`, reusing the connector's approach (brief 063, slice 15):

- **All of `/api/`:** a limit high enough that a person using the app never meets it. Proposed: 300 requests a minute per
  address, burst 100, and 30 open connections.
- **`POST /api/auth/login`:** a tighter limit, so a flood is refused before it reaches Node or the database. Proposed: 20 a
  minute per address, burst 10. The API's own throttle stays as it is, and still decides on wrong codes.
- **Over a limit:** an immediate 429, with a JSON body the app can read, `{"error":"rate_limited"}`. nginx's default page
  is HTML, which the app's client would read as an error with no code.
- **The app:** a screen that hits the limit shows its usual load error with a retry. The login screen says "Too many
  attempts. Wait a minute and try again.", which is different from its 24-hour `blocked` message.

## Acceptance criteria

- [ ] Hammering `POST /api/auth/login` from one address gets 429 with `{"error":"rate_limited"}` once past the burst, and
      those attempts reach neither Node nor the login throttle. Checked on the droplet after deploy, with a throwaway
      username and no valid code.
- [ ] A normal session stays well under the limits: walking every tab and switching months twice on web gets no 429.
      Checked by counting requests in the browser, and in `/var/log/nginx/access.log`.
- [ ] Two people in one household on one address, using the app at once, get no 429. Reasoned from the request count in the
      previous check.
- [ ] A 429 on a data screen shows the screen's load error with a retry, and the retry works once the limit clears. Unit
      test on the client, and a browser check with a stubbed 429.
- [ ] The login screen shows "Too many attempts. Wait a minute and try again." for `rate_limited`, and keeps its message for
      `blocked`. Unit test.
- [ ] `/api/health` still answers through nginx during a deploy, and `deploy.sh`'s own check is unaffected: it uses
      `127.0.0.1:3100`, past nginx.
- [ ] `apps/mcp`'s calls to the API are unaffected: they go straight to `127.0.0.1:3100`.
- [ ] The security headers still appear on `/api/` answers, including the 429. `curl -sI` after deploy.
- [ ] `nginx -t` passes on the droplet before the reload, with the backup and restore steps from the connector's vhost
      change.
- [ ] `deploy/README.md` says what the limits are, how to check them, and what to change if real use meets them.

## Out of scope

- Changing the API's login throttle, its 24-hour lock, or pruning `login_throttle`: that's brief 072.
- Limits inside Node, such as `@fastify/rate-limit`. nginx refuses earlier and cheaper, and the app has one entry point.
- Per-user limits. nginx sees addresses, not users.
- Network-level DDoS, as in brief 063.
- Limits on the static web app.

## Notes

- `location /api/` is at `deploy/kopiyka.englishplus.com.ua.conf:68`. The zones sit at file level, in the http context
  shared with other sites, so names keep the `kopiyka_` prefix. `limit_req_status 429` and `limit_conn_status 429` are
  already set for the server.
- A location with its own `add_header` loses the server's security headers, so the JSON 429 needs care: an `error_page 429`
  pointing at an internal location that returns the body is the likely way, and it must keep those headers.
- `limit_req` runs before the proxy, so a refused login never reaches the API's throttle. That's the point, and it means
  an attacker's refused attempts don't lock a username either.
- Mobile carriers put many people behind one address, which is the reason for a generous general limit.
- The app's client reads `error` from a JSON body (`apps/mobile/src/api/client.ts`).
- Deployment needs the vhost re-installed by hand: a deploy never updates it. The app change ships with a normal deploy, and
  should go first, so the app can read the new 429 before nginx starts sending it.
- Develop in a worktree: `~/home/kopiyka-api-limits`, branch `fix/api-rate-limits`.

## Open questions

- Are 300 a minute and 20 logins a minute the right numbers? The planner measures a real session and confirms them at the
  plan gate.
- Should `/api/health` be left out of the limit, or is the general limit fine for it?
