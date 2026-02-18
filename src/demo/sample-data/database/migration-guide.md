# Migration Guide

Migrating between API versions requires updating SDKs, understanding schema changes, and testing thoroughly. This guide covers the v1 → v2 migration.

## Version Compatibility

The v2 API and SDK introduce breaking changes:

| Component | v1 | v2 | Compatible |
|-----------|----|----|-----------|
| API endpoint | /v1/ | /v2/ | No |
| SDK version | 1.x | 2.x | No |
| Database | PostgreSQL 11 | PostgreSQL 13+ | Mostly |
| Python SDK | 1.x | 2.x | No |

## Pre-Migration Checklist

Before starting migration:

- [ ] Review breaking changes documentation
- [ ] Test in sandbox environment first
- [ ] Backup production database
- [ ] Schedule migration during low-traffic period
- [ ] Prepare rollback plan
- [ ] Update documentation and runbooks

## Breaking Changes in v2

### API Endpoint Changes

v1 endpoints are removed; use v2 equivalents:

| v1 | v2 | Notes |
|----|----|----- |
| `/v1/users` | `/v2/users` | Same structure |
| `/v1/orgs` | `/v2/organizations` | Renamed |
| `GET /v1/users/{id}` | `GET /v2/users/{id}` | Same |

All endpoints require explicit v2 in URL.

### Response Format Changes

v1 response:

```json
{
  "id": "user_123",
  "name": "Alice",
  "created": "2026-01-01T00:00:00Z"
}
```

v2 response:

```json
{
  "data": {
    "id": "user_123",
    "name": "Alice",
    "created_at": "2026-01-01T00:00:00Z"
  },
  "meta": {
    "timestamp": "2026-02-18T12:34:56Z",
    "request_id": "req_abc123"
  }
}
```

Wrap response data in `data` object; use `created_at` instead of `created`.

### Authentication Changes

v1 API key header:

```
Authorization: ApiKey sk_live_abc123
```

v2 API key header:

```
Authorization: Bearer sk_live_abc123
```

All SDKs updated automatically; if making raw requests, update headers.

### SDK Changes

v1 Python SDK:

```python
from saasplatform import Client
client = Client('sk_live_abc123')
users = client.list_users()
```

v2 Python SDK:

```python
from saasplatform import Client
client = Client(api_key='sk_live_abc123')
users = client.users.list()
```

Initialize with keyword arguments; use fluent API.

## Migration Steps

### Step 1: Update SDKs

Update all SDKs to v2.x:

```bash
# Python
pip install --upgrade saasplatform-sdk

# Node.js
npm install @saasplatform/sdk@latest

# Go
go get -u github.com/saasplatform/sdk-go
```

Don't deploy yet; test first.

### Step 2: Update Code

Replace v1 SDK calls with v2 equivalents:

**Python v1 → v2:**

```python
# v1
for user in client.get_users(status='active'):
    print(user['name'])

# v2
for user in client.users.list(filter={'status': 'active'}):
    print(user.name)
```

**Node.js v1 → v2:**

```javascript
// v1
const users = await client.getUsers();

// v2
const result = await client.users.list();
for (const user of result.data) {
  console.log(user.name);
}
```

### Step 3: Test in Sandbox

Test all functionality in sandbox environment:

```bash
API_KEY=sk_test_sandbox_key npm test
```

Verify:
- Authentication works
- CRUD operations succeed
- Error handling works
- Pagination and filtering work

### Step 4: Test in Production (Canary)

Route a small percentage of traffic to v2:

```yaml
# Kubernetes rollout
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
```

Monitor for errors:

```bash
# Watch error rates
kubectl logs -l app=my-app --since=5m | grep ERROR

# Check response times
kubectl top pods
```

### Step 5: Full Rollout

If canary succeeds, roll out to all:

```bash
kubectl rollout status deployment/my-app
```

### Step 6: Monitor

After rollout, closely monitor:

- Error rates (target: <0.1%)
- Response times (no significant increase)
- Authentication failures
- Rate limiting issues

## Database Migration

No database schema migration needed; v2 API is compatible with existing data.

However, some v2 features require schema extensions:

```sql
-- v2 adds column
ALTER TABLE users ADD COLUMN verification_status VARCHAR(50) DEFAULT 'pending';

-- Create index for new field
CREATE INDEX idx_users_verification ON users(verification_status);
```

Run migrations during low-traffic period.

## Rollback Plan

If migration fails:

1. **Revert SDKs to v1.x**
2. **Revert code changes**
3. **Redeploy to production**
4. **Restore database** (if schema changed)

Rollback should complete within 30 minutes.

## Parallel Running (Optional)

For critical applications, run v1 and v2 in parallel:

```
┌──────────────┐
│ Load Balancer │
├──────────────┤
│ v1 API (50%) │
│ v2 API (50%) │
└──────────────┘
```

Gradually increase v2 percentage:

- Day 1: 10% v2
- Day 2: 25% v2
- Day 3: 50% v2
- Day 4: 100% v2

This approach is safer but more complex.

## Troubleshooting

### "401 Unauthorized"

Check API key format. v2 requires `Bearer` scheme:

```
Authorization: Bearer sk_live_abc123
```

### "404 Not Found"

Endpoint path changed. Check v2 documentation:

```
/v1/orgs → /v2/organizations
```

### Response parsing errors

v2 wraps responses in `data` object:

```python
# v1
users = response['users']

# v2
users = response['data']
```

### Type errors (Python/TypeScript)

v2 uses different types. Update type annotations:

```python
# v1
def process(user: dict):

# v2
from saasplatform.models import User
def process(user: User):
```

## Timeline Estimate

Typical migration timeline:

- Planning & testing: 1-2 weeks
- Code updates: 1-2 weeks
- Canary deployment: 1 week
- Full rollout: 1 day
- Monitoring & stability: 1 week

**Total: 4-6 weeks** for large applications

Smaller applications: 1-2 weeks

## Support

For migration assistance:

- Review [v2 Documentation](../endpoints/overview.md)
- Check [SDK Release Notes](sdks/sdk-versioning.md)
- Contact support: support@example.com
- Community: Discord/forum

v1 support ends 2026-01-01. Plan migration accordingly.
