# Indexes

Indexes in MongoDB improve query performance by allowing the database to locate
documents without scanning every document in a collection. Proper indexing is
critical for production workloads.

## Single Field Index

The most basic index type, created on a single field.

```javascript
// Ascending index on email
db.users.createIndex({ email: 1 })

// Descending index on createdAt
db.users.createIndex({ createdAt: -1 })

// Verify the index was created
db.users.getIndexes()
```

## Unique Index

Enforce uniqueness on a field. Rejects duplicate values.

```javascript
db.users.createIndex({ email: 1 }, { unique: true })

// Unique compound index
db.inventory.createIndex({ warehouse: 1, sku: 1 }, { unique: true })

// Attempting a duplicate insert will throw an error
db.users.insertOne({ email: "ada@example.com" })
db.users.insertOne({ email: "ada@example.com" })
// MongoServerError: E11000 duplicate key error
```

## Compound Index

An index on multiple fields. Field order matters for query optimization.

```javascript
db.orders.createIndex({ customerId: 1, orderDate: -1 })

// This index supports queries on:
// - { customerId: ... }                       (prefix)
// - { customerId: ..., orderDate: ... }        (full match)
// - { customerId: ... } sorted by orderDate    (sort)

// It does NOT efficiently support:
// - { orderDate: ... } alone (not a prefix)
```

## Multikey Index (Array Fields)

MongoDB automatically creates a multikey index when you index a field that
contains an array. Each array element gets an index entry.

```javascript
db.articles.createIndex({ tags: 1 })

// Efficiently query any element in the array
db.articles.find({ tags: "mongodb" })
db.articles.find({ tags: { $in: ["mongodb", "nosql"] } })
```

## Text Index

Full-text search index for string content. One text index per collection.

```javascript
db.articles.createIndex({
  title: "text",
  body: "text",
  tags: "text"
}, {
  weights: { title: 10, body: 5, tags: 2 },
  name: "article_text_search"
})

// Search using the text index
db.articles.find({ $text: { $search: "mongodb aggregation" } })

// Sort by relevance score
db.articles.find(
  { $text: { $search: "mongodb aggregation" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
```

## Geospatial Index (2dsphere)

Index for querying location data stored as GeoJSON.

```javascript
db.places.createIndex({ location: "2dsphere" })

db.places.insertOne({
  name: "MongoDB HQ",
  location: {
    type: "Point",
    coordinates: [-73.9857, 40.7484]  // [longitude, latitude]
  }
})

// Find places within 5 km of a point
db.places.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
      $maxDistance: 5000  // meters
    }
  }
})
```

## Hashed Index

Supports hash-based sharding. Provides even distribution for shard keys.

```javascript
db.sessions.createIndex({ userId: "hashed" })

// Used for hash-based sharding
sh.shardCollection("mydb.sessions", { userId: "hashed" })
```

## Wildcard Index

Indexes all fields or fields matching a pattern. Useful for documents with
unpredictable or dynamic field names.

```javascript
// Index all fields in the document
db.logs.createIndex({ "$**": 1 })

// Index all fields under a specific path
db.products.createIndex({ "attributes.$**": 1 })

// Query any attribute without knowing field names in advance
db.products.find({ "attributes.color": "red" })
db.products.find({ "attributes.weight": { $gte: 10 } })
```

## TTL Index (Time-To-Live)

Automatically deletes documents after a specified time period. The field
must contain a Date value.

```javascript
// Documents expire 24 hours after createdAt
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 })

// Documents expire 7 days after lastAccessed
db.cache.createIndex({ lastAccessed: 1 }, { expireAfterSeconds: 604800 })

// Modify TTL on an existing index
db.runCommand({
  collMod: "sessions",
  index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: 3600 }
})
```

## Partial Index

Indexes only documents matching a filter expression. Reduces index size and
improves write performance.

```javascript
// Only index active users
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { isActive: true } }
)

// Only index orders above $100
db.orders.createIndex(
  { customerId: 1, orderDate: -1 },
  { partialFilterExpression: { total: { $gte: 100 } } }
)
```

## Sparse Index

Only includes documents that contain the indexed field. Documents missing
the field are excluded from the index.

```javascript
db.contacts.createIndex({ phone: 1 }, { sparse: true })

// Only documents that have a "phone" field are in the index
// Useful when the field is optional and you want unique + sparse
db.contacts.createIndex({ phone: 1 }, { unique: true, sparse: true })
```

## Atlas Search Index

MongoDB Atlas provides Lucene-based full-text search via Atlas Search indexes.

```javascript
// Create an Atlas Search index (via Atlas UI, CLI, or API)
// Index definition:
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "title": { "type": "string", "analyzer": "lucene.standard" },
      "description": { "type": "string", "analyzer": "lucene.english" },
      "category": { "type": "stringFacet" }
    }
  }
}

// Query using $search in an aggregation pipeline
db.products.aggregate([
  { $search: {
    index: "product_search",
    compound: {
      must: [{ text: { query: "wireless headphones", path: "title" } }],
      filter: [{ text: { query: "electronics", path: "category" } }]
    }
  }},
  { $limit: 10 },
  { $project: { title: 1, price: 1, score: { $meta: "searchScore" } } }
])
```

## Vector Search Index

Atlas Vector Search enables semantic search using vector embeddings.

```javascript
// Vector search index definition (via Atlas UI or API)
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 1024,
    "similarity": "cosine"
  }]
}

// Query using $vectorSearch
db.documents.aggregate([
  { $vectorSearch: {
    index: "vector_index",
    path: "embedding",
    queryVector: [0.12, -0.34, 0.56, /* ... 1024 dimensions */],
    numCandidates: 100,
    limit: 10
  }},
  { $project: { title: 1, content: 1, score: { $meta: "vectorSearchScore" } } }
])
```

## Query Analysis with explain()

Use `explain()` to understand how MongoDB executes a query and whether indexes
are being used.

```javascript
// Check if a query uses an index
db.users.find({ email: "ada@example.com" }).explain("executionStats")

// Key fields to check in the output:
// - winningPlan.stage: "IXSCAN" means an index is used
// - winningPlan.stage: "COLLSCAN" means a full collection scan (no index)
// - executionStats.totalDocsExamined: documents scanned
// - executionStats.nReturned: documents returned

// Compare index candidates
db.orders.find({ customerId: "abc", status: "shipped" })
  .sort({ orderDate: -1 })
  .explain("allPlansExecution")
```

## Managing Indexes

```javascript
// List all indexes on a collection
db.users.getIndexes()

// Drop a specific index by name
db.users.dropIndex("email_1")

// Drop all non-_id indexes
db.users.dropIndexes()

// Hide an index (stops the query planner from using it, without dropping)
db.users.hideIndex("email_1")
db.users.unhideIndex("email_1")
```

## Tips

- Follow the ESR rule for compound indexes: **E**quality, **S**ort, **R**ange.
- Use `explain()` regularly to verify your queries hit the expected indexes.
- Avoid over-indexing -- each index adds overhead to write operations.
- Partial and sparse indexes save space when fields are optional.
- In MongoDB Atlas, the Performance Advisor recommends indexes based on slow queries.
