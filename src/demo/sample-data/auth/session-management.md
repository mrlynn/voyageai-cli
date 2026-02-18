# Session Management

Sessions represent authenticated user interactions with the platform. The session management system handles login, logout, timeout, and concurrent session limits to balance user experience with security.

## Creating Sessions

Sessions are created via `POST /auth/login` with username and password. On success, the platform returns an `access_token` and `refresh_token`. For multi-tenant applications, specify the `organization_id` parameter to indicate which workspace you're logging into.

```
POST /auth/login
{"email": "user@example.com", "password": "...", "organization_id": "org_123"}
```

Sessions are cryptographically tied to the client's IP address and User-Agent by default. If either changes significantly, the session becomes invalid and requires re-authentication. This prevents session hijacking if a token is stolen.

## Session Lifecycle

Sessions remain active for 24 hours. For longer-lived applications, use refresh tokens to extend sessions without re-authentication. Refresh tokens last 30 days and can be exchanged for new access/refresh token pairs multiple times.

Refresh tokens are rotation-required: calling `/auth/refresh` invalidates the old refresh token and issues a new one. This enforces the most-recent-token-wins model, detecting if stolen tokens are reused.

## Concurrent Sessions

By default, users can maintain up to 5 concurrent sessions across different devices and browsers. Exceeding this limit forces the oldest session to logout. The `GET /auth/sessions` endpoint lists all active sessions with device info and last-accessed timestamps.

Users can manually terminate sessions via `DELETE /auth/sessions/:session_id` or log out all sessions at once. Administrative revocation via `/admin/sessions/:user_id` revokes all user sessions immediately.

## Session Timeout and Idle Expiration

Sessions timeout after 24 hours of elapsed time regardless of activity. For additional security, configure idle timeout (default: 30 minutes). If no API requests are made within the idle window, the next request returns 401 Unauthorized.

Idle timeout is reset on every request. To avoid disrupting long-running operations, clients can heartbeat the session via `POST /auth/heartbeat` without consuming API quota.

## Logout and Cleanup

Logout via `POST /auth/logout`, which revokes the current session and invalidates the access token. Any outstanding refresh tokens become invalid within 5 minutes as revocation propagates through the cluster.

For security-critical scenarios (e.g., password change, account compromise), call `POST /auth/logout-all` to terminate all active sessions immediately.
