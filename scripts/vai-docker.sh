#!/usr/bin/env bash
# vai-docker.sh - Run vai via Docker as if it were installed natively
# Usage: ./scripts/vai-docker.sh <command> [args...]
# Setup: alias vai="./scripts/vai-docker.sh"

set -euo pipefail

IMAGE_NAME="vai:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Auto-build image if it doesn't exist
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building vai Docker image..." >&2
  docker build -t "$IMAGE_NAME" "$PROJECT_DIR"
fi

# Load .env file if present
ENV_FILE="${SCRIPT_DIR}/../.env"
ENV_ARGS=()
if [ -f "$ENV_FILE" ]; then
  ENV_ARGS+=("--env-file" "$ENV_FILE")
fi

# Forward host environment variables if set
for var in VOYAGE_API_KEY MONGODB_URI VAI_LLM_PROVIDER VAI_LLM_API_KEY VAI_LLM_MODEL VAI_LLM_BASE_URL VAI_MCP_SERVER_KEY; do
  if [ -n "${!var:-}" ]; then
    ENV_ARGS+=("-e" "${var}=${!var}")
  fi
done

# Detect command and apply appropriate Docker flags
COMMAND="${1:-}"
case "$COMMAND" in
  playground)
    PORT="${PLAYGROUND_PORT:-3333}"
    exec docker run --rm -it \
      "${ENV_ARGS[@]}" \
      -p "${PORT}:3333" \
      -v "vai-config:/root/.vai" \
      "$IMAGE_NAME" "$@" --port 3333 --no-open
    ;;
  mcp-server)
    PORT="${MCP_PORT:-3100}"
    exec docker run --rm -it \
      "${ENV_ARGS[@]}" \
      -p "${PORT}:3100" \
      -v "vai-config:/root/.vai" \
      "$IMAGE_NAME" "$@" --host 0.0.0.0 --port 3100
    ;;
  pipeline|ingest|store)
    exec docker run --rm -it \
      "${ENV_ARGS[@]}" \
      -v "$(pwd):/data:ro" \
      -v "vai-config:/root/.vai" \
      "$IMAGE_NAME" "$@"
    ;;
  *)
    exec docker run --rm -it \
      "${ENV_ARGS[@]}" \
      -v "vai-config:/root/.vai" \
      "$IMAGE_NAME" "$@"
    ;;
esac
