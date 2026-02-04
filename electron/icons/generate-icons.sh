#!/bin/bash
# Generate macOS/iOS app icons from source PNGs
# Usage: ./generate-icons.sh [dark-source.png] [light-source.png]
#
# Sources should be 1024x1024 with transparent corners (squircle shape).
# If no args, looks for dark-source.png and light-source.png in this dir.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DARK_SRC="${1:-$SCRIPT_DIR/dark-source.png}"
LIGHT_SRC="${2:-$SCRIPT_DIR/light-source.png}"

SIZES=(16 20 29 32 40 48 50 55 57 58 60 64 66 72 76 80 87 88 92 100 102 108 114 120 128 144 152 167 172 180 196 216 234 256 258 512 1024)

process_variant() {
  local SRC="$1"
  local VARIANT="$2"
  local OUT_DIR="$SCRIPT_DIR/$VARIANT/AppIcons/Assets.xcassets/AppIcon.appiconset"

  if [ ! -f "$SRC" ]; then
    echo "  ⚠ Source not found: $SRC — skipping $VARIANT"
    return
  fi

  echo "📦 Processing $VARIANT from $(basename "$SRC")..."
  mkdir -p "$OUT_DIR"

  # Resize source to all target sizes (preserve alpha/transparency)
  for SIZE in "${SIZES[@]}"; do
    magick "$SRC" -resize "${SIZE}x${SIZE}" -strip "$OUT_DIR/${SIZE}.png"
  done
  echo "  ✓ ${#SIZES[@]} PNGs generated"

  # Generate .icns for macOS
  local ICONSET_DIR="$SCRIPT_DIR/$VARIANT/icon.iconset"
  rm -rf "$ICONSET_DIR"
  mkdir -p "$ICONSET_DIR"
  cp "$OUT_DIR/16.png"   "$ICONSET_DIR/icon_16x16.png"
  cp "$OUT_DIR/32.png"   "$ICONSET_DIR/icon_16x16@2x.png"
  cp "$OUT_DIR/32.png"   "$ICONSET_DIR/icon_32x32.png"
  cp "$OUT_DIR/64.png"   "$ICONSET_DIR/icon_32x32@2x.png"
  cp "$OUT_DIR/128.png"  "$ICONSET_DIR/icon_128x128.png"
  cp "$OUT_DIR/256.png"  "$ICONSET_DIR/icon_128x128@2x.png"
  cp "$OUT_DIR/256.png"  "$ICONSET_DIR/icon_256x256.png"
  cp "$OUT_DIR/512.png"  "$ICONSET_DIR/icon_256x256@2x.png"
  cp "$OUT_DIR/512.png"  "$ICONSET_DIR/icon_512x512.png"
  cp "$OUT_DIR/1024.png" "$ICONSET_DIR/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET_DIR" -o "$SCRIPT_DIR/$VARIANT/icon.icns"
  echo "  ✓ icon.icns built"

  # Copy key sizes to playground (web UI sidebar logo + favicon)
  local PLAY_DIR="$SCRIPT_DIR/../../src/playground/icons/$VARIANT"
  mkdir -p "$PLAY_DIR"
  for S in 16 32 64 128 256; do
    cp "$OUT_DIR/${S}.png" "$PLAY_DIR/${S}.png"
  done
  echo "  ✓ Playground icons updated"
}

process_variant "$DARK_SRC" "dark"
process_variant "$LIGHT_SRC" "light"

echo ""
echo "✅ Done! Icons in $SCRIPT_DIR/{dark,light}/"
