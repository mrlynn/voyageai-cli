# Rate Limiting (Deployment Perspective)

Rate limiting infrastructure protects backend services from overload. This document covers rate limiting from a deployment and infrastructure perspective.

## Rate Limiting Tiers

The platform enforces rate limits at infrastructure layer:

```
Load Balancer → Rate Limiter → Service Instances
  (ingress)   (enforce quota)    (process)
```

Rate limiter tracks usage per user/API key and blocks excessive traffic.

## Token Bucket Algorithm

Most rate limiters use token bucket:

```
Bucket capacity: 100 tokens
Refill rate: 10 tokens/second

Time 0s:   100 tokens (full)
Time 0.1s: Consume 10 tokens → 90 left
Time 1.0s: Refilled → 100 tokens
```

Allows bursts (temporary spikes) while enforcing average rate.

## Infrastructure Rate Limiting

Rate limits enforced before requests reach application:

**Per-IP rate limiting**:
```
192.168.1.1: 1000 req/min (normal user)
192.168.1.2: 100 req/min (rate limited)
```

**Per-API-key rate limiting**:
```
sk_live_abc: Quota 10M req/month
sk_live_xyz: Quota 100K req/month
```

## Distributed Rate Limiting

In multi-server setup, coordinate rate limits globally:

```
Server 1 ──┐
Server 2 ──┼→ Redis (shared state) → Rate Limit Decision
Server 3 ──┘

User makes request to Server 1.
Server 1 checks with Redis: "Can user_123 make request?"
Redis: "4 requests remaining of 5/minute"
Allow request, decrement counter.
```

Redis ensures global consistency across all servers.

## DDoS Protection

Rate limiting mitigates DDoS attacks:

```
Normal traffic: 1000 req/sec
Attack: 1M req/sec (1000x spike)

Rate limiter drops excess requests.
Services see normal traffic → stay healthy.
Attacker's traffic discarded (doesn't reach backend).
```

## Configuration

Rate limits configured per tier:

```yaml
Rate Limits:
  Free Plan:
    requests_per_second: 10
    requests_per_month: 100K
  
  Pro Plan:
    requests_per_second: 100
    requests_per_month: 10M
  
  Enterprise:
    Custom limits (negotiate with sales)
```

## Monitoring Rate Limiting

Track rate limit effectiveness:

```
Requests blocked by rate limiter: 0.1% (normal)
Requests blocked due to quota: 0.01% (expected overages)
Blocked requests trending up? → Investigate legitimate use spike
```

Alert if legitimate users are being blocked.

## Graceful Degradation

When rate limited:

```
500 total requests limit
400 consumed by normal traffic
100 reserved for important operations

If reaching limit:
1. Non-critical requests rejected (429)
2. Critical requests proceed (database writes, etc.)
3. Excess traffic discarded
```

Prioritize critical operations during overload.

## Cost-Based Rate Limiting

Some operations consume more quota:

```
List users (100 items): 1 unit
Get user details: 1 unit
Analytics query (expensive): 10 units
Bulk create 1000 users: 100 units
```

Users consuming resources pay proportionally.

## See Also

- [Rate Limiting (Endpoints)](../endpoints/rate-limiting-endpoints.md) - API client perspective
- [Scaling](scaling.md) - Infrastructure scaling
- [Load Balancing](load-balancing.md) - Traffic distribution
