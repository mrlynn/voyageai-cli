# Query Parameters

Query parameters customize request behavior, allowing filtering, sorting, pagination, and field selection without changing the endpoint URL.

## Standard Query Parameters

**page** and **per_page**: Control pagination.

```
GET /users?page=2&per_page=50
```

Returns 50 users starting at offset (page-1)*per_page. See [Pagination](pagination.md) for details.

**filter**: Filter results by field values. Format depends on data type.

```
GET /users?filter[status]=active&filter[created_after]=2026-01-01
```

See [Filtering](filtering.md) for comprehensive syntax.

**sort**: Order results by one or more fields.

```
GET /users?sort=-created_at,name
```

Prefix with `-` for descending order. See [Sorting](sorting.md).

**fields**: Specify which fields to include in response (projection).

```
GET /users?fields=id,name,email
```

Reduces response size by excluding unused fields. Useful for bandwidth optimization.

**expand**: Include related resources in the response.

```
GET /users/user_123?expand=profile,permissions
```

Reduces round-trips by embedding related data.

**include**: Include additional computed fields.

```
GET /users/user_123?include=total_projects,last_login_date
```

## Parameter Encoding

Special characters in query values must be URL-encoded:

```
GET /users?filter[name]=John%20Doe  // Space is %20
GET /users?filter[email]=test%40example.com  // @ is %40
```

Most HTTP clients encode this automatically.

## Boolean Parameters

Use `true` or `false` for boolean values:

```
GET /users?active=true&verified=false
```

Alternatively use `1`/`0`, but string values are preferred for clarity.

## Multiple Values

For multi-valued parameters, repeat the parameter name:

```
GET /users?status=active&status=pending
```

Or use array bracket syntax:

```
GET /users?status[]=active&status[]=pending
```

## Parameter Validation

Invalid parameter values return 400 Bad Request:

```json
{
  "error": "invalid_parameter",
  "parameter": "page",
  "value": "abc",
  "message": "page must be a positive integer"
}
```

Required parameters omitted in the URL should be checked—some endpoints require specific query parameters.

## Reserved Parameters

Parameters beginning with `_` are reserved:

- `_debug=true` - Include debugging information in response (admin only)
- `_format=xml` - Return XML instead of JSON (legacy, not recommended)

Regular applications should not use `_` prefixed parameters.

## Case Sensitivity

Parameter names are case-insensitive. These are equivalent:

```
GET /users?Page=1&Per_Page=50
GET /users?page=1&per_page=50
```

Parameter *values* are case-sensitive. `status=Active` differs from `status=active`.

## URL Length Limits

URLs have a practical limit of ~2,000 characters. For complex filters with many conditions, use POST requests with a request body instead.

## Query String Best Practices

- Use consistent naming conventions (snake_case vs. camelCase)
- Validate user input before constructing URLs
- Avoid exposing internal implementation details
- Document all supported query parameters
- Consider query complexity impact on performance

## Caching with Query Parameters

Query strings affect caching headers. The same base URL with different query parameters is a separate cache key:

```
GET /users?page=1  - Cache key 1
GET /users?page=2  - Cache key 2
```

This ensures correct pagination caching behavior.
