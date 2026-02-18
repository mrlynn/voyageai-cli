# Authentication Errors

Authentication errors indicate that a request lacks valid credentials or the provided credentials are invalid. Understanding error codes and recovery strategies is essential for building robust authentication flows.

## Common Error Codes

**401 Unauthorized**: The request lacks valid authentication credentials. Possible causes:
- Missing Authorization header
- Invalid or expired access token
- Malformed JWT (doesn't match signature)

**403 Forbidden**: The request is authenticated but not authorized for this resource. The user's scopes don't include the required permission.

**400 Bad Request**: Invalid authentication parameters (e.g., malformed login request, missing required fields).

**429 Too Many Requests**: Rate limiting on authentication endpoints. Too many failed login attempts from the same IP address triggers a temporary lockout.

## Password-Related Errors

**invalid_password**: Password is incorrect. The response includes `attempts_remaining` to warn before account lockout.

**password_expired**: User's password has expired and must be changed before authentication succeeds.

**password_too_weak**: New password doesn't meet complexity requirements. Respond with details about required rules (length, character types, etc.).

## MFA Errors

**mfa_required**: MFA is enabled but no MFA code provided. Return a challenge token for MFA verification.

**invalid_mfa_code**: The provided MFA code is incorrect or expired. Response includes `attempts_remaining`.

**backup_code_invalid**: Backup code provided doesn't match or has already been used.

## Token Errors

**token_expired**: Access token has exceeded its expiry time. Client should refresh or re-authenticate.

**token_invalid**: Token signature doesn't match or is malformed.

**refresh_token_expired**: Refresh token has expired; require full re-authentication.

**token_revoked**: Token was explicitly revoked and can no longer be used.

## Rate Limiting and Account Lockout

After 5 failed login attempts within 10 minutes, the account is temporarily locked for 15 minutes. This prevents brute-force attacks.

Lockout applies per email, not per IP. Users are notified via email that their account was locked. Admins can manually unlock accounts via `/admin/users/{user_id}/unlock`.

## CORS and Cross-Origin Errors

**invalid_origin**: The request's origin doesn't match allowed CORS origins. For OAuth flows, this typically means the redirect URI wasn't registered.

**cross_origin_request_blocked**: Requests from unauthorized origins are blocked even before reaching authentication handlers.

## Error Responses Format

Standard error response:

```json
{
  "error": "invalid_password",
  "error_description": "The password provided is incorrect.",
  "error_code": 40001,
  "timestamp": "2026-02-18T12:34:56Z",
  "request_id": "req_abc123"
}
```

The `request_id` is useful for support tickets and debugging. Include it in error reports.

## Handling Errors Gracefully

Always implement exponential backoff when handling 401/403 errors. Don't hammer the API with invalid tokens; this triggers rate limiting. Cache token validation errors for 5 seconds before retrying.

For user-facing applications, provide clear error messages:
- "Incorrect password. Try again." (not "Invalid password")
- "Your account is locked for 15 minutes due to failed login attempts."
- "This feature requires additional permissions. Contact your administrator."
