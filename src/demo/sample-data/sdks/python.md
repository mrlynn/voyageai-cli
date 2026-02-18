# Python SDK

The Python SDK provides a Pythonic interface to the SaaS API with full async support, type hints, and comprehensive error handling. Suitable for backend services, data analysis, and automation.

## Installation

Install via pip:

```bash
pip install saasplatform-sdk
```

For async support:

```bash
pip install saasplatform-sdk[async]
```

## Basic Usage

Initialize the client and perform operations:

```python
from saasplatform import Client

client = Client(api_key='sk_live_abc123')

# Create a user
user = client.users.create(name='Alice', email='alice@example.com')

# Retrieve a user
user = client.users.get('user_123')

# Update a user
user = client.users.update('user_123', name='Alice Smith')

# Delete a user
client.users.delete('user_123')
```

## Async Support

For high-concurrency applications, use async/await:

```python
import asyncio
from saasplatform import AsyncClient

async def main():
    async with AsyncClient(api_key='sk_live_abc123') as client:
        user = await client.users.create(
            name='Alice',
            email='alice@example.com'
        )
        print(user.id)

asyncio.run(main())
```

The SDK manages connection pooling automatically.

## Pagination

Retrieve paginated results:

```python
# Manual pagination
users = client.users.list(page=1, per_page=50)
for user in users.data:
    print(user.name)

# Automatic iteration (handles all pages)
for user in client.users.list(per_page=100):
    print(user.name)
```

## Filtering and Sorting

Filter and sort results:

```python
active_users = client.users.list(
    filter={'status': 'active'},
    sort='-created_at'
)

# Complex filters
users = client.users.list(
    filter={
        'created_at': {'$gte': '2026-01-01'},
        'status': {'$in': ['active', 'pending']}
    }
)
```

## Error Handling

Handle different error types:

```python
from saasplatform import (
    NotFoundError,
    ValidationError,
    AuthenticationError,
    RateLimitError
)

try:
    user = client.users.get('nonexistent')
except NotFoundError:
    print('User not found')
except ValidationError as e:
    print(f'Validation error: {e.details}')
except RateLimitError as e:
    print(f'Rate limited. Retry after {e.retry_after}s')
except AuthenticationError:
    print('Check API key')
```

## Batch Operations

Create or update multiple items efficiently:

```python
users = client.users.batch.create([
    {'name': 'Alice', 'email': 'alice@example.com'},
    {'name': 'Bob', 'email': 'bob@example.com'}
])

print(f'Created {len(users.data)} users')
```

## Streaming

Stream large datasets efficiently:

```python
# Streaming (generator-based)
for event in client.events.stream(start_date='2026-01-01'):
    print(event.timestamp)
```

## Webhooks

Manage webhooks:

```python
# Create a webhook
webhook = client.webhooks.create(
    url='https://yourapp.com/webhooks',
    events=['user.created', 'user.deleted']
)

# Verify webhook signature
from saasplatform import verify_webhook_signature

try:
    payload = verify_webhook_signature(
        body=request.body,
        signature=request.headers['Webhook-Signature'],
        timestamp=request.headers['Webhook-Timestamp'],
        secret=WEBHOOK_SECRET
    )
    # Process payload
except ValueError:
    # Invalid signature
    pass
```

## Timeouts and Retries

Configure timeout and retry behavior:

```python
client = Client(
    api_key='sk_live_abc123',
    timeout=30,          # seconds
    max_retries=3,
    retry_backoff=True
)
```

## Connection Pooling

The SDK uses connection pooling for efficiency. Control pool size:

```python
client = Client(
    api_key='sk_live_abc123',
    pool_size=10,
    max_pool_connections=20
)
```

## Logging

Enable debug logging:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('saasplatform')
logger.setLevel(logging.DEBUG)

client = Client(api_key='sk_live_abc123')  # Now logs all requests
```

## Type Hints

All methods include type hints for IDE support:

```python
from saasplatform import Client
from saasplatform.models import User

client: Client = Client(api_key='sk_live_abc123')
user: User = client.users.get('user_123')
```

## Context Managers

Use context managers for cleanup:

```python
from saasplatform import Client

with Client(api_key='sk_live_abc123') as client:
    users = client.users.list()
    # Connection closed automatically
```

## Migration from v1

The v2 SDK is not backward compatible with v1. See the [Migration Guide](../database/migration-guide.md) for upgrade steps.
