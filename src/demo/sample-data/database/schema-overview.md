# Document Schema Design

MongoDB uses a document model where data is stored as flexible BSON documents
in collections. Unlike relational databases, MongoDB does not require a fixed
schema -- documents in the same collection can have different fields and structures.
Effective schema design in MongoDB means modeling data around your application's
access patterns.

## The Document Model

A MongoDB document is a set of field-value pairs, analogous to a JSON object.
Documents are grouped into collections.

```javascript
// A single document in a "users" collection
db.users.insertOne({
  _id: ObjectId("65a1f2c3d4e5f6a7b8c9d0e1"),
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "engineer",
  skills: ["algorithms", "mathematics", "programming"],
  address: {
    street: "12 Babbage Lane",
    city: "London",
    country: "UK"
  },
  createdAt: new Date("2025-01-15T10:00:00Z")
})
```

Key characteristics:
- Documents can contain nested objects (embedded documents) and arrays
- Each document has a unique `_id` field (auto-generated ObjectId if not provided)
- Fields can vary between documents in the same collection
- Maximum document size is 16 MB

## Embedded Documents vs References

The fundamental schema design decision in MongoDB is whether to **embed** related
data within a single document or **reference** it from a separate collection.

### Embedding (Denormalized)

Store related data together in one document. Best when data is read together.

```javascript
// Order with embedded line items -- read in a single query
db.orders.insertOne({
  orderNumber: "ORD-2025-4521",
  customer: {
    name: "Grace Hopper",
    email: "grace@example.com"
  },
  items: [
    { product: "MongoDB Handbook", quantity: 1, price: NumberDecimal("49.99") },
    { product: "USB Drive 128GB", quantity: 2, price: NumberDecimal("12.50") }
  ],
  total: NumberDecimal("74.99"),
  status: "shipped",
  orderDate: new Date("2025-02-20")
})

// One query returns the full order
db.orders.findOne({ orderNumber: "ORD-2025-4521" })
```

### Referencing (Normalized)

Store related data in separate collections and link with ObjectId references.
Best when data is large, frequently updated independently, or shared across
many documents.

```javascript
// Separate collections linked by reference
db.authors.insertOne({
  _id: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3"),
  name: "Alan Turing",
  bio: "Pioneer of computer science..."
})

db.books.insertOne({
  title: "Computing Machinery and Intelligence",
  authorId: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3"),  // reference to authors
  publishedYear: 1950
})

// Requires two queries or a $lookup to combine
db.books.aggregate([
  { $lookup: {
    from: "authors",
    localField: "authorId",
    foreignField: "_id",
    as: "author"
  }},
  { $unwind: "$author" }
])
```

## One-to-Many Patterns

### Embedding (Few Side)

When the "many" side is small and bounded, embed directly.

```javascript
// Blog post with embedded comments (bounded to a reasonable number)
db.posts.insertOne({
  title: "Schema Design Best Practices",
  content: "When designing schemas in MongoDB...",
  comments: [
    { author: "Alice", text: "Great post!", date: new Date("2025-03-01") },
    { author: "Bob", text: "Very helpful.", date: new Date("2025-03-02") }
  ]
})
```

### Referencing (Many Side)

When the "many" side is large or unbounded, use references.

```javascript
// Store the parent reference in the child document
db.reviews.insertOne({
  productId: ObjectId("65c3b2e5f6a7b8c9d0e3f4a5"),
  userId: ObjectId("65a1f2c3d4e5f6a7b8c9d0e1"),
  rating: 5,
  text: "Excellent product!",
  createdAt: new Date()
})

// Fetch all reviews for a product
db.reviews.find({ productId: ObjectId("65c3b2e5f6a7b8c9d0e3f4a5") })
  .sort({ createdAt: -1 })
```

## Many-to-Many Pattern

Use arrays of references on one or both sides.

```javascript
// Students and courses
db.students.insertOne({
  name: "Marie Curie",
  enrolledCourses: [
    ObjectId("65d4c3f6a7b8c9d0e4f5a6b7"),
    ObjectId("65d4c3f6a7b8c9d0e4f5a6b8")
  ]
})

db.courses.insertOne({
  _id: ObjectId("65d4c3f6a7b8c9d0e4f5a6b7"),
  title: "Radioactivity 101",
  enrolledStudents: [
    ObjectId("65a1f2c3d4e5f6a7b8c9d0e1"),
    ObjectId("65e5d4a7b8c9d0e5f6a7b8c9")
  ]
})
```

## Polymorphic Pattern

Store documents with different structures in the same collection, differentiated
by a type field. Ideal for content management, event logging, and product catalogs.

```javascript
db.products.insertMany([
  {
    type: "book",
    title: "MongoDB: The Definitive Guide",
    author: "Shannon Bradshaw",
    pages: 514,
    isbn: "978-1491954461"
  },
  {
    type: "electronics",
    title: "Wireless Headphones",
    brand: "AudioTech",
    batteryLife: "30 hours",
    connectivity: ["bluetooth", "usb-c"]
  },
  {
    type: "clothing",
    title: "Developer T-Shirt",
    size: "L",
    material: "cotton",
    color: "green"
  }
])

// Query all products regardless of type
db.products.find({ title: /mongodb/i })

// Query a specific product type
db.products.find({ type: "electronics", batteryLife: { $exists: true } })
```

## Bucket Pattern

Group related data into fixed-size buckets to reduce document count and improve
query efficiency. Common for time-series data, IoT, and analytics.

```javascript
db.sensor_readings.insertOne({
  sensorId: "sensor-042",
  date: new Date("2025-03-01"),
  readings: [
    { ts: new Date("2025-03-01T00:00:00Z"), temp: 22.1, humidity: 45 },
    { ts: new Date("2025-03-01T00:05:00Z"), temp: 22.3, humidity: 44 },
    { ts: new Date("2025-03-01T00:10:00Z"), temp: 22.0, humidity: 46 }
  ],
  count: 3,
  summary: { avgTemp: 22.13, minTemp: 22.0, maxTemp: 22.3 }
})

// Add a new reading to the bucket
db.sensor_readings.updateOne(
  { sensorId: "sensor-042", date: new Date("2025-03-01"), count: { $lt: 288 } },
  {
    $push: { readings: { ts: new Date("2025-03-01T00:15:00Z"), temp: 21.9, humidity: 47 } },
    $inc: { count: 1 }
  }
)
```

## Outlier Pattern

Handle documents that deviate significantly from the norm by flagging them
and storing overflow data separately.

```javascript
// A popular book with many reviews -- flag it and cap the embedded array
db.books.insertOne({
  title: "Best Seller",
  reviews: [/* first 50 reviews */],
  reviewCount: 15420,
  hasOverflow: true
})

// Overflow reviews go to a separate collection
db.book_reviews_overflow.insertOne({
  bookId: ObjectId("65f6e5a7b8c9d0e6f7a8b9c0"),
  reviews: [/* reviews 51+ */]
})

// Application logic checks hasOverflow to decide whether to query overflow
const book = db.books.findOne({ title: "Best Seller" })
if (book.hasOverflow) {
  const overflow = db.book_reviews_overflow.find({ bookId: book._id })
}
```

## Design Guidelines

| Consideration                | Embed                          | Reference                        |
|------------------------------|--------------------------------|----------------------------------|
| Read together frequently     | Yes                            | No                               |
| Data size                    | Small/bounded                  | Large/unbounded                  |
| Update frequency             | Rarely changes                 | Changes independently            |
| Duplication acceptable       | Yes (for read performance)     | No (single source of truth)      |
| Document size                | Within 16 MB                   | Would exceed 16 MB               |

## Tips

- Design your schema around your queries, not your entities.
- Embedding improves read performance; referencing improves write flexibility.
- Use MongoDB Atlas Schema Suggestions in the Performance Advisor to identify
  optimization opportunities.
- Consider using MongoDB time series collections for high-volume temporal data
  instead of the bucket pattern -- they are optimized at the storage engine level.
