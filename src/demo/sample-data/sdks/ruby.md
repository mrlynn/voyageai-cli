# Ruby SDK

The Ruby SDK provides a clean, Rails-friendly interface to the SaaS API with support for both synchronous and asynchronous operations.

## Installation

Add to your Gemfile:

```ruby
gem 'saasplatform-sdk'
```

Then run:

```bash
bundle install
```

Or install directly:

```bash
gem install saasplatform-sdk
```

## Basic Usage

Initialize and perform operations:

```ruby
require 'saasplatform'

client = SaasPlatform::Client.new(api_key: 'sk_live_abc123')

# Create a user
user = client.users.create(name: 'Alice', email: 'alice@example.com')
puts user.id

# Retrieve a user
user = client.users.get('user_123')

# Update a user
user = client.users.update('user_123', name: 'Alice Smith')

# Delete a user
client.users.delete('user_123')
```

## Rails Integration

In a Rails application, configure in `config/initializers/saasplatform.rb`:

```ruby
SaasPlatform.configure do |config|
  config.api_key = ENV['SAASPLATFORM_API_KEY']
  config.environment = Rails.env.production? ? 'production' : 'sandbox'
end

# Now use in your controllers/models
client = SaasPlatform::Client.new
```

## Pagination

Iterate through paginated results:

```ruby
users = client.users.list(page: 1, per_page: 50)

users.each do |user|
  puts user.name
end

# Automatic pagination
client.users.list(per_page: 100) do |user|
  puts user.name
end
```

## Filtering and Sorting

Build filtered queries:

```ruby
active_users = client.users.list(
  filter: {status: 'active'},
  sort: '-created_at'
)

# Complex filters
users = client.users.list(
  filter: {
    created_at: {$gte: '2026-01-01'},
    status: {$in: ['active', 'pending']}
  }
)
```

## Error Handling

Handle errors with rescue blocks:

```ruby
begin
  user = client.users.get('nonexistent')
rescue SaasPlatform::NotFoundError => e
  puts "User not found"
rescue SaasPlatform::ValidationError => e
  e.errors.each do |error|
    puts "#{error.field}: #{error.message}"
  end
rescue SaasPlatform::AuthenticationError => e
  puts "Check API key"
rescue SaasPlatform::RateLimitError => e
  puts "Rate limited, retry after #{e.retry_after}s"
end
```

## Batch Operations

Efficiently batch create/update:

```ruby
users = [
  {name: 'Alice', email: 'alice@example.com'},
  {name: 'Bob', email: 'bob@example.com'}
]

result = client.users.batch.create(users)
puts "Created #{result.successful.length} users"

result.errors.each do |error|
  puts "Error at index #{error.index}: #{error.message}"
end
```

## Async Operations

For async operations (using Typhoeus):

```ruby
client = SaasPlatform::Client.new(
  api_key: 'sk_live_abc123',
  async: true
)

# Returns a promise
promise = client.users.create_async(
  name: 'Alice',
  email: 'alice@example.com'
)

promise.then do |user|
  puts "Created user: #{user.id}"
end.catch do |error|
  puts "Error: #{error.message}"
end
```

## Streaming

Stream large datasets efficiently:

```ruby
client.events.stream(start_date: '2026-01-01') do |event|
  puts event.timestamp
end
```

## Webhooks

Register and verify webhooks:

```ruby
# Create a webhook
webhook = client.webhooks.create(
  url: 'https://yourapp.com/webhooks',
  events: ['user.created', 'user.deleted']
)

# In your webhook handler
verify_webhook = SaasPlatform::Webhooks.verify(
  payload: request.body.read,
  signature: request.headers['Webhook-Signature'],
  timestamp: request.headers['Webhook-Timestamp'],
  secret: ENV['WEBHOOK_SECRET']
)

if verify_webhook
  # Process webhook
else
  raise "Invalid signature"
end
```

## Logging

Enable request logging:

```ruby
client = SaasPlatform::Client.new(
  api_key: 'sk_live_abc123',
  logger: Logger.new(STDOUT),
  log_level: :debug
)
```

## Configuration Options

```ruby
client = SaasPlatform::Client.new(
  api_key: 'sk_live_abc123',
  environment: 'production',  # or 'sandbox'
  timeout: 30,                # seconds
  max_retries: 3,
  open_timeout: 10            # seconds
)
```

## Testing with RSpec

```ruby
describe UserService do
  let(:client) { SaasPlatform::Client.new(api_key: 'test_key') }

  before do
    allow(client.users).to receive(:get).and_return(
      SaasPlatform::User.new(id: 'user_123', name: 'Alice')
    )
  end

  it 'fetches a user' do
    user = client.users.get('user_123')
    expect(user.name).to eq('Alice')
  end
end
```

## Ruby Version Support

- **Ruby**: 2.6+
- **Rails**: 5.0+

See [SDK Installation](sdk-installation.md) for detailed setup.
