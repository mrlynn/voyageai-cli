# VAI: Python Component Distribution & Versioning Strategy

**Spec Version:** 1.0.0  
**Companion To:** `vai-nano-local-inference-spec.md`  
**Target Release:** v1.31.0  
**Status:** Draft

---

## Executive Summary

`voyage-4-nano` requires Python for local inference. VAI is a Node.js project distributed via npm, Electron, and (planned) Homebrew. These two ecosystems have no native integration — npm cannot install Python packages, and Python's tooling knows nothing about npm packages.

This spec defines how the Python components (`nano-bridge.py`, `requirements.txt`, the venv, and the model cache) are distributed, versioned, and kept synchronized with the JavaScript codebase across all VAI distribution channels.

**The core decision:** Python source files are shipped *inside* the npm package alongside the JavaScript. No separate Python package is published. No PyPI presence. The npm package is the single source of truth for both the JS and Python code. Python *runtime dependencies* (torch, sentence-transformers) are installed on the user's machine at setup time via `vai nano setup`, not at npm install time.

---

## 1. The Distribution Problem in Full

When a user runs `npm install -g voyageai-cli`, npm:
- Downloads the package tarball from the npm registry
- Extracts all files listed in `package.json` → `files`
- Runs any `postinstall` script defined in `package.json`
- Makes the `vai` binary available in the user's PATH

npm does **not**:
- Know what Python is
- Install pip packages
- Create virtual environments
- Download model weights

The Python components therefore split into three categories with different distribution answers:

| Component | What it is | Distribution answer |
|-----------|------------|---------------------|
| `nano-bridge.py` | ~150-line Python script | **Bundled in npm package** — it's just a text file |
| `requirements.txt` | Pinned Python deps | **Bundled in npm package** — it's just a text file |
| Python venv (`~/.vai/nano-env/`) | Installed Python packages | **Created on user machine** by `vai nano setup` |
| Model weights (`~/.vai/nano-model/`) | ~700MB HuggingFace download | **Downloaded on user machine** by `vai nano setup` |

The first two ship with VAI. The last two live on the user's machine and are never part of any package.

---

## 2. Repository Structure

The Python files live in the VAI monorepo alongside the JavaScript, in a dedicated directory:

```
voyageai-cli/
  src/
    commands/
    lib/
    nano/
      nano-bridge.py         ← Python inference bridge
      requirements.txt       ← Pinned Python dependencies
      nano-setup.js          ← Setup orchestrator (Node.js)
      nano-health.js         ← Status checker (Node.js)
  test/
    nano/
      nano-bridge.test.js    ← Bridge protocol tests (mocked subprocess)
      nano-setup.test.js     ← Setup logic tests
  package.json
```

The `src/nano/` directory is the boundary. Everything inside it is nano-specific. The Node.js files (`nano-setup.js`, `nano-health.js`) import from `src/lib/` as normal. The Python file (`nano-bridge.py`) is opaque to Node.js — it's a data file that gets spawned as a subprocess.

### What Goes in `package.json` → `files`

npm only includes files explicitly listed in the `files` array (or everything not in `.npmignore`). The nano directory must be explicitly included:

```json
{
  "files": [
    "src/",
    "bin/",
    "README.md"
  ]
}
```

Because `src/nano/` is under `src/`, it is automatically included. No special configuration needed. The Python files ship as plain text files inside the npm tarball, alongside the JavaScript.

**Verification:** After `npm pack`, confirm the Python files are present:

```bash
npm pack --dry-run | grep nano
# Should show:
# src/nano/nano-bridge.py
# src/nano/requirements.txt
# src/nano/nano-setup.js
# src/nano/nano-health.js
```

---

## 3. Versioning Strategy

This is the most important problem to solve correctly. The Python bridge and the Node.js code that calls it must stay in sync. A mismatch — where npm has updated the bridge protocol but the user's venv is running an old Python script — is a silent failure that's hard to debug.

### 3.1 Single Version Source of Truth

VAI uses a single version number (e.g., `1.31.0`) for the entire project. This version lives in `package.json` and nowhere else. Both the JavaScript and Python components are versioned together.

There is **no separate Python package version**. There is no PyPI package. The Python files are part of the `voyageai-cli` npm package.

### 3.2 The Bridge Version File

The Python bridge declares its expected version in a comment header and in a version constant:

```python
# nano-bridge.py
# Part of voyageai-cli v1.31.0
# This file is auto-updated during the release process.
# DO NOT edit the version line manually.

BRIDGE_VERSION = "1.31.0"
```

On startup, the bridge emits its version in the ready signal:

```json
{"status": "ready", "model": "voyage-4-nano", "device": "cpu", "bridge_version": "1.31.0"}
```

The Node.js bridge manager (`nano.js`) reads this version and compares it against the version in `package.json`. If they don't match, it logs a warning — but does not fail. This is a soft check, not a hard gate.

### 3.3 The Version Sync Problem: Warm Bridge Processes

The trickiest version mismatch scenario is a long-running session:

1. User installs VAI v1.31.0, runs `vai nano setup`
2. User runs `vai embed --local` — bridge starts, stays warm
3. User upgrades VAI to v1.32.0 via `npm update -g voyageai-cli`
4. The old bridge process is still running in the background
5. User runs `vai embed --local` again — old bridge, new caller

The Node.js side handles this by checking the version in the ready signal on every new session start. When a version mismatch is detected, the old process is killed and a new one is spawned from the updated `nano-bridge.py`.

**Process warm detection logic:**

```javascript
// In nano.js
async function ensureBridgeReady() {
  if (warmProcess) {
    // check if the running process version matches current package version
    if (warmProcess.bridgeVersion !== currentPackageVersion()) {
      logger.debug('Bridge version mismatch, respawning...');
      shutdownBridge();
    } else {
      return warmProcess;
    }
  }
  return spawnBridge();
}
```

### 3.4 The Venv Version Problem: `vai nano setup` on Upgrade

When a user upgrades VAI, the venv at `~/.vai/nano-env/` still has the old Python packages. In most cases this is fine — `requirements.txt` uses compatible ranges, not exact pins, so a patch upgrade won't require a venv rebuild.

However, minor and major version bumps to `requirements.txt` require a venv rebuild. VAI handles this by storing the VAI version that created the venv:

```
~/.vai/
  nano-env/           ← Python virtual environment
  nano-model/         ← HuggingFace model cache
  nano-env-version    ← Plain text file: "1.31.0"
```

On every `vai embed --local` invocation, `nano.js` reads `~/.vai/nano-env-version` and compares it to the current package version. If the minor or major version has changed, it prompts the user:

```
⚠  voyage-4-nano environment is out of date (env: 1.31.0, vai: 1.32.0).
   Run 'vai nano setup' to update your local inference environment.
   Your existing MongoDB collections are unaffected.
```

The user must explicitly run `vai nano setup` to rebuild. VAI never silently rebuilds the venv — it could take several minutes, and doing it without consent in the middle of a `vai pipeline` run would be surprising.

### 3.5 Version Compatibility Matrix

VAI maintains a simple compatibility table in `src/nano/nano-setup.js`:

```javascript
// Venv built with VAI version X is compatible with VAI versions Y
// Minor version bumps require rebuild. Patch bumps do not.
function isVenvCompatible(venvVersion, currentVersion) {
  const venv = semver.parse(venvVersion);
  const current = semver.parse(currentVersion);
  return venv.major === current.major && venv.minor === current.minor;
}
```

Patch releases (`1.31.0` → `1.31.1`) never require a venv rebuild. Minor releases (`1.31.x` → `1.32.0`) may require one. Major releases (`1.x` → `2.0.0`) always require one.

---

## 4. The `postinstall` Question

npm supports a `postinstall` script that runs automatically after `npm install`. It's tempting to run `vai nano setup` here. **This would be a mistake.**

Reasons not to auto-setup at install time:
- Most VAI users will never use `--local`. Running a 700MB model download for everyone is wrong.
- `postinstall` runs in environments where user interaction is not possible (CI, Docker, automated deploys).
- The download takes minutes. Blocking `npm install` is a terrible UX.
- Electron and Homebrew have their own install hooks; a `postinstall` in `package.json` doesn't map cleanly.

The correct approach: `postinstall` does nothing for nano. Setup is always explicit via `vai nano setup`. The `--local` flag on all commands checks status first and prints a clear message if setup hasn't been run:

```
voyage-4-nano is not set up for local inference.
Run 'vai nano setup' to get started (downloads ~700MB, takes ~5 minutes).
```

---

## 5. Distribution Channel Analysis

### 5.1 npm Global Install (`npm install -g voyageai-cli`)

**File delivery:** `src/nano/nano-bridge.py` and `src/nano/requirements.txt` land in the global npm prefix alongside the JavaScript. On macOS this is typically `/usr/local/lib/node_modules/voyageai-cli/src/nano/`.

**Python files location at runtime:**

```javascript
// nano.js resolves the bridge script relative to its own location
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const BRIDGE_SCRIPT = join(__dirname, 'nano-bridge.py');
export const REQUIREMENTS_FILE = join(__dirname, 'requirements.txt');
```

This path is always correct regardless of where npm installs the global package, because it's relative to the module file itself, not to a hardcoded path.

**Venv and model cache:** Always at `~/.vai/nano-env/` and `~/.vai/nano-model/` — in the user's home directory, never in the npm prefix. This means the user doesn't lose their model cache when upgrading or reinstalling the npm package.

**Upgrade path:**
```bash
npm update -g voyageai-cli   # updates JS + Python source files
vai nano setup               # rebuilds venv if minor/major bump (prompted by vai)
# model cache is unaffected — no re-download needed
```

### 5.2 Electron Desktop App

The Electron app bundles the entire npm package (via `electron-builder`). The Python source files at `src/nano/` are included in the app bundle automatically, since they're part of the npm package files.

**Key difference from npm global:** The Python files live inside the `.app` bundle on macOS (e.g., `Electron.app/Contents/Resources/app.asar/src/nano/`). The `app.asar` archive is read-only. This matters because the bridge script path resolution must still work — and it does, because `__dirname` in Electron correctly resolves to the path inside the asar.

**Venv location in Electron:** Same as npm — `~/.vai/nano-env/`. The Electron app and the CLI global install share the same venv and model cache. A user who has done `vai nano setup` via the CLI doesn't need to redo it for the Electron app.

**Python detection in Electron:** The Electron app cannot rely on the system PATH being populated the same way a terminal shell would. `nano-setup.js` must use an explicit Python search that works in a non-shell process context:

```javascript
// In Electron context, PATH may be minimal. Search known locations explicitly.
const PYTHON_SEARCH_PATHS = [
  process.env.VAI_PYTHON,
  '/usr/bin/python3',
  '/usr/local/bin/python3',
  '/opt/homebrew/bin/python3',    // Apple Silicon Homebrew
  '/usr/local/opt/python3/bin/python3',  // Intel Homebrew
  // Windows paths added in Phase 2
];
```

**Version sync in Electron:** The Electron app version (from `package.json`) is the same as the npm package version. Same logic applies. No special handling needed.

### 5.3 Homebrew Tap (Planned)

A Homebrew formula wraps the npm global install:

```ruby
# Formula/voyageai-cli.rb
class VoyageaiCli < Formula
  desc "Toolkit for Voyage AI embeddings and MongoDB Atlas Vector Search"
  homepage "https://github.com/mrlynn/voyageai-cli"
  url "https://registry.npmjs.org/voyageai-cli/-/voyageai-cli-1.31.0.tgz"
  sha256 "..."
  
  depends_on "node"
  # Note: Python is NOT listed as a Homebrew dependency.
  # Python is optional — only needed for local nano inference.
  # Users who want local inference are directed to vai nano setup.
  
  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end
  
  test do
    system "#{bin}/vai", "version"
  end
end
```

**Why Python is not a Homebrew dependency:** Making Python a required Homebrew dependency would force every Homebrew user to install Python even if they never use `--local`. Since local inference is an optional feature, the Homebrew formula should not mandate it. The `vai nano setup` command handles the Python bootstrap independently.

**Formula updates:** When VAI releases v1.32.0, the Homebrew formula is updated to point to the new npm tarball. The Python source files inside that tarball are automatically updated. No separate formula changes are needed for Python-only changes (e.g., a `requirements.txt` update) as long as the npm version bumps.

### 5.4 Docker (Planned)

Docker is the one distribution channel where bundling Python makes sense. The Dockerfile can install Python, create the venv, and download the model at image build time, producing a ready-to-use image with no user setup required.

```dockerfile
FROM node:22-slim

# Install Python for local nano inference
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install VAI
RUN npm install -g voyageai-cli

# Set up nano inference environment
# This runs at IMAGE BUILD time, not container start time
RUN vai nano setup --quiet

# The model cache is large — consider using a volume mount
# or a separate base image for the model
VOLUME ["/root/.vai/nano-model"]

CMD ["vai"]
```

**Model cache as a Docker volume:** The model weights (~700MB) should be mounted as a volume rather than baked into every image layer. This keeps image sizes manageable and allows the model to be shared across container versions.

```yaml
# docker-compose.yml
services:
  vai:
    image: voyageai-cli:latest
    volumes:
      - nano-model:/root/.vai/nano-model
    environment:
      - VOYAGE_API_KEY=${VOYAGE_API_KEY}
      - MONGODB_URI=${MONGODB_URI}

volumes:
  nano-model:
```

---

## 6. Release Process Integration

The release process for VAI is currently: bump version in `package.json` → tag → CI publishes to npm. The nano integration adds one step:

### 6.1 Updated Release Checklist

```
1. Bump version in package.json (e.g., 1.31.0 → 1.32.0)
2. Update BRIDGE_VERSION in src/nano/nano-bridge.py to match  ← NEW
3. Run: npm run test (includes nano unit tests)
4. Run: npm pack --dry-run | grep nano  ← verify Python files included
5. Tag release: git tag v1.32.0
6. CI: npm publish
7. Update Homebrew formula (if Homebrew tap is active)
8. Build Electron release artifacts
```

### 6.2 Automated Bridge Version Sync

To prevent human error in step 2, a pre-release script automatically updates `BRIDGE_VERSION` in `nano-bridge.py` to match `package.json`:

```javascript
// scripts/sync-nano-version.js
// Run as part of: npm run version-bump
import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const bridgePath = 'src/nano/nano-bridge.py';
let bridge = readFileSync(bridgePath, 'utf8');

bridge = bridge.replace(
  /BRIDGE_VERSION = "[^"]+"/,
  `BRIDGE_VERSION = "${pkg.version}"`
);

bridge = bridge.replace(
  /# Part of voyageai-cli v[^\n]+/,
  `# Part of voyageai-cli v${pkg.version}`
);

writeFileSync(bridgePath, bridge);
console.log(`✓ nano-bridge.py synced to v${pkg.version}`);
```

Add to `package.json`:
```json
{
  "scripts": {
    "version": "node scripts/sync-nano-version.js && git add src/nano/nano-bridge.py"
  }
}
```

The `version` script in npm runs automatically when `npm version` is used to bump the version, before the git commit is made. This means the bridge version is always in sync at the moment of tagging.

### 6.3 CI Verification

Add a CI job that confirms the Python files are in the published package:

```yaml
# .github/workflows/ci.yml
- name: Verify nano files in package
  run: |
    npm pack --dry-run 2>&1 | grep -E "src/nano/(nano-bridge\.py|requirements\.txt)"
    if [ $? -ne 0 ]; then
      echo "ERROR: Python files missing from npm package"
      exit 1
    fi

- name: Verify bridge version matches package.json
  run: |
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    BRIDGE_VERSION=$(grep 'BRIDGE_VERSION = ' src/nano/nano-bridge.py | grep -oP '"[^"]+"' | tr -d '"')
    if [ "$PACKAGE_VERSION" != "$BRIDGE_VERSION" ]; then
      echo "ERROR: Bridge version ($BRIDGE_VERSION) does not match package.json ($PACKAGE_VERSION)"
      exit 1
    fi
```

---

## 7. Dependency Pinning Philosophy

`requirements.txt` uses compatible-release pins (`~=`), not exact pins. This is a deliberate choice:

```
# src/nano/requirements.txt
sentence-transformers~=3.0
torch~=2.0
transformers~=4.40
huggingface_hub~=0.23
numpy~=1.24
```

**Why compatible-release, not exact pins (`==`):**
- Exact pins would break for users who have conflicting packages in their system Python
- The venv is isolated, but pip still resolves transitive dependencies
- Compatible-release (`~=3.0` means `>=3.0, <4.0`) gives pip room to satisfy constraints while preventing breaking changes

**Why not a `requirements.lock` file:**
- A lockfile would require updating on every Python ecosystem security patch
- The VAI maintainer (solo) would need to regularly regenerate it across platforms
- The compatible-range approach is an acceptable tradeoff for a dev-tool use case

**When exact pins are added:** If a specific torch or sentence-transformers version introduces a regression with voyage-4-nano, the affected package is exact-pinned until the upstream issue is resolved. This is documented with a comment in `requirements.txt`:

```
# Pinned at 2.1.x due to MPS regression in 2.2.0 — revisit after torch 2.3.0
torch~=2.1
```

---

## 8. What Is Never Published to npm

These items must never appear in the npm package tarball:

| Item | Reason |
|------|--------|
| `~/.vai/nano-env/` | User's local venv — lives in home directory, not repo |
| `~/.vai/nano-model/` | 700MB model weights — never in source control or npm |
| `*.pyc` / `__pycache__/` | Python bytecode — add to `.npmignore` |
| `.pytest_cache/` | Test artifacts |
| Any HuggingFace token or API key | Security |

Add to `.npmignore`:
```
**/__pycache__/
**/*.pyc
.pytest_cache/
*.egg-info/
```

---

## 9. Summary: Single-Sentence Answers

| Question | Answer |
|----------|--------|
| Where does `nano-bridge.py` live in the repo? | `src/nano/nano-bridge.py` |
| How does it reach the user? | As a plain file inside the npm tarball |
| Is there a PyPI package? | No |
| How are Python *runtime* deps installed? | `vai nano setup` creates a venv at `~/.vai/nano-env/` |
| Where is the model cache? | `~/.vai/nano-model/` — never in any package |
| How are Python and JS versions kept in sync? | `BRIDGE_VERSION` in the bridge file, auto-synced by `npm version` hook |
| What happens when VAI upgrades? | JS + Python source updated; venv rebuilt only on minor/major version bump |
| Does the Electron app need separate handling? | No — same Python files, same venv location, same model cache |
| Does Homebrew need Python as a dependency? | No — local inference is opt-in |
| Does Docker handle it differently? | Yes — setup runs at image build time for a ready-to-use container |