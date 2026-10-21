#!/usr/bin/env bash
#
# Prints one user and one ledger's category setup for a month as data-only SQL, to start production from the laptop's
# database without its expenses (deploy/README.md, "Starting from the laptop's ledger"). Run on the laptop with the
# laptop's DATABASE_URL in the environment:
#
#   set -a; . apps/api/.env; set +a
#   deploy/export-ledger.sh <user id> <ledger id> <YYYY-MM> > ledger.sql
#
# It takes the user (with its encrypted TOTP secret, so the same TOTP_ENC_KEY must be in production), the ledger, its
# members, the categories in that month's live list, the list itself with its names, and its planned amounts. No
# expenses, sessions, Notion records or other months. The output holds the encrypted secret: delete it after import.
set -euo pipefail

if [[ $# -ne 3 || ! $1 =~ ^[0-9]+$ || ! $2 =~ ^[0-9]+$ || ! $3 =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]]; then
  echo "usage: $0 <user id> <ledger id> <YYYY-MM>" >&2
  exit 2
fi
user=$1 ledger=$2 month=$3-01

# The credentials go in a 0600 file, not on the command line, where `ps` would show them.
cnf=$(mktemp)
trap 'rm -f "$cnf"' EXIT
db=$(node -e '
  const url = new URL(process.env.DATABASE_URL);
  const field = (name, value) => `${name}="${decodeURIComponent(value).replace(/["\\]/g, "\\$&")}"\n`;
  require("node:fs").writeFileSync(process.argv[1],
    "[client]\n" + field("user", url.username) + field("password", url.password) +
    field("host", url.hostname) + field("port", url.port || "3306"));
  process.stdout.write(url.pathname.slice(1));
' "$cnf")

# --hex-blob: the TOTP secret is binary and must survive the round trip byte for byte.
dump() {
  mysqldump --defaults-extra-file="$cnf" --no-create-info --skip-triggers --skip-add-locks --single-transaction \
    --no-tablespaces --complete-insert --hex-blob --set-gtid-purged=OFF "$db" "$@"
}
in_list="SELECT category_id FROM category_months WHERE list_month = '$month' AND deleted_at IS NULL"
of_ledger="SELECT category_id FROM categories WHERE ledger_id = $ledger"

dump users --where="user_id = $user"
dump ledgers ledger_members --where="ledger_id = $ledger"
dump categories --where="ledger_id = $ledger AND category_id IN ($in_list)"
dump category_months --where="list_month = '$month' AND deleted_at IS NULL AND category_id IN ($of_ledger)"
dump category_budgets --where="budget_month = '$month' AND category_id IN ($of_ledger)"
