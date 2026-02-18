# Replication

Database replication synchronizes data across multiple instances for high availability, disaster recovery, and read scaling.

## Replication Architecture

The platform uses **primary-replica (master-slave) replication**:

```
Primary Database (accepts writes)
        ↓ (streams changes)
Replica 1 (read-only)
Replica 2 (read-only)
Replica N (read-only)
```

All writes go to primary; reads distributed across replicas.

## How Replication Works

1. Write commits on primary
2. Write-ahead log (WAL) captures change
3. Replica subscribes to WAL stream
4. Replica applies changes in order
5. Replica synchronizes with primary

Result: Replicas eventually consistent with primary.

## Replication Lag

Replicas lag slightly behind primary:

```
Primary: Writes at timestamp T
Replica: Reads data from T-5ms

Replication lag: 5ms (typical)
```

For strong consistency, read from primary. For eventual consistency, read from replicas.

## High Availability Setup

Automatic failover when primary fails:

```
Primary Database (192.168.1.10)
        ↓
Replica (192.168.1.11) [candidate for promotion]

If primary fails:
1. Replica detected primary unavailable
2. Replica promoted to primary
3. DNS updated to new primary
4. Old primary recovered, becomes replica
```

Failover is automatic; applications reconnect seamlessly.

## Read Scaling with Replicas

Distribute read-heavy workloads across replicas:

```python
# Write to primary
primary_connection.insert('users', {...})

# Read from replica (cheaper)
replica_connection.query('SELECT * FROM users WHERE status = "active"')
```

Replicas are typically larger (more resources) since they handle bulk reads.

## Synchronous vs. Asynchronous Replication

**Asynchronous** (default): Primary doesn't wait for replica to apply change.

```
Primary: Writes A, B, C (returns immediately)
Replica: Still applying A (B and C not yet applied)
```

**Pros**: Low latency
**Cons**: Replica lags; brief downtime if primary fails before replication

**Synchronous**: Primary waits for replica to confirm.

```
Primary: Writes A, waits for replica to apply A
Replica: Applies A, confirms to primary
Primary: Returns success
```

**Pros**: Stronger consistency
**Cons**: Higher latency (primary must wait)

The platform uses **semi-synchronous**: Primary waits for at least one replica to acknowledge (balance consistency and performance).

## Standby Replicas

Dedicated standby replicas for failover:

```
Primary Database
Standby Replica (always available, never accessed)
Warm Standby: Same resources, ready to promote
Hot Standby: Full replica, accepting queries (but promoted on failover)
```

Standby is always synchronized with primary.

## Cascading Replication

Replicas can have their own replicas:

```
Primary Database
└── Replica 1
    ├── Replica 1a
    └── Replica 1b
└── Replica 2
    └── Replica 2a
```

Reduces primary load; adds replication lag (each level delays by milliseconds).

## Geographic Replication

Replicas in different geographic regions:

```
Primary (us-east-1)
├── Replica (us-west-1)
├── Replica (eu-west-1)
└── Replica (ap-southeast-1)
```

**Benefits**:
- Reduced latency for remote users
- Disaster recovery (survive regional outages)
- Compliance (data residency)

**Drawbacks**:
- Higher replication lag (network latency)
- Consistency challenges

## Replication Monitoring

Monitor replication health:

```
GET /admin/replication/status
{
  "primary": "db1.internal:5432",
  "replicas": [
    {
      "host": "db2.internal",
      "lag_bytes": 1024,
      "lag_seconds": 0.5,
      "status": "streaming"
    },
    {
      "host": "db3.internal",
      "lag_bytes": 102400,
      "lag_seconds": 2.1,
      "status": "catching_up"
    }
  ]
}
```

Monitor:
- **Lag bytes**: How far behind replica is
- **Lag seconds**: Estimated time until caught up
- **Status**: streaming, catching_up, disconnected

Alert if lag exceeds thresholds.

## Handling Replication Lag

For critical reads requiring current data:

```python
# Read from primary (stronger consistency)
current_user = primary_db.get_user(user_id)

# Read from replica (eventual consistency)
recent_activity = replica_db.get_user_activity(user_id)
```

Some queries must use primary; offload others to replicas.

## Replication Conflicts

If primary and replica diverge:

```
Primary: UPDATE users SET status = 'active' WHERE id = 1
Replica (corrupted): UPDATE users SET status = 'inactive' WHERE id = 1
```

The replica detects the divergence and halts replication (safe).

Recovery:
1. Investigate root cause
2. Re-sync replica from primary
3. Restart replication

Prevention:
- Disable direct writes to replicas
- Use read-only replicas
- Validate replica state regularly

## Backup During Replication

Backups taken from replicas, not primary:

```
Primary Database (production)
Replica (read-only)
└→ Backup process (doesn't impact primary)
```

Reduces primary load; allows time-consistent backups.

## Network Partition Handling

If network splits primary and replicas:

```
[Primary]  ═══════ (network down) ═══════  [Replica]
```

Replicas stop applying changes; primary continues accepting writes.

When network recovers:
- Replicas catch up from WAL logs
- Or re-sync entire contents if lag too large

Network partitions are rare but critical to handle.

## Performance Considerations

Replication adds minimal overhead:
- Primary writes to WAL: <1% latency increase
- Replica applies changes asynchronously: No impact on primary

Read scaling with replicas provides significant benefits.

## Best Practices

1. **Use replicas for reads**: Distribute read load
2. **Monitor replication lag**: Alert if lag > 1 second
3. **Maintain standby replica**: For rapid failover
4. **Test failover**: Verify automatic promotion works
5. **Use synchronous replication for critical data**: Trade latency for consistency
6. **Investigate divergence immediately**: Indicates corruption risk
7. **Backup from replicas**: Reduces primary load

Replication is the foundation of high availability. Combined with [backup and recovery](backup-recovery.md), it ensures data durability and system resilience.
