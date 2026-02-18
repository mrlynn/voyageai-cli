# Debugging Techniques

Effective debugging requires systematic approaches and proper tooling. This guide covers debugging strategies for API integrations.

## Request/Response Logging

Log all HTTP interactions:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

requests_log = logging.getLogger("requests.packages.urllib3")
requests_log.setLevel(logging.DEBUG)
requests_log.propagate = True

response = requests.get('https://api.example.com/users')
```

Output:
```
DEBUG:urllib3.connectionpool: Starting new HTTPS connection (1): api.example.com
DEBUG:urllib3.connectionpool: "GET /users HTTP/1.1" 200 1024
```

## Using cURL for Testing

Test API endpoints with cURL:

```bash
# Simple GET
curl https://api.example.com/users/user_123

# With authentication
curl -H "Authorization: Bearer token" https://api.example.com/users

# POST with data
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# Verbose output (headers and body)
curl -v https://api.example.com/users

# Save response to file
curl https://api.example.com/users > response.json
```

## HTTP Inspection Tools

Use tools to inspect requests/responses:

**Postman**: GUI tool for testing APIs
- Save requests for reuse
- Organize into collections
- Tests and assertions
- Environment variables

**Insomnia**: Lightweight REST client
- Code generation
- Plugin system
- Open source

**VS Code REST Client**: Inline in editor
```
GET https://api.example.com/users HTTP/1.1
Authorization: Bearer token
Content-Type: application/json
```

## Network Tracing

Capture network traffic with tcpdump:

```bash
# Capture traffic on port 443 (HTTPS)
sudo tcpdump -i en0 'port 443' -w api.pcap

# Read captured traffic
tcpdump -r api.pcap

# Decode with Wireshark (GUI)
wireshark api.pcap
```

Useful for low-level debugging; HTTPS is encrypted so limited visibility.

## SDK Debug Mode

Enable SDK debugging:

**JavaScript**:
```javascript
const client = new SaaS.Client({
  apiKey: 'sk_live_abc123',
  logger: (method, url, body, response) => {
    console.log(`${method} ${url}`, response.status);
  }
});
```

**Python**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)

client = SaaS.Client(api_key='sk_live_abc123')
```

**Go**:
```go
client := sdk.NewClient("sk_live_abc123")
client.Debug = true
```

## Request ID Tracing

Use request IDs to track requests through logs:

```python
import uuid

request_id = str(uuid.uuid4())
response = client.users.get('user_123', headers={
    'X-Request-ID': request_id
})

# Later, search logs for this request
logs | grep request_id
```

## Reproducing Issues

Isolate and reproduce problems:

```python
# Minimal reproduction
import saasplatform

client = saasplatform.Client(api_key='sk_live_abc123')

try:
    user = client.users.get('user_123')
    print(user)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
```

Share minimal repro with support for faster debugging.

## Breakpoint Debugging

Use debuggers to step through code:

**Python (pdb)**:
```python
import pdb

def process_user(user_id):
    user = client.users.get(user_id)
    pdb.set_trace()  # Execution pauses here
    # Inspect variables: user, user_id, etc.
    # Step through code
```

**JavaScript (Node.js)**:
```bash
node --inspect app.js
# Open chrome://inspect in Chrome
# Set breakpoints and step through
```

**VS Code Debug**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python",
      "type": "python",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

## Comparing Requests

Debug by comparing working and broken requests:

```bash
# Working request (from logs)
curl -X GET https://api.example.com/users/user_123 \
  -H "Authorization: Bearer token_good"

# Broken request
curl -X GET https://api.example.com/users/user_999 \
  -H "Authorization: Bearer token_expired"

# Differences:
# 1. Different user ID
# 2. Expired token
# 3. Different header (maybe)

Test each change individually to isolate the issue
```

## Performance Profiling

Identify slow operations:

**Python (cProfile)**:
```python
import cProfile

cProfile.run('client.users.list(per_page=1000)')

# Output:
# ncalls  tottime  cumtime  filename:lineno(function)
# 1    0.001    0.250    api_client.py:45(list)
# 1    0.200    0.200    requests.py:89(get)
```

**JavaScript (Node.js profiler)**:
```bash
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

## Sandbox Testing

Use sandbox environment for testing:

```python
client = SaaS.Client(
    api_key='sk_test_sandbox_key',
    environment='sandbox'
)

# Test safely without affecting production
user = client.users.create(name='Test User')
```

Sandbox data is reset daily/weekly; safe for experiments.

## Crash Logs and Stack Traces

When errors occur, capture full context:

```python
import sys
import traceback

try:
    api_call()
except Exception as e:
    tb_lines = traceback.format_exception(type(e), e, e.__traceback__)
    print(''.join(tb_lines))
    
    # Log for support
    logger.error('API call failed', exc_info=True)
```

Stack traces show exact line where error occurred.

## Checklist for Debugging

1. **Understand the error**: What's the error message/code?
2. **Check logs**: Search for relevant log entries
3. **Verify prerequisites**: Is authentication correct? Is service available?
4. **Isolate**: Reproduce with minimal code
5. **Compare**: Working vs. broken requests
6. **Step through**: Use debugger to understand flow
7. **Check assumptions**: Are parameters what you think?
8. **Test in sandbox**: Confirm issue isn't production-specific
9. **Share details**: For support tickets, include request ID, error, logs

## Common Debugging Mistakes

1. **Assuming the error message**: Dig deeper; root cause may differ
2. **Testing in production**: Always test in sandbox first
3. **Forgetting to refresh**: Token expired? Refresh or re-authenticate
4. **Ignoring warnings**: Deprecation warnings indicate upcoming changes
5. **Not capturing request ID**: Impossible to trace later without it

See [Error Handling](error-handling.md) for recovery strategies.
