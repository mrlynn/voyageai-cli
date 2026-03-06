# MongoDB Replication

## Overview

MongoDB uses replica sets to provide high availability, data redundancy, and
read scaling. A replica set is a group of `mongod` instances that maintain the
same data set. One member is the primary (accepts writes), and the remaining
members are secondaries that replicate the primary's oplog.

## Replica Set Architecture

A standard replica set consists of:

- **Primary**: Receives all write operations. There is exactly one primary.
- **Secondaries**: Replicate data from the primary. Can serve read operations
  if read preference is configured.
- **Arbiter** (optional): Participates in elections but holds no data. Used to
  break ties in elections with an even number of data-bearing members.

### Initializing a Replica Set

```javascript
rs.initiate({
  _id: "rs-app",
  members: [
    { _id: 0, host: "mongo-1:27017", priority: 10 },
    { _id: 1, host: "mongo-2:27017", priority: 5 },
    { _id: 2, host: "mongo-3:27017", priority: 5 }
  ]
});
```

### Adding Members

```javascript
// Add a standard secondary
rs.add({ host: "mongo-4:27017", priority: 3 });

// Add an arbiter (no data, voting only)
rs.addArb("mongo-arbiter:27017");

// Add a hidden member (invisible to client drivers)
rs.add({
  host: "mongo-hidden:27017",
  priority: 0,
  hidden: true
});

// Add a delayed member (replicates with a 1-hour delay)
rs.add({
  host: "mongo-delayed:27017",
  priority: 0,
  hidden: true,
  secondaryDelaySecs: 3600
});
```

## Member Types

| Member Type     | Accepts Writes | Votes | Visible to Drivers | Use Case                        |
|-----------------|----------------|-------|--------------------|---------------------------------|
| Primary         | Yes            | Yes   | Yes                | All write operations            |
| Secondary       | No             | Yes   | Yes                | Read scaling, failover          |
| Hidden          | No             | Yes   | No                 | Reporting, backup               |
| Delayed         | No             | Yes   | No                 | Protection against human error  |
| Arbiter         | No             | Yes   | No                 | Election tiebreaker             |

## Elections and Automatic Failover

When the primary becomes unavailable, eligible secondaries call an election.
The member with the highest priority and most recent oplog entry typically wins.

```javascript
// Check current replica set status
rs.status().members.forEach(m => {
  print(`${m.name} | state: ${m.stateStr} | health: ${m.health}`);
});

// Manually trigger a stepdown (primary relinquishes role)
rs.stepDown(60); // Steps down for 60 seconds

// Freeze a secondary to prevent it from seeking election
rs.freeze(120); // Cannot become primary for 120 seconds
```

### Election Requirements

- A majority of voting members must be reachable.
- The candidate must have the most recent oplog entry among reachable members.
- The candidate's `priority` must be greater than 0.
- Members with `priority: 0` can never become primary.

## Write Concern

Write concern specifies the level of acknowledgment requested from MongoDB for
write operations.

```javascript
// Write acknowledged by the primary only
db.orders.insertOne(
  { item: "widget", qty: 25 },
  { writeConcern: { w: 1 } }
);

// Write acknowledged by a majority of replica set members
db.orders.insertOne(
  { item: "widget", qty: 25 },
  { writeConcern: { w: "majority", wtimeout: 5000 } }
);

// Write acknowledged by all data-bearing members
db.orders.insertOne(
  { item: "widget", qty: 25 },
  { writeConcern: { w: 3 } } // Assuming 3 data-bearing members
);

// Write acknowledged after being written to the journal
db.orders.insertOne(
  { item: "widget", qty: 25 },
  { writeConcern: { w: "majority", j: true } }
);
```

| Write Concern    | Durability      | Latency   | Data Safety        |
|------------------|-----------------|-----------|--------------------|
| `w: 1`           | Primary only    | Lowest    | Risk of data loss  |
| `w: "majority"`  | Majority nodes  | Moderate  | Strong durability  |
| `w: <n>`         | Exactly n nodes | Higher    | Depends on n       |
| `j: true`        | Journaled       | Higher    | Survives crashes   |

## Read Preference

Read preference determines which replica set members receive read operations.

```javascript
// Read from primary only (default, strongest consistency)
db.getMongo().setReadPref("primary");

// Read from primary, fall back to secondary if unavailable
db.getMongo().setReadPref("primaryPreferred");

// Read from secondaries only (offload reads from primary)
db.getMongo().setReadPref("secondary");

// Read from secondary, fall back to primary
db.getMongo().setReadPref("secondaryPreferred");

// Read from the member with lowest network latency
db.getMongo().setReadPref("nearest");

// Tag-based read preference (read from a specific data center)
db.getMongo().setReadPref("secondary", [{ dc: "us-east-1" }]);
```

| Read Preference       | Consistency | Availability | Use Case                          |
|-----------------------|-------------|--------------|-----------------------------------|
| `primary`             | Strong      | Lower        | Critical reads needing latest data|
| `primaryPreferred`    | Strong*     | Higher       | Prefer consistency, tolerate lag  |
| `secondary`           | Eventual    | Higher       | Analytics, reporting              |
| `secondaryPreferred`  | Eventual    | Highest      | Read-heavy workloads              |
| `nearest`             | Eventual    | Highest      | Latency-sensitive applications    |

## The Oplog

The oplog (`local.oplog.rs`) is a capped collection that records all operations
that modify data. Secondaries replicate by tailing the primary's oplog.

```javascript
// View oplog stats
const stats = db.getSiblingDB("local").oplog.rs.stats();
print("Max size:", (stats.maxSize / 1024 / 1024 / 1024).toFixed(2), "GB");
print("Current size:", (stats.size / 1024 / 1024).toFixed(2), "MB");

// View the most recent oplog entries
db.getSiblingDB("local").oplog.rs.find().sort({ $natural: -1 }).limit(3).pretty();

// Estimate oplog window (how far back you can recover)
rs.printReplicationInfo();
```

### Oplog Sizing

The oplog must be large enough to hold operations for at least the time it
takes to perform a full resync. For busy systems, increase the oplog size.

```javascript
// Resize the oplog (MongoDB 4.0+)
db.adminCommand({ replSetResizeOplog: 1, size: 16384 }); // 16 GB in MB
```

## Monitoring Replication

```javascript
// Detailed replication status
rs.status();

// Replication lag per secondary
rs.printSecondaryReplicationInfo();

// Replica set configuration
rs.conf();

// Check if current node is primary
db.isMaster().ismaster;

// Monitor replication lag in a loop
while (true) {
  rs.status().members
    .filter(m => m.stateStr === "SECONDARY")
    .forEach(m => {
      const lag = (new Date() - m.optimeDate) / 1000;
      print(`${m.name}: ${lag.toFixed(1)}s lag`);
    });
  sleep(5000);
}
```

## Read Scaling Patterns

### Distribute Analytics to Secondaries

```javascript
// Run expensive aggregation on a secondary
db.getMongo().setReadPref("secondary");

db.events.aggregate([
  { $match: { timestamp: { $gte: ISODate("2026-03-01") } } },
  { $group: { _id: "$eventType", count: { $sum: 1 }, avgDuration: { $avg: "$duration" } } },
  { $sort: { count: -1 } }
]);
```

### Use Hidden Members for Dedicated Workloads

Hidden members are not visible to application drivers but can be connected
to directly for reporting, backup, or analytics workloads without affecting
application performance.

## Geographic Replication

Deploy replica set members across regions for reduced latency and compliance.

```javascript
rs.initiate({
  _id: "rs-global",
  members: [
    { _id: 0, host: "mongo-us-east:27017", priority: 10, tags: { dc: "us-east-1" } },
    { _id: 1, host: "mongo-us-west:27017", priority: 5, tags: { dc: "us-west-2" } },
    { _id: 2, host: "mongo-eu-west:27017", priority: 3, tags: { dc: "eu-west-1" } },
    { _id: 3, host: "mongo-ap-south:27017", priority: 1, tags: { dc: "ap-south-1" } }
  ]
});
```

Benefits:
- Reduced read latency for users near secondary members
- Disaster recovery across regions
- Data residency compliance with tag-based read preference

## Best Practices

1. **Use an odd number of voting members** (3 or 5) to ensure clean elections.
2. **Set `w: "majority"` as the default write concern** for data durability.
3. **Deploy members across availability zones** for fault tolerance.
4. **Monitor replication lag** and alert when it exceeds acceptable thresholds.
5. **Size the oplog appropriately** for your write volume and maintenance windows.
6. **Use delayed members** as a safety net against accidental data modifications.
7. **Never use arbiters** when you can afford a full data-bearing member instead.
8. **Use tag sets** to control read distribution across data centers.
