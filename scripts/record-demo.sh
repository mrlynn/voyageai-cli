#!/usr/bin/env bash
# Record a demo GIF for voyageai-cli
# Requires: VOYAGE_API_KEY environment variable
#
# Usage:
#   ./scripts/record-demo.sh          # Uses vhs (preferred)
#   ./scripts/record-demo.sh asciinema # Uses asciinema instead
#
# Output:
#   demo.gif (vhs) or demo.cast (asciinema)

set -euo pipefail
cd "$(dirname "$0")/.."

METHOD="${1:-vhs}"

if [ "$METHOD" = "vhs" ]; then
  if ! command -v vhs &>/dev/null; then
    echo "❌ vhs not found. Install: brew install charmbracelet/tap/vhs"
    echo "   Or run: ./scripts/record-demo.sh asciinema"
    exit 1
  fi

  if [ -z "${VOYAGE_API_KEY:-}" ]; then
    echo "⚠️  VOYAGE_API_KEY not set. Commands that call the API will fail."
    echo "   Set it: export VOYAGE_API_KEY=your-key"
    exit 1
  fi

  echo "🎬 Recording demo with vhs..."
  vhs demo.tape
  echo "✅ Demo GIF saved to demo.gif"

elif [ "$METHOD" = "asciinema" ]; then
  if ! command -v asciinema &>/dev/null; then
    echo "❌ asciinema not found. Install: brew install asciinema"
    exit 1
  fi

  CAST_FILE="demo.cast"
  echo "🎬 Recording demo with asciinema..."
  echo "   Run the following commands, then press Ctrl-D when done:"
  echo ""
  echo "   vai --version"
  echo "   vai models --type embedding"
  echo '   vai embed "What is MongoDB Atlas?"'
  echo "   vai explain embeddings"
  echo '   vai similarity "MongoDB is great" "MongoDB Atlas is amazing"'
  echo ""

  asciinema rec "$CAST_FILE"
  echo "✅ Recording saved to $CAST_FILE"
  echo ""
  echo "Convert to GIF with agg or svg-term-cli:"
  echo "  agg $CAST_FILE demo.gif"
  echo "  # or"
  echo "  npx svg-term-cli --in $CAST_FILE --out demo.svg --window"

else
  echo "Unknown method: $METHOD"
  echo "Usage: $0 [vhs|asciinema]"
  exit 1
fi
