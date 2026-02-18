# Multi-Factor Authentication

Multi-factor authentication (MFA) adds an additional layer of security by requiring users to prove their identity through multiple methods. Supported MFA methods include TOTP (time-based one-time passwords), SMS, and email verification codes.

## TOTP Setup

TOTP (Time-based One-Time Password) is the most secure and user-friendly method. Users scan a QR code with an authenticator app (Google Authenticator, Authy, Microsoft Authenticator) to register.

Enable TOTP via `POST /auth/mfa/totp/setup`, which returns a QR code and backup codes. The user must verify the setup by providing a TOTP code to `POST /auth/mfa/totp/verify`. Backup codes should be stored securely; they allow account recovery if the authenticator app is lost.

## SMS and Email MFA

SMS MFA sends a 6-digit code via text message. Request codes via `POST /auth/mfa/sms/request`, which sends immediately. Codes expire after 10 minutes and support 5 attempts before locking.

Email MFA sends links with embedded tokens. This method is less secure than TOTP but requires no additional apps. Users click the link to confirm authentication.

## MFA During Login

After entering username and password, users are prompted to provide an MFA code. The flow is:

1. `POST /auth/login` returns a challenge token (not a full session token)
2. `POST /auth/mfa/verify` with the challenge token and MFA code
3. Returns a full access token on success

If MFA is required but not configured, the platform prompts users to set it up. Organizations can enforce MFA for all members via settings.

## Backup Codes

Backup codes are generated during MFA setup. Each code is single-use and can bypass MFA verification in emergency situations. Users receive 10 backup codes during TOTP setup. Once exhausted, users must regenerate them via `/auth/mfa/backup-codes/regenerate`.

Backup codes should be printed or stored in a password manager. If all backup codes are used or lost, users can disable MFA and re-enable it fresh, though this removes the backup codes entirely.

## Managing MFA

List active MFA methods via `GET /auth/mfa`. Disable a method with `DELETE /auth/mfa/{method}`. Organizations can audit MFA adoption via the admin dashboard.

If a user loses access to their MFA device, administrators can disable MFA for that user via `/admin/users/{user_id}/mfa/disable`. This resets the user's security posture—best practice is to issue a password reset in conjunction.
