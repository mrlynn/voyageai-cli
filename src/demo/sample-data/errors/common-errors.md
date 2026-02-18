# Common Errors and Solutions

Reference guide for frequently encountered errors and their resolutions.

## 401 Unauthorized

**Cause**: Missing or invalid authentication token.

**Solutions**:
1. Check Authorization header: `Authorization: Bearer <token>`
2. Verify token hasn't expired: Check JWT `exp` claim
3. Refresh token if expired: `POST /auth/refresh`
4. For API keys, verify format: `Authorization: Bearer sk_live_abc123`

**Example**:
```
❌ Missing Authorization header
curl https://api.example.com/users

✅ Include token
curl -H "Authorization: Bearer eyJhbGc..." https://api.example.com/users
```

## 403 Forbidden

**Cause**: Authenticated but insufficient permissions (scopes).

**Solutions**:
1. Check required scopes in error response
2. Request new token with broader scopes
3. For OAuth, re-authorize with additional scopes
4. Verify user's role/organization

**Example**:
```json
{
  "error": "insufficient_scope",
  "required_scopes": ["admin:users"],
  "provided_scopes": ["users:read"]
}
```

Obtain broader scopes via login with `scope=admin:users+users:read`.

## 404 Not Found

**Cause**: Resource doesn't exist.

**Solutions**:
1. Verify resource ID is correct
2. Check if resource was deleted
3. Verify user has access to resource (authorization)
4. For organizations, ensure correct org_id

**Example**:
```
GET /users/user_invalid_id
→ 404 Not Found

Verify ID exists:
GET /users?filter[email]=user@example.com
```

## 429 Too Many Requests

**Cause**: Rate limit exceeded.

**Solutions**:
1. Implement exponential backoff with jitter
2. Respect `Retry-After` header
3. Batch operations to reduce request count
4. Upgrade plan for higher limits
5. Check rate limit headers on all responses

**Example**:
```
❌ Hammering API
for i in range(1000):
    api.get_user(user_id)

✅ Batch requests
users = api.users.batch.get(user_ids)

✅ Respect backoff
wait = min(base * (2 ** attempt), max_wait)
time.sleep(wait + random(0, jitter))
```

## 500 Internal Server Error

**Cause**: Unexpected server error (not your fault).

**Solutions**:
1. Implement retry with exponential backoff
2. Include request_id in support ticket
3. Check status page for incidents
4. Wait before retrying (gives service time to recover)

**Example**:
```
POST /orders
→ 500 Internal Server Error
Request ID: req_xyz789

Contact support with request_id for investigation
```

## 503 Service Unavailable

**Cause**: Temporary service issues (maintenance, overload).

**Solutions**:
1. Implement retry (service will recover)
2. Check status page for maintenance window
3. Use fallback/cached data if available
4. Reduce traffic if possible

**Example**:
```
Response Headers:
Retry-After: 60  (retry after 60 seconds)

Wait 60 seconds, then retry request
```

## Connection Timeout

**Cause**: Request took too long (network or server slow).

**Solutions**:
1. Increase timeout: `timeout = 30000ms` (30 seconds)
2. Simplify query (reduce scope, add filters)
3. Paginate large requests
4. Split batch into smaller batches
5. Check network connectivity

**Example**:
```python
❌ Timeout on large query
GET /events?start=2000-01-01&end=2026-02-18  # 26 years of data

✅ Split into smaller queries
GET /events?start=2026-02-01&end=2026-02-18  # 1 month
```

## Validation Errors (400 Bad Request)

**Cause**: Invalid request parameters or body.

**Solutions**:
1. Review error details: Check `error.details` array
2. Ensure required fields provided
3. Validate field formats (email, date, etc.)
4. Check data types match schema

**Example**:
```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "email",
      "issue": "Invalid email format",
      "value": "notanemail"
    }
  ]
}
```

Fix: Provide valid email format.

## Conflict (409 Conflict)

**Cause**: Request conflicts with current state (e.g., duplicate).

**Solutions**:
1. Verify unique constraint violation: email already exists
2. Check if resource was already created
3. Retry with different value (e.g., different email)
4. For concurrent modifications, handle gracefully

**Example**:
```
POST /users
{"email": "alice@example.com"}
→ 409 Conflict (email already registered)

Solution: Use different email or update existing user
```

## Deadlock (Serialization Failure)

**Cause**: Concurrent transactions conflict.

**Solutions**:
1. Retry with exponential backoff
2. Reduce transaction scope (fewer operations)
3. Lock resources in consistent order

**Example**:
```python
for attempt in range(5):
    try:
        api.transfer_funds(from_user, to_user, amount)
        break
    except DeadlockError:
        if attempt == 4:
            raise
        time.sleep(0.1 * (2 ** attempt))
```

## Invalid Token (JWT)

**Cause**: JWT signature invalid or malformed.

**Solutions**:
1. Verify token was created with correct key
2. Check token hasn't been tampered with
3. Re-authenticate to get new token
4. Verify JWKS endpoint is accessible

**Example**:
```
Invalid token signature

Solution: Re-authenticate via login to get new token
```

## Rate Limit Exceeded (API Key)

**Cause**: Same as 429, but specifically for quota limits.

**Solutions**:
1. Upgrade to higher-tier plan
2. Optimize code to reduce API calls
3. Implement caching
4. Request rate limit exceptions

Check dashboard for usage:
```
GET /admin/rate-limits/usage
→ Current usage: 8.5M / 10M monthly
```

Upgrade plan before hitting monthly limit.

## Troubleshooting Guide

| Error | Status | Retryable | Action |
|-------|--------|-----------|--------|
| Auth missing | 401 | No | Fix credentials |
| Insufficient scope | 403 | No | Request broader scopes |
| Not found | 404 | No | Verify resource exists |
| Invalid params | 400 | No | Fix request format |
| Rate limited | 429 | Yes | Implement backoff |
| Server error | 500 | Yes | Retry with backoff |
| Unavailable | 503 | Yes | Retry with backoff |
| Timeout | - | Yes | Increase timeout, simplify query |

See [Error Handling](error-handling.md) for recovery strategies and [Error Responses](../endpoints/error-responses.md) for response format details.
