# Indexes

Indexes dramatically improve query performance by allowing the database to locate data without scanning entire tables. Understanding indexes is critical for optimizing API performance.

## Index Basics

An index is a database structure that maps column values to row locations. Without indexes, queries scan every row (full table scan). With indexes, the database jumps directly to matching rows.

**Query without index**: Scan all 1M rows → 50ms
**Query with index**: Locate matching rows → 1ms (50x faster!)

## B-Tree Index (Default)

B-Tree is the default index type for most columns:

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

Use B-Tree for:
- Equality queries: `WHERE email = '...'`
- Range queries: `WHERE created_at > '2026-01-01'`
- Sorting: `ORDER BY created_at`

## Composite Indexes

Indexes on multiple columns for combined filters:

```sql
CREATE INDEX idx_resources_org_type ON resources(org_id, type);
```

Efficiently queries:
```sql
SELECT * FROM resources WHERE org_id = 'org_123' AND type = 'file'
```

Column order matters! Put heavily filtered columns first.

## Unique Indexes

Enforce uniqueness while improving query performance:

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

Combines constraint enforcement with performance.

## Partial Indexes

Index only rows matching a condition:

```sql
CREATE INDEX idx_active_users ON users(name) WHERE status = 'active';
```

Reduces index size for large tables with many inactive rows.

## Full-Text Indexes

Search text efficiently:

```sql
CREATE INDEX idx_documents_search ON documents USING GIN(to_tsvector('english', content));
```

Query full-text:
```sql
SELECT * FROM documents WHERE to_tsvector('english', content) @@ to_tsquery('english', 'postgresql & performance')
```

## GIN and GIST Indexes

For complex data types (arrays, JSONB):

```sql
CREATE INDEX idx_users_tags ON users USING GIN(tags);
CREATE INDEX idx_metadata ON resources USING GIN(metadata);
```

Query JSONB with indexes:
```sql
SELECT * FROM resources WHERE metadata @> '{"tier": "premium"}'
```

## Index Selection

When creating indexes, consider:

1. **Query frequency**: Index heavily used queries
2. **Cardinality**: High-cardinality columns (many unique values) benefit most
3. **Write performance**: Indexes slow down INSERT/UPDATE/DELETE
4. **Storage**: Each index consumes disk space

Monitor slow queries:

```sql
-- Enable query logging
SET log_min_duration_statement = 1000;  -- Log queries >1000ms

-- Check query plan
EXPLAIN ANALYZE SELECT * FROM users WHERE email = '...'
```

## Index Maintenance

Indexes can become fragmented. Rebuild periodically:

```sql
REINDEX INDEX idx_users_email;
```

Or recreate:

```sql
DROP INDEX idx_users_email;
CREATE INDEX idx_users_email ON users(email);
```

PostgreSQL auto-vacuums to reduce index bloat.

## Indexed Columns in the Schema

Common indexed columns:

- `user_id`, `org_id`, `resource_id` (foreign keys)
- `email` (unique searches)
- `created_at`, `updated_at` (date ranges, sorting)
- `status` (filtering)
- `type` (enum filtering)

Check existing indexes:

```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'
```

## Index Performance Impact

Adding indexes affects read vs. write performance:

**Reads**: Faster (direct lookup instead of scan)
**Writes**: Slower (must update indexes)

For read-heavy APIs, more indexes is better. For write-heavy operations, use fewer indexes.

## Best Practices

1. **Index filtered columns**: If a query uses `WHERE status = '...'`, index `status`
2. **Composite indexes for common filters**: `(org_id, type)` for `WHERE org_id AND type`
3. **Unique indexes for uniqueness**: Enforce email uniqueness with indexes
4. **Avoid over-indexing**: Each index consumes storage and slows writes
5. **Monitor slow queries**: Use EXPLAIN ANALYZE to identify missing indexes
6. **Regular maintenance**: Rebuild fragmented indexes monthly

## Examples from Schema

From the users table:

```sql
CREATE INDEX idx_users_email ON users(email);          -- Email lookups
CREATE INDEX idx_users_created_at ON users(created_at); -- Date filtering
CREATE INDEX idx_users_org_id ON users(org_id);         -- Organization membership
CREATE INDEX idx_users_status ON users(status);         -- Status filtering
```

From the resources table:

```sql
CREATE INDEX idx_resources_org_type ON resources(org_id, type);
CREATE INDEX idx_resources_created_at ON resources(created_at);
CREATE INDEX idx_resources_metadata ON resources USING GIN(metadata);
```

Proper indexing is essential for API query performance. See [Performance Tuning](../deployment/performance-tuning.md) for optimization strategies.
