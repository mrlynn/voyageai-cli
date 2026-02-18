# Data Types

Understanding PostgreSQL data types used in the schema ensures proper data handling and storage efficiency.

## Numeric Types

**SMALLINT**: 2-byte integer (-32,768 to 32,767). Use for small counts, priorities.

**INTEGER**: 4-byte integer (-2.1B to 2.1B). Standard for IDs, counts.

**BIGINT**: 8-byte integer for very large numbers. Used for user IDs and timestamps.

```sql
user_id BIGINT PRIMARY KEY  -- Supports 9.2 quintillion values
count INTEGER DEFAULT 0
priority SMALLINT
```

**DECIMAL(precision, scale)**: Fixed-point decimal for financial data.

```sql
price DECIMAL(10,2)  -- Allows 12345678.90
```

**FLOAT / DOUBLE PRECISION**: Floating-point for approximate values.

```sql
latitude DOUBLE PRECISION
score FLOAT
```

## Text Types

**CHAR(n)**: Fixed-length text. Use sparingly (pads with spaces).

```sql
country_code CHAR(2)  -- Exactly 2 characters
```

**VARCHAR(n)**: Variable-length text with maximum length.

```sql
email VARCHAR(255)
name VARCHAR(100)
```

**TEXT**: Unlimited length text. Preferred for flexibility.

```sql
description TEXT
content TEXT
```

## Date/Time Types

**DATE**: Year, month, day only (no time).

```sql
birth_date DATE
```

**TIME**: Time of day only (no date).

```sql
start_time TIME
```

**TIMESTAMP**: Date and time without timezone (discouraged).

```sql
-- Avoid; timezone info lost
created_at TIMESTAMP
```

**TIMESTAMP WITH TIME ZONE**: Date and time with timezone. Always use this.

```sql
-- Recommended; always in UTC
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE
```

Internally stored in UTC; displayed in client's timezone.

## Boolean Type

**BOOLEAN**: True or false values.

```sql
is_active BOOLEAN DEFAULT TRUE
verified BOOLEAN
```

## UUID Type

**UUID**: Universally unique identifier (128-bit).

```sql
request_id UUID DEFAULT gen_random_uuid()
```

Advantages:
- No central sequence needed (good for distributed systems)
- Cannot guess next ID
- Sortable (with version 4)

```sql
-- Generate UUID
SELECT gen_random_uuid();
-- Example: 550e8400-e29b-41d4-a716-446655440000
```

## JSON Types

**JSON**: Stores JSON without processing. Must re-parse on each query.

```sql
metadata JSON
```

**JSONB**: Stores JSON in binary format. Faster queries, indexable.

```sql
attributes JSONB
```

Query JSONB efficiently:

```sql
-- Membership operator
SELECT * FROM users WHERE attributes @> '{"tier": "premium"}'

-- Get value
SELECT attributes->>'name' AS name FROM users

-- Check key exists
SELECT * FROM users WHERE attributes ? 'phone'
```

## Array Types

PostgreSQL supports arrays:

```sql
tags TEXT[]
ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
```

Query arrays:

```sql
-- Array contains
SELECT * FROM resources WHERE tags @> ARRAY['important']

-- Array length
SELECT * FROM resources WHERE array_length(tags, 1) > 5
```

## Enum Type

**ENUM**: Fixed set of allowed values.

```sql
CREATE TYPE status_enum AS ENUM ('active', 'inactive', 'archived');

users (
  status status_enum DEFAULT 'active'
)
```

Advantages:
- Type safety (invalid values rejected)
- Efficient storage
- Self-documenting

## Composite Types

**COMPOSITE**: User-defined structured types.

```sql
CREATE TYPE address AS (
  street VARCHAR(255),
  city VARCHAR(100),
  zip VARCHAR(10),
  country VARCHAR(100)
);

users (
  address address
)
```

## Type Conversions

PostgreSQL performs implicit conversions:

```sql
SELECT COUNT(*) FROM users WHERE user_id = '123'  -- String '123' converted to BIGINT
```

Explicit conversion:

```sql
SELECT user_id::VARCHAR AS id FROM users  -- Cast BIGINT to VARCHAR
SELECT price::INTEGER FROM products       -- Cast DECIMAL to INTEGER
```

## NULL Handling

**NULL** represents missing data (different from empty string or 0):

```sql
name VARCHAR(100)  -- Can be NULL
name VARCHAR(100) NOT NULL  -- Must have value
name VARCHAR(100) DEFAULT 'Unknown'  -- Default if not provided
```

Queries with NULL:

```sql
SELECT * FROM users WHERE phone IS NULL
SELECT * FROM users WHERE phone IS NOT NULL
```

## Storage Size

Data type storage impacts database size and query performance:

| Type | Storage |
|------|---------|
| BOOLEAN | 1 byte |
| SMALLINT | 2 bytes |
| INTEGER | 4 bytes |
| BIGINT | 8 bytes |
| DATE | 4 bytes |
| TIMESTAMP | 8 bytes |
| UUID | 16 bytes |
| VARCHAR(n) | 1 to n bytes |
| TEXT | Variable |
| JSONB | Variable |

Choose appropriate types to minimize storage.

## Validation with Constraints

Use constraints to ensure data validity:

```sql
price DECIMAL(10,2) CHECK (price > 0)
email VARCHAR(255) UNIQUE NOT NULL
status VARCHAR(20) CHECK (status IN ('active', 'inactive'))
```

## Best Practices

1. Always use TIMESTAMP WITH TIME ZONE for temporal data
2. Use VARCHAR with reasonable length limits
3. Use ENUM for fixed sets of values
4. Use BIGINT for IDs in distributed systems
5. Use DECIMAL for financial data (not FLOAT)
6. Use JSONB for flexible data (not JSON)
7. Use UUID for non-sequential IDs
8. Add NOT NULL and DEFAULT constraints where appropriate

See [Constraints](constraints.md) for validation details.
