# Deployment Environments

The platform spans multiple environments with different purposes and configurations.

## Environment Types

**Sandbox**: For testing and development
- Reset daily
- No real data
- Unlimited rate limits
- Test payment methods

**Staging**: Production-like environment
- Pre-production
- Real-like data volumes
- Enforced rate limits
- Close to production config

**Production**: Customer-facing environment
- Real customers
- Real data
- Standard rate limits
- High availability

## Environment URLs

```
Sandbox:   https://sandbox-api.example.com/v2/
Staging:   https://staging-api.example.com/v2/
Production: https://api.example.com/v2/
```

Use environment-specific credentials for each.

## Data Isolation

Each environment has isolated data:

```
Production Database  → Real customer data
Staging Database     → Test data (refreshed weekly)
Sandbox Database     → Ephemeral (reset daily)
```

No data crosses between environments.

## Configuration by Environment

Applications detect environment and adjust:

```python
import os

ENV = os.getenv('API_ENVIRONMENT', 'sandbox')

if ENV == 'production':
    API_KEY = os.getenv('PROD_API_KEY')
    API_URL = 'https://api.example.com'
    LOG_LEVEL = 'ERROR'
elif ENV == 'staging':
    API_KEY = os.getenv('STAGING_API_KEY')
    API_URL = 'https://staging-api.example.com'
    LOG_LEVEL = 'WARN'
else:  # sandbox
    API_KEY = os.getenv('SANDBOX_API_KEY')
    API_URL = 'https://sandbox-api.example.com'
    LOG_LEVEL = 'DEBUG'
```

## Environment-Specific Features

Some features only available in production:

```
Feature          | Sandbox | Staging | Production
Real data        | No      | No      | Yes
Webhooks         | No      | Yes     | Yes
High SLA         | No      | No      | Yes
Backup/recovery  | No      | No      | Yes
```

Test available features in staging before production.

## Promoting Between Environments

Typical workflow:

```
Development → Sandbox → Staging → Production
  (local)  (daily test) (weekly) (customers)
```

Each promotion is a full regression test in that environment.

See [Deployment Process](deployment-process.md) for promotion steps.
