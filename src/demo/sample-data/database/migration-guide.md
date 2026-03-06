# MongoDB Migration Guide

## Overview

This guide covers migration strategies for MongoDB deployments, including
schema versioning patterns, data backfilling, collection validation updates,
and major version upgrades (MongoDB 6.0 to 7.0). It follows a v1 to v2 API
migration as a practical example.

## Schema Versioning Strategy

MongoDB's flexible document model does not enforce a rigid schema, but production
applications benefit from explicit schema versioning. The recommended pattern
uses a `schemaVersion` field in every document.

```javascript
// v1 document structure
{
  _id: ObjectId("6651b2a0c88e1a001f5e83bc"),
  schemaVersion: 1,
  name: "Acme Corp",
  contactEmail: "admin@acme.com",
  address: "123 Main St, Springfield, IL 62701",
  createdAt: ISODate("2025-01-15T10:30:00Z")
}

// v2 document structure (address split into structured embedded document)
{
  _id: ObjectId("6651b2a0c88e1a001f5e83bc"),
  schemaVersion: 2,
  name: "Acme Corp",
  contactEmail: "admin@acme.com",
  address: {
    street: "123 Main St",
    city: "Springfield",
    state: "IL",
    postalCode: "62701",
    country: "US"
  },
  tags: [],
  createdAt: ISODate("2025-01-15T10:30:00Z"),
  migratedAt: ISODate("2026-03-01T08:00:00Z")
}
```

## Version Compatibility

| Component       | v1              | v2              | Compatible |
|-----------------|-----------------|-----------------|------------|
| API endpoint    | /v1/            | /v2/            | No         |
| SDK version     | 1.x             | 2.x             | No         |
| MongoDB version | MongoDB 6.0     | MongoDB 7.0+    | Mostly     |
| Node.js SDK     | 1.x             | 2.x             | No         |

## Pre-Migration Checklist

Before starting migration:

- Review breaking changes documentation
- Test in a staging environment first
- Take a full mongodump backup of the production database
- Schedule migration during low-traffic period
- Prepare rollback plan
- Update documentation and runbooks

## Migration Phases

### Phase 1: Preparation

Audit current documents and identify the scope of changes.

```javascript
// Count documents by schema version
db.organizations.aggregate([
  { $group: { _id: "$schemaVersion", count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// Find documents missing schemaVersion (pre-versioning data)
db.organizations.countDocuments({ schemaVersion: { $exists: false } });

// Sample documents to understand current structure
db.organizations.find({ schemaVersion: 1 }).limit(5).pretty();
```

### Phase 2: Backfill Missing Fields

Use `updateMany()` to add default values for new fields and set the schema
version on legacy documents.

```javascript
// Step 1: Tag legacy documents with schemaVersion 1
db.organizations.updateMany(
  { schemaVersion: { $exists: false } },
  { $set: { schemaVersion: 1 } }
);

// Step 2: Add the new 'tags' field to all v1 documents
db.organizations.updateMany(
  { schemaVersion: 1, tags: { $exists: false } },
  { $set: { tags: [] } }
);

// Step 3: Parse and restructure the address field using an aggregation pipeline
db.organizations.updateMany(
  { schemaVersion: 1, address: { $type: "string" } },
  [
    {
      $set: {
        "_oldAddress": "$address",
        "address": {
          street: { $trim: { input: { $arrayElemAt: [{ $split: ["$address", ","] }, 0] } } },
          city: { $trim: { input: { $arrayElemAt: [{ $split: ["$address", ","] }, 1] } } },
          state: { $trim: { input: {
            $arrayElemAt: [
              { $split: [{ $trim: { input: { $arrayElemAt: [{ $split: ["$address", ","] }, 2] } } }, " "] },
              0
            ]
          } } },
          postalCode: { $trim: { input: {
            $arrayElemAt: [
              { $split: [{ $trim: { input: { $arrayElemAt: [{ $split: ["$address", ","] }, 2] } } }, " "] },
              1
            ]
          } } },
          country: "US"
        },
        schemaVersion: 2,
        migratedAt: new Date()
      }
    }
  ]
);
```

### Phase 3: Batch Migration for Large Collections

For collections with millions of documents, process migrations in batches
to avoid excessive memory use and oplog pressure.

```javascript
const batchSize = 1000;
let processed = 0;
let hasMore = true;

while (hasMore) {
  const batch = db.organizations.find(
    { schemaVersion: 1 },
    { _id: 1 }
  ).limit(batchSize).toArray();

  if (batch.length === 0) {
    hasMore = false;
    break;
  }

  const ids = batch.map(doc => doc._id);

  db.organizations.updateMany(
    { _id: { $in: ids } },
    [
      {
        $set: {
          tags: { $ifNull: ["$tags", []] },
          schemaVersion: 2,
          migratedAt: new Date()
        }
      }
    ]
  );

  processed += batch.length;
  print(`Migrated ${processed} documents...`);

  sleep(100); // Small delay to reduce oplog pressure
}

print(`Migration complete. Total processed: ${processed}`);
```

### Phase 4: Update Collection Validation

After migrating all documents, update the collection's JSON Schema validation
to enforce the new structure using `collMod`.

```javascript
db.runCommand({
  collMod: "organizations",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["schemaVersion", "name", "contactEmail", "address"],
      properties: {
        schemaVersion: { bsonType: "int", minimum: 2 },
        name: { bsonType: "string", minLength: 1 },
        contactEmail: { bsonType: "string", pattern: "^.+@.+\\..+$" },
        address: {
          bsonType: "object",
          required: ["street", "city", "state", "postalCode", "country"],
          properties: {
            street: { bsonType: "string" },
            city: { bsonType: "string" },
            state: { bsonType: "string" },
            postalCode: { bsonType: "string" },
            country: { bsonType: "string" }
          }
        },
        tags: { bsonType: "array", items: { bsonType: "string" } }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});
```

## MongoDB 6.0 to 7.0 Upgrade Path

### Pre-Upgrade Checklist

```javascript
// Check current version
db.version();

// Ensure feature compatibility version is set correctly
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 });

// Verify all replica set members are healthy
rs.status().members.forEach(m => {
  print(`${m.name}: ${m.stateStr}`);
});
```

### Upgrade Steps

1. **Upgrade secondaries first**, one at a time, waiting for each to recover.
2. **Step down the primary** using `rs.stepDown()`.
3. **Upgrade the former primary** (now a secondary).
4. **Set the feature compatibility version** after all members are upgraded.

```javascript
// After all members are on MongoDB 7.0
db.adminCommand({ setFeatureCompatibilityVersion: "7.0" });

// Verify the upgrade
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 });
```

### MongoDB 7.0 Features to Adopt

After upgrading, take advantage of new capabilities:

```javascript
// Compound wildcard indexes
db.organizations.createIndex({ "address.$**": 1 });

// $percentile and $median aggregation operators
db.orders.aggregate([
  {
    $group: {
      _id: null,
      medianTotal: { $median: { input: "$total", method: "approximate" } },
      p95Total: { $percentile: { input: "$total", p: [0.95], method: "approximate" } }
    }
  }
]);
```

## Rollback Strategy

Always prepare a rollback plan before migrating.

```javascript
// Before migration, store a rollback record
db.migrationLog.insertOne({
  migration: "v1-to-v2-organizations",
  startedAt: new Date(),
  backupPath: "/backups/pre-migration/20260301",
  rollbackScript: "rollback-v2-to-v1.js",
  status: "in-progress"
});

// Rollback: revert v2 documents to v1 using the stored old address
db.organizations.updateMany(
  { schemaVersion: 2, _oldAddress: { $exists: true } },
  [
    {
      $set: {
        address: "$_oldAddress",
        schemaVersion: 1
      }
    },
    { $unset: ["_oldAddress", "migratedAt", "tags"] }
  ]
);
```

## Best Practices

1. **Always include a `schemaVersion` field** in your documents from day one.
2. **Migrate in batches** to control resource consumption and enable progress tracking.
3. **Test migrations on a staging replica** before running in production.
4. **Take a full mongodump backup** immediately before any migration.
5. **Use aggregation pipelines in updates** for complex field transformations.
6. **Keep rollback scripts** alongside migration scripts.
7. **Monitor oplog lag** during large batch migrations with `rs.printSecondaryReplicationInfo()`.
