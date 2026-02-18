# Sorting

Sorting orders results by one or more fields. Results are sorted ascending by default; prefix field names with `-` for descending order.

## Basic Sorting

Sort by a single field:

```
GET /users?sort=name
```

Returns users sorted by name (A-Z).

Descending order:

```
GET /users?sort=-created_at
```

Returns users sorted by creation date (newest first).

## Multiple Sort Fields

Combine multiple sort keys for secondary ordering:

```
GET /users?sort=-created_at,name
```

Sorts by creation date descending, then by name ascending. Secondary sorts break ties in primary sorts.

## Sortable Fields

Not all fields are sortable. Documentation specifies which fields support sorting. Common sortable fields:
- `name`, `email`, `title` (text fields)
- `created_at`, `updated_at`, `timestamp` (date fields)
- `status`, `role` (enum fields)
- `price`, `count`, `score` (numeric fields)

Attempting to sort by a non-sortable field returns 400 Bad Request.

## Indexed vs. Non-Indexed Sorting

Sorting by indexed fields is fast. Sorting by non-indexed fields may be slow on large datasets. The database query planner uses available indexes to optimize sorts.

For performance-critical sorts, ensure fields are indexed. See [Database Indexes](../database/indexes.md).

## Case-Sensitive Sorting

Sorting is case-sensitive. Uppercase letters sort before lowercase in ASCII order:

```
A, B, Z, a, b, z
```

For case-insensitive sorting, use:

```
GET /users?sort=lower(name)  // Function-based sorting (limited support)
```

Not all databases support function-based sorting; check your environment.

## Null Value Handling

Null values in sort fields are typically placed last (for ascending) or first (for descending). Behavior varies by database.

To control null placement explicitly (if supported):

```
GET /users?sort=name,_nulls_last
```

This is a future enhancement; currently nulls follow database defaults.

## Limiting Sort Keys

Complex sorts with many keys may reduce performance. Limit secondary sorts to 2-3 fields maximum.

## Sort Order Consistency

When paginating with sorting, always specify the same sort order in all requests:

```
Request 1: GET /users?page=1&sort=-created_at
Request 2: GET /users?page=2&sort=-created_at
```

Omitting sort in page 2 reverts to default sort, causing inconsistent pagination.

## Dynamic Sorting

API responses include available sort fields in response headers or metadata (future feature):

```
X-Sort-Available: name,-created_at,status,role
```

This helps clients discover sortable fields without reading documentation.

## Performance Considerations

Sorting large datasets is expensive, especially for non-indexed fields. For better performance:

1. **Filter first**: Reduce dataset size before sorting
2. **Use pagination**: Never fetch entire unsorted dataset
3. **Index sort fields**: Ensure critical sort fields have indexes
4. **Limit sort complexity**: Use simple, single-field sorts when possible

## Default Sort Order

If no sort is specified, results use the default sort order (usually `-created_at` for most collections). Some endpoints may have different defaults; check endpoint documentation.

Override defaults explicitly to avoid surprises when defaults change.
