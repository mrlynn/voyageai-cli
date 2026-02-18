# Backup and Recovery

The platform maintains automated backups and provides recovery procedures for disaster scenarios. Understanding backup policies ensures data safety.

## Backup Strategy

Automated backups are taken continuously:

- **Point-in-time snapshots**: Every hour
- **Continuous replication**: Real-time to standby
- **Off-site backup**: Daily copy to cold storage
- **Retention**: 30 days of hourly backups, 1 year of daily backups

## Backup Locations

- **Hot storage**: Last 30 days of hourly snapshots (fast recovery)
- **Warm storage**: Last 90 days (slower access)
- **Cold storage**: Year-long archive (very slow, compliance)

## Recovery Point Objective (RPO)

RPO measures how much data you might lose:

- **Standard Plan**: 1-hour RPO (lose up to 1 hour of data)
- **Premium Plan**: 15-minute RPO
- **Enterprise Plan**: 5-minute RPO

Request higher RPO for additional cost.

## Recovery Time Objective (RTO)

RTO measures how quickly service is restored:

- **Standard Plan**: 4-hour RTO (service restored in 4 hours)
- **Premium Plan**: 1-hour RTO
- **Enterprise Plan**: 15-minute RTO

## Automated Failover

If the primary database fails:

1. Health checks detect failure (within 30 seconds)
2. Promote standby replica to primary (within 2 minutes)
3. DNS updated to route to new primary (propagates in minutes)

Total downtime: <5 minutes for Premium/Enterprise

## Manual Recovery

For manual data recovery, request point-in-time restore (PITR):

```
https://dashboard.example.com/settings/backup

1. Select recovery timestamp
2. Click "Restore to Point in Time"
3. Confirmation required (prevents accidental overwrites)
4. New database created with historical data
5. Test thoroughly before promoting
```

PITR availability:
- Last 30 days: Restore to any hour
- 30-90 days: Restore to any day
- >90 days: Contact support

## Full Backup Export

Export complete database backup:

```bash
curl -X POST https://api.example.com/admin/backups/export \
  -H "Authorization: Bearer <token>" \
  -d '{"format": "sql"}' \
  > backup.sql.gz
```

Formats:
- **sql**: SQL dump (text format, human-readable)
- **binary**: PostgreSQL binary format (faster restore)

Export includes:
- Schema and indexes
- All data
- Sequences and functions

## Backup Verification

Automatically verify backups are restorable:

```bash
# View recent backup verification results
GET /admin/backups/verify
{
  "last_verified": "2026-02-18T00:00:00Z",
  "status": "success",
  "tested_restore_time": 45  // minutes
}
```

Weekly full recovery tests ensure backups are valid.

## Data Retention Policies

### Active Data

User data is retained indefinitely (unless deleted). Soft-deleted data (marked with `deleted_at`) is retained for 90 days before permanent purge.

### Logs and Audit Trails

- API request logs: 90 days
- Audit logs: 1 year (for compliance)
- Error logs: 30 days

Older logs are archived to cold storage but remain queryable.

### Compliance Holds

For legal/compliance reasons, data can be placed on legal hold:

```
POST /admin/legal-hold/{user_id}
{
  "hold_id": "hold_123",
  "reason": "litigation"
}
```

Data with legal hold:
- Cannot be deleted (even during retention period expiry)
- Must be recovered if deleted elsewhere
- Retained indefinitely

## Disaster Recovery Runbook

### Scenario 1: Database Corruption

If data corruption is detected:

1. **Assess scope**: Which tables/records are affected?
2. **Decide recovery point**: How far back to restore?
3. **Test restore**: Restore to separate database, verify
4. **Execute restore**: Promote recovered database to primary
5. **Verify**: Spot-check recovered data

Estimated time: 30 min - 2 hours

### Scenario 2: Accidental Data Deletion

If important data is deleted:

1. **Immediately file incident**: Stops cleanup processes
2. **Identify deletion time**: When was data deleted?
3. **Request PITR**: Recover database to point before deletion
4. **Verify recovered data**: Confirm correct data restored
5. **Promote**: Switch to recovered database

Estimated time: 15 min - 1 hour

### Scenario 3: Complete Data Center Failure

If entire data center is unavailable:

1. **Activate DR site**: Standby region is promoted
2. **Validate**: Ensure all data replicated correctly
3. **Route traffic**: DNS updated to DR site
4. **Monitor**: Watch for anomalies
5. **Restore**: When primary recovers, sync and failback

Estimated time: 5 - 30 minutes (depends on plan)

## Testing Recovery

Regularly test recovery procedures:

```bash
# Simulate disaster recovery test
POST /admin/dr-test
{
  "target_restore_time": "2026-02-17T12:00:00Z"
}
```

Tests include:
- PITR restore
- Failover to standby
- Data validation
- Application restart

Schedule monthly tests for critical systems.

## Backup Monitoring

Monitor backup health:

```
GET /admin/backups/status
{
  "last_backup_time": "2026-02-18T07:00:00Z",
  "backup_size": "500GB",
  "next_backup_time": "2026-02-18T08:00:00Z",
  "retention_days": 30,
  "health": "healthy"
}
```

Alerts:
- Backup failure: Immediate notification
- Backup size anomaly: >20% change → review
- Restore test failure: Security incident

## Best Practices

1. **Test recovery regularly**: Untested backups are useless
2. **Maintain backups off-site**: Protects against data center failure
3. **Document procedures**: Runbooks should be clear and tested
4. **Monitor health**: Watch backup success rates
5. **Separate access**: Different credentials for production and backups
6. **Encrypt sensitive data**: Backup encryption at rest and in transit
7. **Verify retention policies**: Ensure compliance with regulations

## Compliance Certifications

Backup practices support:

- **SOC 2 Type II**: Automated testing and recovery
- **ISO 27001**: Data protection and encryption
- **GDPR**: Right to erasure (soft delete + purge after 90 days)
- **HIPAA**: Backup encryption and audit trails

See [Security Hardening](../deployment/security-hardening.md) for security details.
