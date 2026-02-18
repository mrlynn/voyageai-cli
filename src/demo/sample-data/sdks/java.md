# Java SDK

The Java SDK provides a type-safe, fluent API for the SaaS platform. Built on modern Java standards with support for synchronous and reactive (Project Reactor) operations.

## Installation

Add to your Maven `pom.xml`:

```xml
<dependency>
  <groupId>com.saasplatform</groupId>
  <artifactId>sdk-java</artifactId>
  <version>2.0.0</version>
</dependency>
```

Or Gradle:

```gradle
implementation 'com.saasplatform:sdk-java:2.0.0'
```

## Basic Usage

Create a client and perform operations:

```java
import com.saasplatform.SaasPlatformClient;
import com.saasplatform.models.User;

SaasPlatformClient client = SaasPlatformClient.builder()
    .apiKey("sk_live_abc123")
    .build();

// Create a user
User newUser = client.users().create(
    new CreateUserRequest()
        .name("Alice")
        .email("alice@example.com")
);

// Retrieve a user
User user = client.users().get("user_123");

// Update a user
User updated = client.users().update("user_123",
    new UpdateUserRequest()
        .name("Alice Smith")
);

// Delete a user
client.users().delete("user_123");
```

## Pagination

Iterate through paginated results:

```java
ListUsersRequest request = ListUsersRequest.builder()
    .page(1)
    .perPage(50)
    .build();

UsersPage page = client.users().list(request);

for (User user : page.getData()) {
    System.out.println(user.getName());
}

// Iterate all pages
client.users().list()
    .forEach(user -> System.out.println(user.getName()));
```

## Filtering and Sorting

Build complex queries:

```java
UsersPage results = client.users().list(
    ListUsersRequest.builder()
        .filter("status", "active")
        .filter("created_at", Operator.GTE, "2026-01-01")
        .sort("-created_at", "name")
        .build()
);
```

## Error Handling

Handle specific exception types:

```java
try {
    User user = client.users().get("nonexistent");
} catch (NotFoundException e) {
    System.out.println("User not found");
} catch (ValidationException e) {
    e.getErrors().forEach(error -> 
        System.out.println(error.getField() + ": " + error.getMessage())
    );
} catch (AuthenticationException e) {
    System.out.println("Check API key");
} catch (RateLimitException e) {
    System.out.println("Rate limited, retry after " + e.getRetryAfter() + "s");
}
```

## Batch Operations

Efficiently create multiple items:

```java
List<CreateUserRequest> users = Arrays.asList(
    new CreateUserRequest().name("Alice").email("alice@example.com"),
    new CreateUserRequest().name("Bob").email("bob@example.com")
);

BatchCreateUsersResponse response = client.users().batchCreate(users);

response.getSuccessful().forEach(user -> 
    System.out.println("Created: " + user.getId())
);

response.getErrors().forEach(error -> 
    System.out.println("Failed at index " + error.getIndex() + ": " + error.getMessage())
);
```

## Reactive (Async) Operations

Use Project Reactor for reactive streams:

```java
import reactor.core.publisher.Mono;

Mono<User> userMono = client.users().async().get("user_123");

userMono
    .subscribe(
        user -> System.out.println("User: " + user.getName()),
        error -> System.out.println("Error: " + error.getMessage())
    );
```

For bulk async operations:

```java
List<String> userIds = Arrays.asList("user_1", "user_2", "user_3");

Mono.from(
    client.users().async().get(userIds)
).subscribe(users -> users.forEach(System.out::println));
```

## Timeout and Retry Configuration

Customize client behavior:

```java
SaasPlatformClient client = SaasPlatformClient.builder()
    .apiKey("sk_live_abc123")
    .timeout(30, TimeUnit.SECONDS)
    .maxRetries(3)
    .retryStrategy(RetryStrategy.EXPONENTIAL)
    .build();
```

## Connection Pooling

The SDK manages connection pooling automatically:

```java
SaasPlatformClient client = SaasPlatformClient.builder()
    .apiKey("sk_live_abc123")
    .connectionPoolSize(20)
    .maxIdleTime(5, TimeUnit.MINUTES)
    .build();
```

## Custom Headers

Add custom headers to requests:

```java
User user = client.users().get("user_123",
    RequestOptions.builder()
        .header("X-Custom-Header", "value")
        .build()
);
```

## Logging

Enable request/response logging:

```java
SaasPlatformClient client = SaasPlatformClient.builder()
    .apiKey("sk_live_abc123")
    .debug(true)
    .logger(new Slf4jLogger())
    .build();
```

## Resource Cleanup

Close the client when done:

```java
try (SaasPlatformClient client = SaasPlatformClient.builder()
        .apiKey("sk_live_abc123")
        .build()) {
    User user = client.users().get("user_123");
} // Client closed automatically
```

## Build Details

- **Java Version**: 11+
- **HTTP Client**: OkHttp 4.x
- **JSON Serialization**: Jackson
- **Reactive**: Project Reactor 2021.0.x+

Refer to [SDK Installation](sdk-installation.md) for detailed setup instructions.
