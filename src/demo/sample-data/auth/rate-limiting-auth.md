# Rate Limiting for Authentication

Authentication endpoints are heavily rate-limited to prevent brute-force attacks, credential stuffing, and denial-of-service attacks. Different rate limits apply to different endpoints based on security sensitivity.

## Login Rate Limits

The `/auth/login` endpoint allows 5 requests per minute per IP address. Exceeding this returns 429 Too Many Requests. After 10 failed login attempts within 30 minutes from the same IP, that IP is temporarily blocked for 60 minutes.

Failed attempts are defined as requests with invalid credentials, missing fields, or MFA failures. Successful logins reset the counter.

Failed login attempts also trigger per-account lockout. The same user account cannot attempt login more than 5 times within 10 minutes. Exceeding this locks the account for 15 minutes, during which login is impossible (even with correct credentials).

## Token and Refresh Rate Limits

The `/auth/token` endpoint (for API key auth) allows 10 requests per second per authenticated user. The `/auth/refresh` endpoint (for refresh token exchange) allows 5 requests per second.

These high limits support legitimate use cases (e.g., bulk token generation, high-concurrency services). Exceeding limits returns 429 with a `Retry-After` header indicating how long to wait.

## MFA Rate Limits

MFA verification (`/auth/mfa/verify`) allows 5 attempts per minute per session. After exceeding this, the challenge expires and the user must restart authentication.

MFA code generation (via SMS or email) is limited to 3 requests per 10 minutes. This prevents attackers from flooding users with OTP codes.

## Rate Limit Headers

All rate-limited endpoints include headers:

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1645198456
```

`X-RateLimit-Reset` is a Unix timestamp indicating when the limit window resets.

## Bypassing Rate Limits

Authenticated users with high-volume integration needs can request higher rate limits via the API dashboard. Approval requires valid business justification.

Service accounts (API key auth) bypass login rate limits entirely but remain subject to token endpoint limits.

## Progressive Delays

After a rate limit is exceeded, implement exponential backoff with jitter:

```
wait = min(100ms * (2 ^ attempt), 10s) + random(0, 1000ms)
```

This ensures distributed retry patterns that don't cause thundering herd problems.

## Geographic Rate Limiting

The platform tracks geographic patterns. Login attempts from many countries in a short period trigger additional verification (email confirmation, CAPTCHA). This is transparent to legitimate users but blocks distributed brute-force attacks.

## Monitoring and Alerts

Applications should monitor rate limit responses and alert on unusual patterns:
- Sudden spike in 429 responses from a single user
- Login attempts from geographic anomalies
- Repeated MFA failures before account lockout

Set up webhooks to receive notifications of potential security incidents:

```
POST /webhooks/security/suspicious_auth
Payload: {"event": "brute_force_attempt", "ip": "...", "timestamp": "..."}
```
