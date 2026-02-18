# JavaScript SDK

The official JavaScript SDK provides a type-safe, easy-to-use interface for the SaaS platform API. It works in Node.js and modern browsers with built-in authentication handling and error management.

## Installation

Install via npm or yarn:

```bash
npm install @saasplatform/sdk
# or
yarn add @saasplatform/sdk
```

## Authentication

Initialize the SDK with an API key or JWT token:

```javascript
const SaaS = require('@saasplatform/sdk');

const client = new SaaS.Client({
  apiKey: 'sk_live_abc123',  // API key authentication
  environment: 'production'   // or 'sandbox'
});
```

For OAuth authentication:

```javascript
const client = new SaaS.Client({
  accessToken: 'your_access_token',
  tokenRefresher: async (refreshToken) => {
    // Return new access token
  }
});
```

The SDK automatically refreshes expired tokens using the provided refresher function.

## Basic Usage

Create, read, update, delete operations:

```javascript
// Create a user
const user = await client.users.create({
  name: 'Alice',
  email: 'alice@example.com'
});

// Read a user
const user = await client.users.get('user_123');

// Update a user
const updated = await client.users.update('user_123', {
  name: 'Alice Smith'
});

// Delete a user
await client.users.delete('user_123');
```

## Pagination and Filtering

List resources with pagination and filtering:

```javascript
const users = await client.users.list({
  page: 1,
  per_page: 50,
  filter: {status: 'active'},
  sort: '-created_at'
});

for (const user of users.data) {
  console.log(user.name);
}

// Iterate all pages
for await (const user of client.users.list({per_page: 100})) {
  console.log(user.name);
}
```

## Error Handling

The SDK throws typed errors for different failure modes:

```javascript
try {
  const user = await client.users.get('nonexistent');
} catch (error) {
  if (error instanceof SaaS.NotFoundError) {
    console.log('User not found');
  } else if (error instanceof SaaS.ValidationError) {
    console.log('Invalid parameters:', error.details);
  } else if (error instanceof SaaS.AuthenticationError) {
    console.log('Authentication failed');
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

## Batch Operations

Create or update multiple resources efficiently:

```javascript
const users = await client.users.batch.create([
  {name: 'Alice', email: 'alice@example.com'},
  {name: 'Bob', email: 'bob@example.com'}
]);

console.log(users.data);  // Array of created users
```

## Streaming Large Datasets

Stream large result sets without loading everything into memory:

```javascript
const stream = client.events.stream({
  startDate: '2026-01-01',
  batchSize: 1000
});

stream.on('data', (event) => {
  console.log(event);
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});

stream.on('end', () => {
  console.log('Stream complete');
});
```

## Webhooks

Register and manage webhooks:

```javascript
const webhook = await client.webhooks.create({
  url: 'https://yourapp.com/webhooks',
  events: ['user.created', 'user.deleted']
});

// Verify webhook signature
const verified = SaaS.Webhooks.verify(
  payload,
  signature,
  timestamp,
  webhookSecret
);

if (!verified) {
  throw new Error('Invalid webhook signature');
}
```

## Advanced Features

**Retries and Timeouts**:

```javascript
const client = new SaaS.Client({
  apiKey: 'sk_live_abc123',
  maxRetries: 3,
  timeout: 30000,  // 30 seconds
  retryStrategy: 'exponential'
});
```

**Custom Headers**:

```javascript
const user = await client.users.get('user_123', {
  headers: {'X-Custom-Header': 'value'}
});
```

**Request Logging**:

```javascript
const client = new SaaS.Client({
  apiKey: 'sk_live_abc123',
  logger: (method, url, body, response) => {
    console.log(`${method} ${url}`, response.status);
  }
});
```

## Version Compatibility

The SDK targets the API v2. For v1, use `@saasplatform/sdk@1.x`. 

Check the [SDK Versioning](sdk-versioning.md) guide for upgrade information.

## TypeScript Support

Full TypeScript support with auto-generated types:

```typescript
import { SaaS, User, ValidationError } from '@saasplatform/sdk';

const client = new SaaS.Client({apiKey: 'sk_live_abc123'});

const user: User = await client.users.get('user_123');
```

See [TypeScript Support](typescript-support.md) for details.
