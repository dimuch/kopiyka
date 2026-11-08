#!/usr/bin/env bash
# Checks the vhost's $kopiyka_addr map (brief 072): an IPv6 /64 counts as one address, an IPv4 address on its own.
# It runs as you, with no sudo: a throwaway nginx on 127.0.0.1:18064 holds only that map and a 1-a-minute limit, takes
# each case's address from X-Real-IP through the realip module, and is stopped and removed on exit.
#
# Usage: deploy/check-address-key.sh [vhost]   (default: the installed vhost)
# Exit: 0 when every case passes, 1 when one fails, 2 when it can't set up its own nginx (it says why).
set -euo pipefail

vhost=${1:-/etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf}
port=18064
nginx_bin=$(command -v nginx || echo /usr/sbin/nginx)

[ -x "$nginx_bin" ] || { echo "No nginx found."; exit 2; }
"$nginx_bin" -V 2>&1 | grep -q http_realip_module || { echo "This nginx has no http_realip_module."; exit 2; }
map=$(awk '/^map \$binary_remote_addr \$kopiyka_addr \{/ { found = 1 } found { print } found && /^\}/ { exit }' "$vhost")
[ -n "$map" ] || { echo "No \$kopiyka_addr map in $vhost."; exit 2; }

dir=$(mktemp -d)
cleanup() {
  [ -f "$dir/nginx.pid" ] && kill "$(cat "$dir/nginx.pid")" 2>/dev/null || true
  sleep 0.3
  rm -rf "$dir"
}
trap cleanup EXIT

mkdir -p "$dir/www"
echo ok >"$dir/www/index.html"
# Nothing may fall back to nginx's built-in paths under /var: as you, nginx can't open them, and wouldn't start.
cat >"$dir/nginx.conf" <<CONF
pid $dir/nginx.pid;
error_log $dir/error.log;
worker_processes 1;
events { worker_connections 64; }
http {
    access_log off;
    client_body_temp_path $dir/client_body;
    proxy_temp_path $dir/proxy;
    fastcgi_temp_path $dir/fastcgi;
    uwsgi_temp_path $dir/uwsgi;
    scgi_temp_path $dir/scgi;
$map
    limit_req_zone \$kopiyka_addr zone=check_addr:1m rate=1r/m;
    server {
        listen 127.0.0.1:$port;
        set_real_ip_from 127.0.0.1;
        real_ip_header X-Real-IP;
        limit_req zone=check_addr;
        limit_req_status 429;
        # A static file, not \`return\`: return answers in the rewrite phase, before limit_req ever runs.
        root $dir/www;
    }
}
CONF

# -e (nginx 1.19.5 and later) keeps the startup error log out of /var/log/nginx too.
version=$("$nginx_bin" -v 2>&1 | sed -n 's|.*nginx/\([0-9.]*\).*|\1|p')
early_log=()
if [ "$(printf '%s\n' 1.19.5 "$version" | sort -V | head -1)" = 1.19.5 ]; then early_log=(-e "$dir/error.log"); fi
if ! "$nginx_bin" -p "$dir" -c "$dir/nginx.conf" ${early_log[@]+"${early_log[@]}"} 2>"$dir/start.err"; then
  echo "Its nginx didn't start:"
  cat "$dir/start.err" "$dir/error.log" 2>/dev/null || true
  exit 2
fi

failed=0
check() {
  local address=$1 expected=$2 got
  got=$(curl -s -o /dev/null -w '%{http_code}' -H "X-Real-IP: $address" "http://127.0.0.1:$port/index.html" || true)
  if [ "$got" = "$expected" ]; then
    echo "PASS  $address → $got"
  else
    echo "FAIL  $address → $got, expected $expected"
    failed=1
  fi
}

check 2001:db8:1:2::1 200
check 2001:db8:1:2::ffff 429 # the same /64
check 2001:db8:1:3::1 200    # the next /64
check 2001:db8::1 200
check 2001:db8:0:0:2::1 429 # the same /64 as 2001:db8::1, written out
check 192.0.2.1 200
check 192.0.2.2 200 # IPv4 isn't grouped
check 192.0.2.1 429

exit "$failed"
