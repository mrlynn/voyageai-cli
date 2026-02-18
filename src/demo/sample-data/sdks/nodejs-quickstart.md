# Node.js Quickstart

Get started with the JavaScript SDK in Node.js in 5 minutes. This guide covers installation, authentication, and basic operations.

## Prerequisites

- Node.js 14+ (LTS recommended)
- npm or yarn
- A SaaS platform API key (get one from the dashboard)

## Step 1: Create a Project

Create a new directory and initialize Node.js:

```bash
mkdir my-saas-app
cd my-saas-app
npm init -y
```

## Step 2: Install the SDK

```bash
npm install @saasplatform/sdk
```

For TypeScript projects, add TypeScript:

```bash
npm install --save-dev typescript @types/node
npx tsc --init
```

## Step 3: Write Your First Request

Create `index.js`:

```javascript
const { Client } = require('@saasplatform/sdk');

async function main() {
  const client = new Client({
    apiKey: process.env.SAASPLATFORM_API_KEY || 'sk_live_abc123'
  });

  // Create a user
  const user = await client.users.create({
    name: 'Alice',
    email: 'alice@example.com'
  });

  console.log('Created user:', user.id);

  // Fetch the user
  const fetched = await client.users.get(user.id);
  console.log('Fetched user:', fetched.name);

  // Update the user
  const updated = await client.users.update(user.id, {
    name: 'Alice Smith'
  });
  console.log('Updated user:', updated.name);

  // Delete the user
  await client.users.delete(user.id);
  console.log('Deleted user');
}

main().catch(console.error);
```

## Step 4: Run It

```bash
export SAASPLATFORM_API_KEY="sk_live_your_key"
node index.js
```

Expected output:
```
Created user: user_123
Fetched user: Alice
Updated user: Alice Smith
Deleted user
```

## Common Patterns

### Error Handling

```javascript
const { ValidationError, NotFoundError } = require('@saasplatform/sdk');

try {
  await client.users.get('nonexistent');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('User not found');
  } else if (error instanceof ValidationError) {
    console.log('Validation error:', error.details);
  } else {
    throw error;
  }
}
```

### Pagination

```javascript
const users = await client.users.list({
  page: 1,
  per_page: 50,
  sort: '-created_at'
});

for (const user of users.data) {
  console.log(user.name);
}

if (users.pagination.pages > 1) {
  const page2 = await client.users.list({
    page: 2,
    per_page: 50
  });
}
```

### Filtering

```javascript
const active = await client.users.list({
  filter: { status: 'active' },
  sort: 'name'
});

console.log(`Found ${active.data.length} active users`);
```

### Batch Operations

```javascript
const result = await client.users.batch.create([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
]);

console.log(`Created ${result.data.length} users`);
```

## Configuration

### Environment Variables

Store sensitive data in `.env`:

```bash
# .env
SAASPLATFORM_API_KEY=sk_live_abc123
SAASPLATFORM_ENVIRONMENT=production
```

Load in your code:

```javascript
require('dotenv').config();

const client = new Client({
  apiKey: process.env.SAASPLATFORM_API_KEY,
  environment: process.env.SAASPLATFORM_ENVIRONMENT
});
```

### Custom Configuration

```javascript
const client = new Client({
  apiKey: 'sk_live_abc123',
  timeout: 30000,        // 30 seconds
  maxRetries: 3,
  retryStrategy: 'exponential',
  userAgent: 'MyApp/1.0'
});
```

## Development and Testing

### Using the Sandbox Environment

```javascript
const client = new Client({
  apiKey: 'sk_test_sandbox_key',
  environment: 'sandbox'
});
```

### Logging Requests

```javascript
const client = new Client({
  apiKey: 'sk_live_abc123',
  logger: (method, url, body, response) => {
    console.log(`${method} ${url} -> ${response.status}`);
  }
});
```

## Next Steps

- Read the [JavaScript SDK](javascript.md) guide for advanced features
- Check out [TypeScript Support](typescript-support.md) if using TypeScript
- Explore [Authentication](../auth/api-keys.md) options
- See [Error Responses](../endpoints/error-responses.md) for handling errors

## Troubleshooting

**"Cannot find module '@saasplatform/sdk'"**

Ensure it's installed: `npm list @saasplatform/sdk`

**"401 Unauthorized"**

Check your API key: `echo $SAASPLATFORM_API_KEY`

**"Network timeout"**

Increase timeout: `{timeout: 60000}`

**"Rate limited (429)"**

Reduce request frequency or upgrade your plan.

## Getting Help

- [Documentation](https://docs.example.com)
- [GitHub Issues](https://github.com/saasplatform/sdk-js)
- [Community Discord](https://discord.example.com)
