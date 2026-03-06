# BSON Data Types

MongoDB stores data in BSON (Binary JSON), a binary-encoded serialization format that
extends JSON with additional data types. Understanding BSON types is essential for
schema design, validation, and querying.

## Core BSON Types

| Type             | Number | Alias       | Description                              |
|------------------|--------|-------------|------------------------------------------|
| Double           | 1      | `double`    | 64-bit floating point                    |
| String           | 2      | `string`    | UTF-8 encoded string                     |
| Object           | 3      | `object`    | Embedded document                        |
| Array            | 4      | `array`     | Ordered list of values                   |
| Binary Data      | 5      | `binData`   | Binary content (images, files, etc.)     |
| ObjectId         | 7      | `objectId`  | 12-byte unique identifier               |
| Boolean          | 8      | `bool`      | `true` or `false`                        |
| Date             | 9      | `date`      | 64-bit integer (ms since Unix epoch)     |
| Null             | 10     | `null`      | Null value                               |
| Regular Expr.    | 11     | `regex`     | Regular expression with options          |
| 32-bit Integer   | 16     | `int`       | 32-bit signed integer                    |
| Timestamp        | 17     | `timestamp` | Internal MongoDB replication timestamp   |
| 64-bit Integer   | 18     | `long`      | 64-bit signed integer                    |
| Decimal128       | 19     | `decimal`   | 128-bit high-precision decimal           |

## String

UTF-8 strings are the most common BSON type.

```javascript
db.products.insertOne({
  name: "MongoDB in Action",
  description: "A comprehensive guide to MongoDB",
  sku: "MDB-2024-001"
})

// Query with regex on string fields
db.products.find({ name: /mongodb/i })

// String comparison
db.products.find({ sku: { $gte: "MDB-2024", $lt: "MDB-2025" } })
```

## Numeric Types

MongoDB distinguishes between several numeric types. In mongosh, numbers
default to Double unless you use explicit constructors.

```javascript
db.metrics.insertOne({
  count: NumberInt(42),              // Int32 - 32-bit integer
  bigCount: NumberLong("900719925"), // Int64 - 64-bit integer
  score: 3.14,                       // Double - 64-bit float (default)
  price: NumberDecimal("29.99")      // Decimal128 - exact precision
})

// Use Decimal128 for financial data to avoid floating-point errors
db.accounts.insertOne({
  balance: NumberDecimal("10452.37"),
  interestRate: NumberDecimal("0.0425")
})
```

## Boolean

Standard true/false values.

```javascript
db.users.insertOne({
  email: "ada@example.com",
  isActive: true,
  emailVerified: false
})

db.users.find({ isActive: true, emailVerified: false })
```

## Date

Dates are stored as 64-bit integers representing milliseconds since the Unix epoch.

```javascript
db.events.insertOne({
  title: "MongoDB World",
  startDate: new Date("2025-06-10T09:00:00Z"),
  endDate: new Date("2025-06-12T17:00:00Z"),
  createdAt: new Date()    // current timestamp
})

// Date range queries
db.events.find({
  startDate: { $gte: new Date("2025-01-01"), $lt: new Date("2026-01-01") }
})

// Date aggregation
db.events.aggregate([
  { $project: { title: 1, year: { $year: "$startDate" }, month: { $month: "$startDate" } } }
])
```

## ObjectId

A 12-byte identifier automatically generated for the `_id` field. Contains a
timestamp, random value, and incrementing counter.

```javascript
// Auto-generated _id
db.logs.insertOne({ message: "App started" })
// { _id: ObjectId("65a1f2c3d4e5f6a7b8c9d0e1"), message: "App started" }

// Extract the creation timestamp from an ObjectId
const doc = db.logs.findOne()
doc._id.getTimestamp()
// ISODate("2025-01-13T10:30:27.000Z")

// Create a specific ObjectId
const customId = ObjectId("507f1f77bcf86cd799439011")
```

## UUID

Universally unique identifiers, stored as Binary subtype 4.

```javascript
db.sessions.insertOne({
  sessionId: UUID(),
  userId: ObjectId("65a1f2c3d4e5f6a7b8c9d0e1"),
  createdAt: new Date()
})

// Query by UUID
db.sessions.find({ sessionId: UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890") })
```

## Array

Arrays can hold values of any BSON type, including other arrays and documents.

```javascript
db.articles.insertOne({
  title: "Getting Started with MongoDB",
  tags: ["mongodb", "nosql", "tutorial"],
  scores: [95, 87, 92],
  authors: [
    { name: "Alice", role: "lead" },
    { name: "Bob", role: "contributor" }
  ]
})

// Query elements in an array
db.articles.find({ tags: "mongodb" })

// Query with array operators
db.articles.find({ tags: { $all: ["mongodb", "tutorial"] } })
db.articles.find({ scores: { $elemMatch: { $gte: 90 } } })
db.articles.find({ tags: { $size: 3 } })
```

## Embedded Document (Object)

Documents can be nested to any depth, enabling rich data models.

```javascript
db.employees.insertOne({
  name: "Grace Hopper",
  contact: {
    email: "grace@example.com",
    phone: "+1-555-0100",
    address: {
      street: "123 Navy Yard",
      city: "Arlington",
      state: "VA",
      zip: "22204"
    }
  }
})

// Query nested fields with dot notation
db.employees.find({ "contact.address.city": "Arlington" })

// Update nested fields
db.employees.updateOne(
  { name: "Grace Hopper" },
  { $set: { "contact.phone": "+1-555-0200" } }
)
```

## Binary Data

Store binary content such as small files, hashes, or encrypted data.

```javascript
db.files.insertOne({
  filename: "avatar.png",
  contentType: "image/png",
  data: BinData(0, "iVBORw0KGgoAAAANSUhEUg..."),  // base64-encoded
  checksum: BinData(5, "d4a1b2c3e5f67890...")        // MD5 subtype
})
```

## Null

Represents the absence of a value. Distinct from a field not existing.

```javascript
db.profiles.insertOne({ name: "Test User", bio: null })

// Find documents where bio is null
db.profiles.find({ bio: null })

// Find documents where bio field exists but is null (not just missing)
db.profiles.find({ bio: { $type: "null" } })

// Find documents where the field does not exist at all
db.profiles.find({ bio: { $exists: false } })
```

## Regular Expression

Store and query with regex patterns.

```javascript
// Store a regex
db.rules.insertOne({
  name: "Email Pattern",
  pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
})

// Query using regex
db.users.find({ email: { $regex: /@example\.com$/, $options: "i" } })
```

## Timestamp

An internal type used by MongoDB for replication. Application code should
use `Date` instead.

```javascript
// Timestamp is typically set by the server for oplog entries
// In application code, prefer Date:
db.audit.insertOne({
  action: "login",
  performedAt: new Date()
})
```

## Querying by Type with $type

Use the `$type` operator to find documents based on the BSON type of a field.

```javascript
// Find documents where "price" is a Decimal128
db.products.find({ price: { $type: "decimal" } })

// Find documents where "value" is any numeric type
db.metrics.find({ value: { $type: ["int", "long", "double", "decimal"] } })

// Find documents where "tags" is an array
db.articles.find({ tags: { $type: "array" } })

// You can also use the numeric type code
db.products.find({ price: { $type: 19 } })  // 19 = Decimal128
```

## Type Conversion in Aggregation

```javascript
db.raw_data.aggregate([
  { $project: {
    label: 1,
    numericValue: { $toDouble: "$stringValue" },
    dateValue: { $toDate: "$timestampMs" },
    stringId: { $toString: "$_id" }
  }}
])
```

## Tips

- Use `NumberDecimal()` for monetary values to avoid floating-point rounding.
- Use `ObjectId` for `_id` unless you have a natural unique key.
- Prefer `Date` over `Timestamp` in application documents.
- Arrays are automatically indexed as multikey indexes, enabling efficient queries
  on array elements.
- In MongoDB Atlas, the Data Explorer displays BSON types with visual indicators
  for easy identification.
