# Token Expiry

All authentication tokens have a finite lifetime. Understanding token expiry behavior is critical for building resilient applications that handle token refresh and re-authentication gracefully.

## Access Token Expiry

Access tokens (JWT tokens used for API requests) expire after a configurable duration, defaulting to 15 minutes. Expired tokens are rejected with a 401 Unauthorized response.

Expiry is encoded in the JWT's `exp` claim (Unix timestamp). Applications can inspect this locally without server calls. When `current_time > exp`, the token is expired.

Request a token with a custom lifetime via the `ttl_seconds` parameter:

```
POST /auth/token
{"ttl_seconds": 3600}  // 1-hour lifetime
```

Maximum TTL is 24 hours for security reasons. Requesting TTL beyond this returns a 400 Bad Request error.

## Refresh Token Expiry

Refresh tokens last 30 days by default. After expiry, users must re-authenticate fully. Refresh token expiry can be customized per organization (range: 7–90 days).

Refresh tokens are rotation-required. Each call to `/auth/refresh` returns a new refresh token with a fresh 30-day expiry. The old refresh token immediately becomes invalid.

## Token Expiry Responses

Expired access tokens return:
```
401 Unauthorized
{"error": "token_expired", "expires_at": 1234567890}
```

Expired refresh tokens return:
```
401 Unauthorized
{"error": "refresh_token_expired", "expires_at": 1234567890}
```

The `expires_at` field tells clients the exact time expiry occurred, useful for debugging and auditing.

## Handling Expiry in Applications

Applications should:
1. Check token expiry before each request (using the JWT `exp` claim)
2. If expired, call `/auth/refresh` to get a new access token
3. If refresh token is also expired, re-authenticate via login

This approach avoids unnecessary 401 errors. However, always handle 401 gracefully—network timing can cause valid tokens to expire just after checking.

## Sliding Window Expiry

For long-lived user sessions, configure sliding window expiry. Each API request resets the token's expiry timer, automatically extending sessions for active users.

Enable sliding window via organization settings. With this enabled, tokens expire 15 minutes after the *last* request, not the issuance time.

## Clock Skew Tolerance

The platform tolerates up to 60 seconds of clock skew between client and server. Tokens expiring within the next 60 seconds are still accepted with a deprecation warning header:

```
X-Token-Expires-Soon: true
```

This grace period allows graceful handling of minor time synchronization issues. Applications should refresh tokens when this header appears.

## Revoking Before Expiry

Tokens can be explicitly revoked before their expiry time via `POST /auth/revoke`. This is useful for logout, password change, or security incidents. Revoked tokens are added to a denylist and immediately rejected.
