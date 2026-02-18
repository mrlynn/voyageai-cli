# Scaling

Scaling strategies for handling growth in traffic and data.

## Vertical Scaling

Add resources to existing servers:

```
Before:  1 server with 8 GB RAM, 4 CPUs
After:   1 server with 64 GB RAM, 32 CPUs

Cost increase: 8x
Throughput increase: 6-7x (diminishing returns)
```

Limitations: Can't scale forever; maximum hardware limits.

## Horizontal Scaling

Add more servers:

```
Before: 1 server (1000 req/sec)
After:  10 servers (10,000 req/sec)

Load Balancer distributes traffic across servers.
```

Better for large scales; enables unlimited growth.

## Auto-Scaling

Automatically add/remove servers based on load:

```
CPU usage < 20%  → Remove servers (save costs)
CPU usage 20-80% → Maintain current servers
CPU usage > 80%  → Add servers (handle load)

Scales up in minutes; scales down in 10-15 minutes.
```

Balances cost and performance.

## Database Scaling

**Read scaling**: Add replicas for read-heavy workloads.
```
Primary (write)
├── Replica 1 (read)
├── Replica 2 (read)
└── Replica 3 (read)
```

**Write scaling**: Use sharding to distribute writes.
```
Shard 1 (org IDs 1-1M)
Shard 2 (org IDs 1M-2M)
Shard 3 (org IDs 2M+)
```

## Caching for Scaling

Cache frequently accessed data:

```
Request → Cache (hit) → 1ms response
Request → Cache (miss) → Database → 100ms response

Cache hit rate: 90%
Average latency: 1ms * 0.9 + 100ms * 0.1 = 10.9ms
```

See [Caching](caching.md) for details.

## Costs of Scaling

Horizontal scaling costs grow linearly:

```
1 server: $1000/month
10 servers: $10,000/month
100 servers: $100,000/month
```

Use efficient code and caching to reduce server count.

## See Also

- [Load Balancing](load-balancing.md) - Traffic distribution
- [Sharding](../database/sharding.md) - Data distribution
- [Caching](caching.md) - Performance optimization
- [Performance Tuning](performance-tuning.md) - Optimization techniques
