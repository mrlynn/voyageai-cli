# Batch Operations

Batch operations allow creating, updating, or deleting multiple resources in a single API call, improving performance and reducing network overhead.

## Batch Create

Create multiple resources at once:

```
POST /users/batch
{
  "items": [
    {"name": "Alice", "email": "alice@example.com"},
    {"name": "Bob", "email": "bob@example.com"},
    {"name": "Charlie", "email": "charlie@example.com"}
  ]
}

Response:
{
  "data": [
    {"id": "user_1", "name": "Alice", "email": "alice@example.com"},
    {"id": "user_2", "name": "Bob", "email": "bob@example.com"},
    {"id": "user_3", "name": "Charlie", "email": "charlie@example.com"}
  ],
  "errors": []
}
```

Batch creates support up to 100 items per request. Exceeding this returns 400 Bad Request.

## Batch Update

Update multiple resources:

```
PATCH /users/batch
{
  "items": [
    {"id": "user_1", "status": "active"},
    {"id": "user_2", "status": "inactive"},
    {"id": "user_3", "status": "active"}
  ]
}

Response:
{
  "data": [
    {"id": "user_1", "status": "active"},
    {"id": "user_2", "status": "inactive"},
    {"id": "user_3", "status": "active"}
  ],
  "errors": []
}
```

Include the `id` field for each item to update. Unspecified fields are unchanged.

## Batch Delete

Delete multiple resources:

```
DELETE /users/batch
{
  "ids": ["user_1", "user_2", "user_3"]
}

Response:
{
  "deleted": 3,
  "errors": []
}
```

Or provide full item objects:

```
DELETE /users/batch
{
  "items": [
    {"id": "user_1"},
    {"id": "user_2"},
    {"id": "user_3"}
  ]
}
```

## Error Handling in Batches

If some items fail, the response includes both successes and errors:

```
{
  "data": [
    {"id": "user_1", "name": "Alice"},
    null,  // Item 2 failed; null placeholder
    {"id": "user_3", "name": "Charlie"}
  ],
  "errors": [
    {
      "index": 1,  // Second item
      "error": "validation_error",
      "message": "Email invalid",
      "item": {"name": "Bob", "email": "invalid@"}
    }
  ]
}
```

The array index in `errors` indicates which item failed. By default, batch operations process all items; one failure doesn't stop processing.

## Atomic vs. Non-Atomic Batches

By default, batches are **non-atomic**: partial success is OK. Some failures don't roll back successes.

For atomic operations (all-or-nothing), include `atomic: true`:

```
POST /users/batch
{
  "atomic": true,
  "items": [...]
}
```

If any item fails, the entire batch is rolled back (no items are created).

## Batch Size Limits

Default limits:
- Batch create: 100 items
- Batch update: 100 items
- Batch delete: 1000 items

Requests exceeding limits return 400 Bad Request. For larger batches, split into multiple requests or use pagination for sequential operations.

## Idempotency in Batches

Include an `Idempotency-Key` header for batch operations:

```
POST /users/batch
Idempotency-Key: batch_abc123
Content-Type: application/json

{"items": [...]}
```

The same key + body = same response. Retrying doesn't create duplicates.

## Batch Operations Performance

Batches are significantly more efficient than sequential requests:

```
Sequential: 100 requests × (10ms network + 5ms processing) = 1.5 seconds
Batch: 1 request × (10ms network + 5ms processing) = 15 milliseconds

100x faster!
```

Use batch operations for bulk imports, data migrations, and high-concurrency scenarios.

## Partial Batch Retry

If some items in a batch fail, retry only the failed items:

```javascript
async function batchCreateWithRetry(items) {
  const response = await api.post('/users/batch', {items});
  
  if (response.errors.length > 0) {
    // Retry only failed items
    const failedItems = response.errors.map(e => e.item);
    const retryResponse = await api.post('/users/batch', {items: failedItems});
    return {
      ...response,
      data: [...response.data.filter(x => x), ...retryResponse.data]
    };
  }
  
  return response;
}
```

## Batch Operations Rate Limiting

Batch operations count toward rate limits based on item count. A batch of 10 items counts as 10 requests.

This prevents circumventing rate limits with large batches. For bulk operations requiring many items, request higher rate limits or use background jobs.

## Async Batch Operations

For very large batches (1000+ items), use async batch jobs:

```
POST /jobs/users/batch_create
{
  "input_file_url": "https://storage.example.com/users.csv"
}

Response:
{
  "job_id": "job_123",
  "status": "processing",
  "progress": 0
}
```

Poll the job status:

```
GET /jobs/job_123
{
  "job_id": "job_123",
  "status": "completed",
  "results": {
    "created": 10000,
    "failed": 5,
    "errors": [...]
  }
}
```

Async jobs allow processing large datasets without blocking or hitting timeout limits.
