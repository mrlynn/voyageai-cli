# MongoDB Sharding

## Overview

Sharding is MongoDB's approach to horizontal scaling. It distributes data across
multiple machines (shards) to support deployments with very large data sets and
high-throughput workloads. A sharded cluster consists of shards, mongos routers,
and config servers.

## Sharded Cluster Architecture

| Component        | Role                                                              |
|------------------|-------------------------------------------------------------------|
| **Shard**        | Stores a subset of the sharded data. Each shard is a replica set. |
| **mongos**       | Query router. Directs client operations to the appropriate shard(s). |
| **Config Server** | Stores cluster metadata, chunk mappings, and shard configuration. Deployed as a replica set. |

```
Client -> mongos -> Shard 1 (rs-shard1)
                 -> Shard 2 (rs-shard2)
                 -> Shard 3 (rs-shard3)
       Config Server (rs-config)
```

## Enabling Sharding

```javascript
// Enable sharding on a database
sh.enableSharding("analytics");

// Shard a collection with a ranged shard key
sh.shardCollection("analytics.events", { tenantId: 1, timestamp: 1 });

// Shard a collection with a hashed shard key
sh.shardCollection("analytics.logs", { _id: "hashed" });

// Shard with a compound shard key
sh.shardCollection("analytics.metrics", { region: 1, deviceId: 1 });
```

## Shard Key Selection

The shard key determines how documents are distributed across shards. Choosing
the right shard key is the most important sharding decision.

### Shard Key Properties

| Property             | Ideal Shard Key Characteristic                         |
|----------------------|--------------------------------------------------------|
| **Cardinality**      | High cardinality (many distinct values)                |
| **Write distribution** | Even distribution of writes across shards            |
| **Query isolation**  | Queries can target a single shard (not scatter-gather) |
| **Monotonicity**     | Avoid monotonically increasing keys for ranged sharding|

### Good vs Poor Shard Keys

```javascript
// GOOD: High cardinality compound key, distributes evenly
sh.shardCollection("app.users", { region: 1, odId: 1 });

// GOOD: Hashed key for uniform distribution
sh.shardCollection("app.sessions", { userId: "hashed" });

// POOR: Low cardinality (only a few distinct values)
// sh.shardCollection("app.users", { status: 1 });
// Only "active", "inactive", "suspended" => 3 chunks max

// POOR: Monotonically increasing (all writes go to one shard)
// sh.shardCollection("app.logs", { timestamp: 1 });
// New documents always land on the max-range chunk
```

## Hashed vs Ranged Sharding

### Ranged Sharding

Data is divided into contiguous ranges based on the shard key value. Good for
range queries but can create hotspots with monotonic keys.

```javascript
// Ranged shard key: good for range queries on tenantId
sh.shardCollection("saas.orders", { tenantId: 1, orderDate: 1 });

// Targeted query (hits only the shard containing this tenant)
db.orders.find({ tenantId: "tenant-42", orderDate: { $gte: ISODate("2026-01-01") } });
```

### Hashed Sharding

Data is distributed based on a hash of the shard key value. Provides uniform
distribution but does not support efficient range queries on the shard key.

```javascript
// Hashed shard key: even distribution but no range queries on the key
sh.shardCollection("app.events", { eventId: "hashed" });

// This becomes a scatter-gather query (must hit all shards)
db.events.find({ eventId: { $gte: "EVT-1000", $lte: "EVT-2000" } });
```

## Chunks and the Balancer

Data is organized into chunks, each covering a range of shard key values.
The balancer automatically migrates chunks between shards to maintain even
distribution.

```javascript
// View chunk distribution across shards
sh.status();

// Check balancer state
sh.getBalancerState();

// Start or stop the balancer
sh.startBalancer();
sh.stopBalancer();

// Set a balancing window (only balance during off-peak hours)
db.getSiblingDB("config").settings.updateOne(
  { _id: "balancer" },
  {
    $set: {
      activeWindow: { start: "02:00", stop: "06:00" }
    }
  },
  { upsert: true }
);
```

### Chunk Splitting

MongoDB automatically splits chunks when they exceed the configured chunk size
(default: 128 MB). You can also split manually.

```javascript
// Check default chunk size
db.getSiblingDB("config").settings.findOne({ _id: "chunksize" });

// Change default chunk size (in MB)
db.getSiblingDB("config").settings.updateOne(
  { _id: "chunksize" },
  { $set: { value: 64 } },
  { upsert: true }
);

// Manually split a chunk at a specific point
sh.splitAt("analytics.events", { tenantId: "tenant-5000", timestamp: ISODate("2026-06-01") });

// Split a chunk in half
sh.splitFind("analytics.events", { tenantId: "tenant-2500", timestamp: ISODate("2026-03-15") });
```

### Jumbo Chunks

A jumbo chunk exceeds the maximum chunk size and cannot be split because all
documents share the same shard key value. Jumbo chunks cannot be migrated
by the balancer, leading to uneven distribution.

```javascript
// Find jumbo chunks
db.getSiblingDB("config").chunks.find({ jumbo: true }).forEach(chunk => {
  print(`${chunk.ns}: ${tojson(chunk.min)} -> ${tojson(chunk.max)} on ${chunk.shard}`);
});
```

Prevention: Choose a shard key with high cardinality to avoid jumbo chunks.

## Targeted vs Scatter-Gather Queries

| Query Type         | Behavior                              | Performance |
|--------------------|---------------------------------------|-------------|
| **Targeted**       | mongos routes to a single shard       | Fast        |
| **Scatter-gather** | mongos queries all shards, merges results | Slower  |

```javascript
// Targeted query: shard key (tenantId) is in the filter
db.orders.find({ tenantId: "tenant-42", status: "pending" });

// Scatter-gather: shard key is NOT in the filter
db.orders.find({ status: "pending" });

// Explain a query to see which shards are targeted
db.orders.find({ tenantId: "tenant-42" }).explain("executionStats");
// Look for the "shards" field to see which shards were queried
```

## Zone Sharding (Tag-Aware)

Zone sharding pins ranges of shard key values to specific shards. This is
useful for data locality requirements, such as keeping European user data
on shards hosted in EU regions.

```javascript
// Add zone tags to shards
sh.addShardTag("shard-us-east", "US");
sh.addShardTag("shard-eu-west", "EU");
sh.addShardTag("shard-ap-south", "APAC");

// Define zone ranges for the users collection
sh.addTagRange(
  "app.users",
  { region: "US", odId: MinKey },
  { region: "US", odId: MaxKey },
  "US"
);

sh.addTagRange(
  "app.users",
  { region: "EU", odId: MinKey },
  { region: "EU", odId: MaxKey },
  "EU"
);

sh.addTagRange(
  "app.users",
  { region: "APAC", odId: MinKey },
  { region: "APAC", odId: MaxKey },
  "APAC"
);

// Verify zone configuration
sh.status();
```

## Pre-Splitting Chunks

For bulk data loads, pre-split chunks to distribute writes across all shards
from the start, avoiding a hotspot on a single shard.

```javascript
// Pre-split a hashed shard key collection
sh.shardCollection("analytics.rawEvents", { _id: "hashed" });

// For ranged keys, split at known boundaries before loading data
sh.splitAt("analytics.events", { tenantId: "tenant-1000", timestamp: ISODate("2026-01-01") });
sh.splitAt("analytics.events", { tenantId: "tenant-2000", timestamp: ISODate("2026-01-01") });
sh.splitAt("analytics.events", { tenantId: "tenant-3000", timestamp: ISODate("2026-01-01") });

// Move chunks to specific shards for initial distribution
sh.moveChunk("analytics.events",
  { tenantId: "tenant-1000", timestamp: ISODate("2026-01-01") },
  "shard-us-east"
);
```

## Monitoring a Sharded Cluster

```javascript
// Comprehensive shard status
sh.status({ verbose: true });

// Check chunk distribution per collection
db.getSiblingDB("config").chunks.aggregate([
  { $match: { ns: "analytics.events" } },
  { $group: { _id: "$shard", chunkCount: { $sum: 1 } } },
  { $sort: { chunkCount: -1 } }
]);

// Monitor balancer activity
db.getSiblingDB("config").actionlog.find({ what: "balancer.round" })
  .sort({ time: -1 })
  .limit(5)
  .pretty();

// List all shards in the cluster
db.adminCommand({ listShards: 1 }).shards.forEach(shard => {
  print(`${shard._id}: ${shard.host}`);
});

// Check whether a collection is sharded
db.getSiblingDB("config").collections.findOne({ _id: "analytics.events" });
```

## Best Practices

1. **Choose the shard key carefully.** It determines query performance and data distribution.
2. **Prefer compound shard keys** for high cardinality and targeted queries.
3. **Use hashed sharding** when write distribution matters more than range queries.
4. **Avoid low-cardinality shard keys** that cause jumbo chunks.
5. **Include the shard key in queries** whenever possible to enable targeted operations.
6. **Set a balancing window** to avoid chunk migrations during peak traffic.
7. **Monitor chunk distribution** regularly and investigate imbalances.
8. **Use zone sharding** for data residency compliance and geographic locality.
9. **Pre-split chunks** for bulk data loads to avoid hotspotting a single shard.
10. **Test shard key choices** with representative workloads before deploying to production.
