# Alerts and Incident Response

Effective alerting detects issues early. Incident response ensures swift resolution.

## Alert Types

**Threshold Alerts**: Trigger when metric exceeds limit.
```
error_rate > 1% → page oncall
```

**Anomaly Alerts**: Trigger on unusual behavior.
```
error_rate increases 5x baseline → investigate
```

**Composite Alerts**: Combine multiple conditions.
```
error_rate > 0.5% AND p99_latency > 3s → critical
```

## Alert Severity

- **CRITICAL**: Immediate action required; pages oncall
- **HIGH**: Urgent; notify team; check within 15 minutes
- **MEDIUM**: Monitor; plan response within 1 hour
- **LOW**: Informational; check daily/weekly

Avoid alert fatigue by tuning thresholds.

## On-Call Rotation

Distribute oncall duties fairly:
```
Week 1: Alice (Mon-Sun)
Week 2: Bob (Mon-Sun)
Week 3: Charlie (Mon-Sun)
```

Oncall responsibilities:
- Respond to critical alerts within 15 minutes
- Page backup if unresponsive
- Document issues and resolutions
- Maintain runbooks

## Incident Response

**Step 1: Acknowledge**
```
Alert triggered: high_error_rate
Oncall: Alice acknowledges (stops paging)
Time: 12:34 UTC
```

**Step 2: Assess**
```
Error rate: 15% (normal: 0.01%)
Services affected: payment_service, order_service
User impact: Customers can't complete purchases
Severity: Critical (revenue impact)
```

**Step 3: Mitigate**
```
Option 1 (fast): Scale up service (+50% capacity)
Option 2: Rollback recent deployment
Option 3: Circuit break failing service

Chosen: Scale up service (60s to deploy)
Result: Error rate dropped to 0.5% within 90s
```

**Step 4: Communicate**
```
Status page: "Payment processing degraded; mitigation in progress"
Customers: Email with impact and ETA
Team: Slack update with action taken
```

**Step 5: Postmortem**
```
Timeline:
- 12:34 UTC: Alert fired
- 12:35 UTC: Oncall acknowledged
- 12:40 UTC: Root cause identified (database connection leak)
- 12:45 UTC: Service scaled; issue resolved

Root cause: Database connection limit exceeded due to
  cascade of slow queries. Solution: Implement connection pooling.
```

## Runbooks

Document standard responses:

```markdown
# Payment Service Down

## Detection
- Alert: payment_service_unavailable
- Check: curl https://payment-api.internal/health

## Response
1. Check service logs: `kubectl logs -f deployment/payment`
2. Check database: `psql ... "SELECT count(*) FROM connections"`
3. If database connections maxed: increase pool size
4. If recent deploy: rollback: `kubectl rollout undo deployment/payment`
5. If unknown: page db-oncall team

## Escalation
- Page payment_service_owner if issue > 10 minutes
- Page CTO if issue > 30 minutes
```

## See Also

- [Monitoring](monitoring.md) - Metrics and dashboards
- [Error Handling](error-handling.md) - Error recovery
