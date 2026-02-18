# Filtering

Filtering narrows results to specific criteria using query parameters. The platform supports flexible filter syntax for simple and complex queries.

## Basic Filtering

Filter by a single field:

```
GET /users?filter[status]=active
```

Returns only users with `status` equal to "active". Multiple filters combine with AND logic:

```
GET /users?filter[status]=active&filter[role]=admin
```

Returns users with `status=active` AND `role=admin`.

## Comparison Operators

Use operators for more complex filtering:

```
GET /events?filter[created_at][$gte]=2026-01-01
```

Supported operators:
- `$eq` - Equal (default if no operator specified)
- `$ne` - Not equal
- `$gt` - Greater than
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal
- `$in` - In array
- `$nin` - Not in array
- `$exists` - Field exists (true) or is null (false)

## Range Queries

Query ranges with multiple operators:

```
GET /products?filter[price][$gte]=10&filter[price][$lte]=100
```

Returns products priced between $10 and $100 inclusive.

## String Matching

**Exact match**: `filter[name]=John`

**Partial match (contains)**: `filter[name][$contains]=ohn` (matches "John", "Johnson", etc.)

**Case-insensitive**: `filter[name][$icontains]=JOHN` (matches "john", "John", "JOHN")

**Regex**: `filter[email][$regex]=^[a-z]+@example\.com$` (limited to patterns for performance)

## Array Filtering

Filter by array membership:

```
GET /users?filter[tags][$in]=vip,premium
```

Returns users with tags containing "vip" or "premium".

Filter array length:

```
GET /users?filter[tags][$size]=3
```

Returns users with exactly 3 tags.

## Nested Object Filtering

For nested objects, use dot notation:

```
GET /orders?filter[user.status]=active
```

Filters by the `status` field inside the nested `user` object.

## Date and Time Filtering

Dates can be specified in ISO 8601 format:

```
GET /events?filter[timestamp][$gte]=2026-02-01T00:00:00Z
```

Shorthand for day-only:

```
GET /events?filter[date][$gte]=2026-02-01
```

Interpreted as 2026-02-01T00:00:00Z.

Relative dates (future enhancement):

```
GET /events?filter[created_at][$gte]=now-7d
```

Not yet supported; use absolute dates instead.

## Boolean Filtering

```
GET /users?filter[verified]=true&filter[deleted]=false
```

## Multiple OR Conditions

OR logic uses separate filter arrays:

```
GET /users?filter[$or][0][status]=active&filter[$or][0][status]=pending
```

Returns users with `status` equal to "active" OR "pending".

## Filter Limits

Filters are powerful but resource-intensive. Complex filters with >10 conditions or deep nesting may be slow. Use strategically and consider denormalization in your database schema.

## Full-Text Search

For keyword-based search, use `search` parameter instead of filters:

```
GET /articles?search=kubernetes+deployment
```

This searches across multiple text fields efficiently using full-text indexes.

## Filter Performance

Indexes are important for filter performance. Common filtered fields should be indexed. Check the [Schema Documentation](../database/schema-overview.md) for available indexes.

Queries without indexes on filtered fields run slower, especially on large tables. Monitor slow query logs to identify missing indexes.

## Combining Filters with Pagination

Filters reduce results before pagination:

```
GET /users?filter[status]=active&page=2&per_page=50
```

The `total` count in pagination metadata reflects filtered results.
