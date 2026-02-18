# Monitoring and Observability

Monitoring tracks system health and behavior. Observability enables understanding of why failures occur.

## Key Metrics

Track these metrics for API health:

**Availability**: % time service is available (99.9% target)
**Latency**: Response time (p50, p95, p99)
**Error Rate**: % of requests that fail
**Throughput**: Requests per second

Dashboard:
```
Availability: 99.95%  ✓
P95 Latency: 450ms   ✓
Error Rate: 0.02%    ✓
Throughput: 5,000 req/sec
```

## Alerting Rules

Set alerts for anomalies:

```yaml
Alerts:
  - name: high_error_rate
    condition: error_rate > 1%
    severity: critical
    action: page_oncall
  
  - name: slow_api
    condition: p99_latency > 5s
    severity: warning
    action: notify_team
  
  - name: low_availability
    condition: uptime < 99.5%
    severity: critical
```

Alert fatigue: Tune thresholds to reduce false positives.

## Health Checks

Implement health check endpoints:

```
GET /health
200 OK
{"status": "healthy", "dependencies": {
  "database": "healthy",
  "cache": "healthy",
  "payment_service": "healthy"
}}

GET /ready
200 OK (service ready to receive traffic)
503 (service not ready; draining connections)
```

Kubernetes uses `/ready` for rolling deployments.

## Distributed Tracing

Trace requests through microservices:

```
Request: req_abc123
  1. Web server (0-10ms)
  2. Auth service (10-50ms)
  3. User service (50-200ms)
  4. Order service (200-500ms)
Total: 500ms
```

Identify slow services; bottleneck is order service.

Tools: Jaeger, Zipkin, DataDog

## SLOs and Error Budgets

Define Service Level Objectives (SLOs):

```
Availability SLO: 99.9% per month
Uptime SLO: p99 latency < 2s
Error SLO: < 0.1% error rate

Error Budget:
99.9% uptime = 43.2 minutes/month allowed downtime
Used: 15 minutes
Remaining: 28.2 minutes
```

High-risk deploys when budget > 50%.

## Dashboards

Create dashboards for visibility:

**Real-time Dashboard**:
- Current error rate
- Current p95 latency
- Requests per second
- Services health

**Historical Dashboard**:
- Error rate trend (24h, 7d, 30d)
- Latency trends
- Traffic patterns
- Deployment timeline

## See Also

- [Error Handling](error-handling.md) - Error recovery
- [Logging](logging.md) - Structured logging
