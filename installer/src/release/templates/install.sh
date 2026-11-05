#!/usr/bin/env bash
set -eo pipefail
LC_ALL=C
export LC_ALL

MANIFEST_NAME="__MANIFEST_NAME__"
OVERLAY_ROOT="__OVERLAY_ROOT__"
CONFLICT_NAME="__CONFLICT_NAME__"
STATE_ROOT="__STATE_ROOT__"
TAB="$(printf '\t')"
CR="$(printf '\r')"

usage() {
  echo "usage: $0 --target <dir> [--dry-run|--uninstall|--rollback]" >&2
}

target_input=""
operation="install"
seen_target=0
seen_operation=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      [ "$seen_target" -eq 0 ] && [ "$#" -ge 2 ] && [ -n "$2" ] || {
        echo "error: --target requires one value" >&2
        exit 2
      }
      target_input="$2"
      seen_target=1
      shift 2
      ;;
    --dry-run|--uninstall|--rollback)
      [ "$seen_operation" -eq 0 ] || {
        echo "error: operation flags are mutually exclusive" >&2
        exit 2
      }
      case "$1" in
        --dry-run) operation="dry-run" ;;
        --uninstall) operation="uninstall" ;;
        --rollback) operation="rollback" ;;
      esac
      seen_operation=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done
[ "$seen_target" -eq 1 ] || {
  usage
  exit 2
}

lexists() {
  [ -e "$1" ] || [ -L "$1" ]
}

portable_segment() {
  local segment base lower
  segment="$1"
  [ -n "$segment" ] &&
    [ "$segment" != "." ] &&
    [ "$segment" != ".." ] || return 1
  [ "$(printf '%s' "$segment" | wc -c | tr -d ' ')" -le 255 ] || return 1
  printf '%s' "$segment" | grep -q '[[:cntrl:]]' && return 1
  printf '%s' "$segment" | grep -q '[^ -~]' && return 1
  printf '%s' "$segment" | grep -q '[<>:"\\|?*]' && return 1
  case "$segment" in \ *|*[.\ ]) return 1 ;; esac
  base="${segment%%.*}"
  lower="$(printf '%s' "$base" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
  case "$lower" in con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9]|lpt[1-9]) return 1 ;; esac
  return 0
}

portable_path() {
  local candidate rest part depth
  candidate="$1"
  [ -n "$candidate" ] || return 1
  [ "$(printf '%s' "$candidate" | wc -c | tr -d ' ')" -le 1024 ] || return 1
  case "$candidate" in /*|*\\*) return 1 ;; esac
  rest="$candidate"
  depth=0
  while :; do
    case "$rest" in
      */*) part="${rest%%/*}"; rest="${rest#*/}" ;;
      *) part="$rest"; rest="" ;;
    esac
    portable_segment "$part" || return 1
    depth=$((depth + 1))
    [ "$depth" -le 64 ] || return 1
    [ -n "$rest" ] || break
  done
  return 0
}

ordinary_ancestry() {
  local root relative current rest part
  root="$1"
  relative="$2"
  current="$root"
  rest="$relative"
  while [ -n "$rest" ]; do
    case "$rest" in
      */*) part="${rest%%/*}"; rest="${rest#*/}" ;;
      *) part="$rest"; rest="" ;;
    esac
    current="$current/$part"
    if lexists "$current"; then
      [ ! -L "$current" ] || return 1
      if [ -n "$rest" ]; then
        [ -d "$current" ] || return 1
      else
        [ -f "$current" ] || return 1
      fi
    fi
  done
  return 0
}

ordinary_directory_ancestry() {
  local root relative current rest part
  root="$1"
  relative="$2"
  current="$root"
  rest="$relative"
  while [ -n "$rest" ]; do
    case "$rest" in
      */*) part="${rest%%/*}"; rest="${rest#*/}" ;;
      *) part="$rest"; rest="" ;;
    esac
    current="$current/$part"
    if lexists "$current"; then
      [ -d "$current" ] && [ ! -L "$current" ] || return 1
    fi
  done
}

ordinary_directory_path() {
  local path
  path="$1"
  [ -d "$path" ] && [ ! -L "$path" ] || return 1
  case "$path" in *"/../"*|*/..|../*|..) return 1 ;; esac
  return 0
}

# Resolve a directory without cd treating it as an option ("-P", "--"), as
# OLDPWD ("-"), or as a CDPATH entry: relative names are anchored with "./".
physical_directory() {
  local path
  path="$1"
  case "$path" in /*) ;; *) path="./$path" ;; esac
  (CDPATH='' cd -P -- "$path" 2>/dev/null && pwd -P)
}

if [ -L "$0" ]; then
  echo "error: installer script must not be a symbolic link" >&2
  exit 1
fi
script_dir="$(physical_directory "$(dirname -- "$0")")" || exit 1
manifest_path="$script_dir/$MANIFEST_NAME"
overlay_dir="$script_dir/$OVERLAY_ROOT"
conflict_path="$script_dir/$CONFLICT_NAME"

ordinary_directory_path "$target_input" || {
  echo "error: target must be an existing ordinary directory" >&2
  exit 1
}
target="$(physical_directory "$target_input")" || exit 1
ordinary_directory_path "$overlay_dir" || {
  echo "error: bundle overlay must be an ordinary directory" >&2
  exit 1
}
[ -f "$manifest_path" ] && [ ! -L "$manifest_path" ] || {
  echo "error: install manifest must be an ordinary file" >&2
  exit 1
}

if command -v sha256sum >/dev/null 2>&1; then
  hash_file() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  hash_file() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  echo "error: sha256sum or shasum is required" >&2
  exit 1
fi

mode_file() {
  if stat -f '%Lp' "$1" >/dev/null 2>&1; then
    stat -f '%Lp' "$1"
  else
    stat -c '%a' "$1"
  fi
}

work="$(mktemp -d "${TMPDIR:-/tmp}/ramp-install.XXXXXX")" || exit 1
bundle_records="$work/bundle.tsv"
all_states="$work/states.tsv"
origins="$work/origins.tsv"
new_origins="$work/new-origins.tsv"
plan="$work/plan.tsv"
conflicts="$work/conflicts.txt"
: > "$bundle_records"
: > "$all_states"
: > "$origins"
: > "$new_origins"
: > "$plan"
: > "$conflicts"
lock_created=0
ramp_created=0
installed_created=0
backups_created=0
txn=""
transaction_active=0
mutation_started=0
transaction_restored=0
owner_state_mutated=0
origin_state_mutated=0
backup_mutated=0
active_customer_temp=""
active_state_temp=""

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  if [ -n "$active_customer_temp" ]; then
    ordinary_ancestry "$target" "$active_customer_temp" &&
      rm -f "$target/$active_customer_temp" 2>/dev/null || true
    active_customer_temp=""
  fi
  if [ -n "$active_state_temp" ]; then
    ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" &&
      rm -f "$active_state_temp" 2>/dev/null || true
    active_state_temp=""
  fi
  if [ "$transaction_active" -eq 1 ] && [ -n "$txn" ]; then
    if [ "$mutation_started" -eq 1 ] && [ "$transaction_restored" -eq 0 ]; then
      restore_transaction >/dev/null 2>&1 || true
    fi
    rm -rf "$txn" 2>/dev/null || true
    transaction_active=0
  fi
  if [ "$lock_created" -eq 1 ]; then
    rmdir "$target/$STATE_ROOT/install.lock" 2>/dev/null || true
  fi
  if [ "$ramp_created" -eq 1 ]; then
    rmdir "$target/$STATE_ROOT/installed" 2>/dev/null || true
    rmdir "$target/$STATE_ROOT/backups" 2>/dev/null || true
    rmdir "$target/$STATE_ROOT" 2>/dev/null || true
  else
    [ "$installed_created" -eq 0 ] ||
      rmdir "$target/$STATE_ROOT/installed" 2>/dev/null || true
    [ "$backups_created" -eq 0 ] ||
      rmdir "$target/$STATE_ROOT/backups" 2>/dev/null || true
  fi
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

canonical_text_file() {
  local input last
  input="$1"
  [ -s "$input" ] || return 1
  if od -An -tx1 "$input" | grep -Eq '(^|[[:space:]])00([[:space:]]|$)'; then
    return 1
  fi
  last="$(tail -c 1 "$input" | od -An -tuC | tr -d '[:space:]')"
  [ "$last" = "10" ]
}

semantic_version() {
  printf '%s\n' "$1" |
    grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
}

folded_paths_have_no_ancestors() {
  awk '
    {
      paths[NR] = $0
      present[$0] = 1
    }
    END {
      for (i = 1; i <= NR; i++) {
        ancestor = paths[i]
        while (sub("/[^/]+$", "", ancestor)) {
          if (ancestor in present) exit 1
        }
      }
    }
  ' "$1"
}

# A case-insensitive filesystem would merge Dir/ and dir/ into one directory,
# so every folded directory prefix of a parsed manifest has one spelling.
directory_prefixes_fold_uniquely() {
  awk -F '\t' '
    {
      directory = $3
      while (sub("/[^/]+$", "", directory)) {
        key = tolower(directory)
        if ((key in spelled) && spelled[key] != directory) exit 1
        spelled[key] = directory
      }
    }
  ' "$1"
}

parse_manifest() {
  local input output expected_owner line_no previous lower_file line
  local one two three four five folded field_count
  input="$1"
  output="$2"
  expected_owner="${3:-}"
  canonical_text_file "$input" || return 1
  : > "$output"
  line_no=0
  previous=""
  lower_file="$work/lower.$$"
  : > "$lower_file"
  parsed_bundle=""
  parsed_owner=""
  parsed_version=""
  while IFS= read -r line || [ -n "$line" ]; do
    line_no=$((line_no + 1))
    case "$line" in *"$CR"*) return 1 ;; esac
    field_count="$(printf '%s\n' "$line" | awk -F '\t' '{print NF}')"
    if [ "$line_no" -le 4 ]; then
      [ "$field_count" -eq 2 ] || return 1
    else
      [ "$field_count" -eq 4 ] || return 1
    fi
    IFS="$TAB" read -r one two three four five <<EOF
$line
EOF
    case "$line_no" in
      1)
        [ "$one" = "RAMP-INSTALL-MANIFEST" ] &&
          [ "$two" = "1" ] &&
          [ -z "${three:-}" ] || return 1
        ;;
      2)
        [ "$one" = "bundle" ] &&
          [ -n "$two" ] &&
          [ -z "${three:-}" ] &&
          portable_segment "$two" || return 1
        parsed_bundle="$two"
        ;;
      3)
        [ "$one" = "owner" ] &&
          [ -n "$two" ] &&
          [ -z "${three:-}" ] &&
          portable_segment "$two" &&
          [ "${two#.}" = "$two" ] || return 1
        parsed_owner="$two"
        ;;
      4)
        [ "$one" = "version" ] &&
          [ -n "$two" ] &&
          [ -z "${three:-}" ] &&
          portable_segment "$two" &&
          semantic_version "$two" || return 1
        parsed_version="$two"
        ;;
      *)
        [ "$one" = "file" ] &&
          [ "${#two}" -eq 64 ] &&
          [ -z "$(printf '%s' "$two" | tr -d '0-9a-f')" ] &&
          { [ "$three" = "0644" ] || [ "$three" = "0755" ]; } &&
          portable_path "$four" &&
          [ -z "${five:-}" ] || return 1
        if [ -n "$previous" ]; then
          [ "$previous" \< "$four" ] || return 1
          case "$four" in "$previous"/*) return 1 ;; esac
        fi
        folded="$(printf '%s' "$four" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
        grep -Fqx -- "$folded" "$lower_file" && return 1
        printf '%s\n' "$folded" >> "$lower_file"
        printf '%s\t%s\t%s\n' "$two" "$three" "$four" >> "$output"
        previous="$four"
        ;;
    esac
  done < "$input"
  folded_paths_have_no_ancestors "$lower_file" || return 1
  directory_prefixes_fold_uniquely "$output" || return 1
  rm -f "$lower_file"
  [ "$line_no" -ge 5 ] && [ -s "$output" ] || return 1
  [ -z "$expected_owner" ] || [ "$parsed_owner" = "$expected_owner" ] || return 1
  return 0
}

parse_origins() {
  local input output line_no previous line one two three four field_count
  input="$1"
  output="$2"
  canonical_text_file "$input" || return 1
  : > "$output"
  line_no=0
  previous=""
  while IFS= read -r line || [ -n "$line" ]; do
    line_no=$((line_no + 1))
    case "$line" in *"$CR"*) return 1 ;; esac
    field_count="$(printf '%s\n' "$line" | awk -F '\t' '{print NF}')"
    if [ "$line_no" -eq 1 ]; then
      [ "$field_count" -eq 2 ] || return 1
    else
      [ "$field_count" -eq 3 ] || return 1
    fi
    IFS="$TAB" read -r one two three four <<EOF
$line
EOF
    if [ "$line_no" -eq 1 ]; then
      [ "$one" = "RAMP-INSTALL-ORIGINS" ] &&
        [ "$two" = "1" ] &&
        [ -z "${three:-}" ] || return 1
    else
      [ "$one" = "file" ] &&
        { [ "$two" = "managed" ] || [ "$two" = "external" ]; } &&
        portable_path "$three" &&
        [ -z "${four:-}" ] || return 1
      [ -z "$previous" ] || [ "$previous" \< "$three" ] || return 1
      printf '%s\t%s\n' "$two" "$three" >> "$output"
      previous="$three"
    fi
  done < "$input"
  [ "$line_no" -ge 1 ] || return 1
}

render_origins() {
  local input output
  input="$1"
  output="$2"
  {
    printf 'RAMP-INSTALL-ORIGINS\t1\n'
    sort -t "$TAB" -k2,2 "$input" |
      while IFS="$TAB" read -r origin path; do
        printf 'file\t%s\t%s\n' "$origin" "$path"
      done
  } > "$output"
}

parse_manifest "$manifest_path" "$bundle_records" || {
  echo "error: invalid install manifest" >&2
  exit 1
}
bundle_id="$parsed_bundle"
owner="$parsed_owner"
bundle_version="$parsed_version"
installed_dir="$target/$STATE_ROOT/installed"
backups_dir="$target/$STATE_ROOT/backups"
owner_state="$installed_dir/$owner.tsv"
origin_state="$installed_dir/.origins.tsv"
owner_backup="$backups_dir/$owner"

verify_source_records() {
  local expected mode path source actual_mode
  while IFS="$TAB" read -r expected mode path; do
    ordinary_ancestry "$overlay_dir" "$path" || return 1
    source="$overlay_dir/$path"
    [ -f "$source" ] && [ ! -L "$source" ] || return 1
    [ "$(hash_file "$source")" = "$expected" ] || return 1
    actual_mode="$(mode_file "$source")" || return 1
    [ "0$actual_mode" = "$mode" ] || return 1
  done < "$bundle_records"
}

lookup_claim() {
  local claim_owner claim_path
  claim_owner="$1"
  claim_path="$2"
  awk -F '\t' -v o="$claim_owner" -v p="$claim_path" \
    '$1 == o && $4 == p { print $2 "\t" $3; exit }' "$all_states"
}

other_claims_match() {
  local excluded claim_path claim_hash claim_mode
  excluded="$1"
  claim_path="$2"
  claim_hash="$3"
  claim_mode="$4"
  ! awk -F '\t' -v o="$excluded" -v p="$claim_path" \
    -v h="$claim_hash" -v m="$claim_mode" \
    '$1 != o && $4 == p && ($2 != h || $3 != m) { bad=1 } END { exit bad ? 0 : 1 }' \
    "$all_states"
}

other_claim_count() {
  local excluded claim_path
  excluded="$1"
  claim_path="$2"
  awk -F '\t' -v o="$excluded" -v p="$claim_path" \
    '$1 != o && $4 == p { count++ } END { print count+0 }' "$all_states"
}

origin_for() {
  awk -F '\t' -v p="$1" '$2 == p { print $1; exit }' "$origins"
}

portable_collision_with_states() {
  local desired other desired_folded other_folded
  desired="$1"
  desired_folded="$(printf '%s' "$desired" |
    tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
  while IFS= read -r other; do
    [ "$other" != "$desired" ] || continue
    other_folded="$(printf '%s' "$other" |
      tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
    if [ "$other_folded" = "$desired_folded" ]; then return 0; fi
    case "$desired_folded" in "$other_folded"/*) return 0 ;; esac
    case "$other_folded" in "$desired_folded"/*) return 0 ;; esac
  done <<EOF
$(awk -F '\t' '{print $4}' "$all_states" | sort -u)
EOF
  return 1
}

remove_origin() {
  local remove_path
  remove_path="$1"
  awk -F '\t' -v p="$remove_path" '$2 != p' "$new_origins" > "$new_origins.next"
  mv "$new_origins.next" "$new_origins"
}

set_origin() {
  local new_origin origin_path existing
  new_origin="$1"
  origin_path="$2"
  existing="$(awk -F '\t' -v p="$origin_path" '$2 == p { print $1; exit }' "$new_origins")"
  if [ -n "$existing" ] && [ "$existing" != "$new_origin" ]; then
    return 1
  fi
  [ -n "$existing" ] ||
    printf '%s\t%s\n' "$new_origin" "$origin_path" >> "$new_origins"
}

load_state() {
  local state_count state state_owner parsed hash mode path
  local claim_owner origin destination
  : > "$all_states"
  : > "$origins"
  state_count=0
  if lexists "$installed_dir"; then
    [ -d "$installed_dir" ] && [ ! -L "$installed_dir" ] || return 1
    for item in "$installed_dir"/* "$installed_dir"/.[!.]* "$installed_dir"/..?*; do
      lexists "$item" || continue
      name="$(basename "$item")"
      case "$name" in
        .origins.tsv)
          [ -f "$item" ] && [ ! -L "$item" ] || return 1
          ;;
        .*) return 1 ;;
        *.tsv)
          [ -f "$item" ] && [ ! -L "$item" ] || return 1
          ;;
        *) return 1 ;;
      esac
    done
    for state in "$installed_dir"/*.tsv; do
      lexists "$state" || continue
      [ ! -L "$state" ] && [ -f "$state" ] || return 1
      state_owner="$(basename "$state" .tsv)"
      portable_segment "$state_owner" && [ "$state_owner" != ".origins" ] || return 1
      parsed="$work/state-$state_count.tsv"
      parse_manifest "$state" "$parsed" "$state_owner" || return 1
      while IFS="$TAB" read -r hash mode path; do
        printf '%s\t%s\t%s\t%s\n' "$state_owner" "$hash" "$mode" "$path" >> "$all_states"
      done < "$parsed"
      state_count=$((state_count + 1))
    done
  fi
  if [ "$state_count" -gt 0 ]; then
    validate_state_union || {
      echo "error: portable collision in installed owner state" >&2
      return 1
    }
    [ -f "$origin_state" ] && [ ! -L "$origin_state" ] || return 1
    parse_origins "$origin_state" "$origins" || return 1
    while IFS="$TAB" read -r claim_owner hash mode path; do
      [ -n "$(origin_for "$path")" ] || return 1
      ordinary_ancestry "$target" "$path" || return 1
      destination="$target/$path"
      [ -f "$destination" ] && [ ! -L "$destination" ] || return 1
      [ "$(hash_file "$destination")" = "$hash" ] || return 1
      [ "0$(mode_file "$destination")" = "$mode" ] || return 1
    done < "$all_states"
    while IFS="$TAB" read -r origin path; do
      awk -F '\t' -v p="$path" '$4 == p { found=1 } END { exit found ? 0 : 1 }' \
        "$all_states" || return 1
    done < "$origins"
  else
    if lexists "$origin_state"; then return 1; fi
  fi
  return 0
}

validate_state_union() {
  local paths folded_unsorted folded_paths path folded
  paths="$work/state-paths.tsv"
  folded_unsorted="$work/state-paths-folded-unsorted.tsv"
  folded_paths="$work/state-paths-folded.tsv"
  awk -F '\t' '{print $4}' "$all_states" | sort -u > "$paths"
  while IFS= read -r path; do
    folded="$(printf '%s' "$path" |
      tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
    printf '%s\t%s\n' "$folded" "$path"
  done < "$paths" > "$folded_unsorted"
  sort -t "$TAB" -k1,1 -k2,2 "$folded_unsorted" > "$folded_paths"
  awk -F '\t' '
    {
      if (($1 in original) && original[$1] != $2) bad = 1
      original[$1] = $2
    }
    END {
      for (folded in original) {
        ancestor = folded
        while (sub("/[^/]+$", "", ancestor)) {
          if (ancestor in original) bad = 1
        }
      }
      exit bad ? 1 : 0
    }
  ' "$folded_paths"
}

add_conflict() {
  printf '%s\t%s\n' "$1" "$2" >> "$conflicts"
}

prepare_install_plan() {
  local current current_version current_exists
  local desired_hash desired_mode path destination old other_count
  local actual_hash actual_mode old_hash old_mode inherited
  : > "$plan"
  : > "$conflicts"
  cp "$origins" "$new_origins"
  current="$work/current.tsv"
  : > "$current"
  current_version=""
  current_exists=0
  if lexists "$owner_state"; then
    [ -f "$owner_state" ] && [ ! -L "$owner_state" ] || return 1
    parse_manifest "$owner_state" "$current" "$owner" || return 1
    current_version="$parsed_version"
    current_exists=1
    if [ "$current_version" = "$bundle_version" ] &&
      ! cmp -s "$owner_state" "$manifest_path"; then
      add_conflict "$owner" "same version has different manifest"
    fi
  fi
  while IFS="$TAB" read -r desired_hash desired_mode path; do
    if portable_collision_with_states "$path"; then
      add_conflict "$path" "portable path collides with another owner"
      continue
    fi
    ordinary_ancestry "$target" "$path" || {
      add_conflict "$path" "unsafe destination"
      continue
    }
    destination="$target/$path"
    old="$(awk -F '\t' -v p="$path" '$3 == p { print $1 "\t" $2; exit }' "$current")"
    other_count="$(other_claim_count "$owner" "$path")"
    if lexists "$destination"; then
      [ -f "$destination" ] && [ ! -L "$destination" ] || {
        add_conflict "$path" "destination is not an ordinary file"
        continue
      }
      actual_hash="$(hash_file "$destination")"
      actual_mode="0$(mode_file "$destination")"
      if [ -n "$old" ]; then
        old_hash="${old%%"$TAB"*}"
        old_mode="${old#*"$TAB"}"
        if [ "$actual_hash" != "$old_hash" ] || [ "$actual_mode" != "$old_mode" ]; then
          add_conflict "$path" "owned file was modified"
        elif [ "$desired_hash" = "$old_hash" ] && [ "$desired_mode" = "$old_mode" ]; then
          printf 'keep\tbundle\t%s\t%s\t%s\n' "$desired_mode" "$desired_hash" "$path" >> "$plan"
        elif [ "$(origin_for "$path")" = "external" ]; then
          add_conflict "$path" "external-origin file is adopt-only"
        elif ! other_claims_match "$owner" "$path" "$desired_hash" "$desired_mode"; then
          add_conflict "$path" "another owner requires different content"
        else
          printf 'write\tbundle\t%s\t%s\t%s\n' "$desired_mode" "$desired_hash" "$path" >> "$plan"
        fi
      elif [ "$actual_hash" = "$desired_hash" ] && [ "$actual_mode" = "$desired_mode" ]; then
        if ! other_claims_match "$owner" "$path" "$desired_hash" "$desired_mode"; then
          add_conflict "$path" "another owner claim is inconsistent"
        else
          printf 'keep\tbundle\t%s\t%s\t%s\n' "$desired_mode" "$desired_hash" "$path" >> "$plan"
        fi
      else
        add_conflict "$path" "customer file differs"
      fi
      if [ "$other_count" -gt 0 ]; then
        inherited="$(origin_for "$path")"
        [ -n "$inherited" ] || add_conflict "$path" "shared path has no origin"
        set_origin "$inherited" "$path" || add_conflict "$path" "origin mismatch"
      elif [ -n "$old" ]; then
        inherited="$(origin_for "$path")"
        set_origin "$inherited" "$path" || add_conflict "$path" "origin mismatch"
      else
        set_origin "external" "$path" || add_conflict "$path" "origin mismatch"
      fi
    else
      if [ "$other_count" -gt 0 ] || [ -n "$old" ]; then
        add_conflict "$path" "claimed destination is missing"
      else
        printf 'write\tbundle\t%s\t%s\t%s\n' "$desired_mode" "$desired_hash" "$path" >> "$plan"
        set_origin "managed" "$path" || add_conflict "$path" "origin mismatch"
      fi
    fi
  done < "$bundle_records"

  if [ "$current_exists" -eq 1 ]; then
    while IFS="$TAB" read -r old_hash old_mode path; do
      awk -F '\t' -v p="$path" '$3 == p { found=1 } END { exit found ? 0 : 1 }' \
        "$bundle_records" && continue
      if [ "$(other_claim_count "$owner" "$path")" -gt 0 ]; then
        printf 'keep\tcurrent\t%s\t%s\t%s\n' "$old_mode" "$old_hash" "$path" >> "$plan"
      elif [ "$(origin_for "$path")" = "external" ]; then
        printf 'keep\tcurrent\t%s\t%s\t%s\n' "$old_mode" "$old_hash" "$path" >> "$plan"
        remove_origin "$path"
      else
        printf 'remove\tcurrent\t%s\t%s\t%s\n' "$old_mode" "$old_hash" "$path" >> "$plan"
        remove_origin "$path"
      fi
    done < "$current"
  fi
  return 0
}

prepare_uninstall_plan() {
  local current current_version hash mode path origin
  : > "$plan"
  : > "$conflicts"
  cp "$origins" "$new_origins"
  current="$work/current.tsv"
  [ -f "$owner_state" ] && [ ! -L "$owner_state" ] || return 1
  parse_manifest "$owner_state" "$current" "$owner" || return 1
  current_version="$parsed_version"
  while IFS="$TAB" read -r hash mode path; do
    origin="$(origin_for "$path")"
    if [ "$(other_claim_count "$owner" "$path")" -gt 0 ]; then
      printf 'keep\tcurrent\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
    elif [ "$origin" = "managed" ]; then
      printf 'remove\tcurrent\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
      remove_origin "$path"
    else
      printf 'keep\tcurrent\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
      remove_origin "$path"
    fi
  done < "$current"
}

write_conflicts() {
  local report
  [ -s "$conflicts" ] || return 0
  if lexists "$conflict_path"; then
    [ -f "$conflict_path" ] && [ ! -L "$conflict_path" ] || {
      echo "error: conflict report path is unsafe" >&2
      return 1
    }
  fi
  report="$(mktemp "$script_dir/.ramp-conflicts.XXXXXX")" || return 1
  sort "$conflicts" > "$report"
  mv "$report" "$conflict_path"
  echo "error: installation conflicts; see $CONFLICT_NAME" >&2
  return 1
}

build_backup() {
  local backup_stage old_manifest old_bundle old_version new_version source_root
  local hash mode path sums
  backup_stage="$1"
  old_manifest="$2"
  old_bundle="$3"
  old_version="$4"
  new_version="$5"
  source_root="$6"
  mkdir -p "$backup_stage/overlay"
  cp "$owner_state" "$backup_stage/install-files.tsv"
  cp "$origin_state" "$backup_stage/origins.tsv"
  {
    printf 'RAMP-INSTALL-BACKUP\t1\n'
    printf 'owner\t%s\n' "$owner"
    printf 'from-bundle\t%s\n' "$old_bundle"
    printf 'from-version\t%s\n' "$old_version"
    printf 'to-bundle\t%s\n' "$bundle_id"
    printf 'to-version\t%s\n' "$new_version"
  } > "$backup_stage/backup-meta.tsv"
  chmod 644 "$backup_stage/install-files.tsv" \
    "$backup_stage/origins.tsv" "$backup_stage/backup-meta.tsv"
  while IFS="$TAB" read -r hash mode path; do
    mkdir -p "$(dirname "$backup_stage/overlay/$path")"
    cp "$source_root/$path" "$backup_stage/overlay/$path"
    chmod "${mode#0}" "$backup_stage/overlay/$path"
  done < "$old_manifest"
  sums="$backup_stage/SHA256SUMS"
  : > "$sums"
  (
    cd "$backup_stage"
    find . -type f ! -path ./SHA256SUMS -print |
      sed 's#^\./##' |
      sort |
      while IFS= read -r path; do
        printf '%s  %s\n' "$(hash_file "$path")" "$path"
      done
  ) > "$sums"
  chmod 644 "$sums"
}

find_backup() {
  local count candidate generation
  rollback_dir=""
  count=0
  if lexists "$owner_backup"; then
    [ -d "$owner_backup" ] && [ ! -L "$owner_backup" ] || return 1
    for candidate in "$owner_backup"/* "$owner_backup"/.[!.]* "$owner_backup"/..?*; do
      lexists "$candidate" || continue
      [ -d "$candidate" ] && [ ! -L "$candidate" ] || return 1
      generation="$(basename "$candidate")"
      portable_segment "$generation" || return 1
      case "$generation" in .*) return 1 ;; esac
      rollback_dir="$candidate"
      count=$((count + 1))
    done
  fi
  [ "$count" -eq 1 ] || return 1
}

verify_backup() {
  local previous current_bundle current_version previous_bundle previous_version
  local line expected path file prior_path field_count
  local actual_files listed_files expected_files expected_mode
  previous="$1"
  current_bundle="$2"
  current_version="$3"
  previous_bundle="$4"
  previous_version="$5"
  canonical_text_file "$rollback_dir/SHA256SUMS" || return 1
  [ -f "$rollback_dir/SHA256SUMS" ] &&
    [ ! -L "$rollback_dir/SHA256SUMS" ] || return 1
  for required in install-files.tsv origins.tsv backup-meta.tsv; do
    [ -f "$rollback_dir/$required" ] &&
      [ ! -L "$rollback_dir/$required" ] || return 1
    [ "0$(mode_file "$rollback_dir/$required")" = "0644" ] || return 1
  done
  [ "0$(mode_file "$rollback_dir/SHA256SUMS")" = "0644" ] || return 1
  [ -z "$(find "$rollback_dir" -mindepth 1 ! -type f ! -type d -print -quit)" ] ||
    return 1
  canonical_text_file "$rollback_dir/backup-meta.tsv" || return 1
  meta_line=0
  while IFS= read -r line || [ -n "$line" ]; do
    meta_line=$((meta_line + 1))
    case "$line" in *"$CR"*) return 1 ;; esac
    field_count="$(printf '%s\n' "$line" | awk -F '\t' '{print NF}')"
    [ "$field_count" -eq 2 ] || return 1
    IFS="$TAB" read -r one two three <<EOF
$line
EOF
    case "$meta_line" in
      1) [ "$one" = "RAMP-INSTALL-BACKUP" ] && [ "$two" = "1" ] || return 1 ;;
      2) [ "$one" = "owner" ] && [ "$two" = "$owner" ] || return 1 ;;
      3) [ "$one" = "from-bundle" ] && [ "$two" = "$previous_bundle" ] || return 1 ;;
      4) [ "$one" = "from-version" ] && [ "$two" = "$previous_version" ] || return 1 ;;
      5) [ "$one" = "to-bundle" ] && [ "$two" = "$current_bundle" ] || return 1 ;;
      6) [ "$one" = "to-version" ] && [ "$two" = "$current_version" ] || return 1 ;;
      *) return 1 ;;
    esac
  done < "$rollback_dir/backup-meta.tsv"
  [ "$meta_line" -eq 6 ] || return 1
  actual_files="$work/backup-actual.tsv"
  listed_files="$work/backup-listed.tsv"
  expected_files="$work/backup-expected.tsv"
  (
    cd "$rollback_dir"
    find . -type f ! -path ./SHA256SUMS -print | sed 's#^\./##' | sort
  ) > "$actual_files"
  {
    printf 'backup-meta.tsv\ninstall-files.tsv\norigins.tsv\n'
    while IFS="$TAB" read -r hash mode path; do
      printf 'overlay/%s\n' "$path"
    done < "$previous"
  } | sort > "$expected_files"
  cmp -s "$actual_files" "$expected_files" || return 1
  : > "$listed_files"
  prior_path=""
  while IFS= read -r line || [ -n "$line" ]; do
    [ "${#line}" -ge 67 ] || return 1
    expected="${line:0:64}"
    [ -z "$(printf '%s' "$expected" | tr -d '0-9a-f')" ] || return 1
    [ "${line:64:2}" = "  " ] || return 1
    path="${line:66}"
    portable_path "$path" || return 1
    [ "$path" != "SHA256SUMS" ] || return 1
    [ -z "$prior_path" ] || [ "$prior_path" \< "$path" ] || return 1
    prior_path="$path"
    ordinary_ancestry "$rollback_dir" "$path" || return 1
    file="$rollback_dir/$path"
    [ -f "$file" ] && [ ! -L "$file" ] || return 1
    [ "$(hash_file "$file")" = "$expected" ] || return 1
    printf '%s\n' "$path" >> "$listed_files"
  done < "$rollback_dir/SHA256SUMS"
  cmp -s "$listed_files" "$expected_files" || return 1
  [ "$(basename "$rollback_dir")" = "$previous_version" ] || return 1
  while IFS="$TAB" read -r hash expected_mode path; do
    [ "0$(mode_file "$rollback_dir/overlay/$path")" = "$expected_mode" ] ||
      return 1
  done < "$previous"
}

prepare_rollback_plan() {
  local current current_bundle current_version previous previous_bundle previous_version
  local backup_origins backup_origin live_origin
  local hash mode path source current_record current_hash current_mode
  local actual_hash actual_mode
  : > "$plan"
  : > "$conflicts"
  current="$work/current.tsv"
  [ -f "$owner_state" ] && [ ! -L "$owner_state" ] || return 1
  parse_manifest "$owner_state" "$current" "$owner" || return 1
  current_bundle="$parsed_bundle"
  current_version="$parsed_version"
  find_backup || return 1
  previous="$work/previous.tsv"
  parse_manifest "$rollback_dir/install-files.tsv" "$previous" "$owner" || return 1
  previous_bundle="$parsed_bundle"
  previous_version="$parsed_version"
  verify_backup "$previous" "$current_bundle" "$current_version" \
    "$previous_bundle" "$previous_version" || return 1
  backup_origins="$work/backup-origins.tsv"
  parse_origins "$rollback_dir/origins.tsv" "$backup_origins" || return 1
  cp "$origins" "$new_origins"
  while IFS="$TAB" read -r hash mode path; do
    if ! awk -F '\t' -v p="$path" '$3 == p { found=1 } END { exit found ? 0 : 1 }' \
      "$previous"; then
      if [ "$(other_claim_count "$owner" "$path")" -eq 0 ]; then
        remove_origin "$path"
      fi
    fi
  done < "$current"
  while IFS="$TAB" read -r hash mode path; do
    backup_origin="$(awk -F '\t' -v p="$path" '$2 == p {print $1; exit}' "$backup_origins")"
    [ -n "$backup_origin" ] || return 1
    live_origin="$(origin_for "$path")"
    if [ -n "$live_origin" ] && [ "$live_origin" != "$backup_origin" ]; then
      add_conflict "$path" "rollback origin disagrees with live owners"
    else
      set_origin "$backup_origin" "$path" ||
        add_conflict "$path" "rollback origin mismatch"
    fi
  done < "$previous"
  while IFS="$TAB" read -r hash mode path; do
    source="$rollback_dir/overlay/$path"
    ordinary_ancestry "$rollback_dir/overlay" "$path" || return 1
    [ "$(hash_file "$source")" = "$hash" ] || return 1
    current_record="$(awk -F '\t' -v p="$path" '$3 == p { print $1 "\t" $2; exit }' "$current")"
    if [ -n "$current_record" ]; then
      current_hash="${current_record%%"$TAB"*}"
      current_mode="${current_record#*"$TAB"}"
      if [ "$current_hash" = "$hash" ] && [ "$current_mode" = "$mode" ]; then
        printf 'keep\tbackup\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
      elif ! other_claims_match "$owner" "$path" "$hash" "$mode"; then
        add_conflict "$path" "another owner blocks rollback"
      else
        printf 'write\tbackup\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
      fi
    elif portable_collision_with_states "$path"; then
      add_conflict "$path" "portable path collides with another owner"
    elif ! ordinary_ancestry "$target" "$path"; then
      add_conflict "$path" "unsafe destination"
    elif lexists "$target/$path"; then
      actual_hash="$(hash_file "$target/$path")"
      actual_mode="0$(mode_file "$target/$path")"
      if [ "$actual_hash" = "$hash" ] && [ "$actual_mode" = "$mode" ] &&
        other_claims_match "$owner" "$path" "$hash" "$mode"; then
        printf 'keep\tbackup\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
      else
        add_conflict "$path" "rollback destination differs"
      fi
    else
      printf 'write\tbackup\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
    fi
  done < "$previous"
  while IFS="$TAB" read -r hash mode path; do
    awk -F '\t' -v p="$path" '$3 == p { found=1 } END { exit found ? 0 : 1 }' \
      "$previous" && continue
    if [ "$(other_claim_count "$owner" "$path")" -gt 0 ]; then
      printf 'keep\tcurrent\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
    elif [ "$(origin_for "$path")" = "managed" ]; then
      printf 'remove\tcurrent\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
    else
      printf 'keep\tcurrent\t%s\t%s\t%s\n' "$mode" "$hash" "$path" >> "$plan"
    fi
  done < "$current"
}

preflight() {
  verify_source_records || return 1
  load_state || return 1
  case "$operation" in
    install|dry-run) prepare_install_plan ;;
    uninstall) prepare_uninstall_plan ;;
    rollback) prepare_rollback_plan ;;
  esac
}

record_missing_directories() {
  local path parent rest part current
  path="$1"
  case "$path" in
    */*) parent="${path%/*}" ;;
    *) return 0 ;;
  esac
  rest="$parent"
  current=""
  while [ -n "$rest" ]; do
    case "$rest" in
      */*) part="${rest%%/*}"; rest="${rest#*/}" ;;
      *) part="$rest"; rest="" ;;
    esac
    if [ -n "$current" ]; then
      current="$current/$part"
    else
      current="$part"
    fi
    if lexists "$target/$current"; then
      [ -d "$target/$current" ] && [ ! -L "$target/$current" ] || return 1
    else
      printf '%s\n' "$current" >> "$txn/created-dirs.tsv"
    fi
  done
}

preflight || {
  echo "error: installer preflight failed" >&2
  exit 1
}
write_conflicts
if [ "$operation" = "dry-run" ]; then
  echo "RAMP dry run: $(wc -l < "$plan" | tr -d ' ') planned paths"
  exit 0
fi

if [ ! -e "$target/$STATE_ROOT" ]; then
  mkdir "$target/$STATE_ROOT"
  ramp_created=1
else
  [ -d "$target/$STATE_ROOT" ] && [ ! -L "$target/$STATE_ROOT" ] || {
    echo "error: unsafe state root" >&2
    exit 1
  }
fi
if ! lexists "$installed_dir"; then
  mkdir "$installed_dir"
  installed_created=1
else
  [ -d "$installed_dir" ] && [ ! -L "$installed_dir" ] || exit 1
fi
if ! lexists "$backups_dir"; then
  mkdir "$backups_dir"
  backups_created=1
else
  [ -d "$backups_dir" ] && [ ! -L "$backups_dir" ] || exit 1
fi
mkdir "$target/$STATE_ROOT/install.lock" 2>/dev/null || {
  echo "error: another RAMP installer holds the target lock" >&2
  exit 1
}
lock_created=1

preflight || {
  echo "error: locked installer preflight failed" >&2
  exit 1
}
write_conflicts

txn="$target/$STATE_ROOT/.transaction.$$"
[ ! -e "$txn" ] && [ ! -L "$txn" ] || exit 1
mkdir -p "$txn/old" "$txn/new"
mkdir -p "$txn/state.old"
transaction_active=1
owner_state_old=0
origin_state_old=0
owner_backup_old=0
if lexists "$owner_state"; then
  [ -f "$owner_state" ] && [ ! -L "$owner_state" ] || exit 1
  cp "$owner_state" "$txn/state.old/owner.tsv"
  owner_state_old=1
fi
if lexists "$origin_state"; then
  [ -f "$origin_state" ] && [ ! -L "$origin_state" ] || exit 1
  cp "$origin_state" "$txn/state.old/origins.tsv"
  origin_state_old=1
fi
if lexists "$owner_backup"; then
  current_check="$work/current-backup-check.tsv"
  parse_manifest "$owner_state" "$current_check" "$owner" || exit 1
  current_check_bundle="$parsed_bundle"
  current_check_version="$parsed_version"
  find_backup || exit 1
  previous_check="$work/previous-backup-check.tsv"
  parse_manifest "$rollback_dir/install-files.tsv" "$previous_check" "$owner" ||
    exit 1
  previous_check_bundle="$parsed_bundle"
  previous_check_version="$parsed_version"
  verify_backup "$previous_check" "$current_check_bundle" \
    "$current_check_version" "$previous_check_bundle" \
    "$previous_check_version" || exit 1
  mkdir -p "$txn/backup.old"
  cp -R "$rollback_dir" "$txn/backup.old/$previous_check_version"
  owner_backup_old=1
fi
: > "$txn/journal.tsv"
: > "$txn/created-dirs.tsv"
while IFS="$TAB" read -r action source_kind mode hash path; do
  case "$action" in
    write|remove)
      if lexists "$target/$path"; then
        mkdir -p "$(dirname "$txn/old/$path")"
        cp "$target/$path" "$txn/old/$path"
        printf 'present\t%s\t%s\n' "0$(mode_file "$target/$path")" "$path" >> "$txn/journal.tsv"
      else
        printf 'absent\t-\t%s\n' "$path" >> "$txn/journal.tsv"
      fi
      ;;
  esac
  if [ "$action" = "write" ]; then
    record_missing_directories "$path" || exit 1
    case "$source_kind" in
      bundle) source_file="$overlay_dir/$path" ;;
      backup) source_file="$rollback_dir/overlay/$path" ;;
      *) exit 1 ;;
    esac
    mkdir -p "$(dirname "$txn/new/$path")"
    cp "$source_file" "$txn/new/$path"
    chmod "${mode#0}" "$txn/new/$path"
    [ "$(hash_file "$txn/new/$path")" = "$hash" ] || exit 1
  fi
done < "$plan"

upgrade_old_version=""
upgrade_old_bundle=""
upgrade_backup_stage=""
if [ "$operation" = "install" ] && lexists "$owner_state"; then
  parse_manifest "$owner_state" "$work/old-for-backup.tsv" "$owner" || exit 1
  upgrade_old_bundle="$parsed_bundle"
  upgrade_old_version="$parsed_version"
  if [ "$upgrade_old_version" != "$bundle_version" ]; then
    upgrade_backup_stage="$txn/backup/$upgrade_old_version"
    build_backup "$upgrade_backup_stage" "$work/old-for-backup.tsv" \
      "$upgrade_old_bundle" "$upgrade_old_version" "$bundle_version" "$target" ||
      exit 1
  fi
fi
if [ "$operation" = "rollback" ]; then
  cp "$rollback_dir/install-files.tsv" "$txn/rollback-install-files.tsv"
fi

restore_transaction() {
  local prior prior_mode path temporary restore_failed directory
  restore_failed=0
  if [ -n "$active_customer_temp" ]; then
    ordinary_ancestry "$target" "$active_customer_temp" &&
      rm -f "$target/$active_customer_temp" || restore_failed=1
    active_customer_temp=""
  fi
  if [ -n "$active_state_temp" ]; then
    ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" &&
      rm -f "$active_state_temp" || restore_failed=1
    active_state_temp=""
  fi
  while IFS="$TAB" read -r prior prior_mode path; do
    if [ "$prior" = "present" ]; then
      ordinary_ancestry "$target" "$path" || {
        restore_failed=1
        continue
      }
      mkdir -p "$(dirname "$target/$path")" || {
        restore_failed=1
        continue
      }
      temporary="$target/$path.ramp-restore.$$"
      ! lexists "$temporary" || {
        restore_failed=1
        continue
      }
      cp "$txn/old/$path" "$temporary" &&
        chmod "${prior_mode#0}" "$temporary" &&
        ordinary_ancestry "$target" "$path" &&
        mv "$temporary" "$target/$path" || {
          rm -f "$temporary" 2>/dev/null || true
          restore_failed=1
        }
    else
      ordinary_ancestry "$target" "$path" &&
        rm -f "$target/$path" || restore_failed=1
    fi
  done < "$txn/journal.tsv"
  sort -r -u "$txn/created-dirs.tsv" |
    while IFS= read -r directory; do
      [ -n "$directory" ] || continue
      ordinary_directory_ancestry "$target" "$directory" &&
        rmdir "$target/$directory" 2>/dev/null || true
    done

  if [ "$owner_state_mutated" -eq 1 ]; then
    ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" ||
      restore_failed=1
    if [ "$restore_failed" -eq 0 ]; then
      if lexists "$owner_state"; then
        [ -f "$owner_state" ] && [ ! -L "$owner_state" ] ||
          restore_failed=1
      fi
    fi
    if [ "$restore_failed" -eq 0 ]; then
      if [ "$owner_state_old" -eq 1 ]; then
        temporary="$installed_dir/$owner.tsv.restore.$$"
        ! lexists "$temporary" &&
          cp "$txn/state.old/owner.tsv" "$temporary" &&
          mv "$temporary" "$owner_state" || restore_failed=1
      else
        rm -f "$owner_state" || restore_failed=1
      fi
    fi
  fi

  if [ "$origin_state_mutated" -eq 1 ]; then
    ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" ||
      restore_failed=1
    if [ "$restore_failed" -eq 0 ]; then
      if lexists "$origin_state"; then
        [ -f "$origin_state" ] && [ ! -L "$origin_state" ] ||
          restore_failed=1
      fi
    fi
    if [ "$restore_failed" -eq 0 ]; then
      if [ "$origin_state_old" -eq 1 ]; then
        temporary="$installed_dir/.origins.tsv.restore.$$"
        ! lexists "$temporary" &&
          cp "$txn/state.old/origins.tsv" "$temporary" &&
          mv "$temporary" "$origin_state" || restore_failed=1
      else
        rm -f "$origin_state" || restore_failed=1
      fi
    fi
  fi

  if [ "$backup_mutated" -eq 1 ]; then
    ordinary_directory_ancestry "$target" "$STATE_ROOT/backups" ||
      restore_failed=1
    if [ "$restore_failed" -eq 0 ]; then
      if lexists "$owner_backup"; then
        [ -d "$owner_backup" ] && [ ! -L "$owner_backup" ] ||
          restore_failed=1
      fi
    fi
    if [ "$restore_failed" -eq 0 ]; then
      rm -rf "$owner_backup" || restore_failed=1
    fi
    if [ "$restore_failed" -eq 0 ] && [ "$owner_backup_old" -eq 1 ]; then
      mkdir -p "$owner_backup" &&
        cp -R "$txn/backup.old/." "$owner_backup" || restore_failed=1
    fi
  fi
  [ "$restore_failed" -eq 0 ] || return 1
  transaction_restored=1
  return 0
}

recheck_owner_backup() {
  ordinary_directory_ancestry "$target" "$STATE_ROOT/backups" || return 1
  if [ "$owner_backup_old" -eq 1 ]; then
    lexists "$owner_backup" &&
      [ -d "$owner_backup" ] &&
      [ ! -L "$owner_backup" ] || return 1
    find_backup || return 1
    verify_backup "$previous_check" "$current_check_bundle" \
      "$current_check_version" "$previous_check_bundle" \
      "$previous_check_version" || return 1
  else
    ! lexists "$owner_backup" || return 1
  fi
}

commit_failed=0
mutation_started=1
while IFS="$TAB" read -r action source_kind mode hash path; do
  case "$action" in
    keep) ;;
    write)
      ordinary_ancestry "$target" "$path" || { commit_failed=1; break; }
      mkdir -p "$(dirname "$target/$path")" || { commit_failed=1; break; }
      temporary="$target/$path.ramp-install.$$"
      ! lexists "$temporary" || { commit_failed=1; break; }
      active_customer_temp="$path.ramp-install.$$"
      cp "$txn/new/$path" "$temporary" || { commit_failed=1; break; }
      chmod "${mode#0}" "$temporary" || { commit_failed=1; break; }
      ordinary_ancestry "$target" "$path" || { commit_failed=1; break; }
      mv "$temporary" "$target/$path" || { commit_failed=1; break; }
      active_customer_temp=""
      ;;
    remove)
      ordinary_ancestry "$target" "$path" || { commit_failed=1; break; }
      rm -f "$target/$path" || { commit_failed=1; break; }
      ;;
  esac
done < "$plan"

if [ "$commit_failed" -eq 0 ]; then
  origins_rendered="$txn/origins.tsv"
  render_origins "$new_origins" "$origins_rendered" || commit_failed=1
fi

if [ "$commit_failed" -eq 0 ]; then
  case "$operation" in
    install)
      if [ -n "$upgrade_backup_stage" ]; then
        recheck_owner_backup || commit_failed=1
        if [ "$commit_failed" -eq 0 ]; then
          backup_mutated=1
          rm -rf "$owner_backup" &&
            ordinary_directory_ancestry "$target" "$STATE_ROOT/backups" &&
            mkdir -p "$owner_backup" &&
            mv "$upgrade_backup_stage" "$owner_backup/$upgrade_old_version" ||
              commit_failed=1
        fi
      fi
      ;;
  esac
fi

if [ "$commit_failed" -eq 0 ]; then
  case "$operation" in
    install)
      if ! ordinary_directory_ancestry "$target" "$STATE_ROOT/installed"; then
        commit_failed=1
      elif lexists "$owner_state" &&
        { [ ! -f "$owner_state" ] || [ -L "$owner_state" ]; }; then
        commit_failed=1
      elif lexists "$installed_dir/$owner.tsv.new"; then
        commit_failed=1
      else
        owner_state_mutated=1
        active_state_temp="$installed_dir/$owner.tsv.new"
        cp "$manifest_path" "$installed_dir/$owner.tsv.new" &&
          ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" &&
          mv "$installed_dir/$owner.tsv.new" "$owner_state" || commit_failed=1
        if [ "$commit_failed" -eq 0 ]; then active_state_temp=""; fi
      fi
      ;;
    uninstall)
      ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" &&
        [ -f "$owner_state" ] &&
        [ ! -L "$owner_state" ] || commit_failed=1
      if [ "$commit_failed" -eq 0 ]; then
        owner_state_mutated=1
        rm -f "$owner_state" || commit_failed=1
      fi
      ;;
    rollback)
      if ! ordinary_directory_ancestry "$target" "$STATE_ROOT/installed"; then
        commit_failed=1
      elif lexists "$owner_state" &&
        { [ ! -f "$owner_state" ] || [ -L "$owner_state" ]; }; then
        commit_failed=1
      elif lexists "$installed_dir/$owner.tsv.new"; then
        commit_failed=1
      else
        owner_state_mutated=1
        active_state_temp="$installed_dir/$owner.tsv.new"
        cp "$txn/rollback-install-files.tsv" "$installed_dir/$owner.tsv.new" &&
          ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" &&
          mv "$installed_dir/$owner.tsv.new" "$owner_state" || commit_failed=1
        if [ "$commit_failed" -eq 0 ]; then active_state_temp=""; fi
      fi
      ;;
  esac
fi

if [ "$commit_failed" -eq 0 ]; then
  case "$operation" in
    uninstall|rollback)
      recheck_owner_backup || commit_failed=1
      if [ "$commit_failed" -eq 0 ]; then
        backup_mutated=1
        rm -rf "$owner_backup" || commit_failed=1
      fi
      ;;
  esac
fi

if [ "$commit_failed" -eq 0 ]; then
  ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" ||
    commit_failed=1
fi

if [ "$commit_failed" -eq 0 ]; then
  if [ -s "$new_origins" ]; then
    if lexists "$origin_state" &&
      { [ ! -f "$origin_state" ] || [ -L "$origin_state" ]; }; then
      commit_failed=1
    elif lexists "$installed_dir/.origins.tsv.new"; then
      commit_failed=1
    else
      origin_state_mutated=1
      active_state_temp="$installed_dir/.origins.tsv.new"
      cp "$txn/origins.tsv" "$installed_dir/.origins.tsv.new" &&
        ordinary_directory_ancestry "$target" "$STATE_ROOT/installed" &&
        mv "$installed_dir/.origins.tsv.new" "$origin_state" || commit_failed=1
      if [ "$commit_failed" -eq 0 ]; then active_state_temp=""; fi
    fi
  else
    if lexists "$origin_state"; then
      [ -f "$origin_state" ] && [ ! -L "$origin_state" ] ||
        commit_failed=1
    fi
    if [ "$commit_failed" -eq 0 ]; then
      origin_state_mutated=1
      rm -f "$origin_state" || commit_failed=1
    fi
  fi
fi

if [ "$commit_failed" -ne 0 ]; then
  restore_transaction || {
    echo "error: install transaction failed and restoration was incomplete" >&2
    exit 1
  }
  echo "error: install transaction failed and was restored" >&2
  exit 1
fi

# The commit is final: mark it first so an exit or signal from here on
# never restores the transaction over it.
mutation_started=0
rm -rf "$txn" ||
  echo "warning: could not remove transaction staging $txn" >&2
txn=""
transaction_active=0
while IFS="$TAB" read -r action source_kind mode hash path; do
  [ "$action" = "remove" ] || continue
  directory="$(dirname "$target/$path")"
  while [ "$directory" != "$target" ]; do
    rmdir "$directory" 2>/dev/null || break
    directory="$(dirname "$directory")"
  done
done < "$plan"
echo "RAMP $operation complete"
