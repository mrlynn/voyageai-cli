# REST Patterns and Conventions

The API follows standard REST principles and conventions for consistent, predictable behavior across all endpoints.

## Resource-Oriented Design

Resources are identified by nouns, not verbs:

- ✓ `POST /users` - Create a user
- ✗ `GET /createUser` - Anti-pattern (verb in URL)

Resources are uniquely identified by their ID:

```
GET /users/user_123
DELETE /resources/res_456
```

## Standard HTTP Methods

**GET**: Retrieve a resource or list of resources. Safe and idempotent. Does not modify state.

**POST**: Create a new resource or trigger an action. Idempotent when paired with `Idempotency-Key`. Creates a new resource each time if no idempotency key.

**PATCH**: Partially update a resource. Only provided fields are modified.

**PUT**: Replace a resource entirely (not commonly used; PATCH is preferred).

**DELETE**: Remove a resource. Idempotent—deleting twice returns success both times (idempotent in effect, though second delete may return 404).

## Status Codes

**2xx Success**:
- `200 OK` - Request succeeded; response includes data
- `201 Created` - New resource created; includes the created resource
- `204 No Content` - Request succeeded; no response body

**4xx Client Error**:
- `400 Bad Request` - Invalid parameters or request format
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Request conflicts with current state (e.g., duplicate resource)
- `429 Too Many Requests` - Rate limited

**5xx Server Error**:
- `500 Internal Server Error` - Unexpected server error
- `503 Service Unavailable` - Temporary service issues

See [Status Codes](status-codes.md) for comprehensive list.

## Request/Response Examples

Creating a resource:

```
POST /users
{"name": "Alice", "email": "alice@example.com"}

Response (201):
{
  "id": "user_123",
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2026-02-18T12:34:56Z"
}
```

Updating a resource:

```
PATCH /users/user_123
{"name": "Alice Smith"}

Response (200):
{
  "id": "user_123",
  "name": "Alice Smith",
  "email": "alice@example.com"
}
```

## Null vs. Omitted Fields

In responses, null fields are included with `null` value:

```json
{
  "id": "user_123",
  "name": "Alice",
  "phone": null
}
```

In requests, omitted fields mean "don't change this" (for PATCH) or "no value" (for POST). Include `null` to explicitly set a field to null.

## Object Nesting

Related resources can be embedded or referenced:

Embedded (default):
```json
{"user": {"id": "user_123", "name": "Alice"}}
```

Expanded (include related data):
```
GET /users/user_123?include=profile,settings

{"user": {"id": "user_123", "name": "Alice", "profile": {...}, "settings": {...}}}
```

## Bulk Operations

Bulk create/update:

```
POST /users/bulk
[{"name": "Alice"}, {"name": "Bob"}]

Response: [{"id": "user_123", ...}, {"id": "user_124", ...}]
```

See [Batch Operations](batch-operations.md) for details.

## HATEOAS and Links

Responses include `_links` for navigation:

```json
{
  "id": "user_123",
  "_links": {
    "self": {"href": "/users/user_123"},
    "update": {"href": "/users/user_123", "method": "PATCH"},
    "delete": {"href": "/users/user_123", "method": "DELETE"}
  }
}
```

This allows clients to discover available actions without hardcoding URLs.
