# Request and Response Headers

HTTP headers provide metadata about requests and responses. Understanding headers is critical for authentication, caching, and advanced API usage.

## Required Headers

**Authorization**: Authentication credential (required for authenticated endpoints).

```
Authorization: Bearer eyJhbGc...
```

Include the `Bearer` scheme for JWT tokens. For API keys, use:

```
Authorization: Bearer sk_live_abc123
```

**Content-Type**: Specifies request body format (required for POST/PATCH).

```
Content-Type: application/json
```

Always use `application/json`; XML is not supported for request bodies.

## Recommended Headers

**User-Agent**: Identifies your application. Helps with debugging and analytics.

```
User-Agent: MyApp/1.0 (Node.js 18)
```

**Accept**: Specifies desired response format (default: application/json).

```
Accept: application/json
```

**Idempotency-Key**: Ensures idempotent processing for create/update operations.

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Use a UUID that's stable across retries. If the same key is used again, the original response is returned.

## Conditional Request Headers

**If-None-Match**: Requests resource only if it differs from the specified ETag.

```
GET /users/user_123
If-None-Match: "etag_abc123"

Response: 304 Not Modified (resource unchanged)
```

Reduces bandwidth for frequently accessed resources.

**If-Modified-Since**: Requests resource only if modified after the specified date.

```
GET /users/user_123
If-Modified-Since: Wed, 18 Feb 2026 12:00:00 GMT

Response: 304 Not Modified
```

## Custom Headers

**X-Request-ID**: Track a specific request through logs and monitoring.

```
X-Request-ID: req_custom_tracking_id
```

If provided, the response includes the same ID for correlation.

**X-Correlation-ID**: Trace related requests across microservices.

```
X-Correlation-ID: corr_abc123
```

Used internally for distributed tracing.

## Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1645198456
```

Inspect these to avoid hitting limits.

## Response Headers

**Content-Type**: Response body format.

```
Content-Type: application/json; charset=utf-8
```

**Content-Length**: Size of response body in bytes.

```
Content-Length: 2048
```

**Content-Encoding**: Response compression method.

```
Content-Encoding: gzip
```

**Cache-Control**: Caching directives.

```
Cache-Control: public, max-age=300
```

**ETag**: Unique identifier for the resource version (for caching).

```
ETag: "abc123def456"
```

**Last-Modified**: Resource's last modification date.

```
Last-Modified: Wed, 18 Feb 2026 12:00:00 GMT
```

**Location**: URL of newly created resource (for 201 responses).

```
Location: /users/user_456
```

**Retry-After**: How long to wait before retrying (for 429/503 responses).

```
Retry-After: 5
```

## Deprecation Headers

**Deprecation**: Indicates the endpoint is deprecated.

```
Deprecation: true
```

**Sunset**: Date when the endpoint will be removed.

```
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
```

**Link**: Link to migration documentation.

```
Link: <https://docs.example.com/migration>; rel="deprecation"
```

## CORS Headers

**Access-Control-Allow-Origin**: Allowed origins for cross-origin requests.

```
Access-Control-Allow-Origin: https://example.com
```

**Access-Control-Allow-Methods**: Allowed HTTP methods.

```
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

**Access-Control-Allow-Headers**: Allowed custom headers in preflight requests.

```
Access-Control-Allow-Headers: Authorization, Content-Type
```

## Security Headers

**Strict-Transport-Security**: Enforces HTTPS.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**X-Content-Type-Options**: Prevents MIME type sniffing.

```
X-Content-Type-Options: nosniff
```

**X-Frame-Options**: Prevents clickjacking.

```
X-Frame-Options: DENY
```

## Feature Flag Headers

**X-Feature-Flag**: Enable beta features.

```
X-Feature-Flag: beta.new_analytics_api
```

Features must be explicitly enabled on your account.

## Best Practices

- Include `User-Agent` for debugging support
- Use `Idempotency-Key` for all create/update operations
- Respect `Cache-Control` and `Retry-After` headers
- Log `X-Request-ID` for support tickets
- Monitor deprecation headers for API migrations
