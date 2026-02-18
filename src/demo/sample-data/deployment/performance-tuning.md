# Performance Tuning

Optimization techniques to improve API performance.

## Database Query Optimization

**Add Indexes**:
```
SELECT * FROM users WHERE email = '...'
→ Without index: Full table scan (1M rows scanned)
→ With index: Direct lookup (1 row scanned)

Performance: 1000x faster
```

**Use Explain to Analyze**:
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = '...'
→ Seq Scan on users (1000ms)
→ Add index idx_users_email
→ Index Scan on idx_users_email (1ms)
```

## Connection Pooling

Reuse database connections:

```
Without pooling:
Request 1: Open connection (100ms), query (50ms), close (50ms) = 200ms
Request 2: Open connection (100ms), query (50ms), close (50ms) = 200ms

With pooling:
Request 1: Get from pool (1ms), query (50ms) = 51ms
Request 2: Get from pool (1ms), query (50ms) = 51ms
```

Configure pool size: min 5, max 20 connections.

## Pagination and Filtering

Reduce data returned:

```
✗ Bad: SELECT * FROM large_table
  → Returns 1M rows (1GB)
  → Timeout or crash

✓ Good: SELECT * FROM large_table WHERE date > '2026-01-01' LIMIT 100
  → Returns 100 rows (100KB)
  → Fast response
```

## Caching

Cache expensive operations:

```
without cache: Database query → 100ms
with cache: Redis lookup → 1ms

Cache hit rate: 90%
Average latency: 1ms * 0.9 + 100ms * 0.1 = 10.9ms
```

See [Caching](caching.md) for details.

## Compression

Reduce response size:

```
Uncompressed: 1MB response → 100ms transfer
Compressed (gzip): 100KB response → 10ms transfer

10x faster for large responses.
```

Enable in web server: `Content-Encoding: gzip`

## Async Processing

Defer slow operations:

```
Synchronous:
POST /orders → Validate, charge payment, email → 5s response

Asynchronous:
POST /orders → Validate → 100ms response
Background: Charge payment, email (completes later)
```

Webhook notifies of payment result.

## Batch Operations

Combine multiple operations:

```
100 sequential requests: 100 * 50ms = 5000ms
1 batch request: 1 * 100ms = 100ms

50x faster!
```

See [Batch Operations](../endpoints/batch-operations.md).

## Code Profiling

Identify slow code:

```
Function A: 1000ms (bottleneck!)
Function B: 100ms
Function C: 50ms

Optimize Function A first.
```

Tools: cProfile (Python), Node profiler, JProfiler (Java)

## Monitoring Performance

Track metrics:

```
P50 latency: 100ms (50% of requests faster)
P95 latency: 500ms (95% faster)
P99 latency: 2000ms (99% faster)
```

P99 matters for user experience; optimize tail latency.

## See Also

- [Indexes](../database/indexes.md) - Database optimization
- [Caching](caching.md) - Performance with caching
- [Scaling](scaling.md) - Horizontal scaling
