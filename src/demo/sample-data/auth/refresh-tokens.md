# Refresh Tokens

Refresh tokens enable long-lived sessions without exposing long-lived access tokens. They are single-use, rotation-required tokens that can be exchanged for new access tokens and new refresh tokens.

## Token Pair Model

The platform uses a two-token model: short-lived access tokens and longer-lived refresh tokens. Access tokens (15 minutes) are used for API requests. When they expire, refresh tokens (30 days) are exchanged for a new pair.

This architecture limits the window of exposure if an access token is stolen. An attacker with a stolen access token can act for 15 minutes; stealing a refresh token grants 30 days of access, but refresh tokens are stored securely and rotated frequently.

## Refresh Token Exchange

Exchange a refresh token via `POST /auth/refresh`:

```
POST /auth/refresh
{"refresh_token": "rtk_..."}
Response:
{
  "access_token": "eyJhbGc...",
  "refresh_token": "rtk_...",  // NEW refresh token
  "expires_in": 900  // 15 minutes
}
```

The returned refresh token is different from the one sent. The old token immediately becomes invalid—this prevents token reuse. If the same refresh token is submitted twice, the second request fails.

## Rotation-Required Behavior

Refresh token rotation detects if a token is stolen and reused. If an attacker steals a refresh token and uses it before the legitimate owner, both will have different new tokens. The next legitimate refresh attempt will fail (the attacker's new token has invalidated the old one).

Implement defensive logic: if refresh fails, force re-authentication and audit the session for unauthorized access.

## Storage and Security

Store refresh tokens securely:
- **Web**: httpOnly, Secure cookies (not localStorage, which is vulnerable to XSS)
- **Mobile**: Secure storage (Keychain on iOS, Keystore on Android)
- **Server-to-server**: Encrypted at rest in the application database

Never transmit refresh tokens in URLs or plain-text logs. If a refresh token appears in logs, revoke it immediately.

## Refresh Token Families

The platform implements refresh token families for detecting compromised tokens. All tokens descended from the same initial refresh share a family ID. If a token from a family is used twice, all tokens in that family are invalidated immediately.

This "kill family" mechanism catches token theft quickly. Users affected see authentication failures and are prompted to re-login.

## Expiration and Renewal

Refresh tokens expire after 30 days. As expiry approaches, the platform includes an `X-Refresh-Expires-Soon: true` header. Applications should proactively refresh before expiry to avoid service disruption.

Alternatively, refresh tokens can be renewed before expiry without consuming them. Use `POST /auth/refresh?renew=true` to extend the token's lifetime by 30 days. This is useful for maintaining long-lived background jobs or services.

## Revoking Refresh Tokens

Revoke a refresh token immediately via `POST /auth/revoke-refresh`. This invalidates that token and all descendants (tokens generated from it). Revoking a parent token revokes the entire family tree.

For password changes or security incidents, administrators can revoke all refresh tokens for a user via `/admin/users/{user_id}/refresh-tokens/revoke-all`.
