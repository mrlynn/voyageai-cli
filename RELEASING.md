# Releasing Vai

## Architecture

Vai ships as both an **npm CLI** (`voyageai-cli`) and an **Electron desktop app** (`Vai`).

| Platform | Built where | Signed? | Published to |
|----------|------------|---------|--------------|
| npm CLI  | Local      | n/a     | npmjs.com    |
| macOS    | Local      | Yes — Apple Developer cert + notarization | GitHub Releases |
| Linux    | GitHub Actions CI | No | GitHub Releases |
| Windows  | GitHub Actions CI | No | GitHub Releases |

All Electron builds publish to the **same GitHub Release** identified by a `v*` tag (e.g., `v1.33.0`).

## Version Source of Truth

`package.json` (root) is the single source of truth. The release script syncs:
- `electron/package.json` — Electron app version
- `src/nano/nano-bridge.py` — Python nano-bridge version (via `scripts/sync-nano-version.js`)

## Cutting a Release

```bash
# One command does everything:
npm run release -- patch    # or minor | major

# Options:
npm run release -- patch --dry-run     # Preview without changes
npm run release -- patch --skip-npm    # Skip npm publish
npm run release -- patch --skip-mac    # Skip local macOS build
```

### What the script does (in order)

1. Pre-flight: clean git state, on `main`, pulls latest
2. Runs `npm test`
3. Bumps version in `package.json` + syncs to `electron/package.json` + `nano-bridge.py`
4. Commits: `release: v1.x.x`
5. Tags: `v1.x.x` (this triggers CI)
6. Pushes commit + tag to origin
7. Publishes to npm
8. Waits for CI to create draft release (Linux + Windows builds)
9. Builds macOS locally (signs with Apple cert, notarizes, uploads to release)
10. Promotes the draft release to **Latest**
11. Verifies auto-update manifests (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`)

## Manual Recovery

If the script fails partway through, you can finish manually:

```bash
# Build and publish macOS (signs + notarizes + uploads)
cd electron && npm run build:mac

# Promote draft to Latest
gh release edit v1.x.x --draft=false --latest --title "Vai v1.x.x"

# Verify update manifests
curl -sL https://github.com/mrlynn/voyageai-cli/releases/download/v1.x.x/latest-mac.yml
```

## Important Rules

1. **Never push `app-v*` tags** — this format is deprecated and will not trigger anything useful
2. **Never run `build:mac` before pushing the tag** — electron-builder creates a draft release, and CI assets won't be in it
3. **`electron-builder` is pinned at `24.13.3`** — v25 breaks notarization. Do not upgrade without explicit testing
4. **`notarize: false` in electron-builder config is intentional** — prevents double-notarization. The `afterSign` hook handles notarization
5. **macOS builds require your local machine** — CI has no access to the Apple Developer certificate

## Key Files

| File | Purpose |
|------|---------|
| `scripts/release.sh` | Release orchestration script |
| `electron/package.json` | electron-builder config, version, publish settings |
| `electron/scripts/notarize.cjs` | afterSign notarization hook (keychain profile: `VAI_NOTARIZE`) |
| `electron/build/entitlements.mac.plist` | Hardened runtime entitlements for macOS |
| `.github/workflows/release-desktop.yml` | CI: builds Linux + Windows on `v*` tag push |
| `.github/workflows/ci.yml` | CI: runs tests on all pushes |
| `scripts/sync-nano-version.js` | Syncs nano-bridge.py version on `npm version` |

## Troubleshooting

### "damaged app" error on macOS
The DMG was not notarized. Rebuild locally with `cd electron && npm run build:mac`.

### Auto-update not working
Check that:
- The release is tagged `v*` (not `app-v*`)
- The release is marked as **Latest** (not Draft)
- `latest-mac.yml` exists in the release assets and contains the correct version

### electron-builder notarization fails
- Ensure `VAI_NOTARIZE` keychain profile exists: `xcrun notarytool store-credentials VAI_NOTARIZE`
- Verify Apple Developer cert is in your keychain
- Confirm `electron-builder` is at `24.13.3` (not v25+)
