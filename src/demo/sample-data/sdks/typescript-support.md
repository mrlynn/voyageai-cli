# TypeScript Support

All official SDKs include comprehensive TypeScript support with auto-generated types, ensuring type safety and excellent IDE integration.

## Why TypeScript?

TypeScript provides:
- **Type Safety**: Catch errors at compile time, not runtime
- **IDE Support**: Full IntelliSense and autocomplete
- **Self-Documenting**: Types serve as inline documentation
- **Refactoring**: Rename properties across codebases safely

## JavaScript SDK with TypeScript

The JavaScript SDK includes built-in TypeScript definitions:

```typescript
import { Client, User, ValidationError } from '@saasplatform/sdk';

const client = new Client({
  apiKey: 'sk_live_abc123'
});

// Full type safety
const user: User = await client.users.get('user_123');

// IDE autocomplete shows available properties
console.log(user.name, user.email, user.created_at);

// Type checking on method arguments
client.users.update('user_123', {
  name: 'Alice Smith'
  // email: 123  // Error: Type 'number' is not assignable to type 'string'
});
```

## Strict Typing

Configure TypeScript compiler for strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true
  }
}
```

## Generic Types

Many methods use generics for flexibility:

```typescript
// List operation with typed results
const users = await client.users.list<User>({
  page: 1,
  per_page: 50
});

// Filter with type safety
const active: User[] = users.data.filter(u => u.status === 'active');
```

## Error Typing

Error responses are fully typed:

```typescript
import { ValidationError, NotFoundError } from '@saasplatform/sdk';

try {
  const user = await client.users.get('user_123');
} catch (error) {
  if (error instanceof ValidationError) {
    // error.details is typed as ValidationDetail[]
    error.details.forEach(detail => {
      console.log(`${detail.field}: ${detail.issue}`);
    });
  } else if (error instanceof NotFoundError) {
    console.log('Resource not found');
  }
}
```

## Request/Response Types

All request and response types are exported:

```typescript
import {
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  User,
  UserList
} from '@saasplatform/sdk';

const createReq: CreateUserRequest = {
  name: 'Alice',
  email: 'alice@example.com'
  // phone: undefined  // Optional property
};

const listReq: ListUsersRequest = {
  page: 1,
  per_page: 50,
  filter: { status: 'active' }
};

const response: UserList = await client.users.list(listReq);
```

## Custom Types

Define your own types for domain-specific logic:

```typescript
import { User } from '@saasplatform/sdk';

interface AdminUser extends User {
  admin_level: 'super' | 'org' | 'team';
  permissions: string[];
}

async function promoteToAdmin(userId: string): Promise<AdminUser> {
  return client.users.update(userId, {
    admin_level: 'org'
  }) as Promise<AdminUser>;
}
```

## Async/Await with Types

Full async/await support with proper typing:

```typescript
async function processUsers(): Promise<void> {
  try {
    const users = await client.users.list({ per_page: 100 });
    
    for (const user of users.data) {
      console.log(user.name);
    }
  } catch (error) {
    console.error('Failed to fetch users', error);
  }
}
```

## Type Inference

Let TypeScript infer types when possible:

```typescript
// Type inferred automatically
const user = await client.users.get('user_123');
// user is inferred as User

// Or be explicit
const explicitUser: User = await client.users.get('user_123');
```

## Discriminated Unions

Response types use discriminated unions for better type narrowing:

```typescript
type WebhookEvent = 
  | {type: 'user.created', data: User}
  | {type: 'user.deleted', data: {id: string}};

function handleWebhook(event: WebhookEvent) {
  switch (event.type) {
    case 'user.created':
      console.log('New user:', event.data.email);
      break;
    case 'user.deleted':
      console.log('Deleted user:', event.data.id);
      break;
  }
}
```

## Generating Types from API Specs

Types are auto-generated from OpenAPI specs. Update your SDK when API specs change:

```bash
npm install @saasplatform/sdk@latest
```

New types are available immediately.

## Type Exports

All commonly used types are exported:

```typescript
export {
  Client,
  // Models
  User, Organization, Resource,
  // Requests
  CreateUserRequest, UpdateUserRequest,
  // Responses
  UserList, User,
  // Errors
  ValidationError, NotFoundError, AuthenticationError,
  // Options
  RequestOptions, ClientOptions
}
```

## Troubleshooting

**Type mismatch on required fields**:

Ensure all required fields are provided. Check the type definition or IDE hints.

**"Cannot find module @saasplatform/sdk"**:

Reinstall types: `npm install --save-dev @types/@saasplatform/sdk`

**Type inference not working**:

Check TypeScript version. Types require TypeScript 4.0+.

## See Also

- [JavaScript SDK](javascript.md) for runtime usage
- [Node.js Quickstart](nodejs-quickstart.md) for setup examples
