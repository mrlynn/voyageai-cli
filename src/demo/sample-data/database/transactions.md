# MongoDB Transactions

## Overview

MongoDB provides multi-document ACID transactions for operations that require
atomicity across multiple documents or collections. Since MongoDB 4.0 (replica sets)
and 4.2 (sharded clusters), you can group multiple read and write operations into
a single atomic unit.

**Key principle:** MongoDB guarantees single-document atomicity by default. Because
documents can embed related data, many operations that would require transactions
in other systems are already atomic in MongoDB. Use multi-document transactions
only when you genuinely need cross-document or cross-collection atomicity.

## Single-Document Atomicity

MongoDB writes to a single document are always atomic, even when the operation
modifies multiple embedded documents or array elements within that document.

```javascript
// This is fully atomic without a transaction
db.orders.updateOne(
  { _id: ObjectId("6651a1f8b23c9a001e4d72ab") },
  {
    $set: { status: "shipped", "shipping.trackingNumber": "1Z999AA10123456784" },
    $push: {
      statusHistory: {
        status: "shipped",
        timestamp: new Date(),
        updatedBy: "system"
      }
    },
    $inc: { "metadata.updateCount": 1 }
  }
);
```

No transaction needed. The entire update to this single document is atomic.

## Multi-Document Transactions

When you need to update multiple documents atomically, use a session-based transaction.

### Basic Transaction Pattern

```javascript
const session = db.getMongo().startSession();
const accounts = session.getDatabase("bank").getCollection("accounts");

session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
  maxCommitTimeMS: 5000
});

try {
  // Debit source account
  accounts.updateOne(
    { accountId: "ACC-001", balance: { $gte: 500 } },
    { $inc: { balance: -500 }, $push: { ledger: { type: "debit", amount: 500, date: new Date() } } },
    { session }
  );

  // Credit destination account
  accounts.updateOne(
    { accountId: "ACC-002" },
    { $inc: { balance: 500 }, $push: { ledger: { type: "credit", amount: 500, date: new Date() } } },
    { session }
  );

  session.commitTransaction();
  print("Transfer committed successfully.");
} catch (error) {
  session.abortTransaction();
  print("Transfer aborted: " + error.message);
} finally {
  session.endSession();
}
```

### The withTransaction() Helper

The recommended approach uses `withTransaction()`, which handles transient errors
and retries automatically.

```javascript
const session = db.getMongo().startSession();

session.withTransaction(() => {
  const orders = session.getDatabase("shop").getCollection("orders");
  const inventory = session.getDatabase("shop").getCollection("inventory");

  // Reserve inventory
  const result = inventory.updateOne(
    { sku: "WIDGET-42", stock: { $gte: 3 } },
    { $inc: { stock: -3, reserved: 3 } },
    { session }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Insufficient stock for WIDGET-42");
  }

  // Create the order
  orders.insertOne({
    customerId: ObjectId("6651a2f0c88e1a001f5e83bc"),
    items: [{ sku: "WIDGET-42", quantity: 3, unitPrice: 29.99 }],
    total: 89.97,
    status: "confirmed",
    createdAt: new Date()
  }, { session });

}, {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
});

session.endSession();
```

The `withTransaction()` helper automatically retries on `TransientTransactionError`
and `UnknownTransactionCommitResult` errors.

## Read and Write Concerns

### Write Concern

Controls acknowledgment of write operations within a transaction.

| Write Concern   | Behavior                                         |
|-----------------|--------------------------------------------------|
| `w: 1`          | Acknowledged by primary only                     |
| `w: "majority"` | Acknowledged by majority of replica set members  |
| `w: 3`          | Acknowledged by exactly 3 members                |

### Read Concern

Controls the consistency and isolation of read operations.

| Read Concern   | Behavior                                                    |
|----------------|-------------------------------------------------------------|
| `"snapshot"`   | Reads from a consistent snapshot (recommended for txns)     |
| `"majority"`   | Reads data acknowledged by a majority of members            |
| `"local"`      | Reads the most recent data available on the primary          |

```javascript
session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", j: true }
});
```

## Causal Consistency

Causal consistency guarantees that operations within a causally consistent session
are observed in an order consistent with their causal relationships.

```javascript
const session = db.getMongo().startSession({ causalConsistency: true });
const users = session.getDatabase("app").getCollection("users");

// Write followed by a guaranteed-consistent read
users.updateOne(
  { _id: ObjectId("6651a3a0d44b2c001a6f94cd") },
  { $set: { role: "admin" } },
  { session }
);

// This read is guaranteed to see the update above
const user = users.findOne(
  { _id: ObjectId("6651a3a0d44b2c001a6f94cd") },
  { session }
);
print(user.role); // "admin"
session.endSession();
```

## Transaction Limits and Constraints

| Limit                        | Default Value          |
|------------------------------|------------------------|
| Max transaction runtime      | 60 seconds             |
| Max transaction size (oplog) | 16 MB                  |
| Max open transactions        | Dependent on resources |
| DDL operations in txns       | Not supported          |

Additional constraints:

- You cannot create or drop collections inside a transaction.
- You cannot create indexes inside a transaction.
- Transactions that run longer than `transactionLifetimeLimitSeconds` are aborted.
- Cursors created outside a transaction cannot be used inside, and vice versa.

```javascript
// Adjust the transaction lifetime limit (requires admin privileges)
db.adminCommand({
  setParameter: 1,
  transactionLifetimeLimitSeconds: 120
});
```

## When You Need Transactions (and When You Do Not)

### Transactions NOT needed

- Updating a single document (already atomic)
- Embedding related data within one document
- Using `$push`, `$pull`, `$set` on nested fields in one document
- Upserting a single document

### Transactions needed

- Transferring funds between two account documents
- Creating an order document and decrementing inventory in a separate collection
- Inserting audit log entries that must be consistent with the operation they track
- Any multi-collection or multi-document operation requiring all-or-nothing semantics

## Monitoring Transactions

```javascript
// Check current active transactions
db.currentOp({ "transaction": { $exists: true } });

// View transaction metrics in serverStatus
db.serverStatus().transactions;

// Key metrics to watch
const txnStats = db.serverStatus().transactions;
print("Total started:", txnStats.totalStarted);
print("Total committed:", txnStats.totalCommitted);
print("Total aborted:", txnStats.totalAborted);
```

## Best Practices

1. **Design documents to minimize transaction usage.** Embed related data when possible.
2. **Keep transactions short.** Long-running transactions hold resources and risk timeouts.
3. **Use `withTransaction()` for automatic retry logic.**
4. **Set appropriate write concern.** Use `w: "majority"` for durability guarantees.
5. **Always end sessions** with `session.endSession()` to free server resources.
6. **Monitor transaction metrics** in production via `db.serverStatus().transactions`.
7. **Test transaction behavior under load** to identify contention and lock issues.
