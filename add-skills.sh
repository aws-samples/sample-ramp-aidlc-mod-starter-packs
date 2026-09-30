#!/usr/bin/env bash
#
# add-skills.sh — repo-root shortcut. Port a pack's skills by name, no Node.
#
#   ./add-skills.sh <pack> --tool <kiro|claude-code|copilot|cursor> --target <dir>
#
# e.g.  ./add-skills.sh cots-rewrite-on-cloudnative --tool kiro --target /path/to/project
#
# This just delegates to packs/<pack>/add-skills.sh (where the editable SKILLS
# list lives). Run with no args to list available packs.
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

list_packs() {
  echo "available packs:"
  for d in "$here"/packs/*/add-skills.sh; do
    [ -f "$d" ] && echo "  $(basename "$(dirname "$d")")"
  done
}

if [ $# -lt 1 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ "${1#-}" != "$1" ]; then
  echo "usage: ./add-skills.sh <pack> --tool <kiro|claude-code|copilot|cursor> --target <dir>"
  list_packs
  exit 1
fi

pack="$1"; shift
script="$here/packs/$pack/add-skills.sh"
if [ ! -f "$script" ]; then
  echo "error: no such pack '$pack' (expected $script)" >&2
  list_packs >&2
  exit 1
fi

exec "$script" "$@"
