# Response Formats

All API responses follow a consistent structure for predictability and ease of parsing. The platform supports JSON as the primary format with optional XML support for legacy integrations.

## JSON Response Structure

Standard response envelope:

```json
{
  "data": { /* the actual response data */ },
  "meta": {
    "timestamp": "2026-02-18T12:34:56Z",
    "request_id": "req_abc123",
    "version": "2.0"
  },
  "status": "success"
}
```

**data**: The actual requested resource(s) or operation result.

**meta**: Metadata about the response (timestamp, request ID, API version).

**status**: "success" for successful requests, "error" for failures (rarely used with appropriate HTTP status codes).

## Collection Responses

List endpoints return collections with pagination metadata:

```json
{
  "data": [
    {"id": "user_1", "name": "Alice"},
    {"id": "user_2", "name": "Bob"}
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "pages": 3
  },
  "meta": { /* ... */ }
}
```

## Error Responses

Error responses follow the same structure:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid parameter: status",
    "details": [
      {
        "field": "status",
        "issue": "Unknown status value 'pending'. Expected: active, inactive, archived"
      }
    ]
  },
  "meta": { /* ... */ },
  "status": "error"
}
```

Errors use HTTP status codes (400, 401, 404, etc.) matching the error type.

## Nested Resources

Related resources can be embedded or referenced:

Referenced (default):

```json
{
  "data": {
    "id": "order_123",
    "user_id": "user_456",
    "status": "completed"
  }
}
```

Embedded (with `expand` parameter):

```json
{
  "data": {
    "id": "order_123",
    "user": {
      "id": "user_456",
      "name": "Alice",
      "email": "alice@example.com"
    },
    "status": "completed"
  }
}
```

## Content Negotiation

Specify desired response format via Accept header:

```
Accept: application/json  // JSON (default)
Accept: application/xml   // XML (legacy support)
```

The API returns the requested format if supported. Default is JSON.

## Field Formatting

**Numbers**: Floats include decimal point; integers may be strings for large numbers to avoid precision loss in JavaScript.

```json
{
  "price": 19.99,
  "user_id": "user_9007199254740991"  // String to preserve precision
}
```

**Dates**: ISO 8601 format with UTC timezone:

```json
{
  "created_at": "2026-02-18T12:34:56Z",
  "updated_at": "2026-02-18T12:35:10.123Z"  // With milliseconds
}
```

**Null values**: Explicitly represented as `null`:

```json
{
  "id": "user_123",
  "phone": null
}
```

Omitted fields indicate "no value" in requests; in responses, null values are always explicit.

## Binary and File Responses

File downloads return binary content with appropriate headers:

```
GET /exports/report.csv
Content-Type: text/csv
Content-Disposition: attachment; filename="report.csv"
```

The response body is the file content, not JSON.

## Streaming Responses

For large datasets, streaming responses are available:

```
GET /events/stream?start=2026-02-01
Content-Type: application/x-ndjson

{"id": "event_1", "timestamp": "2026-02-01T00:00:00Z"}
{"id": "event_2", "timestamp": "2026-02-01T00:00:01Z"}
...
```

NDJSON (newline-delimited JSON) allows processing large results without loading everything into memory.

## Response Size Optimization

Use `fields` query parameter to reduce response size:

```
GET /users?fields=id,name,email
```

Returns only specified fields, reducing bandwidth.

## Caching Headers

Responses include cache control headers:

```
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: Wed, 18 Feb 2026 12:00:00 GMT
```

Clients can use these for efficient caching and conditional requests.

## Content Encoding

Responses are compressed when beneficial:

```
Content-Encoding: gzip
```

Most HTTP clients handle decompression automatically.
