#!/usr/bin/env bash
#
# add-skills.sh — copy this pack's Agent Skills into your project.
#
# No Node required — just bash + cp. Skills are copied from the shared
# skills-library/ in this repo into your project's per-tool skills directory.
#
#   ./add-skills.sh --tool kiro --target /path/to/your/project
#   ./add-skills.sh --tool claude-code --target .        # default target: current dir
#   ./add-skills.sh --tool cursor --target . --skills-src /path/to/skills-library
#
# To change which skills this pack installs, EDIT the SKILLS list below —
# add or remove names (each must match a directory in skills-library/).
#
set -euo pipefail

PACK_NAME="agentic-ai-workflow"

# --- EDIT ME: the skills installed for this use case --------------------------
SKILLS=(
  agentic-optimizer
  aws-skills
  iac
  terraform-aws
  terraform-skill
)
# -----------------------------------------------------------------------------

tool=""
target="."
skills_src=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tool) tool="${2:-}"; shift 2 ;;
    --target) target="${2:-}"; shift 2 ;;
    --skills-src) skills_src="${2:-}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

case "$tool" in
  kiro)        dest_sub=".kiro/skills" ;;
  claude-code) dest_sub=".claude/skills" ;;
  copilot)     dest_sub=".github/skills" ;;
  cursor)      dest_sub=".cursor/skills" ;;
  *) echo "usage: $0 --tool <kiro|claude-code|copilot|cursor> --target <dir>" >&2; exit 1 ;;
esac

# Locate skills-library: use --skills-src if given, else search up from this script.
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$skills_src" ]; then
  for cand in \
    "$here/../../../skills-library" \
    "$here/../../skills-library" \
    "$here/../skills-library" \
    "$here/skills-library"; do
    if [ -d "$cand" ]; then skills_src="$(cd "$cand" && pwd)"; break; fi
  done
fi
if [ -z "$skills_src" ] || [ ! -d "$skills_src" ]; then
  echo "error: skills-library not found. Pass --skills-src /path/to/skills-library" >&2
  exit 1
fi

dest="$target/$dest_sub"
mkdir -p "$dest"
echo "Installing ${#SKILLS[@]} skills for '$PACK_NAME' -> $dest"
missing=0
for s in "${SKILLS[@]}"; do
  if [ -d "$skills_src/$s" ]; then
    rm -rf "${dest:?}/$s"
    cp -R "$skills_src/$s" "$dest/$s"
    echo "  + $s"
  else
    echo "  ! not found in skills-library: $s" >&2
    missing=$((missing + 1))
  fi
done
echo "Done. $(( ${#SKILLS[@]} - missing )) copied, $missing missing -> $dest"
[ "$missing" -eq 0 ]
