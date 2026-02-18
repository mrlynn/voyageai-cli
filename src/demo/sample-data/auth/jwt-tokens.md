# JWT Tokens

JSON Web Tokens (JWT) provide a stateless authentication mechanism suitable for microservices, mobile applications, and distributed systems. Unlike API keys, JWTs contain encoded claims and can be validated without server-side state lookups.

## Token Structure and Claims

A JWT consists of three parts separated by dots: `header.payload.signature`. The header identifies the token type and signing algorithm (typically HS256 or RS256). The payload contains claims such as `sub` (subject/user ID), `exp` (expiration time), `iat` (issued at), and custom claims like `user_role` or `org_id`.

Tokens are signed with either a symmetric key (HS256) or an asymmetric keypair (RS256). RS256 is recommended for distributed architectures where multiple services validate tokens without accessing the signing key.

## Token Lifecycle

Issue tokens via the `/auth/token` endpoint by providing valid credentials or an API key. Tokens expire after 15 minutes by default, though you can request longer lifetimes (up to 24 hours) during issuance.

```
POST /auth/token
{"ttl_seconds": 3600}
Response: {"access_token": "eyJhbGc...", "expires_in": 3600}
```

## Refresh Tokens and Expiration

For long-lived sessions, pair access tokens with refresh tokens. Access tokens are short-lived (15 minutes), while refresh tokens last 30 days. When an access token expires, exchange the refresh token for a new access token without requiring password entry.

Refresh tokens are rotation-required: each refresh invalidates the old refresh token and issues a new one. This prevents attackers from using stolen refresh tokens indefinitely.

## Token Validation

Applications validate JWT signatures locally using the public key published at `/.well-known/jwks.json`. This endpoint returns JWKS (JSON Web Key Set) data for all active signing keys. Cache this response for 24 hours to minimize outbound requests.

Validate token expiration by checking the `exp` claim against the current Unix timestamp. Expired tokens should be rejected immediately without making server-side calls.

## Security Considerations

Store JWT tokens securely in httpOnly cookies for web applications or secure storage for mobile apps. Never expose tokens in URL parameters or plain-text logs.

Implement token revocation by maintaining a denylist on the server side for critical scenarios like password changes or account compromise. For stateless validation, rely on short TTLs instead.

Cross-origin requests should validate the token's `origin` claim if present, preventing token reuse across domains.
