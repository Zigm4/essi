#!/usr/bin/env bash
# Generate dSYMs for Flutter native_assets frameworks (objective_c.framework, etc.)
# that ship without them. Run on:
#   1. An .xcarchive path → patches the dSYMs folder in place.
#   2. No arg, inside an Xcode Run Script phase → patches the build outputs.
set -euo pipefail

if [[ $# -eq 1 && -d "$1" ]]; then
  # Mode 1: explicit archive path.
  ARCHIVE="$1"
  APP_PATH=$(find "$ARCHIVE/Products/Applications" -maxdepth 1 -name "*.app" | head -1)
  DSYMS_DIR="$ARCHIVE/dSYMs"
elif [[ -n "${BUILT_PRODUCTS_DIR:-}" && -n "${EXECUTABLE_FOLDER_PATH:-}" ]]; then
  # Mode 2: invoked from Xcode build phase.
  APP_PATH="$BUILT_PRODUCTS_DIR/$EXECUTABLE_FOLDER_PATH"
  DSYMS_DIR="${DWARF_DSYM_FOLDER_PATH:-$BUILT_PRODUCTS_DIR}"
else
  echo "usage: $0 <path-to-.xcarchive>" >&2
  exit 1
fi

[[ -d "$APP_PATH/Frameworks" ]] || { echo "no Frameworks/ in $APP_PATH"; exit 0; }

# Iterate every framework inside the bundle and synthesise a dSYM if none is
# already present in $DSYMS_DIR. Empty-symbol dSYMs are still accepted by
# App Store Connect because the UUID match is what matters.
for fw in "$APP_PATH/Frameworks/"*.framework; do
  [[ -d "$fw" ]] || continue
  name=$(basename "$fw" .framework)
  bin="$fw/$name"
  [[ -f "$bin" ]] || continue
  target="$DSYMS_DIR/$name.framework.dSYM"
  if [[ -d "$target" ]]; then
    continue
  fi
  echo "[dsym-fix] generating $target"
  /usr/bin/dsymutil "$bin" -o "$target" 2>&1 || true
done
