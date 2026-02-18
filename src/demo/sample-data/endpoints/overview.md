# API Endpoints Overview

The SaaS platform provides a comprehensive REST API for accessing and managing all application resources. All endpoints follow consistent patterns and require proper authentication as documented in the [Authentication Guide](../auth/api-keys.md).

## Base URL

The API is available at `https://api.example.com/v2/`. All examples in this documentation use this base URL. For testing, use the sandbox environment at `https://sandbox-api.example.com/v2/`.

## Protocol and Transport

All API requests must use HTTPS. Unencrypted HTTP requests are rejected. The platform uses HTTP/2 for efficient multiplexing and compression.

TLS 1.3 is required for all connections. Older TLS versions are explicitly rejected. This ensures secure, modern cryptographic standards across all traffic.

## Response Format

All endpoints return JSON responses. Even error responses follow the same JSON structure for consistency.

Standard response structure:

```json
{
  "data": { /* resource data */ },
  "status": "success",
  "timestamp": "2026-02-18T12:34:56Z",
  "request_id": "req_abc123"
}
```

Array responses return paginated data:

```json
{
  "data": [ { /* item 1 */ }, { /* item 2 */ } ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 42
  }
}
```

## Resource Endpoints

Common resource patterns:

- `GET /resources` - List resources (supports [pagination](pagination.md) and [filtering](filtering.md))
- `POST /resources` - Create a new resource
- `GET /resources/{id}` - Retrieve a specific resource
- `PATCH /resources/{id}` - Partially update a resource
- `DELETE /resources/{id}` - Delete a resource

Not all resources support all operations. Each resource's documentation specifies available methods.

## Request Headers

Required headers for all requests:

- `Authorization: Bearer <access_token>` - Authentication token
- `Content-Type: application/json` - For POST/PATCH requests
- `Accept: application/json` - Expected response format (optional, JSON is default)

Optional but recommended headers:

- `Idempotency-Key: <uuid>` - For create/update requests, prevents duplicate processing
- `User-Agent: MyApp/1.0` - Identifies your application
- `X-Request-ID: <uuid>` - Track requests through logs and monitoring

## Versioning

The API uses URL versioning (`/v2/`). Major versions are backward-incompatible changes and appear in the URL. Minor versions (new fields, endpoints) don't affect the URL.

The current version is `v2`. Legacy `v1` is still supported but receives security patches only. Migrate to `v2` before v1 is sunset (planned for 2027).

## Timestamps and Time Zones

All timestamps are in ISO 8601 format with UTC timezone:

```
2026-02-18T12:34:56Z  ✓ Correct
2026-02-18T12:34:56+00:00  ✓ Also acceptable
```

Accept timestamps in any ISO 8601 format; internally they're normalized to UTC.

## Rate Limiting

The platform enforces rate limits to ensure fair usage. See [Rate Limiting](rate-limiting-endpoints.md) for details. Standard limits: 100 requests per second for authenticated users, 10 for public (if applicable).

## Endpoint Documentation Structure

Each endpoint is documented with:
- HTTP method and path
- Required/optional parameters
- Request/response examples
- Error cases and status codes
- Rate limit tier

## Next Steps

Start with the [REST Patterns Guide](rest-patterns.md) for general patterns, then explore specific resources relevant to your use case.
