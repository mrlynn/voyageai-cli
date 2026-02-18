# SDK Versioning

All official SDKs follow semantic versioning (MAJOR.MINOR.PATCH) aligned with API versions. Understanding versioning ensures smooth upgrades and backwards compatibility.

## Semantic Versioning

SDKs follow SemVer: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes and security patches

Example: `2.3.5`
- Major version: 2 (aligns with API v2)
- Minor version: 3 (features added)
- Patch version: 5 (bug fixes)

## API Version Alignment

SDK major versions align with API major versions:

| API Version | SDK Version | Status | Support Until |
|-------------|-------------|--------|----------------|
| v1          | 1.x         | Deprecated | 2026-01-01 |
| v2          | 2.x         | Current    | 2028-01-01 |

Use SDK v2.x with API v2. SDK v1.x is no longer recommended.

## Breaking Changes

Major version upgrades may include breaking changes:

**v1 to v2 changes:**
- SDK initialization syntax changed
- Some method names updated
- Response structure modifications
- Removed deprecated features

Read the migration guide before upgrading.

## Backwards Compatibility

Minor and patch versions are backwards compatible. You can safely upgrade:

- `2.0.0` → `2.5.3` (safe)
- `2.3.0` → `2.3.5` (safe)
- `2.0.0` → `3.0.0` (breaking, requires code changes)

## Managing SDK Versions

### Node.js / NPM

Specify in `package.json`:

```json
{
  "dependencies": {
    "@saasplatform/sdk": "^2.3.0"
  }
}
```

- `^2.3.0` - Allows 2.3.0 to <3.0.0 (safe)
- `~2.3.0` - Allows 2.3.0 to <2.4.0 (conservative)
- `2.3.0` - Exactly version 2.3.0 (pinned)

Recommended: Use `^` for active projects.

### Python

In `requirements.txt`:

```
saasplatform-sdk>=2.3,<3.0
```

Or `setup.py`:

```python
install_requires=[
  'saasplatform-sdk>=2.3,<3.0'
]
```

### Java / Maven

In `pom.xml`:

```xml
<dependency>
  <groupId>com.saasplatform</groupId>
  <artifactId>sdk-java</artifactId>
  <version>[2.3,3.0)</version>
</dependency>
```

### Go

Using `go.mod`:

```
require github.com/saasplatform/sdk-go v2.3.0
```

Or import the latest:

```bash
go get github.com/saasplatform/sdk-go@latest
```

## Release Schedule

- **Major versions**: Every 1-2 years (breaking changes)
- **Minor versions**: Monthly (new features)
- **Patch versions**: As needed (bug fixes, security)

Check [release notes](https://github.com/saasplatform/sdk-*/releases) for details.

## Deprecation Notices

When features are deprecated, they remain in SDK for 2+ minor versions:

```javascript
// Example: Deprecated method in v2.5
const data = client.oldMethod();  // Logs warning in console
// "Warning: oldMethod is deprecated since v2.5, use newMethod instead"
```

Deprecation warnings include:
- When the feature was deprecated
- What to use instead
- Link to migration guide

## Pre-Release Versions

Beta features use pre-release tags:

```
2.4.0-beta.1
2.4.0-beta.2
2.4.0-rc.1
2.4.0
```

Install betas explicitly:

```bash
npm install @saasplatform/sdk@2.4.0-beta.1
```

Avoid using pre-release versions in production.

## Security Patches

Critical security issues receive patches across active versions:

```
v1.9.5 - Security patch
v2.0.8 - Security patch
v2.3.2 - Security patch
```

Upgrade patch versions immediately when security patches are released.

## Version Checking

Check your SDK version at runtime:

**JavaScript:**

```javascript
console.log(require('@saasplatform/sdk').version);
```

**Python:**

```python
import saasplatform
print(saasplatform.__version__)
```

**Java:**

```java
import com.saasplatform.sdk.Version;
System.out.println(Version.get());
```

## Upgrading SDKs

### Minor Version Upgrades (Safe)

```bash
npm install @saasplatform/sdk@latest  # Safe upgrade
```

No code changes required; new features are additive.

### Major Version Upgrades (Breaking)

1. Read the migration guide
2. Review breaking changes
3. Update code as needed
4. Test thoroughly
5. Deploy

Example migration from v1 to v2:

```javascript
// v1
const client = SaasPlatform('sk_live_abc123');

// v2
const client = new SaasPlatform.Client({
  apiKey: 'sk_live_abc123'
});
```

## Checking for Outdated Versions

**Node.js:**

```bash
npm outdated
npm audit  # Security vulnerabilities
```

**Python:**

```bash
pip list --outdated
pip-audit  # Security check
```

## Long-Term Support (LTS)

Currently no designated LTS versions. All active versions receive updates.

In the future, LTS versions will receive extended support (3+ years).

## Deprecation Policy

SDK features are deprecated following this process:

1. **Deprecation notice**: Warning in documentation and logs
2. **Support period**: 6+ months for migration
3. **Removal**: Feature removed in next major version

This ensures sufficient time for applications to migrate.
