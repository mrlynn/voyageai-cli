# Troubleshooting Guide

Quick reference for diagnosing common problems.

## Quick Checklist

- [ ] Is the service up? (Health check endpoint)
- [ ] Are credentials valid? (Try different token)
- [ ] Is endpoint correct? (Check URL spelling)
- [ ] Is request format correct? (Validate JSON)
- [ ] Are you rate limited? (Check rate limit headers)
- [ ] Is network connectivity OK? (Ping service)
- [ ] Have you checked logs? (Search for request ID)
- [ ] Is it a known issue? (Check status page, issues)

## Network Connectivity

Test basic connectivity:

```bash
# Check DNS
nslookup api.example.com

# Test connection
curl https://api.example.com/health -v

# Check latency
ping api.example.com

# Check routing
traceroute api.example.com
```

## Authentication Issues

Verify authentication:

```bash
# Check token validity
curl -H "Authorization: Bearer <token>" https://api.example.com/users/me

# Try different token
export NEWTOKEN=$(curl -X POST https://api.example.com/auth/token \
  -d '{"api_key": "sk_live_abc123"}' | jq -r '.access_token')

# Retry with new token
curl -H "Authorization: Bearer $NEWTOKEN" https://api.example.com/users
```

## Request Debugging

Isolate issues:

```bash
# Step 1: Test with curl (isolate SDK issue)
curl https://api.example.com/users/user_123 \
  -H "Authorization: Bearer token"

# Step 2: Test with valid token (isolate auth)
curl https://api.example.com/users/user_123 \
  -H "Authorization: Bearer $(get_valid_token)"

# Step 3: Test with different user ID (isolate data issue)
curl https://api.example.com/users/user_456

# Step 4: Test simpler endpoint (isolate endpoint)
curl https://api.example.com/health
```

## Log Analysis

Search logs for issues:

```bash
# Find errors for request
logs | filter(request_id = 'req_abc123')

# Find all errors for user
logs | filter(user_id = 'user_123' AND level = 'ERROR')

# Find slow requests
logs | filter(duration_ms > 5000)

# Find recent changes
logs | filter(timestamp > now() - 1h) | group_by(service)
```

## Performance Issues

Diagnose slowness:

```bash
# Measure request time
time curl https://api.example.com/users/user_123

# Check network latency
ping -c 5 api.example.com

# Check service health
curl https://api.example.com/health

# Check database queries
EXPLAIN ANALYZE SELECT * FROM users WHERE id = 'user_123'
```

## Data Inconsistency

Verify data consistency:

```bash
# Fetch from API
curl https://api.example.com/users/user_123 | jq .

# Fetch from database (if access available)
SELECT * FROM users WHERE user_id = 'user_123'

# Compare values
# If different: cache stale, database inconsistent, or API bug
```

## Version Compatibility

Check version compatibility:

```bash
# Check SDK version
npm list @saasplatform/sdk

# Check API version (from response headers)
curl -i https://api.example.com/users | grep API-Version

# Check for deprecation warnings
curl -i https://api.example.com/users | grep Deprecation
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 errors | Missing/invalid token | Refresh or re-authenticate |
| 403 errors | Insufficient scope | Request broader scopes |
| 404 errors | Resource doesn't exist | Verify resource ID exists |
| 429 errors | Rate limited | Implement backoff |
| 500 errors | Server error | Retry with backoff |
| Timeout | Slow service | Increase timeout, simplify query |
| Slow response | Database slow | Add indexes, optimize query |
| High error rate | Service down | Check status page, page oncall |

## Contacting Support

When reaching out to support:

1. **Include request ID**: Essential for tracing
2. **Describe issue**: What were you trying to do?
3. **Include error message**: Exact error response
4. **Share steps to reproduce**: Minimal example
5. **Include environment**: API version, SDK version, language
6. **Attach logs**: Full logs of failing requests

Example support request:

```
Subject: 404 errors on user creation

Request ID: req_xyz789
Issue: Creating users returns 404 after successful creation
Steps to reproduce:
  curl -X POST https://api.example.com/users \
    -H "Authorization: Bearer token" \
    -d '{"name": "Alice", "email": "alice@example.com"}'
  Returns: 201 Created with user_id: user_123
  
  curl https://api.example.com/users/user_123 \
  Returns: 404 Not Found
  
Environment:
  API: v2
  SDK: saasplatform/sdk-js 2.3.0
  Node: 18.0.0
  
Logs: [attached]
```

See [Error Handling](error-handling.md) and [Common Errors](common-errors.md) for detailed guidance.
