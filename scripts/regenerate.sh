#!/usr/bin/env bash
#
# regenerate.sh — rebuild per-tool pack output after you hand-edit a pack.
#
# Under Model B the rendered output is NOT committed to git; it is regenerated
# from source (pack.yaml + instructions/ + skills-library/). Run this after
# editing a pack to preview all four tool configs locally.
#
#   ./scripts/regenerate.sh              # rebuild every pack   -> dist/<pack>/<tool>/
#   ./scripts/regenerate.sh <pack>       # rebuild one pack     -> dist/<pack>/<tool>/
#   OUT=preview ./scripts/regenerate.sh  # override output dir  (default: dist)
#
# NOTE: generation runs the Node renderer (ramp-pack). Node 18+ is required to
# GENERATE. If you only need a ready-made folder and don't have Node, download
# it from the project's gh-pages site instead — no tooling needed.
#
# To install a pack into a specific project (not just preview), use:
#   node installer/bin/ramp-pack.js init <pack> --tool <kiro|claude-code|copilot|cursor> --target /path/to/project
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${OUT:-dist}"
pack="${1:-}"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js 18+ is required to generate packs, but 'node' was not found." >&2
  echo "       Install Node, or download a pre-built folder from the project's gh-pages site." >&2
  exit 1
fi

cd "$repo_root"
if [ -n "$pack" ]; then
  echo "Regenerating pack '$pack' -> $out/$pack/<tool>/ ..."
  node installer/bin/ramp-pack.js build-all --out "$out" --pack "$pack"
else
  echo "Regenerating all packs -> $out/<pack>/<tool>/ ..."
  node installer/bin/ramp-pack.js build-all --out "$out"
fi
echo "Done. Review the output under: $out/"
