# HTTP Status Codes

The API uses standard HTTP status codes to indicate the outcome of requests. Proper status code handling is essential for robust client implementations.

## 2xx Success

**200 OK**: Request succeeded. Response includes data.

```
GET /users/user_123
200 OK
{"data": {"id": "user_123", ...}}
```

**201 Created**: Resource was successfully created.

```
POST /users
201 Created
{"data": {"id": "user_456", ...}}
Location: /users/user_456
```

Include the `Location` header for newly created resources.

**204 No Content**: Request succeeded, but there's no response body.

```
DELETE /users/user_123
204 No Content
(empty response body)
```

Don't expect JSON in 204 responses.

## 3xx Redirection

**301 Moved Permanently**: Resource moved to new location (rare in APIs).

**304 Not Modified**: Resource hasn't changed since your last request (conditional GET).

```
GET /users/user_123
If-None-Match: "etag_abc"
304 Not Modified
(empty response body)
```

## 4xx Client Error

**400 Bad Request**: Invalid request (malformed syntax, missing fields, invalid parameters).

```
POST /users
{"name": ""}  // Missing required field

400 Bad Request
{"error": {"code": "validation_error", ...}}
```

Check response body for specific validation errors.

**401 Unauthorized**: Missing or invalid authentication.

```
GET /users
(No Authorization header)

401 Unauthorized
{"error": {"code": "authentication_required", ...}}
```

Include valid access token in Authorization header.

**403 Forbidden**: Authenticated but not authorized for this resource.

```
GET /admin/reports
(User doesn't have admin scope)

403 Forbidden
{"error": {"code": "insufficient_scope", ...}}
```

Check required scopes in error response.

**404 Not Found**: Resource doesn't exist.

```
GET /users/nonexistent_user

404 Not Found
{"error": {"code": "resource_not_found", ...}}
```

Verify resource ID; create the resource if needed.

**409 Conflict**: Request conflicts with current state.

```
POST /users
{"email": "alice@example.com"}  // Email already exists

409 Conflict
{"error": {"code": "resource_conflict", ...}}
```

Resolve the conflict (e.g., use different email) before retrying.

**422 Unprocessable Entity**: Request is valid but can't be processed.

```
POST /orders
{"user_id": "user_123", "total": 0}  // Invalid state

422 Unprocessable Entity
{"error": {"code": "invalid_operation", ...}}
```

This differs from 400 (syntax is valid, but business logic rejects it).

**429 Too Many Requests**: Rate limited. Respect Retry-After header.

```
GET /users?page=1

429 Too Many Requests
Retry-After: 5
{"error": {"code": "rate_limit_exceeded", ...}}
```

Wait before retrying; use exponential backoff.

## 5xx Server Error

**500 Internal Server Error**: Unexpected server error (not your fault).

```
POST /data/process
500 Internal Server Error
{"error": {"code": "internal_error", ...}, "meta": {"request_id": "..."}}
```

Retry with exponential backoff. Include request_id in support tickets.

**503 Service Unavailable**: Temporary server issues (maintenance, overload).

```
GET /users
503 Service Unavailable
Retry-After: 30
```

Wait the specified duration before retrying. Check status page for incidents.

**504 Gateway Timeout**: Request took too long to process.

```
POST /analytics/report?scope=year
504 Gateway Timeout
```

Reduce query scope or split into smaller requests.

## Status Code Handling Strategies

**Idempotent operations** (GET, DELETE, PUT): Safe to retry.

**Non-idempotent operations** (POST, PATCH): Use idempotency keys to safely retry:

```
POST /users
Idempotency-Key: unique-key-123
```

Same key + body = same response; safe to retry without duplicating data.

## Status Code Combinations

Some combinations are common:

| Scenario | Status | Action |
|----------|--------|--------|
| Invalid credentials | 401 | Re-authenticate |
| Expired token | 401 | Refresh token |
| Insufficient permissions | 403 | Request broader scopes |
| Resource not found | 404 | Verify ID; create if needed |
| Duplicate email | 409 | Use different email |
| Validation error | 400 | Fix input; check error details |
| Rate limited | 429 | Implement backoff |
| Server error | 5xx | Retry with exponential backoff |

## Monitoring Status Codes

Track status code distribution in your applications:

```
200 OK: 99.5%
400 Bad Request: 0.3%
401 Unauthorized: 0.1%
500 Internal Server Error: 0.1%
```

High error rates indicate issues to investigate.
