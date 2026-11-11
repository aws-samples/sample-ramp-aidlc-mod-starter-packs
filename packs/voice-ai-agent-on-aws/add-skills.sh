#!/usr/bin/env bash
#
# add-skills.sh — copy this pack's Agent Skills into a project without Node.
#
#   ./add-skills.sh --tool kiro --target /path/to/project
#   ./add-skills.sh --tool claude-code --repo-root /path/to/ramp-repository
#   ./add-skills.sh --tool cursor --skills-src /path/to/skills-library
#
# Source precedence is pack override, RAMP-owned, then compatibility library.
# The editable SKILLS list below is generated from pack.yaml.
#
set -eo pipefail
LC_ALL=C
export LC_ALL

PACK_NAME="voice-ai-agent-on-aws"

# --- EDIT ME: the skills installed for this use case -------------------------
SKILLS=(
  nova-sonic-best-practices
  nova-sonic-optimization
  text-agent-to-nova-sonic-voice
)
# -----------------------------------------------------------------------------

usage() {
  echo "usage: $0 --tool <kiro|claude-code|copilot|cursor|codex> [--target <dir>] [--repo-root <ramp-repository-root>] [--skills-src <compatibility-library-root>]" >&2
}

tool=""
target="."
repo_root_input=""
skills_src_input=""
repo_root_explicit=0
skills_src_explicit=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --tool|--target|--repo-root|--skills-src)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "error: $1 requires a value" >&2
        usage
        exit 1
      fi
      case "$1" in
        --tool) tool="$2" ;;
        --target) target="$2" ;;
        --repo-root) repo_root_input="$2"; repo_root_explicit=1 ;;
        --skills-src) skills_src_input="$2"; skills_src_explicit=1 ;;
      esac
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$tool" in
  kiro) dest_sub=".kiro/skills" ;;
  claude-code) dest_sub=".claude/skills" ;;
  copilot) dest_sub=".github/skills" ;;
  cursor) dest_sub=".cursor/skills" ;;
  codex) dest_sub=".agents/skills" ;;
  *)
    usage
    exit 1
    ;;
esac

ERRORS=()
SELECTED_SOURCES=()
SELECTED_KINDS=()
NAME_VALIDITY=()

preflight_scan=""
if ! preflight_scan="$(mktemp "${TMPDIR:-/tmp}/ramp-add-skills.XXXXXX")"; then
  echo "error: cannot create a private preflight scan file" >&2
  exit 1
fi
cleanup_preflight_scan() {
  rm -f "$preflight_scan"
}
trap cleanup_preflight_scan EXIT HUP INT TERM

add_error() {
  ERRORS[${#ERRORS[@]}]="$1"
}

lexists() {
  [ -e "$1" ] || [ -L "$1" ]
}

is_link() {
  [ -L "$1" ]
}

portable_segment_error() {
  portable_segment="$1"
  portable_context="$2"
  if [ -z "$portable_segment" ] ||
     [ "$portable_segment" = "." ] ||
     [ "$portable_segment" = ".." ]; then
    add_error "$portable_context contains an unsafe path segment '$portable_segment'"
    return 1
  fi
  if printf '%s' "$portable_segment" | grep -q '[[:cntrl:]]'; then
    add_error "$portable_context contains an ASCII control character"
    return 1
  fi
  if printf '%s' "$portable_segment" | grep -q '[^ -~]'; then
    add_error "$portable_context contains a non-ASCII character: $portable_segment"
    return 1
  fi
  if printf '%s' "$portable_segment" | grep -q '[<>:"\\|?*]'; then
    add_error "$portable_context contains a non-portable character: $portable_segment"
    return 1
  fi
  case "$portable_segment" in
    *[.\ ])
      add_error "$portable_context has a trailing dot or space: $portable_segment"
      return 1
      ;;
  esac
  portable_base="${portable_segment%%.*}"
  portable_lower="$(printf '%s' "$portable_base" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
  case "$portable_lower" in
    con|prn|aux|nul|com[1-9]|lpt[1-9])
      add_error "$portable_context uses a Windows reserved device name: $portable_segment"
      return 1
      ;;
  esac
  return 0
}

portable_relative_path() {
  portable_path="$1"
  portable_label="$2"
  portable_rest="$portable_path"
  while :; do
    case "$portable_rest" in
      */*)
        portable_part="${portable_rest%%/*}"
        portable_rest="${portable_rest#*/}"
        ;;
      *)
        portable_part="$portable_rest"
        portable_rest=""
        ;;
    esac
    portable_segment_error "$portable_part" "$portable_label" || return 1
    [ -n "$portable_rest" ] || break
  done
  return 0
}

ordinary_directory_root() {
  root_input="$1"
  root_label="$2"
  RESOLVED_DIRECTORY_ROOT=""
  root_lexical="${root_input%/}"
  [ -n "$root_lexical" ] || root_lexical="/"
  if ! lexists "$root_lexical"; then
    add_error "$root_label does not exist: $root_input"
    return 1
  fi
  if is_link "$root_lexical"; then
    add_error "$root_label must not be a symbolic link: $root_input"
    return 1
  fi
  if [ ! -d "$root_lexical" ]; then
    add_error "$root_label must be an ordinary directory: $root_input"
    return 1
  fi
  RESOLVED_DIRECTORY_ROOT="$(
    cd "$root_lexical" 2>/dev/null
    pwd -P
  )" || {
    add_error "cannot resolve $root_label: $root_input"
    return 1
  }
  return 0
}

check_directory_component() {
  component_path="$1"
  component_label="$2"
  if ! lexists "$component_path"; then
    add_error "$component_label does not exist: $component_path"
    return 1
  fi
  if is_link "$component_path"; then
    add_error "$component_label must not be a symbolic link: $component_path"
    return 1
  fi
  if [ ! -d "$component_path" ]; then
    add_error "$component_label must be an ordinary directory: $component_path"
    return 1
  fi
  return 0
}

check_regular_file() {
  file_path="$1"
  file_label="$2"
  if ! lexists "$file_path"; then
    add_error "$file_label does not exist: $file_path"
    return 1
  fi
  if is_link "$file_path"; then
    add_error "$file_label must not be a symbolic link: $file_path"
    return 1
  fi
  if [ ! -f "$file_path" ]; then
    add_error "$file_label must be an ordinary regular file: $file_path"
    return 1
  fi
  return 0
}

check_directory_chain() {
  chain_root="$1"
  chain_relative="$2"
  chain_label="$3"
  chain_path="$chain_root"
  chain_rest="$chain_relative"
  while [ -n "$chain_rest" ]; do
    case "$chain_rest" in
      */*)
        chain_part="${chain_rest%%/*}"
        chain_rest="${chain_rest#*/}"
        ;;
      *)
        chain_part="$chain_rest"
        chain_rest=""
        ;;
    esac
    chain_path="$chain_path/$chain_part"
    if lexists "$chain_path"; then
      check_directory_component "$chain_path" "$chain_label component '$chain_part'" || return 1
    else
      return 0
    fi
  done
  return 0
}

validate_repository() {
  validate_repo="$1"
  validate_compat="$2"
  check_directory_component "$validate_repo/packs" "repository packs directory" || return 1
  check_directory_component "$validate_repo/packs/$PACK_NAME" "pack directory for '$PACK_NAME'" || return 1
  check_regular_file "$validate_repo/packs/$PACK_NAME/pack.yaml" "pack marker for '$PACK_NAME'" || return 1
  check_directory_component "$validate_repo/skills" "repository skills directory" || return 1
  check_directory_component "$validate_repo/skills/ramp" "RAMP skills directory" || return 1
  if [ "$validate_compat" -eq 1 ]; then
    check_directory_component "$validate_repo/skills-library" "compatibility skills directory" || return 1
  fi
  return 0
}

is_repository_candidate() {
  candidate_repo="$1"
  candidate_compat="$2"
  [ -d "$candidate_repo" ] && [ ! -L "$candidate_repo" ] || return 1
  [ -d "$candidate_repo/packs" ] && [ ! -L "$candidate_repo/packs" ] || return 1
  [ -d "$candidate_repo/packs/$PACK_NAME" ] &&
    [ ! -L "$candidate_repo/packs/$PACK_NAME" ] || return 1
  [ -f "$candidate_repo/packs/$PACK_NAME/pack.yaml" ] &&
    [ ! -L "$candidate_repo/packs/$PACK_NAME/pack.yaml" ] || return 1
  [ -d "$candidate_repo/skills" ] && [ ! -L "$candidate_repo/skills" ] || return 1
  [ -d "$candidate_repo/skills/ramp" ] &&
    [ ! -L "$candidate_repo/skills/ramp" ] || return 1
  if [ "$candidate_compat" -eq 1 ]; then
    [ -d "$candidate_repo/skills-library" ] &&
      [ ! -L "$candidate_repo/skills-library" ] || return 1
  fi
  return 0
}

script_path="${BASH_SOURCE[0]}"
if is_link "$script_path"; then
  add_error "helper must not be invoked through a symbolic link: $script_path"
elif [ ! -f "$script_path" ]; then
  add_error "helper is not an ordinary regular file: $script_path"
fi
script_directory="$(dirname "$script_path")"
if is_link "$script_directory"; then
  add_error "helper directory must not be a symbolic link: $script_directory"
elif [ ! -d "$script_directory" ]; then
  add_error "helper directory is not an ordinary directory: $script_directory"
fi

helper_root=""
if [ "${#ERRORS[@]}" -eq 0 ]; then
  helper_root="$(cd "$script_directory" 2>/dev/null && pwd -P)" ||
    add_error "cannot resolve helper directory: $script_directory"
fi

repo_root=""
if [ "$repo_root_explicit" -eq 1 ]; then
  if ordinary_directory_root "$repo_root_input" "repository root"; then
    repo_root="$RESOLVED_DIRECTORY_ROOT"
    validate_repository "$repo_root" "$((1 - skills_src_explicit))" || true
  fi
elif [ -n "$helper_root" ]; then
  candidate="$helper_root"
  while :; do
    if is_repository_candidate "$candidate" "$((1 - skills_src_explicit))"; then
      repo_root="$candidate"
      validate_repository "$repo_root" "$((1 - skills_src_explicit))" || true
      break
    fi
    parent="$(dirname "$candidate")"
    [ "$parent" != "$candidate" ] || break
    candidate="$parent"
  done
fi

skills_src=""
if [ "$skills_src_explicit" -eq 1 ]; then
  if ordinary_directory_root "$skills_src_input" "compatibility root"; then
    skills_src="$RESOLVED_DIRECTORY_ROOT"
  fi
elif [ -n "$repo_root" ]; then
  skills_src="$repo_root/skills-library"
fi

validate_skill_tree() {
  source_tree="$1"
  source_name="$2"
  source_kind="$3"
  check_directory_component "$source_tree" "$source_kind source for '$source_name'" || return 1
  check_regular_file "$source_tree/SKILL.md" "SKILL.md for '$source_name'" || return 1

  tree_seen=()
  if ! find "$source_tree" -mindepth 1 -print0 > "$preflight_scan"; then
    add_error "cannot completely traverse $source_kind source for '$source_name': $source_tree"
    return 1
  fi
  while IFS= read -r -d '' tree_entry; do
    tree_relative="${tree_entry#"$source_tree"/}"
    portable_relative_path "$tree_relative" "path in skill '$source_name'" || continue
    tree_lower="$(printf '%s' "$tree_relative" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
    for tree_prior in "${tree_seen[@]}"; do
      if [ "$tree_prior" = "$tree_lower" ]; then
        add_error "skill '$source_name' has a case-insensitive path collision at '$tree_relative'"
      fi
    done
    tree_seen[${#tree_seen[@]}]="$tree_lower"

    if is_link "$tree_entry"; then
      add_error "skill '$source_name' contains a symbolic link: $tree_relative"
    elif [ -d "$tree_entry" ]; then
      :
    elif [ -f "$tree_entry" ]; then
      :
    else
      add_error "skill '$source_name' contains a special file: $tree_relative"
    fi
  done < "$preflight_scan"
  return 0
}

for skill in "${SKILLS[@]}"; do
  if ! printf '%s' "$skill" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$'; then
    add_error "invalid skill name '$skill': expected lower-kebab case"
    NAME_VALIDITY[${#NAME_VALIDITY[@]}]=0
  else
    NAME_VALIDITY[${#NAME_VALIDITY[@]}]=1
  fi
done

for skill_index in "${!SKILLS[@]}"; do
  skill="${SKILLS[$skill_index]}"
  prior_index=0
  while [ "$prior_index" -lt "$skill_index" ]; do
    if [ "${SKILLS[$prior_index]}" = "$skill" ]; then
      add_error "duplicate skill name: $skill"
      NAME_VALIDITY[$skill_index]=0
    fi
    prior_index=$((prior_index + 1))
  done
done

for skill_index in "${!SKILLS[@]}"; do
  skill="${SKILLS[$skill_index]}"
  selected_source=""
  selected_kind=""

  if [ "${NAME_VALIDITY[$skill_index]}" -eq 0 ]; then
    SELECTED_SOURCES[${#SELECTED_SOURCES[@]}]=""
    SELECTED_KINDS[${#SELECTED_KINDS[@]}]=""
    continue
  fi

  if [ -n "$repo_root" ]; then
    pack_relative="packs/$PACK_NAME/skills/$skill"
    pack_candidate="$repo_root/$pack_relative"
    check_directory_chain "$repo_root" "$pack_relative" "pack source" || true
    if lexists "$pack_candidate"; then
      selected_source="$pack_candidate"
      selected_kind="pack"
    else
      ramp_relative="skills/ramp/$skill"
      ramp_candidate="$repo_root/$ramp_relative"
      check_directory_chain "$repo_root" "$ramp_relative" "RAMP source" || true
      if lexists "$ramp_candidate"; then
        selected_source="$ramp_candidate"
        selected_kind="ramp"
      fi
    fi
  fi

  if [ -z "$selected_source" ] && [ -n "$skills_src" ]; then
    check_directory_chain "$skills_src" "$skill" "compatibility source" || true
    compatibility_candidate="$skills_src/$skill"
    if lexists "$compatibility_candidate"; then
      selected_source="$compatibility_candidate"
      selected_kind="compatibility"
    fi
  fi

  if [ -z "$selected_source" ]; then
    available_roots=""
    [ -n "$repo_root" ] && available_roots="$available_roots repository=$repo_root"
    [ -n "$skills_src" ] && available_roots="$available_roots compatibility=$skills_src"
    if [ -z "$repo_root" ]; then
      add_error "skill '$skill' was not found.$available_roots Pass --repo-root <ramp-repository-root> for pack or RAMP skills."
    else
      add_error "skill '$skill' was not found in available roots:$available_roots"
    fi
    SELECTED_SOURCES[${#SELECTED_SOURCES[@]}]=""
    SELECTED_KINDS[${#SELECTED_KINDS[@]}]=""
  else
    validate_skill_tree "$selected_source" "$skill" "$selected_kind" || true
    SELECTED_SOURCES[${#SELECTED_SOURCES[@]}]="$selected_source"
    SELECTED_KINDS[${#SELECTED_KINDS[@]}]="$selected_kind"
  fi
done

canonical_target=""
target_was_missing=0
target_lexical="${target%/}"
[ -n "$target_lexical" ] || target_lexical="/"
if lexists "$target_lexical"; then
  if is_link "$target_lexical"; then
    add_error "target must not be a symbolic link: $target"
  elif [ ! -d "$target_lexical" ]; then
    add_error "target must be an ordinary directory: $target"
  else
    canonical_target="$(cd "$target_lexical" 2>/dev/null && pwd -P)" ||
      add_error "cannot resolve target directory: $target"
  fi
else
  target_was_missing=1
  case "$target_lexical" in
    /*) target_absolute="$target_lexical" ;;
    *) target_absolute="$(pwd -P)/$target_lexical" ;;
  esac
  missing_segments=()
  target_probe="${target_absolute%/}"
  [ -n "$target_probe" ] || target_probe="/"
  while ! lexists "$target_probe"; do
    target_part="${target_probe##*/}"
    portable_segment_error "$target_part" "target path" || true
    missing_segments[${#missing_segments[@]}]="$target_part"
    target_parent="${target_probe%/*}"
    [ -n "$target_parent" ] || target_parent="/"
    if [ "$target_parent" = "$target_probe" ]; then
      add_error "cannot find an existing parent for target: $target"
      break
    fi
    target_probe="$target_parent"
  done
  if lexists "$target_probe"; then
    if is_link "$target_probe"; then
      add_error "nearest existing target parent must not be a symbolic link: $target_probe"
    elif [ ! -d "$target_probe" ]; then
      add_error "nearest existing target parent must be a directory: $target_probe"
    else
      canonical_target="$(cd "$target_probe" 2>/dev/null && pwd -P)" ||
        add_error "cannot resolve target parent: $target_probe"
      reverse_index=$((${#missing_segments[@]} - 1))
      while [ "$reverse_index" -ge 0 ]; do
        canonical_target="$canonical_target/${missing_segments[$reverse_index]}"
        reverse_index=$((reverse_index - 1))
      done
    fi
  fi
fi

destination_root=""
if [ -n "$canonical_target" ]; then
  destination_root="$canonical_target/$dest_sub"
  case "$destination_root/" in
    "$canonical_target"/*) : ;;
    *) add_error "destination escapes the target root: $destination_root" ;;
  esac
fi

validate_destination_path() {
  destination_target="$1"
  destination_relative="$2"
  destination_label="$3"
  destination_current="$destination_target"
  destination_rest="$destination_relative"
  while [ -n "$destination_rest" ]; do
    case "$destination_rest" in
      */*)
        destination_part="${destination_rest%%/*}"
        destination_rest="${destination_rest#*/}"
        ;;
      *)
        destination_part="$destination_rest"
        destination_rest=""
        ;;
    esac
    destination_current="$destination_current/$destination_part"
    case "$destination_current/" in
      "$destination_target"/*) : ;;
      *)
        add_error "$destination_label escapes the target root: $destination_current"
        return 1
        ;;
    esac
    if lexists "$destination_current"; then
      check_directory_component "$destination_current" "$destination_label component '$destination_part'" || return 1
    fi
  done
  return 0
}

if [ -n "$canonical_target" ]; then
  validate_destination_path "$canonical_target" "$dest_sub" "tool skills destination" || true
  for skill in "${SKILLS[@]}"; do
    validate_destination_path "$canonical_target" "$dest_sub/$skill" "destination for '$skill'" || true
    existing_destination="$canonical_target/$dest_sub/$skill"
    if [ -d "$existing_destination" ] && [ ! -L "$existing_destination" ]; then
      if ! find "$existing_destination" -mindepth 1 -print0 > "$preflight_scan"; then
        add_error "cannot completely traverse existing destination for '$skill': $existing_destination"
      else
        while IFS= read -r -d '' destination_entry; do
          destination_relative="${destination_entry#"$existing_destination"/}"
          if is_link "$destination_entry"; then
            add_error "destination for '$skill' contains a symbolic link: $destination_relative"
          elif [ -d "$destination_entry" ] || [ -f "$destination_entry" ]; then
            :
          else
            add_error "destination for '$skill' contains a special file: $destination_relative"
          fi
        done < "$preflight_scan"
      fi
    fi
  done
fi

if [ "${#ERRORS[@]}" -gt 0 ]; then
  echo "error: add-skills preflight failed:" >&2
  for error_message in "${ERRORS[@]}"; do
    echo "  - $error_message" >&2
  done
  exit 1
fi

# PRE-FLIGHT COMPLETE — no target mutation is allowed above this marker.
if [ "$target_was_missing" -eq 1 ]; then
  mkdir -p "$canonical_target"
fi
mkdir -p "$destination_root"

echo "Installing ${#SKILLS[@]} skills for '$PACK_NAME' -> $destination_root"
copy_index=0
while [ "$copy_index" -lt "${#SKILLS[@]}" ]; do
  skill="${SKILLS[$copy_index]}"
  source_path="${SELECTED_SOURCES[$copy_index]}"
  source_kind="${SELECTED_KINDS[$copy_index]}"
  final_destination="$destination_root/$skill"
  rm -rf "$final_destination"
  mkdir -p "$final_destination"
  cp -R "$source_path"/. "$final_destination"/
  # skill.yaml is RAMP source metadata; customer projects do not receive it.
  # find -name matches case-sensitively, even on a case-insensitive file system.
  find "$final_destination" -mindepth 1 -maxdepth 1 -name skill.yaml -exec rm -rf {} +
  echo "  + $skill [$source_kind]"
  copy_index=$((copy_index + 1))
done
echo "Done. ${#SKILLS[@]} copied -> $destination_root"
