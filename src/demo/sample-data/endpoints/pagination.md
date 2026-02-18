# Pagination

When returning large datasets, results are paginated to improve performance and usability. The platform supports multiple pagination strategies depending on your use case.

## Offset-Based Pagination

The default pagination strategy uses `page` and `per_page` parameters:

```
GET /users?page=1&per_page=20
```

Returns items 1-20. Page 2 returns items 21-40, etc. This is simple and familiar but becomes inefficient for large offsets (deep pagination is slow in databases).

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1234,
    "pages": 62
  }
}
```

## Cursor-Based Pagination

For large datasets, use cursor-based pagination. Cursors are opaque strings that point to a specific position in the dataset:

```
GET /events?first=20&after=cursor_xyz
```

Returns the first 20 items after the cursor. Cursors encode the sort key and position, allowing efficient jumping through datasets.

```json
{
  "data": [...],
  "pagination": {
    "has_next": true,
    "has_previous": true,
    "next_cursor": "cursor_abc",
    "previous_cursor": "cursor_xyz"
  }
}
```

Cursor-based pagination is ideal for large tables, sorted results, and real-time data. It handles insertions/deletions during pagination gracefully.

## Limit and Offset

Alternative syntax using `limit` and `offset`:

```
GET /users?limit=20&offset=40
```

Equivalent to `page=3&per_page=20`. Less commonly used than page/per_page.

## Pagination Limits

Maximum `per_page` is 100 items. Requesting more returns a 400 error. Some expensive endpoints (e.g., analytics) have lower limits (max 50).

Minimum `per_page` is 1. Default is 20 if unspecified.

## Ordering and Pagination

Results are ordered by `created_at` descending by default. When paginating, always specify sort order explicitly:

```
GET /users?page=1&per_page=20&sort=-created_at,name
```

This ensures consistent ordering across pagination requests.

## Total Count Caching

The `total` count in offset-based pagination is eventually consistent. It's cached for performance and may be 1-2 minutes stale. For critical applications, re-query the total separately.

With cursor pagination, the `total` is not provided to avoid expensive count queries.

## Practical Pagination Patterns

**For UI (tables, infinite scroll)**:
Use offset-based pagination with low page numbers. Cache early pages (page 1-5); deeper pages are rarely accessed.

**For data exports**:
Use cursor-based pagination. It handles large datasets efficiently and provides stable ordering.

**For real-time feeds**:
Use cursor-based pagination with timestamp cursors. This handles insertions gracefully (new items appear at the top without disrupting pagination).

**For analytics/reporting**:
Use offset-based pagination with reasonable per_page values (20-50). Accept that large offsets are slow; optimize by filtering first.

## Combining with Filters and Sorting

Pagination works seamlessly with filters and sorting:

```
GET /users?status=active&sort=-created_at&page=2&per_page=50
```

Filters reduce the dataset first, then pagination applies. Total count reflects filtered results.

## Backwards Pagination

Cursor-based pagination supports `last` and `before` parameters for reverse iteration:

```
GET /events?last=20&before=cursor_xyz
```

Returns the 20 items before the cursor. Useful for "load more above" patterns.

## Performance Considerations

Avoid deep pagination (high page numbers). Instead, use filters to narrow results before paginating. For example, "show active users page 100" is slower than "show active users in 2026-02-18 page 1".
