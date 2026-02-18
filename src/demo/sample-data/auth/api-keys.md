# API Keys

API keys are the simplest method for authenticating requests to the SaaS platform. They provide basic access control and are suitable for server-to-server integrations, internal tools, and development environments.

## Key Format and Rotation

API keys follow the format `sk_live_<base64>` for production and `sk_test_<base64>` for testing. Each key is associated with a specific environment and cannot be used across environments. Keys should be rotated every 90 days for security compliance, though many deployments rotate quarterly.

To create a new key, visit the API dashboard under Settings → API Keys. New keys are displayed only once—copy and store them securely in your environment configuration or secrets manager. If you lose a key, you must regenerate it, which immediately invalidates the old one.

## Key Scopes and Restrictions

By default, new keys have unrestricted access to all API endpoints for their environment. We recommend restricting keys to specific scopes when possible. Available scopes include `read`, `write`, `admin`, and service-specific scopes like `webhooks:manage` or `billing:read`.

You can set IP address restrictions for production keys. This prevents unauthorized use even if the key is compromised. Whitelist only the specific IP ranges or servers that need access.

## Key Revocation and Management

Revoked keys stop working immediately but retain their history in audit logs. Old keys remain queryable for compliance purposes but cannot authenticate new requests. When rotating keys, maintain both old and new keys in production for 24 hours to allow graceful transitions.

## Security Best Practices

Never commit API keys to version control. Use environment variables or a secrets manager like AWS Secrets Manager, HashiCorp Vault, or GitHub Secrets. For local development, store keys in a `.env.local` file and add it to `.gitignore`.

Implement key monitoring by logging all API authentication attempts and setting alerts for unusual activity. The audit log endpoint (`GET /admin/audit-logs`) returns authentication events with timestamps and IP addresses.

For additional security, consider using JWT tokens or OAuth 2.0 for public-facing applications. API keys are best suited for internal integrations where key storage is straightforward.

## Key Expiration

API keys do not automatically expire, but you can set optional expiration dates during creation. Setting a 1-year expiration enforces proactive rotation. After expiration, requests using that key return a 401 Unauthorized status.
