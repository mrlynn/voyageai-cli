# Permission Scopes

Scopes define granular permissions that limit what actions an authenticated user or application can perform. They follow the OAuth 2.0 scope model and are essential for implementing the principle of least privilege.

## Scope Naming Convention

Scopes follow the pattern `resource:action`. For example:
- `users:read` - Read user information
- `users:write` - Create or modify users
- `billing:read` - View billing information
- `admin:all` - Full administrative access

Hierarchical scopes use colons for nested permissions:
- `resources:*` - All actions on resources
- `resources:create` - Create new resources
- `resources:update` - Modify existing resources

## Standard Scopes

**User Scopes**:
- `profile` - Read user profile (name, email, avatar)
- `profile:write` - Update user profile
- `user:all` - Full user account access

**Data Scopes**:
- `data:read` - Read application data
- `data:write` - Create or modify data
- `data:delete` - Delete data (dangerous; use sparingly)

**Admin Scopes**:
- `admin:read` - View administrative settings
- `admin:write` - Modify administrative settings
- `admin:users` - User management
- `admin:audit` - Access audit logs
- `admin:all` - Full administrative access

**Service Scopes**:
- `webhooks:manage` - Create and modify webhooks
- `integrations:manage` - Manage third-party integrations
- `billing:read` - View billing details

## Using Scopes in OAuth

During OAuth authorization, request only necessary scopes:

```
GET /oauth/authorize
  ?scope=users:read+billing:read
  &client_id=app_123
  &redirect_uri=...
```

Users see exactly which permissions they're granting. Requesting excessive scopes reduces authorization success rates.

## Scope Validation in APIs

Each API endpoint is protected by required scopes. Requests with insufficient scopes return 403 Forbidden:

```json
{
  "error": "insufficient_scope",
  "required_scopes": ["users:read"],
  "provided_scopes": ["users:write"]
}
```

## Scope Inheritance and Hierarchies

Some scopes imply others for convenience:
- `data:write` includes `data:read` (you must read before writing)
- `admin:all` includes all other scopes
- `users:*` includes `users:read`, `users:write`, `users:delete`

Wildcard scopes should be used rarely. For API integrations, always specify exact scopes needed.

## Custom Scopes for Organizations

Organizations can define custom scopes for application-specific permissions. Create custom scopes via the dashboard under Organization Settings → Scopes.

Custom scopes follow the same naming convention and integrate seamlessly with standard scopes.

## Revoking and Modifying Scopes

Users can revoke individual scopes for an OAuth app via Settings → Connected Apps → Manage Scopes. This immediately invalidates tokens unless they have other granted scopes.

Admins can revoke scopes for all users via `/admin/apps/{app_id}/scopes/revoke`.

## Audit and Compliance

Scope usage is logged in audit trails. Queries show which scopes authenticated each action:

```
GET /admin/audit-logs?action=data:read&scope=users:read
```

This supports compliance investigations ("Did this app access billing data?") and security reviews.

## Best Practices

- Request minimum necessary scopes during authorization
- Use specific scopes; avoid wildcards
- Regularly audit which scopes apps actually use
- Remove unused scopes from token grants
- Document scope requirements in API documentation
