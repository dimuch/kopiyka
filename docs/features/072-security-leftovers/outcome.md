# Outcome: Security leftovers

Brief: ./brief.md · Finished 2026-11-08

## PRs

- [#119](https://github.com/dimuch/kopiyka/pull/119) Security leftovers: /mcp, IPv6 limits and service sandbox — v1.6.1
- [#120](https://github.com/dimuch/kopiyka/pull/120) Record brief 072's droplet rollout and the sandbox scores — v1.6.1
- [#122](https://github.com/dimuch/kopiyka/pull/122) Say what the login lock counts, and prune old throttle rows — v1.6.2

## Decided

- Two PRs split by how they reach production: droplet files first (the most urgent item), then the API. Two patch
  bumps.
- `/mcp` takes only Anthropic's ranges, like `/oauth/token` and `/oauth/register`.
- Every nginx limit keys IPv6 clients by their /64. Zones keyed straight on the address got new names, since a reload
  refuses a changed key. `deploy/check-address-key.sh` tests the map on the droplet's nginx.
- Both services got a conservative systemd sandbox, and the connector `IPAddressAllow=localhost`. #120 recorded the
  owner's rollout.
- The lock rule is unchanged (owner's decision); its comment now says what it counts, with a test. Rows that no longer
  count are pruned on each good login.

## Left out

- `MemoryDenyWriteExecute`, `PrivateUsers`, `ProcSubset=pid` and a system call filter, which Node needs.
- A pruning timer or index, an AAAA record, and running the address check in CI.

## Follow-ups

- Hide the droplet's other sites' files from both services — in BACKLOG.md
- Check IPv6 normally if an AAAA record is added — dropped: there is none, so nothing to do.

Full plan: `git show 8be3b47c:docs/features/072-security-leftovers/plan.md`
