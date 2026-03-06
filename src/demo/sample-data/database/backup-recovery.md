# MongoDB Backup and Recovery

## Overview

A robust backup and recovery strategy is essential for any production MongoDB
deployment. This guide covers backup methods, restore procedures, point-in-time
recovery, and disaster recovery planning for both self-managed and MongoDB Atlas
deployments.

## Backup Methods

### mongodump and mongorestore

The `mongodump` tool exports data in BSON dump format, capturing collections,
indexes, and metadata. `mongorestore` imports BSON dumps back into a MongoDB instance.

```javascript
// Verify database status before backup
db.adminCommand({ serverStatus: 1, repl: 1 });

// List all databases and their sizes
db.adminCommand({ listDatabases: 1 }).databases.forEach(d => {
  print(`${d.name}: ${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB`);
});
```

#### Full Backup with mongodump

```bash
# Full cluster backup with oplog for point-in-time recovery
mongodump --uri="mongodb+srv://cluster0.example.mongodb.net" \
  --oplog \
  --gzip \
  --out=/backups/full/$(date +%Y%m%d_%H%M%S)

# Backup a single database
mongodump --uri="mongodb://localhost:27017" \
  --db=production \
  --gzip \
  --out=/backups/db_production/$(date +%Y%m%d)

# Backup a single collection
mongodump --uri="mongodb://localhost:27017" \
  --db=production \
  --collection=orders \
  --gzip \
  --out=/backups/collection_orders/$(date +%Y%m%d)
```

#### Restore with mongorestore

```bash
# Full restore from a BSON dump
mongorestore --uri="mongodb://localhost:27017" \
  --gzip \
  --oplogReplay \
  /backups/full/20260305_020000

# Restore a single database
mongorestore --uri="mongodb://localhost:27017" \
  --db=production \
  --gzip \
  /backups/db_production/20260305/production

# Restore a single collection, dropping existing data
mongorestore --uri="mongodb://localhost:27017" \
  --db=production \
  --collection=orders \
  --drop \
  --gzip \
  /backups/collection_orders/20260305/production/orders.bson.gz
```

### Filesystem Snapshots

For WiredTiger deployments, filesystem-level snapshots (LVM, EBS, ZFS) provide
fast, consistent backups when journaling is enabled.

Requirements:
- Journaling must be enabled (default for WiredTiger).
- The snapshot must capture the entire `dbPath` directory.
- For sharded clusters, stop the balancer and snapshot all shards and config servers.

```javascript
// Verify journaling is enabled
db.serverStatus().storageEngine;
// { "name": "wiredTiger", "supportsCommittedReads": true, ... }

// For sharded clusters, stop the balancer before snapshots
sh.stopBalancer();
// ... take filesystem snapshots ...
sh.startBalancer();
```

### MongoDB Atlas Continuous Backup

MongoDB Atlas provides fully managed backup with:

- **Continuous backups** with point-in-time restore granularity.
- **Cloud provider snapshots** taken at configurable intervals.
- **Snapshot retention policies** (hourly, daily, weekly, monthly).
- **Cross-region snapshot distribution** for disaster recovery.

Atlas backup requires no manual tooling. Snapshots are taken automatically
and can be restored through the Atlas UI or API.

## Recovery Point and Recovery Time Objectives

| Metric | Target       | Strategy                                        |
|--------|--------------|-------------------------------------------------|
| RPO    | < 1 minute   | Oplog-based continuous backup (Atlas)           |
| RPO    | < 1 hour     | Hourly filesystem snapshots                     |
| RPO    | < 24 hours   | Daily mongodump with oplog                      |
| RTO    | < 5 minutes  | Replica set automatic failover                  |
| RTO    | < 30 minutes | mongorestore from local BSON dump               |
| RTO    | < 2 hours    | Atlas point-in-time restore to new cluster      |

## Point-in-Time Recovery

### Oplog-Based Recovery

The oplog (operations log) is a capped collection that records all write operations.
Combined with a base backup, you can replay the oplog to restore to any specific
point in time.

```javascript
// Check oplog status
const oplogInfo = db.getSiblingDB("local").getCollection("oplog.rs").stats();
print("Oplog size:", (oplogInfo.maxSize / 1024 / 1024).toFixed(0), "MB");
print("Oplog used:", (oplogInfo.size / 1024 / 1024).toFixed(2), "MB");

// Find the oplog time window
const first = db.getSiblingDB("local").oplog.rs.find().sort({ $natural: 1 }).limit(1).next();
const last = db.getSiblingDB("local").oplog.rs.find().sort({ $natural: -1 }).limit(1).next();
print("Oplog window start:", first.ts);
print("Oplog window end:", last.ts);
```

```bash
# Restore base backup, then replay oplog to a specific timestamp
mongorestore --oplogReplay \
  --oplogLimit="1709654400:1" \
  --gzip \
  /backups/full/20260305_020000
```

### Atlas Point-in-Time Restore

In MongoDB Atlas, point-in-time restore allows you to restore a cluster to
any second within the backup retention window. Atlas handles oplog replay
automatically.

## Replica Set Failover and Recovery

MongoDB replica sets provide automatic failover. When a primary becomes
unavailable, the remaining members hold an election to choose a new primary.

```javascript
// Check replica set health
rs.status().members.forEach(m => {
  print(`${m.name} | state: ${m.stateStr} | health: ${m.health} | lag: ${m.optimeDate}`);
});

// Force a replica set member to become primary (for maintenance)
rs.stepDown(120); // Primary steps down for 120 seconds

// Check replication lag
rs.printSecondaryReplicationInfo();
```

### Failover Timeline

| Phase                          | Duration     |
|--------------------------------|--------------|
| Failure detection              | 5-10 seconds |
| Election initiation            | ~2 seconds   |
| New primary election           | ~2 seconds   |
| Driver reconnection            | ~1-5 seconds |
| **Total automatic failover**   | 10-20 seconds|

## Disaster Recovery

### Multi-Region Replica Set

Deploy replica set members across regions for geographic redundancy.

```javascript
// Example replica set config with multi-region members
rs.initiate({
  _id: "rs-production",
  members: [
    { _id: 0, host: "mongo-us-east-1:27017", priority: 10 },
    { _id: 1, host: "mongo-us-west-2:27017", priority: 5 },
    { _id: 2, host: "mongo-eu-west-1:27017", priority: 1 },
    { _id: 3, host: "mongo-us-east-1b:27017", priority: 0, hidden: true, tags: { role: "backup" } },
    { _id: 4, host: "mongo-us-east-1c:27017", arbiterOnly: true }
  ],
  settings: {
    getLastErrorDefaults: { w: "majority", wtimeout: 5000 }
  }
});
```

### Backup Verification

Regularly test that backups are restorable.

```javascript
// After restoring to a test environment, verify data integrity
const collections = db.getCollectionNames();
collections.forEach(name => {
  const count = db.getCollection(name).estimatedDocumentCount();
  const indexes = db.getCollection(name).getIndexes().length;
  print(`${name}: ${count} documents, ${indexes} indexes`);
});

// Validate a collection for internal consistency
db.orders.validate({ full: true });
```

### Backup Automation Script

```javascript
// Run from mongosh to log backup metadata
const backupRecord = {
  timestamp: new Date(),
  type: "full",
  method: "mongodump",
  databases: db.adminCommand({ listDatabases: 1 }).databases.map(d => ({
    name: d.name,
    sizeOnDisk: d.sizeOnDisk
  })),
  oplogPosition: db.getSiblingDB("local").oplog.rs.find().sort({ $natural: -1 }).limit(1).next().ts,
  status: "completed"
};

db.getSiblingDB("admin").getCollection("backupLog").insertOne(backupRecord);
print("Backup record logged:", backupRecord.timestamp);
```

## Data Retention Policies

### Active Data

Document data is retained indefinitely unless explicitly removed. Documents
marked with a `deletedAt` field are retained for 90 days before permanent
removal via a TTL index or scheduled cleanup job.

```javascript
// Create a TTL index for automatic document expiration
db.sessionLogs.createIndex(
  { "expiresAt": 1 },
  { expireAfterSeconds: 0 }
);
```

### Logs and Audit Trails

- API request logs: 90 days
- Audit logs: 1 year (for compliance)
- Error logs: 30 days

## Best Practices

1. **Automate backups** on a schedule matching your RPO requirements.
2. **Always include the oplog** when using mongodump for point-in-time recovery.
3. **Test restores regularly.** A backup you have never restored is not a backup.
4. **Monitor oplog window size.** Ensure the oplog retains enough history for your needs.
5. **Use Atlas managed backups** when possible for automated snapshots and restore.
6. **Store backups in a different region** from your primary deployment.
7. **Encrypt backups at rest** using `--gzip` with filesystem-level encryption.
8. **Document your recovery runbook** and practice failover drills quarterly.
