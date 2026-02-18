# API Key Rotation

Regular API key rotation is essential for maintaining security, especially in production environments where keys may be exposed through logs, credentials dumps, or developer machines. The rotation process is designed to be zero-downtime.

## Rotation Strategy

Implement a rolling rotation where new keys are generated and deployed before old keys are revoked. This prevents outages if key updates are delayed in production.

The recommended approach:
1. Generate a new API key in the dashboard
2. Update application configuration and deploy
3. Monitor logs to ensure all requests use the new key
4. After 24 hours, revoke the old key
5. Verify no 401 errors spike in error tracking

## Automated Rotation

The platform supports scheduled key rotation via the automation API. Enable auto-rotation in settings to automatically generate new keys every 90 days.

```
POST /admin/keys/rotation/enable
{"interval_days": 90, "keep_previous": true}
```

With `keep_previous: true`, the two most recent keys remain valid simultaneously, allowing graceful migration across services.

## Key Versions

All API keys have an associated version field. When a key is rotated, the version increments. Log entries include the key version that made the request, allowing you to audit which key authenticated each operation.

Query the audit log to see key usage patterns:

```
GET /admin/audit-logs?key_version=2&start_date=2026-01-01
```

## Emergency Revocation

If a key is compromised, revoke it immediately via `DELETE /admin/keys/{key_id}`. Revocation is instant—requests using that key return 401 Unauthorized within seconds.

For critical incidents, disable all keys for a user via `/admin/users/{user_id}/keys/disable`. This forces a complete re-authentication flow and key regeneration.

## Monitoring Rotation

Set up alerts for:
- Key access patterns changing unexpectedly
- Multiple failed 401s from a single IP (possible rotation failure)
- Keys unused for >7 days (possible stale deployment)

The dashboard displays last-used timestamps for each key. Keys unused for 30 days are flagged as "potentially stale."

## Compliance and Auditing

Key rotation is recorded in the organization's audit log. Track rotation events to demonstrate compliance with security policies (SOC 2, ISO 27001, etc.).

Export audit logs via `GET /admin/audit-logs?type=key_rotation` for compliance reporting. Each rotation entry includes timestamp, old key fingerprint, new key fingerprint, and rotated-by user.

## Integration with Secrets Managers

Use CI/CD integration to automatically update secrets in HashiCorp Vault, AWS Secrets Manager, or similar systems when keys rotate. The platform provides webhooks to notify external systems of key rotation events.

```
POST /webhooks/key_rotation
Payload: {"old_key": "...", "new_key": "...", "timestamp": "..."}
```
