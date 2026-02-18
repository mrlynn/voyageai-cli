# PHP SDK

The PHP SDK provides an object-oriented interface to the SaaS API with PSR-compliant design, Laravel integration, and comprehensive error handling.

## Installation

Install via Composer:

```bash
composer require saasplatform/sdk
```

## Basic Usage

Initialize and perform operations:

```php
<?php
require 'vendor/autoload.php';

use SaasPlatform\Client;

$client = new Client(['api_key' => 'sk_live_abc123']);

// Create a user
$user = $client->users->create([
    'name' => 'Alice',
    'email' => 'alice@example.com'
]);

echo "User ID: {$user->id}\n";

// Retrieve a user
$user = $client->users->get('user_123');

// Update a user
$user = $client->users->update('user_123', ['name' => 'Alice Smith']);

// Delete a user
$client->users->delete('user_123');
```

## Laravel Integration

Register the service provider in `config/app.php`:

```php
'providers' => [
    // ...
    SaasPlatform\Laravel\ServiceProvider::class,
],
```

Publish configuration:

```bash
php artisan vendor:publish --provider="SaasPlatform\Laravel\ServiceProvider"
```

Configure in `.env`:

```
SAASPLATFORM_API_KEY=sk_live_abc123
SAASPLATFORM_ENVIRONMENT=production
```

Use in your Laravel code:

```php
use SaasPlatform\Facades\SaasPlatform;

class UserController extends Controller {
    public function show($id) {
        $user = SaasPlatform::users()->get($id);
        return view('user.show', ['user' => $user]);
    }
}
```

## Pagination

Iterate through paginated results:

```php
$users = $client->users->list([
    'page' => 1,
    'per_page' => 50
]);

foreach ($users->data as $user) {
    echo "{$user->name}\n";
}

// Automatic pagination
foreach ($client->users->list(['per_page' => 100]) as $user) {
    echo "{$user->name}\n";
}
```

## Filtering and Sorting

Build filtered queries:

```php
$activeUsers = $client->users->list([
    'filter' => ['status' => 'active'],
    'sort' => '-created_at'
]);

// Complex filters
$users = $client->users->list([
    'filter' => [
        'created_at' => ['\$gte' => '2026-01-01'],
        'status' => ['\$in' => ['active', 'pending']]
    ]
]);
```

## Error Handling

Handle exceptions:

```php
use SaasPlatform\Exceptions\NotFoundException;
use SaasPlatform\Exceptions\ValidationException;
use SaasPlatform\Exceptions\AuthenticationException;
use SaasPlatform\Exceptions\RateLimitException;

try {
    $user = $client->users->get('nonexistent');
} catch (NotFoundException $e) {
    echo "User not found\n";
} catch (ValidationException $e) {
    foreach ($e->getErrors() as $error) {
        echo "{$error->field}: {$error->message}\n";
    }
} catch (AuthenticationException $e) {
    echo "Check API key\n";
} catch (RateLimitException $e) {
    echo "Rate limited, retry after {$e->getRetryAfter()}s\n";
}
```

## Batch Operations

Efficiently batch operations:

```php
$users = [
    ['name' => 'Alice', 'email' => 'alice@example.com'],
    ['name' => 'Bob', 'email' => 'bob@example.com']
];

$response = $client->users->batchCreate($users);

foreach ($response->successful as $user) {
    echo "Created: {$user->id}\n";
}

foreach ($response->errors as $error) {
    echo "Error at index {$error->index}: {$error->message}\n";
}
```

## Async Operations (Guzzle-based)

For async operations:

```php
$promise = $client->users->createAsync([
    'name' => 'Alice',
    'email' => 'alice@example.com'
]);

$promise->then(function($user) {
    echo "Created user: {$user->id}\n";
})->otherwise(function($reason) {
    echo "Error: {$reason->getMessage()}\n";
});
```

## Streaming

Stream large datasets:

```php
$stream = $client->events->stream([
    'start_date' => '2026-01-01'
]);

foreach ($stream as $event) {
    echo "{$event->timestamp}\n";
}
```

## Webhooks

Register and verify webhooks:

```php
// Create a webhook
$webhook = $client->webhooks->create([
    'url' => 'https://yourapp.com/webhooks',
    'events' => ['user.created', 'user.deleted']
]);

// In webhook handler
use SaasPlatform\Webhooks;

try {
    $payload = Webhooks::verify(
        file_get_contents('php://input'),
        $_SERVER['HTTP_WEBHOOK_SIGNATURE'],
        $_SERVER['HTTP_WEBHOOK_TIMESTAMP'],
        getenv('WEBHOOK_SECRET')
    );
    
    // Process payload
} catch (\Exception $e) {
    http_response_code(403);
    die('Invalid signature');
}
```

## Configuration

```php
$client = new Client([
    'api_key' => 'sk_live_abc123',
    'environment' => 'production',  // or 'sandbox'
    'timeout' => 30,                // seconds
    'max_retries' => 3,
    'base_uri' => 'https://api.example.com/v2'
]);
```

## PSR Compliance

The SDK follows PSR standards:
- PSR-4: Autoloading
- PSR-7: HTTP Messages (Guzzle)
- PSR-12: Coding Style

## PHP Version Support

- **PHP**: 7.4+
- **Guzzle**: 7.0+
- **Laravel**: 5.5+

See [SDK Installation](sdk-installation.md) for detailed setup.
