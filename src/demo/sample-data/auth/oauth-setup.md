# OAuth 2.0 Setup

OAuth 2.0 enables third-party applications to access user resources without handling passwords. Use OAuth when building integrations, public mobile apps, or allowing users to authorize external services on their behalf.

## OAuth Flows

### Authorization Code Flow (Most Common)
For web applications, users are redirected to our login page. After authentication, they grant permissions and are redirected back to your app with an authorization code. Exchange this code for an access token using your client secret.

```
1. GET https://api.example.com/oauth/authorize?client_id=...&redirect_uri=...&scope=...
2. User logs in and grants permission
3. Redirect to: https://yourapp.com/callback?code=auth_code
4. POST /oauth/token (exchange code for access_token)
```

### Implicit Flow (Deprecated)
Older flow for single-page applications (SPAs). No longer recommended due to token exposure in URL fragments. Use the Authorization Code flow with PKCE instead.

### PKCE (Proof Key for Code Exchange)
For mobile and desktop apps, use PKCE to secure the authorization code exchange. Generate a random `code_verifier` and hash it to create a `code_challenge`. Include the challenge in the authorization request and the verifier in the token exchange.

## Application Registration

Register your OAuth application at the Dashboard → OAuth Apps. You'll receive a `client_id` and `client_secret`. Treat the secret like an API key—never expose it in client-side code or public repositories.

Set redirect URIs carefully. Only exact-match URIs are accepted for security reasons. During development, use `http://localhost:3000/callback`; in production, use HTTPS URLs only.

## Scopes and Permissions

Request the minimum required scopes. Available scopes include:
- `profile` - User name, email, avatar
- `read:data` - Read access to user resources
- `write:data` - Write access to user resources
- `admin` - Full administrative access

Scopes are granted during the authorization step. Users see exactly what permissions they're granting.

## Token Refresh and Revocation

Access tokens expire after 1 hour. Use refresh tokens to obtain new access tokens without user interaction. Refresh tokens last 30 days.

Users can revoke tokens at any time via Settings → Connected Apps. Revocation is immediate—subsequent API requests return 401 Unauthorized.

## Best Practices

- Always verify CSRF tokens when handling authorization callbacks
- Validate that the `state` parameter matches your session state
- Store refresh tokens securely and never expose them client-side
- Implement logout by clearing local tokens and calling `/oauth/revoke`
- Use HTTPS for all OAuth flows
