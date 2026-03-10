# Releasing Vai

## Architecture

Vai ships as both an **npm CLI** (`voyageai-cli`) and an **Electron desktop app** (`Vai`).

All platforms are built in **GitHub Actions CI** on `v*` tag push:

| Platform | Runner | Signed? | Notarized? |
|----------|--------|---------|------------|
| macOS    | `macos-latest` | Yes — Apple Developer cert from GitHub Secrets | Yes |
| Linux    | `ubuntu-latest` | No | n/a |
| Windows  | `windows-latest` | No | n/a |

CI publishes all assets to the same GitHub Release, then promotes it to **Latest**.

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
```

### What happens

1. Pre-flight: clean git state, on `main`, pulls latest
2. Runs `npm test`
3. Bumps version in `package.json` + syncs to `electron/package.json` + `nano-bridge.py`
4. Commits: `release: v1.x.x`
5. Tags: `v1.x.x`
6. Pushes commit + tag to origin
7. Publishes to npm
8. **CI takes over:**
   - Builds macOS (imports cert, signs, notarizes, uploads DMG + ZIP)
   - Builds Linux (AppImage)
   - Builds Windows (NSIS installer)
   - Promotes the draft release to **Latest**

## GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Apple Developer Team ID (`YZ36Z8GSEN`) |

## Manual Recovery

If CI fails partway through:

```bash
# Re-run just the failed job from GitHub Actions UI, or:
gh workflow run release-desktop.yml

# If the release exists but isn't promoted:
gh release edit v1.x.x --draft=false --latest --title "Vai v1.x.x"
```

## Important Rules

1. **Never push `app-v*` tags** — deprecated, blocked by pre-push hook
2. **`electron-builder` is pinned at `24.13.3`** — v25 breaks notarization
3. **`notarize: false` in electron-builder config is intentional** — prevents double-notarization; the `afterSign` hook handles it

## Key Files

| File | Purpose |
|------|---------|
| `scripts/release.sh` | Release orchestration script |
| `electron/package.json` | electron-builder config, version, publish settings |
| `electron/scripts/notarize.cjs` | afterSign notarization hook |
| `electron/build/entitlements.mac.plist` | Hardened runtime entitlements for macOS |
| `.github/workflows/release-desktop.yml` | CI: builds all platforms on `v*` tag push |
| `.github/workflows/ci.yml` | CI: runs tests on all pushes |

## Troubleshooting

### Auto-update not working
- Release must be tagged `v*` (not `app-v*`)
- Release must be marked **Latest** (not Draft)
- Check `latest-mac.yml` in release assets has the correct version

### CI macOS build fails
- Verify GitHub Secrets are set (Settings → Secrets → Actions)
- Check the Apple Developer cert hasn't expired
- Confirm the app-specific password is still valid at appleid.apple.com

### electron-builder notarization fails
- Ensure `electron-builder` is at `24.13.3` (not v25+)
- The `notarize: false` in `electron/package.json` is required — do not remove it
