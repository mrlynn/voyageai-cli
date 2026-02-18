# Structured Logging

Structured logging captures system behavior for debugging, monitoring, and compliance. Proper logging is essential for observability.

## Structured Logging Format

Instead of unstructured text, use structured (JSON) logs:

**Unstructured**:
```
2026-02-18 12:34:56 User alice@example.com logged in from IP 192.168.1.1
```

**Structured (JSON)**:
```json
{
  "timestamp": "2026-02-18T12:34:56Z",
  "level": "INFO",
  "message": "user_login",
  "user_id": "user_123",
  "email": "alice@example.com",
  "ip_address": "192.168.1.1",
  "user_agent": "Chrome/90",
  "session_id": "sess_abc123",
  "duration_ms": 150
}
```

Structured logs are:
- Queryable: Filter by any field
- Parseable: Machine-readable
- Consistent: Same format across services

## Log Levels

Use appropriate levels to control verbosity:

- **DEBUG**: Detailed debugging info (disabled in production)
- **INFO**: General information (logins, key events)
- **WARN**: Warning conditions (deprecated API use, approaching limits)
- **ERROR**: Error conditions (failures, exceptions)
- **CRITICAL/FATAL**: Critical errors (data corruption, complete outage)

## Context Propagation

Include context across distributed systems:

```python
import uuid

# Generate request ID
request_id = str(uuid.uuid4())

logger.info('Processing request', extra={
    'request_id': request_id,
    'user_id': 'user_123',
    'endpoint': '/users/user_123'
})

# Pass request_id to downstream services
response = api.call_service(
    headers={'X-Request-ID': request_id}
)
```

Later, reconstruct call flow using request_id.

## Sampling Large Logs

For high-volume logs (millions per day), sample to reduce cost:

```python
import logging

class SamplingFilter(logging.Filter):
    def __init__(self, sample_rate=0.1):  # Log 10%
        self.sample_rate = sample_rate
    
    def filter(self, record):
        if record.levelno >= logging.WARNING:
            return True  # Always log errors
        return random.random() < self.sample_rate

logger.addFilter(SamplingFilter(sample_rate=0.1))
```

Log all errors; sample lower-level events.

## Security in Logs

Never log sensitive data:

```python
# ✗ Bad: Logs PII
logger.info('User login', extra={'email': email, 'password_hash': hash})

# ✓ Good: Sanitize sensitive data
logger.info('User login', extra={
    'user_id': user_id,
    'email': mask_email(email),  # 'alice@***'
    'ip_address': ip
})
```

Sanitize:
- Passwords and tokens
- Credit card numbers
- SSNs and government IDs
- Email addresses (in some contexts)

## Log Storage and Retention

Store logs in centralized system:

```
Application → Logging Service → Log Storage
                    ↓
              CloudWatch / ELK / Splunk
                    ↓
              Long-term archive (cold storage)
```

Retention:
- Hot storage (searchable): 30 days
- Warm storage: 90 days
- Cold storage (archive): 1 year

## Querying Logs

Query logs with structured fields:

```
# Find all errors for user 123
logs | filter(level='ERROR' AND user_id='user_123')

# Errors in last 24 hours
logs | filter(timestamp > now()-24h) | filter(level='ERROR')

# Slowest requests
logs | filter(duration_ms > 5000) | sort(duration_ms desc)

# Errors by service
logs | filter(level='ERROR') | group_by(service) | count()
```

## Performance Impact

Excessive logging impacts performance. Be selective:

```python
# ✗ Bad: Logs every API call
logger.debug(f'Calling API: {method} {url}')

# ✓ Good: Logs only errors and slow requests
if duration_ms > 1000:
    logger.warn(f'Slow request: {method} {url}', extra={'duration_ms': duration_ms})
```

Profile your logging; aim for <1% performance impact.

## See Also

- [Error Handling](error-handling.md) - Error recovery strategies
- [Monitoring](monitoring.md) - Observability and alerting
