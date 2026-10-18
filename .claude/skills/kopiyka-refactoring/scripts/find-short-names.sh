#!/usr/bin/env bash
# Lists single-letter names (and their uses) in loops, callbacks, parameters,
# destructuring and declarations (kopiyka-refactoring §4). Read-only.
#
#   find-short-names.sh [path...]       scan files (default: apps/api/src apps/mobile/src)
#   find-short-names.sh --diff <base>   scan only lines added since <base> (e.g. origin/main):
#                                       commits, staged and unstaged edits, and new untracked
#                                       files under apps/ — src and test alike
#
# Prints file:line: code. Exit code 1 when anything is found, so it can gate a slice.
set -euo pipefail

# One alternative per shape, each anchored so SQL aliases (`JOIN categories c ON`,
# `c.tech_name`) and generic type parameters (`api<T>()`) don't match.
bare_arrow='(^|[ (,])[a-z] =>'                                  # x => x
in_parens_or_brackets='(\(|\[|, ?)[a-z]( ?[,:)=]|\]| of | in )' # (r) => · (e, index) · toDto(r: Row) · [a] · catch (e)
declared='(const|let|var) \[?[a-z]( ?[,:=]|\]| of | in )'      # const e = · for (const e of · const [y, m] =
short_name_pattern="$bare_arrow|$in_parens_or_brackets|$declared"

app_dirs=(apps/api/src apps/api/test apps/mobile/src apps/mobile/test)

# Reads a unified diff on stdin and prints `file:line: code` for every added line.
added_lines_with_location() {
  awk '
    /^\+\+\+ / { file = substr($0, 7); next }               # "+++ b/<path>"
    /^@@ /     { split($3, hunk, ","); line = substr(hunk[1], 2) + 0; next }
    /^\+/      { print file ":" line ": " substr($0, 2); line++ }
  '
}

if [[ "${1:-}" == "--diff" ]]; then
  base_ref="${2:?usage: find-short-names.sh --diff <base>}"
  # Comparing the base with the working tree covers commits plus uncommitted edits.
  tracked_matches=$(git diff "$base_ref" -U0 -- "${app_dirs[@]}" \
    | added_lines_with_location | grep -E "$short_name_pattern" || true)
  untracked_files=$(git ls-files --others --exclude-standard -- "${app_dirs[@]}")
  untracked_matches=""
  if [[ -n "$untracked_files" ]]; then
    # shellcheck disable=SC2086 # one path per line, no spaces in this repo's paths
    untracked_matches=$(grep -nE "$short_name_pattern" $untracked_files /dev/null || true)
  fi
  matches=$(printf '%s\n%s\n' "$tracked_matches" "$untracked_matches" | sed '/^$/d')
else
  scan_paths=("$@")
  [[ ${#scan_paths[@]} -eq 0 ]] && scan_paths=(apps/api/src apps/mobile/src)
  matches=$(grep -rnE "$short_name_pattern" "${scan_paths[@]}" || true)
fi

if [[ -z "$matches" ]]; then
  echo "No single-letter names found."
  exit 0
fi

echo "$matches"
echo "---"
echo "$(echo "$matches" | wc -l | tr -d ' ') line(s) with single-letter names."
exit 1
