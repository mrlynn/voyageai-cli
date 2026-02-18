# Transactions

Transactions ensure data consistency by grouping multiple operations into atomic units: either all operations succeed or all roll back.

## ACID Properties

Transactions provide ACID guarantees:

- **Atomicity**: All operations in a transaction succeed or all fail
- **Consistency**: Database moves from one valid state to another
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed data survives crashes

## Transaction Basics

Begin and commit a transaction:

```sql
BEGIN;
UPDATE users SET balance = balance - 100 WHERE user_id = 1;
UPDATE users SET balance = balance + 100 WHERE user_id = 2;
COMMIT;
```

If an error occurs, rollback:

```sql
BEGIN;
UPDATE users SET balance = balance - 100 WHERE user_id = 1;
-- Error occurs during second update
UPDATE users SET balance = balance + 100 WHERE user_id = 999;  -- User doesn't exist
ROLLBACK;  -- Both updates are undone
```

## Savepoints

Create checkpoints within transactions:

```sql
BEGIN;
UPDATE users SET status = 'pending' WHERE user_id = 1;
SAVEPOINT sp1;
UPDATE orders SET status = 'cancelled' WHERE user_id = 1;
-- Something went wrong, rollback to savepoint
ROLLBACK TO sp1;
-- First update still applied, second rolled back
COMMIT;
```

## Isolation Levels

Different isolation levels provide different guarantees:

### READ UNCOMMITTED (Lowest)

Allows dirty reads (reading uncommitted changes). Rarely used in practice.

### READ COMMITTED (Default)

Only reads committed data. Prevents dirty reads.

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;
-- Only sees committed data
COMMIT;
```

### REPEATABLE READ

Ensures consistent reads within a transaction.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM users WHERE user_id = 1;  -- Read 1
-- Other transaction commits changes
SELECT balance FROM users WHERE user_id = 1;  -- Read 2 (same as Read 1)
COMMIT;
```

### SERIALIZABLE (Highest)

Full isolation. Transactions execute as if serially.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- Highest safety, but lowest performance
COMMIT;
```

## Conflict Resolution

Handle conflicts when concurrent transactions modify the same data:

```sql
BEGIN;
UPDATE users SET balance = balance - 50 WHERE user_id = 1;
-- Other transaction also updates user_id = 1
-- This transaction now conflicts
COMMIT;  -- May fail with serialization error
```

Retry on conflict:

```python
max_retries = 3
for attempt in range(max_retries):
    try:
        cursor.execute("BEGIN ISOLATION LEVEL SERIALIZABLE")
        # Perform operations
        cursor.execute("COMMIT")
        break
    except psycopg2.extensions.TransactionRollbackError:
        if attempt == max_retries - 1:
            raise
        time.sleep(0.1 * (2 ** attempt))  # Exponential backoff
```

## Deadlock Prevention

Deadlocks occur when two transactions wait on each other:

```sql
-- Transaction A
BEGIN; UPDATE users SET balance = balance - 100 WHERE user_id = 1;
-- Waiting for Transaction B to release user_id = 2

-- Transaction B
BEGIN; UPDATE users SET balance = balance - 100 WHERE user_id = 2;
-- Waiting for Transaction A to release user_id = 1
-- DEADLOCK!
```

Prevent deadlocks by:

1. Always lock resources in the same order
2. Keep transactions short
3. Use appropriate isolation levels
4. Avoid long-running transactions

## Deadlock Example and Handling

If deadlock occurs:

```sql
ERROR: deadlock detected
DETAIL: Process A waits for... while holding...
HINT: The involved index objects are determined by the constraint violations.
```

Handle in application:

```python
import psycopg2
from psycopg2 import OperationalError

try:
    connection.execute("BEGIN")
    # Perform operations
    connection.commit()
except OperationalError as e:
    if 'deadlock' in str(e):
        connection.rollback()
        # Retry transaction
    else:
        raise
```

## Explicit Locking

Lock resources explicitly to prevent conflicts:

```sql
BEGIN;
SELECT * FROM users WHERE user_id = 1 FOR UPDATE;  -- Exclusive lock
-- No other transaction can modify this row
UPDATE users SET balance = 100 WHERE user_id = 1;
COMMIT;
```

Lock types:

- **FOR UPDATE**: Exclusive lock (no other transaction can read or write)
- **FOR SHARE**: Shared lock (other transactions can read, not write)
- **FOR NO KEY UPDATE**: Write lock (other transactions can't write)

## Async Transactions

API transactions often span multiple HTTP requests:

```python
# Request 1: Start transaction
transaction_id = start_transaction()
response = transfer_funds(transaction_id, from_user, amount)

# Request 2: Commit transaction
result = commit_transaction(transaction_id)
```

This is complex—prefer keeping transactions within single requests.

## Transaction Timeouts

Long transactions block resources. Set timeouts:

```sql
SET statement_timeout = '30s';  -- Kill queries after 30 seconds
BEGIN;
-- Queries exceeding 30s will be terminated
COMMIT;
```

In application code:

```python
cursor.execute("SET statement_timeout = '30s'")
# Perform operations; exceeding timeout raises exception
```

## Best Practices

1. Keep transactions short
2. Lock resources in consistent order
3. Use appropriate isolation levels
4. Implement retry logic for serialization conflicts
5. Set statement timeouts
6. Avoid user interaction within transactions
7. Monitor long-running transactions

Transactions are critical for data consistency. See [Backup and Recovery](backup-recovery.md) for durability guarantees.
