#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# vai release script
#
# Usage:
#   ./scripts/release.sh patch|minor|major [--dry-run] [--skip-npm] [--skip-mac]
#
# What it does:
#   1. Ensures clean git state on main branch
#   2. Runs tests
#   3. Bumps CLI version in package.json (single source of truth)
#   4. Syncs electron/package.json to same version
#   5. Commits, tags (v* only), pushes
#   6. Publishes to npm (unless --skip-npm)
#   7. v* tag push triggers CI → builds Linux + Windows
#   8. Builds + signs + notarizes macOS locally (unless --skip-mac)
#   9. Promotes draft release to Latest
#
# IMPORTANT: macOS build must happen AFTER CI creates the draft
# release, so all platform assets land on the same release.
# ─────────────────────────────────────────────────────────

BUMP="${1:-}"
DRY_RUN=false
SKIP_NPM=false
SKIP_MAC=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --skip-npm)  SKIP_NPM=true ;;
    --skip-mac)  SKIP_MAC=true ;;
    --skip-app)  SKIP_MAC=true ;;  # legacy alias
  esac
done

if [[ -z "$BUMP" || "$BUMP" == --* ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major> [--dry-run] [--skip-npm] [--skip-mac]"
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
  echo "  git push    → origin + tags (triggers CI for Linux/Windows)"
  [[ "$SKIP_NPM" == false ]] && echo "  npm publish → voyageai-cli@$VERSION_NEW"
  [[ "$SKIP_MAC" == false ]] && echo "  build:mac   → sign, notarize, upload macOS DMG + ZIP"
  echo "  gh release  → promote draft to Latest"
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
ok "Pushed (CI will now build Linux + Windows)"

# ── Publish to npm ──
if [[ "$SKIP_NPM" == false ]]; then
  step "Publishing to npm"
  npm publish
  ok "Published voyageai-cli@${VERSION_NEW}"
else
  step "Skipping npm publish (--skip-npm)"
fi

# ── Wait for CI to create the draft release ──
if [[ "$SKIP_MAC" == false ]]; then
  step "Waiting for CI to create draft release"
  echo "  CI builds Linux + Windows and publishes to GitHub Releases."
  echo "  Waiting for the release to appear (this may take a few minutes)..."

  RELEASE_READY=false
  for i in $(seq 1 30); do
    if gh release view "v${VERSION_NEW}" --json isDraft &>/dev/null; then
      RELEASE_READY=true
      ok "Release v${VERSION_NEW} found on GitHub"
      break
    fi
    printf "  Waiting... (%d/30)\r" "$i"
    sleep 10
  done

  if [[ "$RELEASE_READY" == false ]]; then
    warn "Release not found after 5 minutes."
    echo "  CI may still be running. You can build macOS manually later:"
    echo "    cd electron && npm run build:mac"
    echo "    gh release edit v${VERSION_NEW} --draft=false --latest"
    echo ""
    echo "  Monitor CI: https://github.com/mrlynn/voyageai-cli/actions"
    exit 1
  fi

  # ── Build macOS locally ──
  step "Building macOS (sign + notarize + publish)"
  echo "  This will sign with your Apple Developer cert,"
  echo "  notarize via notarytool, and upload to the release."
  cd electron
  npm run build:mac
  cd "$ROOT"
  ok "macOS DMG + ZIP published to release"
fi

# ── Promote draft → Latest ──
step "Promoting release to Latest"
gh release edit "v${VERSION_NEW}" \
  --draft=false \
  --latest \
  --title "Vai v${VERSION_NEW}"
ok "Release v${VERSION_NEW} is now Latest"

# ── Verify update manifest ──
step "Verifying auto-update manifests"
MANIFEST_OK=true
for MANIFEST in latest-mac.yml latest.yml latest-linux.yml; do
  URL="https://github.com/mrlynn/voyageai-cli/releases/download/v${VERSION_NEW}/${MANIFEST}"
  if curl -sfL "$URL" | grep -q "version: ${VERSION_NEW}" 2>/dev/null; then
    ok "$MANIFEST → v${VERSION_NEW}"
  else
    warn "$MANIFEST not found or version mismatch (may need a moment to propagate)"
    MANIFEST_OK=false
  fi
done

# ── Summary ──
step "Release complete: v${VERSION_NEW}"
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  npm:      $([ "$SKIP_NPM" == false ] && printf "✓ published" || printf "— skipped")                        │"
echo "  │  macOS:    $([ "$SKIP_MAC" == false ] && printf "✓ signed + notarized" || printf "— skipped")               │"
echo "  │  Linux:    ✓ built via CI                    │"
echo "  │  Windows:  ✓ built via CI                    │"
echo "  │  Release:  ✓ promoted to Latest              │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo "  Release: https://github.com/mrlynn/voyageai-cli/releases/tag/v${VERSION_NEW}"
echo "  Actions: https://github.com/mrlynn/voyageai-cli/actions"
if [[ "$MANIFEST_OK" == false ]]; then
  echo ""
  warn "Some update manifests may not be ready yet."
  echo "  Re-check: curl -sL https://github.com/mrlynn/voyageai-cli/releases/download/v${VERSION_NEW}/latest-mac.yml"
fi
echo ""
