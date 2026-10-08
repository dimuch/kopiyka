#!/usr/bin/env bash
#
# Deploys one commit of main to the droplet. Installed root-owned as
# /usr/local/bin/kopiyka-deploy and run as the `kopiyka` user through the
# forced command of the GitHub deploy key (deploy/README.md), so the only
# input is the commit SHA in $SSH_ORIGINAL_COMMAND.
#
# Builds in a new release dir, one capped step at a time (the droplet has
# 2 GB RAM shared with other sites), switches `current`, restarts the API
# (which runs pending migrations first) and checks health. If the new release
# is unhealthy it switches back to the previous one. Exit 0 = deployed and healthy.
set -euo pipefail

BASE=/opt/kopiyka
REPO=$BASE/repo.git
RELEASES=$BASE/releases
CURRENT=$BASE/current
HEALTH_URL=http://127.0.0.1:3100/api/health
KEEP=3

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1

sha=${SSH_ORIGINAL_COMMAND:-}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: <40-hex commit sha>" >&2
  exit 2
fi

exec 9>"$BASE/deploy.lock"
if ! flock -n 9; then
  echo "another deploy is running" >&2
  exit 1
fi

git -C "$REPO" fetch --quiet origin +refs/heads/main:refs/heads/main
if ! git -C "$REPO" merge-base --is-ancestor "$sha" main 2>/dev/null; then
  echo "not on main: $sha" >&2
  exit 1
fi

release=$RELEASES/$(date -u +%Y%m%d%H%M%S)-${sha:0:7}

# On any failure, remove the new release unless `current` points to it. A
# dropped SSH session (no pty) arrives as SIGPIPE on the next write, not
# SIGHUP; trapping the signals makes bash run the EXIT trap for them too.
cleanup() {
  if [[ $(readlink "$CURRENT" || true) != "$release" ]]; then
    rm -rf "$release"
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP PIPE INT TERM

mkdir -p "$release"
git -C "$REPO" archive "$sha" | tar -x -C "$release"
cd "$release"

step() {
  local name=$1
  shift
  nice -n 10 /usr/bin/time -f "$name: %e s, max RSS %M KB" "$@"
}

# Measured peaks (brief): install ~750 MB, api build ~350 MB, web export
# ~450 MB with one Metro worker and a 700 MB heap (~1.8 GB with defaults).
step install corepack yarn install --immutable
step "api build" env NODE_OPTIONS=--max-old-space-size=700 corepack yarn api build
step "web export" env NODE_OPTIONS=--max-old-space-size=700 \
  corepack yarn mobile expo export -p web --max-workers 1

switch_to() {
  ln -sfn "$1" "$BASE/current.new"
  mv -T "$BASE/current.new" "$CURRENT"
}

# The restart runs migrations (ExecStartPre) and fails if they fail.
restart_healthy() {
  sudo -n /usr/bin/systemctl restart kopiyka.service || return 1
  local _
  for _ in $(seq 15); do
    if curl -fsS -o /dev/null "$HEALTH_URL" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

prev=$(readlink "$CURRENT" || true)
switch_to "$release"

if ! restart_healthy; then
  if [[ -z $prev ]]; then
    echo "health check failed on the first deploy, nothing to roll back to; see journalctl -u kopiyka" >&2
    exit 1
  fi
  switch_to "$prev"
  if restart_healthy; then
    echo "health check failed; rolled back to $prev" >&2
  else
    echo "health check failed; rolled back to $prev, which is also unhealthy, see journalctl -u kopiyka" >&2
  fi
  exit 1
fi

# Keep the newest releases; never remove the live one.
live=$(readlink "$CURRENT")
mapfile -t old < <(printf '%s\n' "$RELEASES"/*/ | sort -r | tail -n +$((KEEP + 1)))
for dir in "${old[@]}"; do
  dir=${dir%/}
  if [[ $dir != "$live" ]]; then
    rm -rf "$dir"
  fi
done

echo "deployed $sha ($release)"
