# SAML Integration

SAML (Security Assertion Markup Language) enables enterprise single sign-on (SSO) integration with corporate identity providers like Okta, Azure AD, and OneLogin. This allows employees to authenticate using their corporate credentials.

## SAML Configuration

Configure SAML under Organization Settings → SAML. You'll need your identity provider's metadata URL or XML document. The platform generates a Service Provider (SP) metadata URL for you to share with your identity provider's administrator.

Key configuration parameters:
- **Entity ID**: Unique identifier for your organization (usually your domain)
- **ACS URL**: Assertion Consumer Service URL (provided by platform)
- **Logout URL**: Single Logout URL for logout initiation
- **Name ID Format**: Usually email or persistent opaque ID

## SAML Login Flow

When SAML is enabled, users visit your custom login page or use a magic link. They're redirected to your corporate identity provider, authenticate there, and are redirected back to the platform with a SAML assertion.

The assertion contains user attributes like `email`, `first_name`, `last_name`, and optional custom attributes. These attributes are automatically mapped to platform user profiles.

```
1. User visits /login
2. Redirects to IdP (e.g., https://okta.example.com/sso)
3. User authenticates at IdP
4. IdP posts SAML assertion back to /auth/saml/acs
5. User is logged in and redirected to dashboard
```

## Just-In-Time Provisioning

With Just-In-Time (JIT) provisioning enabled, new users are automatically created on first login. Attributes from the SAML assertion populate profile fields. Without JIT, users must be pre-created in the platform, and only authentication occurs.

Disable JIT in high-security environments where user creation must be explicitly managed. Users attempting login without existing accounts see an "unauthorized" error.

## Attribute Mapping

Customize how SAML attributes map to platform user fields. Default mappings:
- `email` → User email
- `givenName` → First name
- `familyName` → Last name
- `groups` → Organization roles

Advanced mapping supports nested attributes and conditional logic. For example, map the `department` attribute to organization teams automatically.

## Testing and Troubleshooting

Use the metadata URL (`https://api.example.com/auth/saml/metadata`) to validate your configuration. The SAML metadata contains your SP configuration for sharing with identity providers.

Test SAML login via the "Test SAML" button in settings. This initiates a real authentication flow and shows detailed error messages if something fails.

Common issues:
- **Clock skew**: Timestamps on IdP and platform differ by >5 minutes
- **ACS URL mismatch**: IdP redirect URL doesn't match configured ACS URL
- **Missing attributes**: Required attributes missing from SAML assertion

Enable SAML audit logging to debug issues. Logs are available under Organization Settings → Audit Logs.
