# Caching

Caching stores frequently accessed data in fast-access layers to reduce database load and latency.

## Cache Types

**In-Memory Cache** (Application):
```
Application ← Cache (Redis/Memcached) ← Database
  (10MB)     (1GB, <5ms latency)    (1TB, 100ms latency)
```

**HTTP Cache** (Browser/CDN):
```
GET /users/user_123
→ Cache-Control: max-age=300
→ Browser caches for 5 minutes
→ Subsequent requests use cached copy
```

**Database Cache** (Query result cache):
```
SELECT * FROM users WHERE status='active'
→ Result cached for 1 hour
→ Repeated queries served from cache
```

## Cache-Aside Pattern

Application manages cache:

```
GET user:
  1. Check cache
  2. If miss: Query database
  3. Store in cache
  4. Return to client
```

```python
def get_user(user_id):
    cached = cache.get(f'user:{user_id}')
    if cached:
        return cached
    
    user = db.get_user(user_id)
    cache.set(f'user:{user_id}', user, ttl=3600)
    return user
```

## Write-Through Cache

Update cache when writing data:

```
PUT user:
  1. Write to database
  2. Update cache
  3. Return success
```

Ensures cache stays consistent.

## Cache Invalidation

When data changes, invalidate cache:

```python
def update_user(user_id, data):
    db.update(user_id, data)
    cache.delete(f'user:{user_id}')  # Invalidate
```

Or set short TTL to expire automatically.

## Cache Warm-Up

Pre-load cache with popular data:

```
On startup:
1. Load top 1000 users into cache
2. Load popular resources
3. Cache is "warm" (ready to serve)

vs.

Cold start: First requests miss cache, slow
```

## Distributed Caching

Share cache across services:

```
Service 1 ──┐
Service 2 ──┼→ Redis (shared cache)
Service 3 ──┘
```

All services access same cache; consistent view of data.

## Cache Eviction Policies

When cache is full, remove old entries:

**LRU** (Least Recently Used): Remove least recently accessed
**LFU** (Least Frequently Used): Remove least frequently accessed
**TTL** (Time To Live): Remove expired entries

## Monitoring Cache

Track cache effectiveness:

```
Cache hit ratio: 85% (good)
Cache size: 5GB / 10GB limit
Eviction rate: 1000 items/hour (acceptable)
```

Low hit ratio? → Increase cache size or improve key strategy

## Cache Stampede

When popular cache key expires, many requests query database:

```
cache.get(popular_key)  → MISS (expired)
Request 1: → Database query
Request 2: → Database query
Request 3: → Database query
...
```

Prevention: Use probabilistic early expiration or locks.

## See Also

- [Scaling](scaling.md) - Infrastructure scaling
- [Load Balancing](load-balancing.md) - Traffic distribution
- [Performance Tuning](performance-tuning.md) - Optimization
