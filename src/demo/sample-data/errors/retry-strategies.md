# Retry Strategies

Implementing robust retry logic is critical for resilient applications. This guide covers retry strategies for different failure scenarios.

## When to Retry

**Retryable errors**:
- Network timeouts (temporary connectivity issues)
- 429 Too Many Requests (rate limited; will recover)
- 503 Service Unavailable (temporary outage)
- 500 Internal Server Error (may be transient)
- Connection refused (service starting up)

**Non-retryable errors**:
- 401 Unauthorized (authentication failure; won't recover)
- 403 Forbidden (authorization; retrying won't help)
- 404 Not Found (resource doesn't exist)
- 400 Bad Request (malformed request)
- 422 Unprocessable Entity (invalid business logic)

## Exponential Backoff

Wait longer between retries to give services time to recover:

```python
max_retries = 5
base_wait = 0.1  # 100ms

for attempt in range(max_retries):
    try:
        return api.call()
    except RetryableError:
        if attempt == max_retries - 1:
            raise
        wait = base_wait * (2 ** attempt)  # Exponential growth
        time.sleep(wait)

# Wait times: 100ms, 200ms, 400ms, 800ms, 1600ms
```

## Jitter

Add randomness to prevent thundering herd (all clients retrying simultaneously):

```python
wait = base_wait * (2 ** attempt)
jitter = random.uniform(0, wait * 0.1)
time.sleep(wait + jitter)
```

Without jitter, if 1000 clients hit the same 429 error, all retry in unison, causing another spike. With jitter, retries are spread out.

## Capped Exponential Backoff

Exponential backoff can grow unbounded. Cap the maximum:

```python
max_wait = 60  # Cap at 60 seconds
wait = min(base_wait * (2 ** attempt), max_wait)
time.sleep(wait)

# Wait times: 100ms, 200ms, 400ms, 800ms, 1.6s, 3.2s, 6.4s, 12.8s, 25.6s, 60s, 60s, 60s
```

## Retry-After Header

Respect the `Retry-After` header if provided:

```python
if response.status == 429:
    retry_after = int(response.headers.get('Retry-After', 60))
    time.sleep(retry_after)
```

The server tells you exactly how long to wait; trust it.

## Idempotent Retries

Make retries safe by using idempotency keys:

```python
import uuid

idempotency_key = str(uuid.uuid4())

for attempt in range(max_retries):
    try:
        response = api.post(
            '/orders',
            data={...},
            headers={'Idempotency-Key': idempotency_key}
        )
        return response
    except RetryableError:
        time.sleep(backoff(attempt))
```

Same `Idempotency-Key` + body = same response. Retrying is safe.

## Dead Letter Queue

If retries exceed maximum, queue for later processing:

```python
try:
    api.process_order(order_id)
except Exception as e:
    if retry_count >= max_retries:
        # Queue for background job
        dead_letter_queue.put({
            'order_id': order_id,
            'error': str(e),
            'attempted_at': now(),
            'retry_count': retry_count
        })
    else:
        raise
```

Background jobs can process queued items later with exponential backoff.

## Circuit Breaker with Retries

Combine retries with circuit breaker to avoid cascading failures:

```python
breaker = CircuitBreaker(failure_threshold=5, timeout=60)

try:
    breaker.call(api.get_user, user_id)
except CircuitBreakerOpen:
    # Circuit open; don't retry
    return get_cached_user(user_id)
except Exception as e:
    # Circuit closed or half-open; retry
    for attempt in range(max_retries):
        try:
            return breaker.call(api.get_user, user_id)
        except Exception:
            time.sleep(backoff(attempt))
```

## Deadline/Timeout

Set absolute deadline for all retries:

```python
import time

deadline = time.time() + 30  # 30 second deadline

while time.time() < deadline:
    try:
        return api.call()
    except RetryableError:
        remaining = deadline - time.time()
        if remaining <= 0:
            raise TimeoutError("Exceeded deadline")
        wait = min(backoff(attempt), remaining)
        time.sleep(wait)
```

Even with retries, don't wait forever.

## Retry Budgets

Limit total retries to prevent excessive load:

```python
# Each service gets 10% of requests as retries
retry_budget = 0.1
total_requests = 0
retry_requests = 0

for request in incoming:
    try:
        api.call()
    except RetryableError:
        if retry_requests / max(1, total_requests) < retry_budget:
            # Budget available; retry
            retry_request()
            retry_requests += 1
        else:
            # Budget exhausted; reject
            reject_request()
    total_requests += 1
```

This prevents cascading failures when multiple services fail.

## Transient Failure Examples

**Example 1: Connection Timeout**

```python
for attempt in range(3):
    try:
        response = requests.get('https://api.example.com/users', timeout=5)
        return response.json()
    except requests.Timeout:
        if attempt == 2:
            raise
        time.sleep(1 * (2 ** attempt))
```

**Example 2: Rate Limited (429)**

```python
for attempt in range(5):
    try:
        response = api.list_users()
        return response
    except RateLimitError:
        retry_after = int(response.headers.get('Retry-After', 60))
        time.sleep(retry_after)
```

**Example 3: Transient 500 Error**

```python
for attempt in range(3):
    try:
        response = api.create_order(order_data)
        return response
    except ServerError as e:
        if e.status == 500 and attempt < 2:
            time.sleep(0.5 * (2 ** attempt))
        else:
            raise
```

## Testing Retries

Test retry logic with mock failures:

```python
class FailingAPI:
    def __init__(self, fail_times=1):
        self.call_count = 0
        self.fail_times = fail_times
    
    def call(self):
        self.call_count += 1
        if self.call_count <= self.fail_times:
            raise ConnectionError("Simulated failure")
        return {"success": True}

# Test that 1 retry succeeds after 1 failure
api = FailingAPI(fail_times=1)
result = call_with_retries(api)
assert result['success'] == True
assert api.call_count == 2  # Called twice
```

## Best Practices

1. **Always retry transient errors**: Network timeouts, rate limits, 5xx
2. **Never retry non-transient errors**: Auth failures, 404s, validation errors
3. **Use exponential backoff**: 100ms, 200ms, 400ms, ...
4. **Add jitter**: Prevent thundering herd
5. **Cap wait time**: Don't wait forever
6. **Use idempotency keys**: Make retries safe
7. **Set deadlines**: Absolute timeout for all retries
8. **Monitor retry rates**: Alert on abnormally high retry rates

See [Error Handling](error-handling.md) for comprehensive error strategies.
