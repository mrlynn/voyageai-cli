# CI/CD (Continuous Integration/Deployment)

Automated CI/CD pipelines ensure code quality and enable frequent, safe deployments.

## CI Pipeline

Automated tests on every commit:

```yaml
stages:
  - build
  - test
  - deploy_sandbox
  - deploy_staging

build:
  script: npm run build
  artifacts: dist/

test_unit:
  script: npm run test:unit
  coverage: "70%"

test_integration:
  script: npm run test:integration
  services: [postgres, redis]

test_e2e:
  script: npm run test:e2e
  environment: sandbox

deploy_sandbox:
  script: kubectl apply -f deploy/sandbox.yaml
  environment: sandbox
  when: on_success
```

Each commit triggers full test suite. Failing tests block deployment.

## CD Pipeline

Automated deployment to production:

```
Merged to main
  ↓
Run all tests
  ↓
Build Docker image
  ↓
Push to registry
  ↓
Deploy to staging (test)
  ↓
Manual approval (prod deployment)
  ↓
Canary deploy (5% traffic)
  ↓
Monitor (15 minutes)
  ↓
Full production deploy (100%)
```

Manual approval gate prevents accidental production changes.

## GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build_and_test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build
        run: npm run build
      - name: Test
        run: npm run test
      - name: Upload artifacts
        uses: actions/upload-artifact@v2

  deploy:
    needs: build_and_test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh prod
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## Deployment Frequency

Healthy teams deploy multiple times per day:

```
Monday:    2 deployments
Tuesday:   3 deployments
Wednesday: 1 deployment (incident)
Thursday:  4 deployments
Friday:    0 deployments (freeze policy)
```

Frequent small deployments are safer than infrequent large ones.

## Secrets Management

Store secrets in CI/CD system, not in code:

```yaml
deploy:
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.PROD_API_KEY }}
  script: ./deploy.sh
```

Secrets are never logged or exposed.

## See Also

- [Deployment Process](deployment-process.md) - Manual deployment steps
- [Environments](environments.md) - Environment configuration
