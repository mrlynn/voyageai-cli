#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# vai release script
#
# Usage:
#   ./scripts/release.sh patch|minor|major [--dry-run] [--skip-npm] [--skip-app]
#
# What it does:
#   1. Ensures clean git state on main branch
#   2. Runs tests
#   3. Bumps CLI version in package.json (single source of truth)
#   4. Syncs electron/package.json to same version
#   5. Commits, tags (v* + app-v*), pushes
#   6. Publishes to npm (unless --skip-npm)
#   7. The app-v* tag triggers GH Actions to build Electron app
# ─────────────────────────────────────────────────────────

BUMP="${1:-}"
DRY_RUN=false
SKIP_NPM=false
SKIP_APP=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true ;;
    --skip-npm) SKIP_NPM=true ;;
    --skip-app) SKIP_APP=true ;;
  esac
done

if [[ -z "$BUMP" || "$BUMP" == --* ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major> [--dry-run] [--skip-npm] [--skip-app]"
  exit 1
fi

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Error: bump type must be patch, minor, or major (got: $BUMP)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Pre-flight checks ──
echo "Pre-flight checks..."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  git status --short
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Warning: Not on main branch (on: $BRANCH). Continue? [y/N]"
  read -r CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || exit 1
fi

echo "Pulling latest..."
git pull --rebase

# ── Run tests ──
echo "Running tests..."
npm test

# ── Read current version ──
VERSION_OLD="$(node -p "require('./package.json').version")"
echo "Current version: $VERSION_OLD"

# ── Bump CLI version (single source of truth) ──
# npm version runs the "version" lifecycle script (sync-nano-version.js)
# which syncs nano-bridge.py. We use node to read the result cleanly.
npm version "$BUMP" --no-git-tag-version > /dev/null 2>&1
VERSION_NEW="$(node -p "require('./package.json').version")"
echo "New version: $VERSION_NEW"

# ── Sync Electron version to match CLI ──
cd electron
npm version "$VERSION_NEW" --no-git-tag-version --allow-same-version > /dev/null 2>&1
cd "$ROOT"
echo "Electron synced to: $VERSION_NEW"

# ── Also stage nano-bridge.py if the sync script updated it ──
git add -f src/nano/nano-bridge.py 2>/dev/null || true

if $DRY_RUN; then
  echo ""
  echo "DRY RUN -- would do:"
  echo "  git add package.json package-lock.json electron/package.json electron/package-lock.json src/nano/nano-bridge.py"
  echo "  git commit -m 'release: v$VERSION_NEW'"
  echo "  git tag v$VERSION_NEW"
  [[ "$SKIP_APP" == false ]] && echo "  git tag app-v$VERSION_NEW"
  echo "  git push && git push --tags"
  [[ "$SKIP_NPM" == false ]] && echo "  npm publish"
  echo ""
  # Revert version bumps
  git checkout -- package.json package-lock.json electron/package.json electron/package-lock.json src/nano/nano-bridge.py 2>/dev/null || true
  echo "Dry run complete. No changes made."
  exit 0
fi

# ── Commit ──
echo "Committing version bump..."
git add package.json package-lock.json electron/package.json electron/package-lock.json src/nano/nano-bridge.py
git commit -m "release: v${VERSION_NEW}"

# ── Tag ──
echo "Tagging v${VERSION_NEW}..."
git tag "v${VERSION_NEW}"

if [[ "$SKIP_APP" == false ]]; then
  echo "Tagging app-v${VERSION_NEW} (triggers Electron build)..."
  git tag "app-v${VERSION_NEW}"
fi

# ── Push ──
echo "Pushing to origin..."
git push
git push --tags

# ── Publish to npm ──
if [[ "$SKIP_NPM" == false ]]; then
  echo "Publishing to npm..."
  npm publish
  echo "Published voyageai-cli@${VERSION_NEW} to npm"
else
  echo "Skipping npm publish (--skip-npm)"
fi

# ── Summary ──
echo ""
echo "==========================================="
echo "  Release complete: v${VERSION_NEW}"
echo ""
echo "  npm:  $([ "$SKIP_NPM" == false ] && echo "published" || echo "skipped")"
echo "  app:  $([ "$SKIP_APP" == false ] && echo "app-v${VERSION_NEW} (GH Actions building)" || echo "skipped")"
echo ""
echo "  Monitor: https://github.com/mrlynn/voyageai-cli/actions"
echo "==========================================="
