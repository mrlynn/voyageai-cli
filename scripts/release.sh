#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# vai release script
#
# Usage:
#   ./scripts/release.sh patch|minor|major [--dry-run] [--skip-npm] [--skip-app]
#
# What it does:
#   1. Ensures clean git state (no uncommitted changes)
#   2. Runs tests
#   3. Bumps CLI version in package.json (npm version)
#   4. Syncs electron/package.json version
#   5. Commits both package.json files
#   6. Tags: v{cli-version} for npm, app-v{electron-version} for Electron
#   7. Pushes commits + tags
#   8. Publishes to npm (unless --skip-npm)
#   9. The app-v* tag triggers GH Actions to build + release Electron app
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
echo "🔍 Pre-flight checks..."

# Clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  git status --short
  exit 1
fi

# On main branch
BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Warning: Not on main branch (on: $BRANCH). Continue? [y/N]"
  read -r CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || exit 1
fi

# Pull latest
echo "📥 Pulling latest..."
git pull --rebase

# ── Run tests ──
echo "🧪 Running tests..."
npm test

# ── Read current versions ──
CLI_VERSION_OLD="$(node -p "require('./package.json').version")"
APP_VERSION_OLD="$(node -p "require('./electron/package.json').version")"
echo "📦 Current versions: CLI=$CLI_VERSION_OLD  App=$APP_VERSION_OLD"

# ── Bump CLI version ──
# Use npm version without git tag (we'll tag manually)
CLI_VERSION_NEW="$(npm version "$BUMP" --no-git-tag-version | tail -1)"
CLI_VERSION_NEW="${CLI_VERSION_NEW#v}"  # strip leading 'v'
echo "📦 CLI: $CLI_VERSION_OLD → $CLI_VERSION_NEW"

# ── Bump Electron version to match ──
# Electron app uses its own versioning scheme but we keep them in sync
APP_VERSION_NEW="$(cd electron && npm version "$BUMP" --no-git-tag-version | tail -1)"
APP_VERSION_NEW="${APP_VERSION_NEW#v}"
echo "🖥️  App: $APP_VERSION_OLD → $APP_VERSION_NEW"

if $DRY_RUN; then
  echo ""
  echo "🏜️  DRY RUN — would do:"
  echo "  git add package.json package-lock.json electron/package.json electron/package-lock.json"
  echo "  git commit -m 'release: v$CLI_VERSION_NEW'"
  echo "  git tag v$CLI_VERSION_NEW"
  [[ "$SKIP_APP" == false ]] && echo "  git tag app-v$APP_VERSION_NEW"
  echo "  git push && git push --tags"
  [[ "$SKIP_NPM" == false ]] && echo "  npm publish"
  echo ""
  # Revert version bumps
  git checkout -- package.json package-lock.json electron/package.json electron/package-lock.json 2>/dev/null || true
  echo "✅ Dry run complete. No changes made."
  exit 0
fi

# ── Commit ──
echo "📝 Committing version bump..."
git add package.json package-lock.json electron/package.json electron/package-lock.json
git commit -m "release: v${CLI_VERSION_NEW}"

# ── Tag ──
echo "🏷️  Tagging v${CLI_VERSION_NEW}..."
git tag "v${CLI_VERSION_NEW}"

if [[ "$SKIP_APP" == false ]]; then
  echo "🏷️  Tagging app-v${APP_VERSION_NEW} (triggers Electron build)..."
  git tag "app-v${APP_VERSION_NEW}"
fi

# ── Push ──
echo "🚀 Pushing to origin..."
git push
git push --tags

# ── Publish to npm ──
if [[ "$SKIP_NPM" == false ]]; then
  echo "📦 Publishing to npm..."
  npm publish
  echo "✅ Published voyageai-cli@${CLI_VERSION_NEW} to npm"
else
  echo "⏭️  Skipping npm publish (--skip-npm)"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Release complete!"
echo ""
echo "  CLI:  v${CLI_VERSION_NEW}  $([ "$SKIP_NPM" == false ] && echo '(published to npm)' || echo '(npm skipped)')"
echo "  App:  app-v${APP_VERSION_NEW}  $([ "$SKIP_APP" == false ] && echo '(GH Actions building)' || echo '(skipped)')"
echo ""
echo "  Monitor Electron build:"
echo "  https://github.com/mrlynn/voyageai-cli/actions"
echo "═══════════════════════════════════════════"
