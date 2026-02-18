# Load Balancing

Load balancers distribute traffic across multiple servers for scalability and resilience.

## Load Balancing Strategies

**Round Robin**: Distribute requests evenly.
```
Request 1 → Server 1
Request 2 → Server 2
Request 3 → Server 3
Request 4 → Server 1 (cycle)
```

**Least Connections**: Route to server with fewest connections.
```
Server 1: 5 connections
Server 2: 2 connections
Request → Server 2
```

**Weighted**: Favor more powerful servers.
```
Server 1 (8 CPU): 50% of traffic
Server 2 (4 CPU): 50% of traffic
```

**IP Hash**: Same client always routes to same server (session affinity).
```
hash(client_ip) % num_servers → consistent routing
```

## Health Checks

Load balancer monitors server health:

```
Every 10 seconds:
  GET /health
  
  200 OK → Server healthy (route traffic)
  503 → Server unhealthy (remove from pool)
```

Failed servers removed from rotation; traffic reroutes.

## Sticky Sessions

Keep user on same server (if needed):

```
Client 1 → Server 1 (for all requests)
Client 2 → Server 2 (for all requests)

Useful for in-memory sessions.
```

Modern systems prefer stateless design (cache sessions in Redis).

## Geographic Load Balancing

Route users to nearest data center:

```
User in US → us-east-1 data center
User in EU → eu-west-1 data center
User in APAC → ap-southeast-1 data center
```

Reduces latency; improves performance.

## Connection Draining

Gracefully shut down servers:

```
1. Mark server "draining"
2. Stop sending new requests
3. Wait for existing requests to complete
4. Shut down (no abrupt disconnects)
```

## Failover

If load balancer fails:

```
Primary Load Balancer → Active
Secondary Load Balancer → Standby

Primary fails → Secondary activates (transparent failover)
```

## Monitoring Load Balancer

Track health:

```
Distribution: 
  Server 1: 33% of traffic (expected)
  Server 2: 33% of traffic (expected)
  Server 3: 33% of traffic (expected)

Latency:
  P50: 100ms
  P95: 500ms
  P99: 2s
```

Uneven distribution indicates unhealthy server.

## See Also

- [Scaling](scaling.md) - Infrastructure scaling
- [Rate Limiting](rate-limiting-deployment.md) - Traffic control
