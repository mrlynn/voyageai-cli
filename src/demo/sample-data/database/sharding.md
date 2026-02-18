# Sharding and Horizontal Scaling

Sharding distributes data across multiple database instances to handle enormous datasets that exceed single-server capacity. It's a fundamental scaling strategy for large SaaS platforms.

## Sharding Concepts

A shard is a partitioned subset of data distributed across separate database instances. Each shard holds different rows of the same table.

**Example: Users table sharded by user_id**

```
User ID Range | Shard
1-1M          | shard_1 (db1)
1M-2M         | shard_2 (db2)
2M-3M         | shard_3 (db3)
3M+           | shard_4 (db4)
```

## Sharding Strategies

### Hash-Based Sharding

Hash user_id to determine shard:

```
shard = hash(user_id) % num_shards
shard = hash("user_123") % 4 = 2  // routes to shard_3
```

**Pros**: Evenly distributed, simple
**Cons**: Adding/removing shards requires reshuffling (expensive)

### Range-Based Sharding

Assign ranges to shards:

```
user_id 1-1M         → shard_1
user_id 1M-2M        → shard_2
user_id 2M-3M        → shard_3
user_id 3M-9999999   → shard_4
```

**Pros**: Easy to add new shards
**Cons**: Uneven distribution if data is skewed

### Geographic Sharding

Shard by region:

```
region = 'US'      → shard_us (db in us-east-1)
region = 'EU'      → shard_eu (db in eu-west-1)
region = 'APAC'    → shard_apac (db in ap-southeast-1)
```

**Pros**: Reduced latency, compliance (data residency)
**Cons**: Uneven distribution

### Directory-Based Sharding

Maintain lookup table:

```
user_id → shard mapping
user_1 → shard_1
user_123 → shard_4
user_999 → shard_2
```

**Pros**: Flexible, easy rebalancing
**Cons**: Lookup table becomes bottleneck

## Implementing Sharding

The SaaS platform uses **hash-based sharding by organization_id**:

```python
def get_shard(org_id):
    num_shards = 16  # Configurable
    shard_id = hash(org_id) % num_shards
    return f"shard_{shard_id}"

# Example
shard = get_shard("org_123")  # → shard_7
connection = connect_to_shard(shard)
```

## Single Shard Queries

Queries involving a shard key are efficient (single shard):

```sql
-- Single shard (fast)
SELECT * FROM users WHERE org_id = 'org_123'
```

Routes to the shard containing org_123.

## Cross-Shard Queries

Queries not filtering by shard key must query all shards:

```sql
-- Cross-shard query (slow)
SELECT COUNT(*) FROM users WHERE status = 'active'
```

Executes on all shards, aggregates results. Much slower.

Minimize cross-shard queries for performance.

## Joins Across Shards

Joining tables on different shard keys requires careful design:

```
users (sharded by org_id)
orders (sharded by org_id)

Good: JOIN users u JOIN orders o ON u.org_id = o.org_id
Bad: JOIN users u JOIN products p (different shard keys)
```

Avoid joins across shard boundaries. Denormalize if necessary.

## Rebalancing Shards

As data grows, rebalance shards to maintain even distribution:

**Original**:
```
shard_1: 10M rows
shard_2: 11M rows
shard_3: 9M rows
shard_4: 10M rows
```

**After rebalancing to 8 shards**:
```
shard_1: 5M rows
shard_2: 5M rows
...
shard_8: 5M rows
```

**Rebalancing process**:

1. Create new shard infrastructure
2. Copy affected data
3. Update routing table
4. Verify new shards
5. Decommission old shards

Rebalancing can cause temporary latency increases.

## Drawbacks of Sharding

1. **Operational complexity**: Managing many databases
2. **Cross-shard queries slow**: Need special handling
3. **Data rebalancing**: Expensive and disruptive
4. **Distributed transactions**: Difficult across shards
5. **Application logic**: Must be shard-aware

## Hot Shards

If one shard receives disproportionate traffic:

```
shard_1: 1000 req/sec (hot)
shard_2: 100 req/sec
shard_3: 100 req/sec
shard_4: 100 req/sec
```

Causes:
- Uneven data distribution
- Popular customer concentrating load
- Skewed sharding strategy

Solutions:
- Split hot shard further
- Use [caching](../deployment/caching.md) to reduce load
- Denormalize frequently accessed data

## Sharding and [Pagination](../endpoints/pagination.md)

Pagination with sharding is complex. Standard offset-based pagination fails:

```
GET /users?page=100  // Unclear which shard?
```

Use cursor-based pagination with shard information:

```
GET /users?cursor=shard_3:offset_500
```

Cursor encodes shard ID and position within shard.

## Backup and Recovery with Shards

Each shard must have backups:

```
shard_1 backup → Cold storage
shard_2 backup → Cold storage
shard_3 backup → Cold storage
shard_4 backup → Cold storage
```

Recovering one shard doesn't impact others—better granularity.

## When to Shard

Shard when:
- Single database exceeds 500GB (or your infrastructure limit)
- Query latency unacceptable despite [optimization](../deployment/performance-tuning.md)
- Cannot scale vertically (bigger hardware) further
- Team has sharding expertise

Don't shard too early; it adds operational burden.

## Example Sharding Scenario

Platform has grown:
- 100,000 organizations
- 50 million users
- 5 billion records

**Before sharding**:
```
Single database: 2TB
Query latency: 500ms (unacceptable)
Operations: Difficult (single failure point)
```

**After sharding (16 shards)**:
```
Each shard: 125GB
Query latency: 50ms (acceptable)
Operations: More complex but resilient
```

## See Also

- [Scaling](../deployment/scaling.md) - Vertical and horizontal scaling strategies
- [Performance Tuning](../deployment/performance-tuning.md) - Query optimization
- [Pagination](../endpoints/pagination.md) - Cursor-based pagination for sharded systems
