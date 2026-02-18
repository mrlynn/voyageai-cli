# Go SDK

The Go SDK provides a clean, idiomatic interface to the SaaS API with strong typing, context support, and efficient concurrency handling.

## Installation

Use `go get`:

```bash
go get github.com/saasplatform/sdk-go@latest
```

Then import in your code:

```go
import "github.com/saasplatform/sdk"
```

## Basic Usage

Create a client and perform CRUD operations:

```go
package main

import (
    "context"
    "log"
    "github.com/saasplatform/sdk"
)

func main() {
    client := sdk.NewClient("sk_live_abc123")
    
    ctx := context.Background()
    
    // Create a user
    user, err := client.Users.Create(ctx, &sdk.CreateUserInput{
        Name:  "Alice",
        Email: "alice@example.com",
    })
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Created user: %s\n", user.ID)
    
    // Retrieve a user
    user, err := client.Users.Get(ctx, "user_123")
    if err != nil {
        log.Fatal(err)
    }
    
    // Update a user
    user, err = client.Users.Update(ctx, "user_123", &sdk.UpdateUserInput{
        Name: "Alice Smith",
    })
    
    // Delete a user
    err = client.Users.Delete(ctx, "user_123")
}
```

## Context and Timeouts

Properly use Go contexts for timeouts:

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

user, err := client.Users.Get(ctx, "user_123")
```

## Pagination

Iterate through paginated results:

```go
// List with pagination
results, err := client.Users.List(ctx, &sdk.ListUsersInput{
    Page:    1,
    PerPage: 50,
})
if err != nil {
    log.Fatal(err)
}

for _, user := range results.Data {
    log.Println(user.Name)
}

// Iterate all pages
iter := client.Users.Iterator(ctx, nil)
for iter.Next() {
    user := iter.Value()
    log.Println(user.Name)
}
if iter.Err() != nil {
    log.Fatal(iter.Err())
}
```

## Filtering and Sorting

Build queries with filters and sorting:

```go
results, err := client.Users.List(ctx, &sdk.ListUsersInput{
    Filter: map[string]interface{}{
        "status": "active",
        "created_at": map[string]string{
            "$gte": "2026-01-01",
        },
    },
    Sort: "-created_at,name",
})
```

## Error Handling

Handle errors idiomatically:

```go
user, err := client.Users.Get(ctx, "user_123")

if err != nil {
    // Check error type
    if errors.Is(err, sdk.ErrNotFound) {
        log.Println("User not found")
    } else if errors.Is(err, sdk.ErrAuthentication) {
        log.Println("Check API key")
    } else if errors.Is(err, sdk.ErrRateLimit) {
        log.Println("Rate limited, retry later")
    } else {
        log.Fatal(err)
    }
}
```

## Batch Operations

Efficiently batch operations:

```go
users := []sdk.CreateUserInput{
    {Name: "Alice", Email: "alice@example.com"},
    {Name: "Bob", Email: "bob@example.com"},
}

response, err := client.Users.BatchCreate(ctx, users)
if err != nil {
    log.Fatal(err)
}

log.Printf("Created %d users\n", len(response.Data))
for _, user := range response.Data {
    log.Println(user.ID)
}
```

## Concurrent Operations

Leverage Go's concurrency for efficient operations:

```go
var wg sync.WaitGroup
errors := make(chan error, len(userIDs))

for _, id := range userIDs {
    wg.Add(1)
    go func(userID string) {
        defer wg.Done()
        user, err := client.Users.Get(ctx, userID)
        if err != nil {
            errors <- err
            return
        }
        // Process user
    }(id)
}

wg.Wait()
close(errors)

for err := range errors {
    log.Println("Error:", err)
}
```

## Custom HTTP Client

Customize the underlying HTTP client:

```go
httpClient := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
    },
}

client := sdk.NewClientWithHTTPClient("sk_live_abc123", httpClient)
```

## Logging and Debugging

Enable request/response logging:

```go
client := sdk.NewClient("sk_live_abc123")
client.Debug = true
client.Logger = log.New(os.Stdout, "SDK: ", log.LstdFlags)
```

## Middleware and Custom Headers

Add custom headers and middleware:

```go
user, err := client.Users.Get(ctx, "user_123",
    sdk.WithHeader("X-Custom-Header", "value"),
    sdk.WithHeader("X-Request-ID", "req_123"),
)
```

## Testing

Use mock interfaces for testing:

```go
type mockUserService struct {
    mock.Mock
}

func (m *mockUserService) Get(ctx context.Context, id string) (*sdk.User, error) {
    args := m.Called(ctx, id)
    return args.Get(0).(*sdk.User), args.Error(1)
}

// In tests
mockSvc := &mockUserService{}
mockSvc.On("Get", mock.Anything, "user_123").Return(&sdk.User{ID: "user_123"}, nil)
```

## Version Requirements

- **Go**: 1.18+
- **HTTP/2**: Supported
- **Modules**: Go modules required

See [SDK Installation](sdk-installation.md) for additional setup details.
