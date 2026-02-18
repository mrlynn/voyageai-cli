# Error Handling Strategies

Proper error handling is essential for building reliable applications. This guide covers strategies for graceful degradation, recovery, and debugging.

## Error Classification

Categorize errors to determine appropriate response:

**Retryable Errors** (temporary, safe to retry):
- Network timeouts (connection lost)
- 429 Too Many Requests (rate limited)
- 503 Service Unavailable (temporary outage)
- 500 Internal Server Error (might be transient)

**Non-Retryable Errors** (permanent, don't retry):
- 401 Unauthorized (fix credentials)
- 403 Forbidden (insufficient permissions)
- 404 Not Found (resource doesn't exist)
- 400 Bad Request (invalid parameters)
- 422 Unprocessable Entity (invalid state)

## Retry Strategy

Implement exponential backoff with jitter:

```python
import time
import random

max_retries = 5
base_wait = 0.1  # 100ms

for attempt in range(max_retries):
    try:
        response = api.request(...)
        break
    except RetryableError as e:
        if attempt == max_retries - 1:
            raise  # Last attempt
        
        wait = min(base_wait * (2 ** attempt), 60)  # Cap at 60s
        jitter = random.uniform(0, wait * 0.1)
        time.sleep(wait + jitter)
```

This prevents thundering herd and gives services time to recover.

## Circuit Breaker Pattern

Prevent cascading failures by "breaking" the circuit when errors exceed threshold:

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func, *args):
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.timeout:
                self.state = 'HALF_OPEN'
            else:
                raise CircuitBreakerOpen()
        
        try:
            result = func(*args)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise

breaker = CircuitBreaker()
try:
    breaker.call(api.get_user, user_id)
except CircuitBreakerOpen:
    # Circuit open; use fallback
    user = get_cached_user(user_id)
```

## Fallback Strategies

When primary service fails, use fallback:

```python
def get_user_with_fallback(user_id):
    try:
        return api.get_user(user_id)
    except (Timeout, ServiceUnavailable):
        # Fallback to cache
        cached = cache.get(f'user:{user_id}')
        if cached:
            return cached
        # Fallback to stale data
        return db.get_user_stale(user_id)
```

Provide graceful degradation with stale data rather than failing completely.

## Error Logging

Log errors with sufficient context:

```python
logger.error(
    'API request failed',
    extra={
        'endpoint': '/users/user_123',
        'method': 'GET',
        'status': 404,
        'error_code': 'resource_not_found',
        'request_id': 'req_abc123',
        'duration_ms': 250,
        'retry_attempt': 2
    }
)
```

Include:
- Endpoint and method
- HTTP status
- Error code (machine-readable)
- Request ID (for tracing)
- Duration
- Retry count

## Distributed Tracing

Use request IDs to trace errors through microservices:

```python
import uuid

request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())

logger.info('Processing request', extra={'request_id': request_id})

try:
    result = api.call_service(headers={'X-Request-ID': request_id})
except Exception as e:
    logger.error('Service call failed', extra={
        'request_id': request_id,
        'service': 'payment_service',
        'error': str(e)
    })
```

Propagate `request_id` through all services. Later, you can reconstruct call flow:

```
Request ID: req_abc123
  1. Web server receives request
  2. Calls payment_service (passes req_abc123)
  3. Calls fraud_detection_service (passes req_abc123)
  4. fraud_detection_service timeout
  5. Payment service retries
  ...
```

## User-Facing Error Messages

Don't expose internal details; provide helpful messages:

```python
# ✗ Bad: Internal details
if error.code == 'FOREIGN_KEY_VIOLATION':
    raise Exception("Foreign key constraint violated on users.org_id")

# ✓ Good: User-friendly
if error.code == 'INVALID_ORGANIZATION':
    raise UserError("Organization not found. Please verify the organization ID.")
```

## Alerting

Set up alerts for critical errors:

```yaml
Alerts:
  - name: high_error_rate
    condition: error_rate > 5%
    severity: critical
    action: page_oncall
  
  - name: payment_service_down
    condition: response_time > 10s OR status_code = 503
    severity: critical
    action: page_oncall
  
  - name: slow_api_response
    condition: p99_latency > 5s
    severity: warning
    action: notify_team
```

Monitor error rates and latency; alert on anomalies.

## Error Budgets

Track error budgets to balance reliability and feature velocity:

```
Service SLA: 99.9% uptime = 43.2 minutes of acceptable downtime per month

Used this month: 15 minutes
Remaining budget: 28.2 minutes

High-risk changes (deploy when budget >50%): Deploy approved
Low-risk changes: Deploy anytime
```

This prevents deploying risky changes when error budget is exhausted.

## Debugging

Use structured logging for easier debugging:

```python
logger.debug('User lookup', extra={
    'user_id': user_id,
    'database': 'replica_1',
    'query_time_ms': 45,
    'cache_hit': False,
    'cache_ttl': 3600
})
```

Later, query logs to understand behavior:

```bash
# Find all slow user lookups
logs | grep 'User lookup' | filter(query_time_ms > 100)

# Analyze cache hit rate
logs | grep 'User lookup' | stats(cache_hit)
```

## Error Recovery Scenarios

**Scenario: Payment Processing Fails**

```
1. Payment request times out
2. Circuit breaker detects repeated timeouts
3. Return "Processing, check status later"
4. Background job retries payment
5. Webhook notifies of outcome
6. User checks payment status
```

**Scenario: Database Connection Lost**

```
1. Connection error detected
2. Failover to replica initiated
3. Queries rerouted to replica (read-only)
4. Write operations queued
5. Primary recovers
6. Switch back to primary
7. Process queued writes
```

## See Also

- [Error Responses](../endpoints/error-responses.md) - HTTP error response format
- [Debugging](debugging.md) - Debugging techniques
- [Monitoring](monitoring.md) - Observability and alerting
