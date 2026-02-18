# Rate Limiting (Endpoints Perspective)

Rate limiting protects the API from abuse and ensures fair resource allocation among all users. Understanding rate limits and implementing proper backoff strategies is essential for reliable integrations.

## Rate Limit Tiers

All authenticated users receive 100 requests per second quota. Burst capacity allows short spikes up to 200 requests per second, but sustained rates above 100/s are throttled.

Rate limits are applied per user/API key, not globally. Each authenticated principal has its own quota.

**Tier 1 (Free)**: 100 req/sec, 100,000 req/day
**Tier 2 (Standard)**: 500 req/sec, 1,000,000 req/day
**Tier 3 (Enterprise)**: Custom limits (contact sales)

Upgrade tiers via the dashboard.

## Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1645198456
```

- `Limit`: Your quota per second
- `Remaining`: Requests remaining in current second window
- `Reset`: Unix timestamp when the quota resets

## Throttling Response

When you exceed your rate limit, the API returns 429 Too Many Requests:

```json
{
  "error": "rate_limit_exceeded",
  "message": "You have exceeded your rate limit of 100 requests/sec",
  "retry_after": 5
}
```

The `Retry-After` header (in seconds) indicates how long to wait before retrying:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 5
X-RateLimit-Reset: 1645198456
```

## Implementing Backoff

When receiving 429, implement exponential backoff with jitter:

```
wait = min(base * (2 ^ attempt), max_wait) + random(0, 1000ms)
```

Example:
```
Attempt 1: wait ~1s (base * 2^0 = 1s)
Attempt 2: wait ~2s (base * 2^1 = 2s)
Attempt 3: wait ~4s (base * 2^2 = 4s)
Max wait: 60s
```

Add jitter to prevent thundering herd (all clients retrying simultaneously).

## Endpoint-Specific Limits

Some endpoints have tighter limits due to resource consumption:

- Analytics queries: 10 req/sec
- Report generation: 5 req/sec
- Webhook delivery: 1,000 req/sec (delivery side)
- Bulk operations: 50 req/sec

These are listed in endpoint documentation.

## Cost-Based Limiting

Some operations consume more quota than others. Heavy operations (e.g., large bulk uploads) consume quota proportional to their cost:

```
Standard request: 1 quota unit
Bulk create 100 items: 10 quota units
Analytics query: 5 quota units
```

Quota consumption is included in rate limit headers.

## Distributed Rate Limiting

For distributed applications with many servers, coordinate rate limits globally. The API tracks usage across all of your servers; individual server requests are counted together toward your quota.

## Daily and Monthly Limits

Beyond per-second limits, daily and monthly quotas apply:

```
100 req/sec limit → ~8.6M requests/day
100,000 req/day limit (tier-dependent)
```

Exceeding daily limits returns 429 with a longer Retry-After.

## Monitoring and Alerts

Monitor your rate limit consumption:

```
GET /admin/rate-limits/usage
{
  "current_second": 45,
  "peak_second": 98,
  "daily_usage": 2500000,
  "monthly_usage": 45000000
}
```

Set up alerts for approaching limits (>80% usage).

## Whitelisting and Exemptions

For critical integrations, request rate limit exemptions. Enterprise customers receive customized limits. Submit requests via support.

Exempted IPs are tracked and logged for compliance.

## Rate Limit Strategies

**Optimize requests**: Batch operations, use pagination efficiently, cache responses.

**Distribute load**: Spread requests over time rather than in bursts.

**Queue jobs**: For batch operations, queue them and process asynchronously.

**Upgrade plan**: If consistently hitting limits, upgrade to higher tier.
