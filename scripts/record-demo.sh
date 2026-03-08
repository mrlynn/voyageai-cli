#!/usr/bin/env bash
# Record a demo GIF for voyageai-cli
# Some tapes may require extra environment variables or local services.
#
# Usage:
#   ./scripts/record-demo.sh
#   ./scripts/record-demo.sh vhs docs/demos/local-inference.tape
#   ./scripts/record-demo.sh vhs ./local-inference.tape
#   ./scripts/record-demo.sh asciinema
#
# Output:
#   Uses the tape's configured Output filename (vhs) or a derived .cast name (asciinema)

set -euo pipefail

CALLER_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

METHOD="${1:-vhs}"
TAPE_ARG="${2:-docs/demos/demo.tape}"

if [[ "$TAPE_ARG" = /* ]]; then
  TAPE_FILE="$TAPE_ARG"
elif [ -f "$CALLER_DIR/$TAPE_ARG" ]; then
  TAPE_FILE="$CALLER_DIR/$TAPE_ARG"
else
  TAPE_FILE="$REPO_DIR/$TAPE_ARG"
fi

OUTPUT_FILE="${TAPE_FILE##*/}"
OUTPUT_FILE="${OUTPUT_FILE%.tape}.gif"

if [ "$METHOD" = "vhs" ]; then
  if ! command -v vhs &>/dev/null; then
    echo "❌ vhs not found. Install: brew install charmbracelet/tap/vhs"
    echo "   Or run: ./scripts/record-demo.sh asciinema"
    exit 1
  fi

  if [ -z "${VOYAGE_API_KEY:-}" ]; then
    echo "⚠️  VOYAGE_API_KEY not set."
    echo "   That's fine for local-only tapes, but API-backed commands may fail."
  fi

  if [ ! -f "$TAPE_FILE" ]; then
    echo "❌ Tape not found: $TAPE_FILE"
    exit 1
  fi

  REQUIRED_OLLAMA_MODEL=""
  case "$(basename "$TAPE_FILE")" in
    local-inference.tape|ollama-nano-chat.tape)
      REQUIRED_OLLAMA_MODEL="llama3.2:3b"
      ;;
  esac

  if [ -n "$REQUIRED_OLLAMA_MODEL" ]; then
    if ! command -v ollama &>/dev/null; then
      echo "❌ ollama not found."
      echo "   Install Ollama first: https://ollama.com/download"
      exit 1
    fi

    if ! ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$REQUIRED_OLLAMA_MODEL"; then
      echo "❌ Ollama model $REQUIRED_OLLAMA_MODEL is not installed."
      echo "   Pre-pull it before recording so the GIF skips the download:"
      echo "   ollama pull $REQUIRED_OLLAMA_MODEL"
      exit 1
    fi
  fi

  echo "🎬 Recording demo with vhs..."
  vhs "$TAPE_FILE"
  echo "✅ Demo GIF saved (see Output setting inside $TAPE_FILE)"

elif [ "$METHOD" = "asciinema" ]; then
  if ! command -v asciinema &>/dev/null; then
    echo "❌ asciinema not found. Install: brew install asciinema"
    exit 1
  fi

  CAST_FILE="${OUTPUT_FILE%.gif}.cast"
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
