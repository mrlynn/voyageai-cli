#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# vai release script
#
# Usage:
#   ./scripts/release.sh patch|minor|major [--dry-run] [--skip-npm]
#
# What it does:
#   1. Ensures clean git state on main branch
#   2. Runs tests
#   3. Bumps CLI version in package.json (single source of truth)
#   4. Syncs electron/package.json to same version
#   5. Commits, tags (v* only), pushes
#   6. Publishes to npm (unless --skip-npm)
#   7. CI handles everything else:
#      - Builds macOS (signed + notarized), Linux, Windows
#      - Publishes all assets to GitHub Releases
#      - Promotes the draft release to Latest
# ─────────────────────────────────────────────────────────

BUMP="${1:-}"
DRY_RUN=false
SKIP_NPM=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --skip-npm)  SKIP_NPM=true ;;
  esac
done

if [[ -z "$BUMP" || "$BUMP" == --* ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major> [--dry-run] [--skip-npm]"
  exit 1
fi

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Error: bump type must be patch, minor, or major (got: $BUMP)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Helpers ──
step() { echo ""; echo "── $1 ──"; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

# ── Pre-flight checks ──
step "Pre-flight checks"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Working directory is not clean. Commit or stash changes first."
fi
ok "Clean working directory"

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  warn "Not on main branch (on: $BRANCH). Continue? [y/N]"
  read -r CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || exit 1
fi
ok "On branch: $BRANCH"

echo "  Pulling latest..."
git pull --rebase
ok "Up to date with origin"

# ── Run tests ──
step "Running tests"
npm test
ok "All tests passed"

# ── Read current version ──
VERSION_OLD="$(node -p "require('./package.json').version")"

# ── Bump CLI version (single source of truth) ──
# npm version runs the "version" lifecycle script (sync-nano-version.js)
# which syncs nano-bridge.py.
step "Bumping version ($BUMP)"
npm version "$BUMP" --no-git-tag-version > /dev/null 2>&1
VERSION_NEW="$(node -p "require('./package.json').version")"
echo "  $VERSION_OLD → $VERSION_NEW"

# ── Sync Electron version to match CLI ──
cd electron
npm version "$VERSION_NEW" --no-git-tag-version --allow-same-version > /dev/null 2>&1
cd "$ROOT"
ok "Electron synced to $VERSION_NEW"

# ── Also stage nano-bridge.py if the sync script updated it ──
git add -f src/nano/nano-bridge.py 2>/dev/null || true

if $DRY_RUN; then
  step "DRY RUN — would do"
  echo "  git commit  → release: v$VERSION_NEW"
  echo "  git tag     → v$VERSION_NEW"
  echo "  git push    → origin + tags (triggers CI for all platforms)"
  [[ "$SKIP_NPM" == false ]] && echo "  npm publish → voyageai-cli@$VERSION_NEW"
  echo ""
  echo "  CI will then:"
  echo "    → Build + sign + notarize macOS"
  echo "    → Build Linux AppImage"
  echo "    → Build Windows NSIS installer"
  echo "    → Promote release to Latest"
  echo ""
  # Revert version bumps
  git checkout -- package.json package-lock.json electron/package.json electron/package-lock.json src/nano/nano-bridge.py 2>/dev/null || true
  ok "Dry run complete. No changes made."
  exit 0
fi

# ── Commit ──
step "Committing version bump"
git add package.json package-lock.json electron/package.json electron/package-lock.json src/nano/nano-bridge.py
git commit -m "release: v${VERSION_NEW}"
ok "Committed"

# ── Tag (v* format only — this is what electron-updater expects) ──
step "Tagging v${VERSION_NEW}"
git tag "v${VERSION_NEW}"
ok "Tagged"

# ── Push ──
step "Pushing to origin"
git push
git push --tags
ok "Pushed (CI will build all platforms)"

# ── Publish to npm ──
if [[ "$SKIP_NPM" == false ]]; then
  step "Publishing to npm"
  npm publish
  ok "Published voyageai-cli@${VERSION_NEW}"
else
  step "Skipping npm publish (--skip-npm)"
fi

# ── Summary ──
step "Release v${VERSION_NEW} initiated"
echo ""
echo "  ┌──────────────────────────────────────────────────┐"
echo "  │  npm:     $([ "$SKIP_NPM" == false ] && printf "✓ published" || printf "— skipped")                             │"
echo "  │  CI:      building macOS + Linux + Windows...     │"
echo "  │  Release: will auto-promote to Latest when done   │"
echo "  └──────────────────────────────────────────────────┘"
echo ""
echo "  Monitor: https://github.com/mrlynn/voyageai-cli/actions"
echo "  Release: https://github.com/mrlynn/voyageai-cli/releases/tag/v${VERSION_NEW}"
echo ""
