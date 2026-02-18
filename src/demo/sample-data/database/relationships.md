# Relationships and Foreign Keys

Relationships define how data in different tables relates to each other. Foreign keys enforce referential integrity, ensuring data consistency.

## One-to-Many Relationships

The most common relationship type. One parent record relates to many child records.

**Example: Organization to Users**

```
organizations (1) ─── (N) users
org_id (PK)              user_id (PK)
name                     user_id
                         email
                         org_id (FK) ──→ organizations.org_id
```

A single organization has many users. Each user belongs to one organization.

```sql
CREATE TABLE organizations (
  org_id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  org_id BIGINT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id)
);
```

Query relationships:

```sql
-- Users in an organization
SELECT * FROM users WHERE org_id = 'org_123'

-- Organization and its users
SELECT o.name, u.email FROM organizations o
JOIN users u ON o.org_id = u.org_id
WHERE o.org_id = 'org_123'
```

## Many-to-Many Relationships

Multiple records in one table relate to multiple records in another.

**Example: Users and Roles**

```
users (N) ─── (N) roles
user_id             role_id
email               name
                    
         user_roles [junction table]
         user_id (FK)
         role_id (FK)
```

A user can have multiple roles. Each role can be assigned to multiple users.

```sql
CREATE TABLE roles (
  role_id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);
```

Query many-to-many:

```sql
-- Roles for a user
SELECT r.name FROM roles r
JOIN user_roles ur ON r.role_id = ur.role_id
WHERE ur.user_id = 'user_123'

-- Users with a specific role
SELECT u.email FROM users u
JOIN user_roles ur ON u.user_id = ur.user_id
WHERE ur.role_id = 'role_admin'
```

## Foreign Key Constraints

Foreign keys enforce referential integrity:

```sql
FOREIGN KEY (org_id) REFERENCES organizations(org_id)
```

Prevents:
- Creating a user with non-existent org_id
- Deleting an organization with users (unless ON DELETE CASCADE)

### Cascade Options

**NO ACTION** (Default): Prevent deletion if child records exist.

```sql
CREATE TABLE users (
  org_id BIGINT,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id)
  ON DELETE NO ACTION
);
-- Cannot delete org with users
```

**CASCADE**: Delete child records when parent is deleted.

```sql
CREATE TABLE users (
  org_id BIGINT,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id)
  ON DELETE CASCADE
);
-- Deleting org deletes all its users
```

**SET NULL**: Set foreign key to NULL when parent is deleted.

```sql
CREATE TABLE comments (
  deleted_by_user BIGINT,
  FOREIGN KEY (deleted_by_user) REFERENCES users(user_id)
  ON DELETE SET NULL
);
-- When user deleted, set deleted_by_user to NULL
```

**RESTRICT**: Same as NO ACTION but checked immediately.

## Self-Referencing Relationships

A table referencing itself.

**Example: Manager-Employee Hierarchy**

```sql
CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255),
  manager_id BIGINT,
  FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL
);
```

Query hierarchies:

```sql
-- Employee's manager
SELECT m.name AS manager FROM users e
JOIN users m ON e.manager_id = m.user_id
WHERE e.user_id = 'user_123'

-- Employee's direct reports
SELECT name FROM users WHERE manager_id = 'user_123'
```

## Polymorphic Relationships

One table relates to multiple types (advanced).

**Example: Comments on Posts and Users**

```sql
CREATE TABLE comments (
  comment_id BIGSERIAL PRIMARY KEY,
  text TEXT,
  target_type VARCHAR(50),  -- 'post' or 'user'
  target_id BIGINT         -- References post_id or user_id
);
```

This lacks enforced referential integrity. Better approach:

```sql
-- Separate tables for each relationship
CREATE TABLE post_comments (
  comment_id BIGSERIAL PRIMARY KEY,
  post_id BIGINT REFERENCES posts(post_id) ON DELETE CASCADE,
  text TEXT
);

CREATE TABLE user_comments (
  comment_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
  text TEXT
);
```

## Join Queries

Retrieve related data using joins.

```sql
-- INNER JOIN: Only matching records
SELECT u.email, o.name FROM users u
INNER JOIN organizations o ON u.org_id = o.org_id

-- LEFT JOIN: All users, matching org (if exists)
SELECT u.email, o.name FROM users u
LEFT JOIN organizations o ON u.org_id = o.org_id

-- Find users without organization (org_id IS NULL)
SELECT * FROM users WHERE org_id IS NULL
```

## Viewing Relationships

Query foreign key relationships:

```sql
SELECT 
  constraint_name, 
  table_name, 
  column_name,
  foreign_table_name, 
  foreign_column_name
FROM information_schema.key_column_usage
WHERE table_name = 'users'
```

## Performance Considerations

- **Index foreign keys**: Foreign keys should be indexed for join performance
- **Eager loading**: Avoid N+1 queries (load related data upfront)
- **Denormalization**: Sometimes duplicate data for performance

Example N+1 problem:

```sql
-- Bad: N queries
SELECT * FROM users
-- For each user: SELECT * FROM organizations WHERE org_id = X

-- Good: 1 query
SELECT u.*, o.* FROM users u
LEFT JOIN organizations o ON u.org_id = o.org_id
```

See [Indexes](indexes.md) for optimizing join performance.
