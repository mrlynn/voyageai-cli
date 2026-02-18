# Security Hardening

Implement security measures to protect against threats.

## Network Security

**Firewall Rules**:
```
Inbound:  Allow HTTPS (443) from anywhere
Inbound:  Allow SSH (22) from admin networks only
Inbound:  Deny all other traffic

Outbound: Allow to database servers
Outbound: Allow to external APIs
Outbound: Deny by default
```

**VPC Isolation**:
```
Public Subnet → Load Balancer (user traffic)
Private Subnet → Application servers (no direct internet)
Private Subnet → Database servers (no internet)
```

## Secrets Management

**Never hardcode secrets**:
```
# ✗ Bad: Hardcoded
API_KEY = 'sk_live_abc123'

# ✓ Good: From secrets manager
API_KEY = get_secret('prod/api_key')
```

Use services: AWS Secrets Manager, HashiCorp Vault, GitHub Secrets

## TLS/SSL Encryption

All communication encrypted:

```
HTTP  → Unencrypted (never use in production)
HTTPS → Encrypted (always use)

Certificate: Auto-renewed before expiry
TLS version: 1.3 minimum
```

## Authentication Hardening

**Multi-factor Authentication (MFA)**:
```
Enabled for all production accounts.
Backup codes stored securely.
```

**Session Management**:
```
Session timeout: 1 hour inactivity
Token expiry: 15 minutes (short-lived)
Refresh tokens: 30 days (rotated on use)
```

## Authorization and Access Control

**Role-Based Access Control (RBAC)**:
```
Admin: Full access
Operator: View/manage resources, no billing
Viewer: Read-only access
```

**Principle of Least Privilege**:
```
Grant minimum permissions necessary.
Audit access regularly.
Revoke unused permissions.
```

## Data Protection

**Encryption at Rest**:
```
Database: Encrypted with AES-256
Backups: Encrypted in cold storage
```

**Encryption in Transit**:
```
API calls: HTTPS/TLS
Database connections: Encrypted
```

## Vulnerability Scanning

Regularly scan for weaknesses:

```
SAST (Static): Scan source code for vulnerabilities
DAST (Dynamic): Scan running app for flaws
Dependency: Check libraries for known CVEs
```

Tools: Snyk, OWASP ZAP, Nessus

## Compliance Standards

Support compliance requirements:

```
SOC 2 Type II: Security audits, controls
ISO 27001: Information security management
GDPR: Data protection, privacy
HIPAA: Healthcare data protection
PCI DSS: Payment card data security
```

## Incident Response Plan

Documented response to security incidents:

```
1. Detection: Intrusion detected
2. Containment: Isolate affected systems
3. Eradication: Remove threat
4. Recovery: Restore normal operation
5. Post-incident: Document, improve
```

## See Also

- [Backup and Recovery](../database/backup-recovery.md) - Data durability
- [Error Handling](../errors/error-handling.md) - Robust error handling
