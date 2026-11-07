# Plan: Finish the connector's manual tests

Status: approved
Brief: ./brief.md
Branch: chore/connector-tests
Base: origin/main (3b27537)

## Approach

No app code changes. The work is a run on production, in the order under [Run](#run), and one commit of its results to
`deploy/README.md`. Test 1 goes first, and nothing else is set up until its result is read: the throwaway user doesn't
exist yet at that point, so a stop leaves the least to undo. Tests 3, 4, 5 and 6 then share three Connects, so the run costs
one wrong code at most. The hostile server comes down during the 61-minute wait, so its removal adds no clock time.

**The hostile server's files aren't committed to `deploy/`.** Every file there maps to something installed on the droplet
(README's table), and this vhost must be gone within hours (AC7), so a file there would describe nothing that exists and
could be installed by mistake on a rebuild. The only reason to keep it is a rerun if Claude changes, and this plan covers
that: it's committed with the brief, it holds the vhost under [Hostile server](#hostile-server), and the README points here.

Alternative considered: a small script or a committed `deploy/` file that sets the server up and tears it down. It lost:
it runs once, by hand, under the owner's `sudo`, and a script adds code to review for about 10 pasted lines.

## Contracts

- DB: none. API: none. App: none.
- Hostile server: see [Hostile server](#hostile-server). It copies kopiyka's real `/mcp` 401 and its metadata, read by
  running `apps/mcp` in-process on 2026-11-05, not from memory.
- Reuses: the throwaway-user command and delete SQL in `deploy/README.md`; `MCP_ENABLED` as the off switch.
- New dependencies: none.

## Slices

The brief and this plan are the branch's first commit, at Gate A, as for every brief.

- [x] 1. Record the connector's manual test results
  - Files: `deploy/README.md`, "What's been tested" (~40 lines). The commit comes after the whole run and cleanup, or after
    a stop.
  - Change: keep the 4 November paragraph, the throwaway-user command and the delete SQL. Replace the "Not run" list with
    dated results for tests 1 and 3–6: what the user saw, and whether the owner accepts it. Give the Claude plan, browser
    and app versions. Say that test 2 wasn't run because there's no second Claude account, and that it needs one: repeat the
    two-browser test with browser B signed in to that account (063 plan, slice 14). Link this plan for repeating test 1 and
    say when to: if Claude changes how it adds connectors.
  - Verify: `yarn format:check && yarn lint && yarn typecheck && yarn test`, not piped. Read the diff for private details:
    no IP, no admin username, no full authorize URL, no code or `state`.
- [x] 2. Add a brief for each unacceptable result (only if there is one)
  - Files: `docs/features/<NNN>-<slug>/brief.md`, ~40 lines each. 069 and 070 are taken, so numbers start at 071.
  - Change: one brief per result the owner won't accept and won't settle with a written decision (which goes in the README
    under slice 1). Each brief says whether it blocks 069.
  - Verify: as slice 1. Skipped when nothing is unacceptable.

Estimate: ~40 lines, or ~80 with one brief.

## Run

**Who.** Owner (O): the DNS panel, every `sudo`, everything in Claude, every sign-in and code, the phone. Orchestrator (C):
`dig` and `curl` from the laptop, reads over `ssh -o BatchMode=yes do`, keeping the tally, the README and the commit.
C never signs in and never sees a code.

**Time (estimates).**

| Block                             | Owner active |       Clock |
| --------------------------------- | -----------: | ----------: |
| Preflight (P1–P3)                 |       10 min |      10 min |
| Hostile server up (H1–H4)         |       15 min |      20 min |
| Test 1, logs, result              |       10 min |      10 min |
| User and connector (U1–U2)        |        5 min |       5 min |
| Tests 3 and 4                     |       15 min |      15 min |
| Test 5 and first half of 6        |       10 min |      10 min |
| Wait, with hostile cleanup inside |       10 min |      61 min |
| Second half of test 6             |       15 min |      15 min |
| Final cleanup                     |       10 min |      10 min |
| Reading the README diff           |       10 min |      10 min |
| **Total**                         |  **~1 h 50** | **~2 h 45** |

A stop at test 1 ends the run after about 1 hour, cleanup included, plus the decision.

**Rules for the whole run.**

- Sign in only as `claude-qa-mcp`. Never with the owner's account.
- Each sign-in takes a code the authenticator has only just shown. A code works once (`last_totp_step`), so retyping one
  counts as a failure. Wait for it to change.
- `ssh do`, the browsers and the phone stay on one network with no VPN, so one address is counted. C tallies every "Wrong
  username or code" the owner reports.
- Paste back to C: command output only. Never the `create-user` output apart from its first line (it prints the secret), a
  code, or a full address-bar URL. Named query values only, such as `resource`.
- No IP, admin username or full URL goes into a tracked file.
- No Deploy and no service restart from test 1 to the end of test 6, apart from a stop. The only nginx change in that time
  is the hostile server's own removal.

**Throttle facts** (`apps/api/src/auth/throttle.ts`). The sign-in page sends no `deviceId`, so failures count per username and
per address. A good login clears the username's count, never the address's. The address count restarts only after 24 hours
with no failure, so it isn't a rolling window. The fifth failure locks the address for 24 hours, for every login, the app
included.

**Stop rules.** Only these stop the run. Any other poor result is recorded, and the run goes on.

| ID  | What stops it                                                               | Do this                                                                              |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| S1  | Kopiyka's page titled "Sign in to Kopiyka" opens from the hostile connector | [S1 steps](#s1-steps). Nothing else runs until the owner has decided                 |
| S2  | `nginx -t` fails, or any other site changes its answer after a reload       | `sudo rm /etc/nginx/sites-enabled/$h.conf && sudo nginx -t`, reload, ask the owner   |
| S3  | The address count reaches 3, or "Too many attempts" appears                 | No more sign-ins. Read the count. Owner decides; a lock is recorded and cleared (C6) |
| S4  | After Cancel, the connector shows connected or a tool answers               | Ask the owner before going on                                                        |
| S5  | The final address bar holds `code=`, in any browser                         | Ask the owner before going on: it means the callback no longer clears the code       |
| S6  | An answer names a budget other than `QA`                                    | Disconnect at once: this is a real account. Redo the Connect                         |

Cleanup runs after every stop, for whatever exists by then.

### Preflight

Shell values for every step:

```bash
h=mcp-test-068.englishplus.com.ua
site=https://kopiyka.englishplus.com.ua
```

**P1 (C, from the laptop).** Each line must hold, or ask the owner first.

```bash
dig +short NS englishplus.com.ua                # DigitalOcean's name servers
dig +short CAA englishplus.com.ua               # empty, or it allows letsencrypt.org
dig +short "$h" @"$(dig +short NS englishplus.com.ua | head -1)"   # empty; anything else means a wildcard record
dig +short AAAA kopiyka.englishplus.com.ua      # empty, so browsers reach kopiyka on IPv4
dig +short kopiyka.englishplus.com.ua           # the droplet's address, for H1 only
curl -s -o /dev/null -w '%{http_code}\n' "$site/api/api-tokens"   # 401: MCP_ENABLED is on (404 means off)
ssh -o BatchMode=yes do 'ls /etc/nginx/sites-enabled'
```

**P2 (O, in `ssh do`).**

```bash
sudo -v
sudo nginx -t
sudo nginx -T 2>/dev/null | sha256sum           # the baseline for C5
sudo nginx -T 2>/dev/null | grep -E '^\s*server_name' | sort -u   # paste back: the names to check
ip=${SSH_CONNECTION%% *}                         # the tester's address, kept out of what's pasted back
sudo mysql kopiyka -e "SELECT failed_attempts, last_failed_at, locked_until FROM login_throttle
    WHERE key_type = 'ip' AND key_value = '$ip';
  SELECT COUNT(*) AS qa_users FROM users WHERE username = 'claude-qa-mcp';
  SELECT COUNT(*) AS qa_ledgers FROM ledgers WHERE name = 'QA';"
```

C keeps, outside the repo, `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<name>/` for each name (skip `_`).
H4 and C5 repeat it and diff.

Pass: `nginx -t` is clean, both counts are 0, there's no lock, and `failed_attempts` is at most 1, or the last failure is over
24 hours old. No row means 0. If `$ip` has a `:`, reconnect with `ssh -4 do`.

**P3 (O, in Claude).** List the connectors, their addresses, and which show as connected. Leave them all as they are.

### Hostile server up

**H1 (O, DNS).** DigitalOcean → Networking → Domains → `englishplus.com.ua`: add `A mcp-test-068 → <droplet IP>`, with the
lowest TTL offered. C then checks that `dig +short "$h"` prints the address.

**H2 (O, in `ssh do`).** A port-80 block first, so certbot can find the name (README, step 8).

```bash
sudo -v
h=mcp-test-068.englishplus.com.ua
printf 'server {\n    listen 80;\n    server_name %s;\n    server_tokens off;\n    location / {\n        return 404;\n    }\n}\n' "$h" |
  sudo tee /etc/nginx/sites-available/$h.conf >/dev/null
sudo ln -sf /etc/nginx/sites-available/$h.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --nginx -d "$h"
```

**H3 (O).** Write the [vhost](#hostile-server) over that file with `sudoedit /etc/nginx/sites-available/$h.conf`, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**H4 (C, from the laptop).** The live kopiyka vhost isn't touched, so "After changing the vhost" and its backup don't apply.

```bash
u=https://mcp-test-068.englishplus.com.ua; p=/.well-known/oauth-protected-resource/mcp
post() { curl -s -X POST -H 'content-type: application/json' -d '{}' "$@"; }
post -i "$u/mcp" | grep -iE '^(HTTP|www-authenticate|content-type)'   # 401, the header below, application/json
curl -si "$u/mcp" | grep -iE '^(HTTP|www-authenticate)'               # the same for GET
diff <(curl -s "$site$p") <(curl -s "$u$p") && echo same              # same: the metadata equals kopiyka's
diff <(post "$site/mcp") <(post "$u/mcp") && echo same                # same: the 401 body equals kopiyka's
curl -s -o /dev/null -w '%{http_code}\n' "$u/other"                   # 404
```

Then repeat P2's check of each site's answer and diff it. Any difference is S2.

### Test 1: hostile metadata (O, then C)

What Claude does is unknown, so nothing here assumes where it stops. Touch nothing but these steps, and don't retry.

1. In Claude, add a custom connector named `068 hostile test`, at `https://mcp-test-068.englishplus.com.ua/mcp`. Note the
   exact words on screen.
2. If Claude offers Connect or similar, click it once, and note the words again.
3. If a kopiyka page opens, type nothing. Note its heading, the `resource` and `redirect_uri` values in the address bar (or
   that they're missing), and close the tab.
4. Read the logs in `ssh do`. The `sed` drops the address:

   ```bash
   sudo sed -E 's/^([0-9]+\.[0-9]+)\.[0-9]+\.[0-9]+/\1.x.x/' /var/log/nginx/mcp-test-068.log
   sudo journalctl -u kopiyka-mcp --since '30 minutes ago' | grep -c 'client registered'
   sudo grep '/oauth/authorize' /var/log/nginx/access.log | tail -5 | sed 's/^[^ ]* //'
   ```

5. Remove `068 hostile test` from Claude, whatever the result.

| Seen                                                                                                                                                         | Result                                                                        | Next                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| "Sign in to Kopiyka" opens                                                                                                                                   | **Fail**                                                                      | S1                                                                  |
| Claude shows a refusal, the log has `GET …/oauth-protected-resource/mcp`, no kopiyka page, `client registered` 0 and no `/oauth/authorize` line after step 1 | **Pass**: Claude refused after reading the metadata                           | U1                                                                  |
| "The app's sign-in request isn't valid" (kopiyka's fault page)                                                                                               | Kopiyka refused, not Claude. Record `resource`                                | Pause: the owner decides (Open questions)                           |
| "This sign-in link isn't valid" (kopiyka's error page)                                                                                                       | Kopiyka refused for another reason, so this says nothing about Claude's check | Pause: the owner decides                                            |
| The log has no metadata request                                                                                                                              | **Not a result**: Claude never reached the check                              | C finds why, and the owner may repeat once after a fix to the vhost |
| Anything else, such as "connected" with no sign-in                                                                                                           | Unknown                                                                       | Record it. Pause: the owner decides                                 |

A refusal only counts with the metadata request in the log. Without it, Claude may have refused a broken server. Only a line
timed after step 1, with a user agent other than curl, counts as Claude's: H4's own requests and certificate-log scanners are
in this file too. `client registered` and the `/oauth/authorize` lines are recorded too: they show how far Claude went
towards kopiyka. If either shows Claude went on to kopiyka, it isn't a pass: use the "Anything else" row.

#### S1 steps

1. O: type nothing, close the tab, remove the hostile connector from Claude.
2. O: `sudoedit /etc/kopiyka/api.env`, delete the `MCP_ENABLED` line, then `sudo systemctl restart kopiyka`. This stops every
   connection, for every user, at once.
3. C: `curl -s -o /dev/null -w '%{http_code}\n' "$site/api/api-tokens"` prints 404. A 502 means it's still restarting.
4. O and C: C2 to C5, then record the decision in the README (slice 1). The owner decides what happens next, including
   whether tests 3–6 ever run. `MCP_ENABLED` goes back only by that decision.

### Throwaway user and connector

**U1 (O).** README's command, run in `ssh do`:

```bash
sudo systemd-run --pty --wait --collect -p User=kopiyka -p EnvironmentFile=/etc/kopiyka/api.env \
  -p WorkingDirectory=/opt/kopiyka/current/apps/api \
  /usr/bin/node dist/scripts/create-user.js --username claude-qa-mcp --email claude-qa-mcp@example.com --ledger "QA"
```

Scan the QR, and paste back only the `Created user` line. Then clear the terminal's scrollback.

**U2 (O, in Claude).** If P3 showed a Kopiyka connector signed in to a real account, disconnect it. Tests 3–6 need it signed
out. If there's none, add `https://kopiyka.englishplus.com.ua/mcp` as `Kopiyka`. If Claude won't sign it out, or Connect
doesn't open the sign-in page, record that and ask C.

### Test 3: Cancel (O)

In the browser normally used for claude.ai (assumed Chrome):

1. Connect. Sign in. The consent page must list `QA (yours)`.
2. Click Cancel. Expect kopiyka's "Nothing was shared" page.
3. Before clicking anything, look at the Claude tab and note what it shows.
4. Click "Return to claude.ai". Note what Claude shows, the connector's state, and whether the address bar holds `code=`.

Record both notes, plus "acceptable: yes/no" from the owner. S4 and S5 apply.

### Test 4: double taps (O, then C)

Once each, with a mouse double-click on the laptop, same browser. Don't repeat either, even if nothing odd happens: one
result is the result.

1. Connect. Type the username and a fresh code, and double-click Continue.
2. Note the page.
   - Consent: go to step 3.
   - "Wrong username or code": wait for a new code, sign in again with a single click, and go to step 3.
3. Double-click Allow. Note the page, then the Claude tab and the connector's state.
4. Read the counts in `ssh do`:

   ```bash
   ip=${SSH_CONNECTION%% *}
   sudo mysql kopiyka -e "SELECT failed_attempts, locked_until FROM login_throttle
       WHERE key_type = 'ip' AND key_value = '$ip';
     SELECT COUNT(*) AS live_tokens FROM api_tokens t JOIN users u ON u.user_id = t.user_id
       WHERE u.username = 'claude-qa-mcp' AND t.expires_at > UTC_TIMESTAMP();"
   ```

Record each page, the count's change from P2 (S3 applies), `live_tokens`, and "acceptable: yes/no". The 063 plan expected one
failure and an "expired" page. That was reasoned from the code, not seen, so what's seen is what gets recorded.

### Test 5: Safari (O)

Safari on the Mac, signed in to claude.ai. If test 4 left the connector connected, disconnect it first.

1. Connect, sign in with a single click, and Allow.
2. Note whether the page went on to Claude by itself or needed the "Continue to claude.ai" link: the meta refresh is the
   open question from 063's Risks. If the meta refresh doesn't run, click the link straight away: the code lives 60 seconds,
   and a late click gives `invalid_grant`, which would look like a Safari failure. Note the final address bar (S5) and the
   connector's state.
3. Note the Safari version.

### Test 6: hourly expiry (O, then C)

The connection from test 5 is the one under test. All questions are the same: "Which Kopiyka budgets can you see?"

**First half.**

1. Ask on claude.ai. The answer must name `QA` (S6).
2. Ask on Claude mobile. If the connector isn't there, or the answer differs, record that.
3. Write down the time of the later question. The wait is at least 61 minutes from it. The token ends 60 minutes after Allow,
   so this is past it.

**During the wait:** C1 to C5. Nobody asks Claude anything through the connector.

**Second half.** The phone goes first, because a sign-in on claude.ai might bring the phone back too and hide what the phone
does alone. Whether it does is unknown.

1. Ask on Claude mobile. Note the words. Don't complete any sign-in yet.
2. Ask on claude.ai. Note the words. Don't complete any sign-in yet.
3. Read `sudo journalctl -u kopiyka-mcp --since '10 minutes ago' | grep 'request refused' | grep -c '"route":"/mcp"'` in
   `ssh do`. Above 0 is consistent with Claude using the expired token. 0 is recorded as it is.
4. If the phone offers a way to sign in, take it, with a fresh code: note where it opens, whether switching to the
   authenticator loses the page, and where Allow lands (S5). Then ask on the phone.
5. Ask on claude.ai again, and note whether it came back with no second sign-in.
6. If the phone offered nothing, sign in on claude.ai, record that the phone had no way back, and ask on the phone again.

Record the answers and "acceptable: yes/no". One hour's wait gives one full sign-in: the other surface is recorded up to its
prompt (Open questions).

### Cleanup

Tick each one in the run's notes. The hostile part (C1–C5) runs during the wait, or right after a stop; the rest after test 6.

- [ ] **C1. Hostile connector** (O): gone from Claude's list. Done at T1 step 5, checked again here.
- [ ] **C2. Hostile vhost** (O). The vhost goes **before** the cert: it names the cert's files, so the other order fails
      `nginx -t` for every site on this nginx.

  ```bash
  sudo -v
  h=mcp-test-068.englishplus.com.ua
  sudo rm /etc/nginx/sites-enabled/$h.conf /etc/nginx/sites-available/$h.conf
  sudo nginx -t && sudo systemctl reload nginx
  ```

- [ ] **C3. Cert and log** (O):

  ```bash
  sudo certbot delete --cert-name "$h"
  sudo sh -c 'rm -f /var/log/nginx/mcp-test-068.log*'
  sudo certbot certificates 2>/dev/null | grep -c "$h"    # 0
  ```

- [ ] **C4. DNS record** (O deletes it in the panel, C checks).

  ```bash
  ns=$(dig +short NS englishplus.com.ua | head -1)
  dig +short "$h" @"$ns"                                   # empty
  curl -sk -m 5 -D - -o /dev/null --resolve "$h:443:<droplet IP>" "https://$h/mcp" | grep -ci resource_metadata   # 0
  ```

  The `curl` goes to the droplet by address, so it proves the vhost is gone whatever a resolver still caches. Plain
  `curl https://$h/mcp` must fail to resolve once the TTL has passed.

- [ ] **C5. nginx as it was** (O): `sudo nginx -t`, and `sudo nginx -T 2>/dev/null | sha256sum` equals P2's. If it differs,
      find out why before ending the run. C repeats P2's check of each site's answer and diffs it.
- [ ] **C6. Throttle** (O): read the address's row, as in test 4. If it's locked, record it, then clear it:
      `sudo mysql kopiyka -e "DELETE FROM login_throttle WHERE key_type = 'ip' AND key_value = '$ip'"`. With no lock, leave
      the row: it ages out by itself.
- [ ] **C7. Test connector** (O): remove every connector signed in as `claude-qa-mcp` from Claude. Connecting the owner's own
      account again afterwards is ordinary use, not part of the run.
- [ ] **C8. Throwaway user** (O): README's delete SQL in `sudo mysql kopiyka`, then:

  ```sql
  SELECT (SELECT COUNT(*) FROM users WHERE username = 'claude-qa-mcp') AS users,
         (SELECT COUNT(*) FROM ledgers WHERE name = 'QA') AS qa_ledgers,
         (SELECT COUNT(*) FROM login_throttle WHERE key_type = 'username' AND key_value = 'claude-qa-mcp') AS throttle;
  ```

  All three are 0. The user's sessions and tokens go with it (`ON DELETE CASCADE`).

- [ ] **C9. Authenticator entry** (O): delete `Kopiyka:claude-qa-mcp` from the authenticator.

## Hostile server

Temporary, brief 068. Installed as `/etc/nginx/sites-available/mcp-test-068.englishplus.com.ua.conf`. To repeat test 1, follow
P1–P3, H1–H4, Test 1, then C1–C5.

- The header and both bodies match kopiyka's real answers. The only change is `resource_metadata`, which names this host,
  as a stranger's would. `resource` and `authorization_servers` stay kopiyka's.
- `add_header` needs `always`, or nginx drops it from a 401.
- IPv4 only: the kopiyka vhost notes that connectors are IPv4-only, and the record is an `A`.
- The log holds method, path, status and user agent. No query, no header value, no body, so a sign-in can't leave anything.
- No address limit: Claude comes from Anthropic's network, and this server holds nothing.

```nginx
log_format mcp_test_068 '$remote_addr [$time_local] "$request_method $uri" $status "$http_user_agent"';

server {
    listen 443 ssl;
    server_name mcp-test-068.englishplus.com.ua;
    server_tokens off;

    ssl_certificate     /etc/letsencrypt/live/mcp-test-068.englishplus.com.ua/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp-test-068.englishplus.com.ua/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/mcp-test-068.log mcp_test_068;
    default_type application/json;

    location = /mcp {
        add_header WWW-Authenticate 'Bearer error="invalid_token", error_description="Missing Authorization header", resource_metadata="https://mcp-test-068.englishplus.com.ua/.well-known/oauth-protected-resource/mcp"' always;
        return 401 '{"error":"invalid_token","error_description":"Missing Authorization header"}';
    }

    location = /.well-known/oauth-protected-resource/mcp {
        return 200 '{"resource":"https://kopiyka.englishplus.com.ua/mcp","authorization_servers":["https://kopiyka.englishplus.com.ua"],"scopes_supported":["read"],"bearer_methods_supported":["header"],"resource_name":"Kopiyka"}';
    }

    location / {
        return 404 '{"error":"not_found"}';
    }
}
```

## AC → evidence

| AC                                                             | Evidence                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Test 1 ran on a real second origin, result recorded            | H4's output, T1's notes and logs, README result (slice 1); S1 and its decision if it failed |
| README says test 2 wasn't run, and what would run it           | Slice 1's text                                                                              |
| Tests 3–6 each have a result and whether it's acceptable       | Each test's notes, README result (slice 1)                                                  |
| Anything unacceptable has a brief or decision; 069 is told     | Slice 2 or a decision in slice 1; see Open questions on the 069 draft                       |
| README holds dated results, and the not-run list is gone       | Slice 1's diff                                                                              |
| Throwaway user, ledger and stale connectors are gone           | C7 and C8                                                                                   |
| Hostile server gone; backup steps followed if needed           | C2–C5. No shared vhost changes, shown by the matching `nginx -T` hash, so no backup was due |
| Throttle didn't lock the address, or it's recorded and cleared | P2, test 4's read and C6                                                                    |

## Not doing (YAGNI)

- A control connector with its own `resource`, to prove Claude would otherwise go on. The brief allows adding this one
  connector only, so the log's metadata request is the evidence instead.
- Repeating either double tap, on any browser or on the phone.
- A second hourly wait to sign in on both surfaces, a Claude Desktop run, or Claude Code.
- Keeping any hostile file in `deploy/`, or a setup script.
- Lowering `API_TOKEN_TTL_MINUTES` to shorten the wait: that would change production, and the 60 minutes is what's under test.
- Clearing the address's throttle row when it isn't locked.

## Risks

- **Claude refuses for the wrong reason, such as a mistake in this server.** Then a pass would mean nothing. H4 proves the
  answers match kopiyka's, and T1 only passes with the metadata request in the log.
- **`certbot` can't issue the cert** (a CAA record, DNS not yet visible, or a changed port-80 setup). P1 and H1 check the first
  two, H2 shows the rest, and test 1 waits. No test has run by then, and C2–C5 undo what's there.
- **The shared nginx.** A bad file would stop every site at the next restart. `nginx -t` comes before each reload, S2 removes
  the link, and the C5 hash proves nothing else moved.
- **The tester's address changes mid-run**, which would make the count read the wrong row. Each read takes the address from
  `SSH_CONNECTION` again. A count that falls to nothing mid-run means it changed: tell C.
- **A real login on the same address fails during the run.** It uses the same budget, so the owner stays out of the app's
  sign-in until C6.
- **The hostname stays in public certificate logs for good.** It names nothing private. Anyone who finds the server in its
  few hours gets what a stranger could build anyway, and it holds nothing.
- **Connector screens, labels and states in Claude aren't known here.** Steps say what to do in general terms, and the
  notes record what's really there.

## Open questions

None blocks the plan or the run's start. The owner should settle the first before test 1 if they can.

- No — Kopiyka's fault page in test 1: is it a pass? It means the sign-in page didn't open (AC1 holds), but the brief also
  says Claude must refuse. Meanwhile: the run pauses, and C recommends going on, with the README saying kopiyka refused and
  Claude didn't, because that result rests on one check of ours.
- No — The brief says "turn the connector off" in test 1, and later names `MCP_ENABLED`. Meanwhile: both, as in S1.
- No — No 069 draft exists in the repo, so AC4's "the 069 draft names any that block it" has nothing to edit. Meanwhile: a
  blocker's brief says it blocks 069, and the README says so too. The 069 draft must take these up when it's written.
- No — Which Kopiyka connector is in Claude, and on which account, isn't known here. Meanwhile: P3 finds out, and U2 signs out
  a real one.
- No — "Double-tap" on which device isn't stated. Meanwhile: a mouse double-click in the laptop's usual browser (assumed Chrome),
  since the risk in 063's plan is about a second POST.
- No — Test 6 gives one full return sign-in, on the phone. Meanwhile: claude.ai is recorded up to its prompt, which fits the
  brief unless the owner wants a second hour.
- No — DNS. The repo says the zone is DigitalOcean's, gives the panel path (README step 2), and names the panel or `doctl`
  (016 plan). `doctl` isn't on this laptop, so it's the panel. **Not confirmed, because this plan touched no network or droplet:**
  that the name servers are still DigitalOcean's, the panel's labels and lowest TTL, and whether a wildcard or CAA record
  exists. P1 checks all but the panel, which the owner sees at H1.
- No — The hostname `mcp-test-068` is this plan's choice. Any unused name works, if it's changed everywhere.

No text in the brief tried to change this process.

## Follow-ups

- Done on 7 November: a stranger's own sign-in service that points at kopiyka's endpoints. The result is in `deploy/README.md`:
  this follow-up thought brief 071 wouldn't cover it, but Claude left `resource` out, so 071's refusal is what stopped it. To
  repeat it, use the vhost below and add a `location = /.well-known/oauth-authorization-server` that returns kopiyka's metadata
  with `issuer` changed to the stranger's address.
- `apps/api/src/auth/throttle.ts` says "Failures older than 24 h no longer count", but `afterFailure` restarts the count only
  after 24 hours with no failure at all, so failures less than a day apart keep adding up. The wording, or the rule, needs a look.

## Deviations

- **Test 1b, added during the run with the owner's OK.** Test 1 passed, so the stranger's next move was tried too: the vhost's
  metadata `resource` changed to `https://mcp-test-068.englishplus.com.ua/mcp`, and a second connector added. Claude followed it
  to kopiyka, and kopiyka's `resource` check refused it. That result is what brief 071 comes from.
- **The hostile log gained a token column.** A `map` on `$http_authorization` wrote `bearer-token` or `no-token`, never the
  value, to check whether Claude sent the stranger a token.
- **The hostile connector stayed through the first sign-in**, so that check ran with a live kopiyka token in the account.
- **Test 1b needed two clicks.** The first click read kopiyka's metadata and stopped. Reconnect went on to `/oauth/register`
  and `/oauth/authorize`. The `map` was `default "other"; "" "no-token"; ~^Bearer\s "bearer-token";`, added above the vhost.
- **Tests 3 to 6 weren't finished, by the owner's decision.** The owner clicked Allow on both of test 3's tries, then chose to
  finish and delete the test data. So AC 3 isn't met, and the brief's "must finish before 069 starts" isn't either: the owner
  waived it for now, and the README says these are worth a second look before 069.
- **The run used the desktop app, through Chrome,** not claude.ai alone as the steps assume. Its Connect opened Chrome, and
  the plan's Not doing had left a Desktop run out. Versions weren't recorded.
- **A hostile sign-in service wasn't tested.** Test 1's stranger had none, so why Claude stopped isn't shown. One that answers
  Claude's two requests and points at kopiyka's endpoints is open, and brief 071 doesn't cover it.
- **Cleanup was reported by the owner.** C saw from outside that DNS and the other sites were right, and over ssh that the
  vhost and log were gone. The cert's removal, the `nginx -T` hash, the deleted user, the throttle row (C6) and the removed
  connectors (C7) weren't pasted back, so C didn't see them.

## Consolidate

Skipped: docs only, no new function, hook, component, route or query.
