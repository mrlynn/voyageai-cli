# Constraints

Constraints enforce data validity and integrity at the database level, ensuring only valid data is stored.

## Primary Key

Uniquely identifies each row in a table. Cannot be NULL.

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255)
);
```

Composite primary key:

```sql
CREATE TABLE order_items (
  order_id BIGINT,
  item_id BIGINT,
  quantity INTEGER,
  PRIMARY KEY (order_id, item_id)
);
```

## Unique Constraint

Ensures all values in a column (or combination) are unique.

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL
);
```

Composite unique:

```sql
CREATE TABLE subscriptions (
  user_id BIGINT,
  plan_id BIGINT,
  UNIQUE (user_id, plan_id)
);
```

Allow multiple NULLs (NULLs are not considered duplicates):

```sql
phone VARCHAR(20) UNIQUE
-- Multiple users can have NULL phone
```

## Not Null Constraint

A field must always have a value.

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20)  -- Can be NULL
);
```

## Default Values

Automatically assign values if not provided.

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);
```

## Check Constraint

Validates data based on a condition.

```sql
CREATE TABLE products (
  price DECIMAL(10,2) CHECK (price > 0),
  discount DECIMAL(5,2) CHECK (discount >= 0 AND discount <= 100),
  inventory INTEGER CHECK (inventory >= 0)
);

CREATE TABLE users (
  age INTEGER CHECK (age >= 0 AND age <= 150),
  status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'archived'))
);
```

Named constraints for better error messages:

```sql
CREATE TABLE products (
  price DECIMAL(10,2),
  CONSTRAINT positive_price CHECK (price > 0)
);
```

## Foreign Key Constraint

Maintains referential integrity between tables.

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  org_id BIGINT,
  CONSTRAINT fk_users_org FOREIGN KEY (org_id)
    REFERENCES organizations(org_id) ON DELETE CASCADE
);
```

See [Relationships](relationships.md) for detailed foreign key usage.

## Exclude Constraint

Prevents certain combinations of values (advanced).

```sql
CREATE TABLE room_bookings (
  room_id BIGINT,
  booking_range TSRANGE,
  EXCLUDE USING GIST (room_id WITH =, booking_range WITH &&)
);
```

This prevents overlapping bookings for the same room.

## Domain Constraints

Create custom data types with built-in constraints.

```sql
CREATE DOMAIN email AS VARCHAR(255)
  CHECK (VALUE ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email email NOT NULL UNIQUE
);
```

## Adding/Removing Constraints

Add constraint after table creation:

```sql
ALTER TABLE users ADD CONSTRAINT positive_age CHECK (age > 0);
```

Remove:

```sql
ALTER TABLE users DROP CONSTRAINT positive_age;
```

## Disabling Constraints (Careful!)

Temporarily disable for bulk operations:

```sql
-- Disable foreign key checks
SET session_replication_role = replica;
-- Perform bulk inserts without FK validation
SET session_replication_role = default;  -- Re-enable
```

Use sparingly; risks data inconsistency.

## Viewing Constraints

Query constraint information:

```sql
-- All constraints on a table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'users'

-- Check constraint details
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
```

## Best Practices

1. **Use NOT NULL** for required fields
2. **Use UNIQUE** for email, usernames, etc.
3. **Use CHECK** for valid value ranges
4. **Use FOREIGN KEY** for relationships
5. **Use DEFAULT** for common values
6. **Name constraints explicitly** for clear error messages
7. **Combine constraints** for comprehensive validation

Example comprehensive table:

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  age INTEGER CHECK (age >= 0),
  org_id BIGINT NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  CONSTRAINT valid_email CHECK (email LIKE '%@%.%')
);
```

## Performance Impact

Constraints add minimal overhead but catch bugs early:

- **PRIMARY KEY / UNIQUE**: Slight overhead (maintains index)
- **NOT NULL**: No overhead (checked at insert time)
- **CHECK**: Minimal overhead (simple validation)
- **FOREIGN KEY**: Moderate overhead (references check)

Always use constraints; performance cost is negligible compared to benefit of data integrity.
