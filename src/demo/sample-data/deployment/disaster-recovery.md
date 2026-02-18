# Disaster Recovery

Plan for catastrophic failures and recovery.

## Recovery Time/Point Objectives

**RTO** (Recovery Time Objective): How long to restore service

```
Standard: 4 hours
Premium: 1 hour
Enterprise: 15 minutes
```

**RPO** (Recovery Point Objective): How much data can you lose

```
Standard: 1 hour (lose up to 1 hour of recent transactions)
Premium: 15 minutes
Enterprise: 5 minutes
```

## Disaster Scenarios

**Database Corruption**:
```
1. Detect corruption (automated checks)
2. Fail over to replica
3. Restore from backup (point-in-time)
4. Verify integrity
5. Resume normal operation
```

**Data Center Outage**:
```
1. Primary DC down
2. DNS updates to secondary DC (minutes)
3. Applications failover (automatic or manual)
4. Secondary DC handles all traffic
5. Primary DC recovers → failback
```

**Ransomware Attack**:
```
1. Detect attack (malware/encryption detected)
2. Isolate systems (network disconnect)
3. Activate backup recovery (clean point-in-time)
4. Restore to uninfected state
5. Investigate and remediate
```

## Geographic Redundancy

Replicate across regions:

```
Primary: us-east-1 (N. Virginia)
Secondary: eu-west-1 (Ireland)
Tertiary: ap-southeast-1 (Singapore)

If primary DC fails → Switch to secondary (live elsewhere)
```

## Backup Strategy

Multiple backup copies for defense in depth:

```
Hourly snapshots (30 days)
Daily backups (90 days)
Weekly archives (1 year)
Off-site cold storage (compliance)
```

## Testing Disaster Recovery

Regular DR drills:

```
Monthly: Test PITR (point-in-time restore)
Quarterly: Simulate failover to secondary
Annually: Full disaster recovery test

Document findings, improve playbooks.
```

## Communication Plan

During disaster:

```
1. Acknowledge incident (page all oncall)
2. Status page: "Investigating issue"
3. Team: Detailed updates every 10 minutes
4. Customers: Email/in-app notification
5. Postmortem: Public writeup within 48 hours
```

## See Also

- [Backup and Recovery](../database/backup-recovery.md) - Backup procedures
- [Replication](../database/replication.md) - Data replication
- [Alerts](../errors/alerts.md) - Incident response
