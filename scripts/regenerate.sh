#!/usr/bin/env bash
#
# regenerate.sh — rebuild the committed per-tool scaffolds after editing a pack.
#
# Committed scaffolds live at packs/<pack>/scaffolded-packs/<tool>/ and contain
# the tool-native steering/MCP/command files ONLY (no skills). Each pack also
# gets an editable add-skills.sh that ports its skills from skills-library/.
# Run this after editing a pack's instructions or pack.yaml.
#
#   ./scripts/regenerate.sh              # rebuild every pack in place
#   ./scripts/regenerate.sh <pack>       # rebuild one pack in place
#
# Requires Node 18+ (the renderer is Node). End users who just want the files
# copy packs/<pack>/scaffolded-packs/<tool>/ and run that pack's add-skills.sh —
# no Node needed for either of those.
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pack="${1:-}"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js 18+ is required to regenerate scaffolds, but 'node' was not found." >&2
  exit 1
fi

cd "$repo_root"
if [ -n "$pack" ]; then
  echo "Regenerating packs/$pack/scaffolded-packs/ ..."
  node installer/bin/ramp-pack.js build-all --in-place --pack "$pack"
else
  echo "Regenerating scaffolds for all packs ..."
  node installer/bin/ramp-pack.js build-all --in-place
fi
echo "Done. Review packs/<pack>/scaffolded-packs/ and commit."
