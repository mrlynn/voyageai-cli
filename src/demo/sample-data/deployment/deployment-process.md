# Deployment Process

Structured deployment process ensures smooth rollouts and minimizes risk.

## Deployment Pipeline

```
Code Commit → Build → Test → Sandbox → Staging → Canary → Production
  (git)    (compile) (unit) (smoke)  (full)   (5%)    (100%)
```

Each stage validates readiness before proceeding.

## Blue-Green Deployment

Run two production environments:

```
Blue (Current)   → Handles all traffic
Green (New)      → Idle, no traffic

Deploy to green, test, then switch:
Blue (Current)   ← Traffic now here
Green (New)      ← Switches traffic from blue
```

Rollback is instant (switch traffic back to blue).

## Canary Releases

Route small traffic percentage to new version:

```
Canary:   5% traffic to new version
Monitor:  Error rate, latency, crashes
If OK:    Increase to 10%, 25%, 50%, 100%
If issue: Rollback to 0%
```

Catches issues before full rollout.

## Rollback Procedure

If deployment fails:

```
1. Acknowledge issue (page oncall)
2. Assess severity (errors, data loss?)
3. Execute rollback: kubectl rollout undo
4. Verify: Health checks pass, errors drop
5. Investigate: Why did deployment fail?
6. Fix: Address root cause before next attempt
```

Rollback should complete in <5 minutes.

## Deployment Checklist

- [ ] Code review approved
- [ ] Tests pass (unit, integration, e2e)
- [ ] No secrets in code
- [ ] Staging smoke tests pass
- [ ] Performance benchmarks OK
- [ ] Database migrations reversible
- [ ] Runbooks updated
- [ ] Team notified
- [ ] Monitoring alerts configured

## See Also

- [Environments](environments.md) - Environment configuration
- [CI/CD](ci-cd.md) - Automated deployment pipeline
