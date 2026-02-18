# Database Schema Overview

The SaaS platform uses PostgreSQL 13+ with a normalized schema designed for scalability, data integrity, and query performance. Understanding the schema is essential for effective API usage and troubleshooting.

## Core Entities

### Users

```
users (user_id, email, name, created_at, updated_at, status)
  ├── Primary Key: user_id
  ├── Unique: email
  ├── Indexes: email, created_at, status
  └── Relations: organizations (via org_members), sessions
```

### Organizations

```
organizations (org_id, name, created_at, updated_at, plan_tier)
  ├── Primary Key: org_id
  ├── Indexes: created_at
  └── Relations: users (via org_members), billing_accounts
```

### Sessions

```
sessions (session_id, user_id, org_id, token, created_at, expires_at)
  ├── Primary Key: session_id
  ├── Foreign Keys: user_id, org_id
  ├── Indexes: user_id, expires_at
  └── Relations: users, organizations
```

### Resources

```
resources (resource_id, org_id, name, type, created_at, updated_at)
  ├── Primary Key: resource_id
  ├── Foreign Key: org_id
  ├── Indexes: org_id, type, created_at
  └── Relations: organizations, resource_metadata
```

## Data Types

- **BIGSERIAL**: Auto-incrementing 64-bit integer (primary keys)
- **UUID**: Universally unique identifiers for distributed systems
- **VARCHAR(255)**: Variable-length text (emails, names)
- **TEXT**: Unlimited text (descriptions, content)
- **TIMESTAMP WITH TIME ZONE**: Timezone-aware timestamps (UTC)
- **JSONB**: JSON data with indexing and querying
- **ENUM**: Fixed set of values (status, plan_tier)
- **BIGINT**: Large integers (quotas, counts)

## Relationships

Relationships are enforced via foreign keys with cascading rules:

```
organizations
  ├── (1) ──── (N) users  [via org_members]
  ├── (1) ──── (N) sessions
  └── (1) ──── (N) resources

resources
  ├── (N) ──── (1) organizations
  └── (1) ──── (N) resource_metadata
```

ON DELETE CASCADE is used selectively (e.g., deleting org deletes its resources).
ON DELETE RESTRICT is used for critical data (e.g., cannot delete user with active sessions).

## Schema Normalization

The schema is normalized to 3rd Normal Form (3NF) to reduce redundancy and improve data integrity:

**Example: User and Organization Relationship**

```
users
  user_id (PK)
  email
  name

org_members  [junction table]
  org_id (FK)
  user_id (FK)
  role

organizations
  org_id (PK)
  name
```

Users can belong to multiple organizations with different roles.

## Temporal Data

All tables include:

```
created_at TIMESTAMP WITH TIME ZONE  -- Immutable creation time
updated_at TIMESTAMP WITH TIME ZONE  -- Updated on every modification
```

These columns are automatically managed and timezone-aware.

For historical tracking, some tables include:

```
deleted_at TIMESTAMP WITH TIME ZONE  -- Soft deletes (NULL if not deleted)
```

Soft deletes allow recovery and audit trails without physical data loss.

## Partitioning Strategy

Large tables (events, audit_logs) are partitioned by date range:

```
events_2026_01  (events from 2026-01)
events_2026_02  (events from 2026-02)
...
```

Partitioning improves query performance for time-based filters and enables efficient archival.

## JSON/JSONB Columns

Some tables use JSONB for flexible data:

```
resource_metadata (resource_id, data)
  data: JSONB containing user-defined attributes
  Indexed: GIN index for efficient querying
```

Query JSONB efficiently:

```sql
SELECT * FROM resources 
WHERE metadata @> '{"tier": "premium"}'
```

## Access Control

Row-level security (RLS) is enforced at the database level. Users can only query their organization's data:

```
users see rows WHERE org_id = current_user_org_id
```

This is enforced in the database layer, not just the application layer.

## Archival and Retention

Old data is archived automatically:
- Audit logs older than 1 year are moved to cold storage
- Event data older than 2 years is purged
- User data is retained indefinitely (unless deleted)

See [Backup and Recovery](backup-recovery.md) for data retention policies.

## Viewing the Schema

Query the schema information:

```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public'

-- Get table columns
\d users  -- In psql

-- Foreign key constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'resources'
```

## Performance Considerations

The schema is optimized for:
- **Query performance**: Proper indexes on frequently filtered columns
- **Write performance**: Denormalization where needed for bulk inserts
- **Disk usage**: Efficient storage with compression

See [Indexes](indexes.md) and [Performance Tuning](../deployment/performance-tuning.md) for optimization details.
