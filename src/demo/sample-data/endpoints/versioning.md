# API Versioning

The platform uses URL-based versioning to manage API changes while maintaining backward compatibility. Major versions are breaking changes; minor versions are backward-compatible.

## Version Format

API versions follow semantic versioning in the URL: `/v{major}/`

Current version: `/v2/`
Previous version: `/v1/` (legacy, deprecated)

The version is part of the base URL: `https://api.example.com/v2/`

## Major Versions

Major versions represent breaking changes (e.g., removed endpoints, changed response format, different authentication). Old major versions are supported for 2 years before sunset.

**v1 Timeline**:
- Released: 2023-01-01
- Sunset date: 2026-01-01
- Status: Deprecated (security updates only)

**v2 Timeline**:
- Released: 2024-01-01
- Sunset date: 2028-01-01 (estimated)
- Status: Current, fully supported

Plan migrations well in advance. Sunset notifications are sent 6 months before end-of-life.

## Migrating Between Versions

Migrate by updating your base URL and reviewing breaking changes documentation.

Breaking changes in v2 vs. v1 include:
- `/v1/resources` → `/v2/resources` (same structure, but v2 has additional fields)
- Removed pagination cursors; now uses offset-based only (v1 supported both)
- Response format includes additional metadata in v2

Review the [Migration Guide](../database/migration-guide.md) for detailed changes.

## Minor Versions

Minor versions add new functionality without breaking existing behavior. The API minor version is not in the URL; instead, it's indicated by the `API-Version` header:

```
API-Version: 2.3
```

This header is informational; you don't need to specify it in requests.

New fields in responses are backward-compatible. Ignore unknown fields; they don't affect your code.

## Feature Flags (Betas)

Beta features are opt-in and available in the current version:

```
Authorization: Bearer <token>
X-Feature-Flag: beta.new_analytics_api
```

Request beta features via the dashboard. Beta features may change before general availability (GA).

## Deprecation Notices

When endpoints are deprecated, responses include a deprecation warning header:

```
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://docs.example.com/migration>; rel="deprecation"
```

Applications should log these warnings and plan migrations.

## Version Support Matrix

| Version | Released | Sunsets | Security | Features | Status |
|---------|----------|---------|----------|----------|--------|
| v1      | 2023-01  | 2026-01 | Updates  | Frozen   | Deprecated |
| v2      | 2024-01  | 2028-01 | Yes      | Yes      | Current |

## Backwards Compatibility

v2 maintains backwards compatibility by:
- Never removing fields from responses
- Adding new fields at the end
- Never removing query parameters
- Supporting both old and new behaviors where possible

This allows gradual adoption of new features.

## Environment-Specific Versions

Sandbox (`https://sandbox-api.example.com/v2/`) may have beta features not yet in production. Test new features in sandbox before using in production.

Production (`https://api.example.com/v2/`) is stable and suitable for production workloads.

## API Changelog

The changelog documents all changes per version:

- New endpoints
- Deprecated endpoints
- Breaking changes
- New fields and parameters
- Bug fixes

Subscribe to the changelog via the dashboard to receive notifications.

## Version Negotiation

For advanced use cases, request a specific version:

```
Accept-Version: 2.3
```

If the requested version isn't available, the API returns the closest compatible version and includes the actual version in the response header:

```
API-Version: 2.2
```

If you request a sunset version, the API returns 410 Gone.
