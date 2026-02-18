# Error Responses

When requests fail, the API returns structured error responses with detailed information for debugging and recovery.

## Error Response Structure

All errors follow a consistent format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "issue": "Invalid email format",
        "value": "invalid@"
      }
    ]
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2026-02-18T12:34:56Z"
  }
}
```

**code**: Machine-readable error code for programmatic handling.

**message**: Human-readable error message.

**details**: Field-level errors (for validation errors) with specific issues.

**request_id**: Unique identifier for support tickets and debugging.

## HTTP Status Codes

**400 Bad Request**: Client error in request format or parameters. Includes validation details.

**401 Unauthorized**: Missing or invalid authentication. Include valid access token and try again.

**403 Forbidden**: Authenticated but insufficient permissions. Check scopes and authorization.

**404 Not Found**: Resource doesn't exist. Verify the resource ID.

**409 Conflict**: Request conflicts with current state (e.g., duplicate resource, concurrent modification).

**422 Unprocessable Entity**: Request is valid but can't be processed (e.g., insufficient funds, invalid state transition).

**429 Too Many Requests**: Rate limited. Respect Retry-After header.

**500 Internal Server Error**: Server error; not your fault. Retry with exponential backoff.

**503 Service Unavailable**: Temporary service issues. Retry later.

## Common Error Codes

**validation_error**: Request parameters or body invalid.

**authentication_required**: No authentication provided; include Authorization header.

**invalid_token**: Access token invalid or expired. Refresh or re-authenticate.

**insufficient_scope**: Token lacks required scopes. Request new token with broader scopes.

**rate_limit_exceeded**: Too many requests. Implement backoff.

**resource_not_found**: Requested resource doesn't exist.

**resource_conflict**: Duplicate resource or concurrent modification. Example: trying to create user with existing email.

**invalid_operation**: Operation not allowed in current state. Example: can't publish a draft that has errors.

**permission_denied**: User lacks permission for this action.

**internal_error**: Unexpected server error. Contact support with request_id.

## Handling Errors Programmatically

Check HTTP status code first, then examine error code:

```javascript
if (response.status === 401) {
  // Re-authenticate
} else if (response.status === 429) {
  // Implement backoff
} else if (response.status === 400) {
  const errors = response.error.details;
  // Show validation errors to user
} else if (response.status >= 500) {
  // Retry with exponential backoff
}
```

## Validation Error Details

For 400 Validation Errors, the `details` array provides granular feedback:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      {
        "field": "name",
        "issue": "Field required",
        "path": "user.profile.name"
      },
      {
        "field": "age",
        "issue": "Must be >= 0",
        "value": -5
      }
    ]
  }
}
```

**field**: The field name causing the error.

**issue**: Description of the validation problem.

**path**: Full path for nested fields (e.g., "user.profile.name").

**value**: The invalid value provided.

## Retryability

Determine if errors are retryable:

- **Retryable**: 429, 503, 5xx (server errors). Use exponential backoff.
- **Not retryable**: 400, 401, 403, 404, 422. Fix the issue before retrying.

## Error Logging

Log errors with request_id for support:

```
Error: resource_not_found
Request ID: req_xyz789
Timestamp: 2026-02-18T12:34:56Z
```

Include this information in support tickets.

## Handling Authentication Errors

**401 Unauthorized**: Token missing or invalid.
- Action: Include Authorization header with valid token.

**401 token_expired**: Token has expired.
- Action: Call /auth/refresh with refresh token.

**401 invalid_token**: Token signature invalid or malformed.
- Action: Re-authenticate and obtain new token.

## Transient vs. Permanent Errors

**Transient**: Rate limits (429), service unavailability (503). Retry is appropriate.

**Permanent**: Invalid credentials (401), missing resource (404), permission denied (403). Fix underlying issue; retry won't help.

## Graceful Error Messages

Avoid exposing internal details in user-facing messages. Sanitize error output:

```javascript
// ✗ Don't show internal details
alert(`Database connection failed: ${error.message}`);

// ✓ Show user-friendly message
alert("Sorry, we couldn't process your request. Please try again.");
// Log internal details server-side with request_id for support
```
