# Webhooks

Webhooks enable event-driven architectures by delivering real-time notifications when platform events occur. Instead of polling for changes, subscribe to events and receive HTTP POST callbacks.

## Webhook Concepts

When an event occurs (e.g., user created, order completed), the platform sends an HTTP POST request to your webhook endpoint with event data.

Webhook setup:
1. Define a webhook endpoint (HTTPS URL)
2. Subscribe to events
3. Receive HTTP POST callbacks when events occur

Example event:

```
POST https://yourapp.com/webhooks/user_created
Content-Type: application/json

{
  "id": "evt_123",
  "event": "user.created",
  "timestamp": "2026-02-18T12:34:56Z",
  "data": {
    "user_id": "user_456",
    "email": "alice@example.com",
    "created_at": "2026-02-18T12:34:56Z"
  }
}
```

## Creating Webhooks

Create a webhook via the dashboard (Settings → Webhooks) or API:

```
POST /webhooks
{
  "url": "https://yourapp.com/webhooks/events",
  "events": ["user.created", "user.deleted", "order.completed"],
  "active": true
}

Response:
{
  "id": "webhook_123",
  "url": "https://yourapp.com/webhooks/events",
  "secret": "whsec_abc123",
  "events": ["user.created", "user.deleted", "order.completed"]
}
```

The `secret` is used to verify webhook authenticity. Store it securely.

## Webhook Signature Verification

Every webhook request includes a signature header for verification. This prevents spoofed webhooks.

```
Webhook-Signature: sha256=abcdef0123456789...
Webhook-Timestamp: 1645198496
```

Verify the signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, timestamp, secret) {
  // Prevent replay attacks (timestamp must be within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  // Compute expected signature
  const message = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  if (signature !== expected) {
    throw new Error('Invalid webhook signature');
  }
}
```

Always verify signatures before processing webhooks.

## Webhook Events

Available events depend on your integration. Common events:

- `user.created` - New user registered
- `user.updated` - User profile changed
- `user.deleted` - User account deleted
- `order.created` - New order placed
- `order.completed` - Order fulfilled
- `payment.completed` - Payment processed
- `payment.failed` - Payment rejected

See the [Webhooks API documentation](https://docs.example.com/webhooks-events) for complete list.

## Retry Logic

If your webhook endpoint returns a non-2xx status code, the platform retries with exponential backoff:

```
Attempt 1: Immediately
Attempt 2: After 5 seconds
Attempt 3: After 30 seconds
Attempt 4: After 5 minutes
Attempt 5: After 30 minutes
```

After 5 failed attempts (spanning ~36 minutes), the webhook is marked as failed.

Implement idempotency to safely handle retries. Use the `id` field to deduplicate:

```javascript
async function handleWebhook(event) {
  // Check if we've processed this event before
  const existing = await db.events.findOne({event_id: event.id});
  if (existing) return; // Already processed

  // Process the event
  await processEvent(event);

  // Record that we processed it
  await db.events.insert({event_id: event.id, processed_at: new Date()});
}
```

## Webhook Testing

Test webhooks in the dashboard. Click "Send Test Event" to simulate events without waiting for real occurrences.

For local testing, use a tunneling service like ngrok to expose your local server:

```bash
ngrok http 3000
```

Then configure the webhook URL as `https://yourngrok.ngrok.io/webhooks/events`.

## Managing Webhooks

List webhooks:

```
GET /webhooks
```

Update a webhook:

```
PATCH /webhooks/webhook_123
{"events": ["user.created", "user.updated"]}
```

Delete a webhook:

```
DELETE /webhooks/webhook_123
```

View webhook deliveries and failures:

```
GET /webhooks/webhook_123/deliveries?status=failed
```

## Webhook Best Practices

1. **Verify signatures** - Always validate webhook authenticity
2. **Implement idempotency** - Handle duplicate deliveries gracefully
3. **Respond quickly** - Return 2xx within 30 seconds; process asynchronously
4. **Log events** - Record received events for debugging
5. **Monitor delivery** - Alert on high failure rates
6. **Use HTTPS** - Webhook URLs must use HTTPS
7. **Store secrets securely** - Never commit webhook secrets to version control

## Troubleshooting

**Webhooks not delivering**: Check webhook URL is accessible and returns 2xx. Verify secret is correct.

**Wrong event data**: Ensure you're subscribed to the correct events. Check event schema in documentation.

**Signature verification failing**: Verify secret matches. Check timestamp is recent (not replayed).
