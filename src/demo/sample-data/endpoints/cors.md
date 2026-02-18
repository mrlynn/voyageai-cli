# CORS (Cross-Origin Resource Sharing)

CORS allows browser-based JavaScript applications to make requests to the API from different origins (domains). Understanding CORS configuration is essential for web application integrations.

## CORS Basics

When a browser loads a page from `https://app.example.com` and that page's JavaScript makes a request to `https://api.example.com`, the browser enforces the Same-Origin Policy for security. The API must explicitly allow cross-origin requests via CORS headers.

The browser automatically includes an `Origin` header in cross-origin requests:

```
Origin: https://app.example.com
```

The API responds with CORS headers:

```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

If the origin is allowed, the browser permits the response. Otherwise, the response is blocked.

## Allowed Origins

Configure allowed origins in the API dashboard under Settings → CORS.

```
Allowed Origins:
https://app.example.com
https://www.example.com
https://localhost:3000  (for local development)
https://*.example.com   (wildcard subdomains)
```

Only requests from allowed origins succeed. Requests from other origins are rejected.

## Preflight Requests

For requests with custom headers (e.g., `Authorization`) or non-simple methods (POST, PATCH, DELETE), browsers send an automatic OPTIONS preflight request:

```
OPTIONS /users
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type
```

The API must respond with CORS headers:

```
200 OK
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

**Access-Control-Max-Age**: How long the browser caches the preflight response (in seconds). Set to 86400 (24 hours) to reduce preflight overhead.

## Simple Requests

GET and POST requests with simple headers don't require preflight:

```
GET /users
Origin: https://app.example.com

Response:
200 OK
Access-Control-Allow-Origin: https://app.example.com
```

Simple headers: `Content-Type` (with specific values), `Accept`, `Accept-Language`.

## Credentials (Cookies, Authorization)

By default, cookies and authorization headers aren't sent in cross-origin requests for security. To include them:

Client-side (JavaScript):

```javascript
fetch('https://api.example.com/users', {
  credentials: 'include',  // Include cookies and auth
  headers: {'Authorization': 'Bearer ...'}
})
```

Server-side (API):

```
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://app.example.com  (must be specific, not *)
```

Note: When using `Access-Control-Allow-Credentials: true`, you cannot use `Access-Control-Allow-Origin: *`. Origins must be explicitly listed.

## Common CORS Errors

**"No 'Access-Control-Allow-Origin' header"**: The origin isn't in the allowed list. Add it to CORS settings.

**"Credentials mode is 'include' but 'Access-Control-Allow-Credentials' is missing"**: The API doesn't allow credentials. Set `Access-Control-Allow-Credentials: true` or remove client-side `credentials: 'include'`.

**"Method not allowed"**: The HTTP method (POST, PATCH, etc.) isn't in `Access-Control-Allow-Methods`. Add it to CORS configuration.

**"Header not allowed"**: Custom headers aren't in `Access-Control-Allow-Headers`. Add them to CORS settings.

## Wildcard Origins

Using `Access-Control-Allow-Origin: *` makes the API accessible from any origin. This is convenient for public APIs but reduces security.

Use wildcards only for public endpoints that don't require authentication. For authenticated APIs, explicitly list allowed origins.

## Development vs. Production

**Development**: Allow `https://localhost:3000`, `https://localhost:8080`, etc.

**Production**: Explicitly list production domains only (e.g., `https://app.example.com`).

Never use `*` in production for authenticated endpoints.

## CORS in Single-Page Applications

SPAs are particularly affected by CORS. When deploying an SPA to a CDN, the CDN origin must be in the API's allowed list:

```
SPA deployed to: https://cdn.example.com/app/
API at: https://api.example.com/

CORS setting:
Allowed Origins: https://cdn.example.com
```

## Testing CORS

Test CORS with curl:

```bash
curl -i -X OPTIONS https://api.example.com/users \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST"
```

Check response headers for CORS directives.

## CORS vs. Authentication

CORS allows *which domains* can make requests. [Authentication](../auth/api-keys.md) determines *who* (which user) can access resources. Both are required for secure APIs.

CORS without authentication: Any origin can make requests, but requires valid credentials.

Authentication without CORS: Requests from any origin are rejected (unless same-origin).
