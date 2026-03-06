# Data Modeling Patterns

MongoDB data modeling revolves around the decision to embed related data within
a single document or reference it across collections. This document covers the
core patterns and trade-offs for modeling relationships in a document database.

## Embedding vs Referencing

**Embedding** places related data inside a single document. It provides atomic
reads and writes -- one query retrieves everything.

**Referencing** stores related data in separate collections linked by ObjectId.
It avoids duplication and handles unbounded or frequently changing data.

```javascript
// Embedded: user with inline address
{
  name: "Ada Lovelace",
  address: { street: "12 Babbage Lane", city: "London", country: "UK" }
}

// Referenced: user points to a separate address document
{
  name: "Ada Lovelace",
  addressId: ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
}
```

## One-to-One (Embedded)

When two entities always appear together, embed the child directly.

```javascript
db.employees.insertOne({
  name: "Grace Hopper",
  badge: "EMP-7291",
  healthInsurance: {
    provider: "BlueCross",
    policyNumber: "BC-55023",
    effectiveDate: new Date("2025-01-01"),
    coveredDependents: 2
  }
})

// Access in a single read
db.employees.findOne(
  { badge: "EMP-7291" },
  { name: 1, "healthInsurance.provider": 1 }
)
```

## One-to-Many: Embedded Array

Best when the "many" side is small and bounded (e.g., phone numbers, addresses).

```javascript
db.contacts.insertOne({
  name: "Alan Turing",
  phones: [
    { label: "work", number: "+44-20-7946-0958" },
    { label: "mobile", number: "+44-77-1234-5678" }
  ]
})

// Query within the embedded array
db.contacts.find({ "phones.label": "work" })

// Add a new phone number
db.contacts.updateOne(
  { name: "Alan Turing" },
  { $push: { phones: { label: "home", number: "+44-20-8123-4567" } } }
)

// Remove a phone number
db.contacts.updateOne(
  { name: "Alan Turing" },
  { $pull: { phones: { label: "home" } } }
)
```

## One-to-Many: Child References

When the "many" side is large or unbounded, store a reference in each child
document pointing back to the parent.

```javascript
// Parent: a company
db.companies.insertOne({
  _id: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3"),
  name: "MongoDB Inc.",
  headquarters: "New York"
})

// Children: employees referencing their company
db.employees.insertMany([
  { name: "Dev Ittycheria", companyId: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3"), role: "CEO" },
  { name: "Sahir Azam", companyId: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3"), role: "CPO" }
])

// Find all employees of a company
db.employees.find({ companyId: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3") })
```

## Many-to-Many: Array of References

Model many-to-many relationships with arrays of ObjectIds on one or both sides.

```javascript
// Actors and movies
db.actors.insertOne({
  _id: ObjectId("65c3b2e5f6a7b8c9d0e3f4a5"),
  name: "Keanu Reeves",
  movieIds: [
    ObjectId("65d4c3f6a7b8c9d0e4f5a6b7"),
    ObjectId("65d4c3f6a7b8c9d0e4f5a6b8")
  ]
})

db.movies.insertMany([
  {
    _id: ObjectId("65d4c3f6a7b8c9d0e4f5a6b7"),
    title: "The Matrix",
    actorIds: [ObjectId("65c3b2e5f6a7b8c9d0e3f4a5")]
  },
  {
    _id: ObjectId("65d4c3f6a7b8c9d0e4f5a6b8"),
    title: "John Wick",
    actorIds: [ObjectId("65c3b2e5f6a7b8c9d0e3f4a5")]
  }
])

// Find all movies for an actor
db.movies.find({ actorIds: ObjectId("65c3b2e5f6a7b8c9d0e3f4a5") })
```

## $lookup for Combining Collections

The `$lookup` aggregation stage combines data from two collections.

```javascript
// Combine orders with customer details
db.orders.aggregate([
  { $lookup: {
    from: "customers",
    localField: "customerId",
    foreignField: "_id",
    as: "customer"
  }},
  { $unwind: "$customer" },
  { $project: {
    orderNumber: 1,
    total: 1,
    "customer.name": 1,
    "customer.email": 1
  }}
])

// Pipeline-based $lookup for more complex combinations
db.orders.aggregate([
  { $lookup: {
    from: "products",
    let: { itemIds: "$items.productId" },
    pipeline: [
      { $match: { $expr: { $in: ["$_id", "$$itemIds"] } } },
      { $project: { name: 1, price: 1 } }
    ],
    as: "productDetails"
  }}
])
```

## Denormalization Trade-offs

Duplicating data across documents improves read performance but creates
consistency challenges.

```javascript
// Denormalized: store author name directly on each book
db.books.insertOne({
  title: "Computing Machinery and Intelligence",
  authorName: "Alan Turing",             // duplicated for fast reads
  authorId: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3")  // reference for updates
})

// Trade-off: if the author name changes, you must update all books
db.books.updateMany(
  { authorId: ObjectId("65b2a1d4e5f6a7b8c9d0e2f3") },
  { $set: { authorName: "Alan M. Turing" } }
)
```

**When to denormalize:**
- The duplicated data changes infrequently
- Read performance is more important than write consistency
- You want to avoid `$lookup` in hot query paths

## Extended Reference Pattern

Store a subset of a referenced document's fields alongside the reference.
Avoids full `$lookup` while keeping the link for complete data when needed.

```javascript
db.orders.insertOne({
  orderNumber: "ORD-2025-9910",
  // Extended reference: enough customer info for display, full doc via customerId
  customer: {
    _id: ObjectId("65e5d4a7b8c9d0e5f6a7b8c9"),
    name: "Marie Curie",
    email: "marie@example.com"
  },
  items: [
    {
      productId: ObjectId("65f6e5a7b8c9d0e6f7a8b9c0"),
      name: "Lab Equipment Set",         // copied for display
      quantity: 1,
      unitPrice: NumberDecimal("299.99")
    }
  ],
  total: NumberDecimal("299.99"),
  orderDate: new Date("2025-03-01")
})

// Most reads need only the embedded data -- no $lookup required
db.orders.find({ "customer._id": ObjectId("65e5d4a7b8c9d0e5f6a7b8c9") })
```

## Subset Pattern

When a document contains a large array but queries typically need only a portion,
store a subset in the main document and the full set in a secondary collection.

```javascript
// Main document with the 10 most recent reviews
db.products.insertOne({
  name: "Wireless Headphones",
  recentReviews: [
    { user: "Alice", rating: 5, text: "Amazing sound!", date: new Date("2025-03-05") },
    { user: "Bob", rating: 4, text: "Great value.", date: new Date("2025-03-04") }
    // ... up to 10 most recent
  ],
  totalReviewCount: 4823,
  avgRating: 4.3
})

// Full review history in a separate collection
db.product_reviews.insertOne({
  productId: ObjectId("65f6e5a7b8c9d0e6f7a8b9c0"),
  user: "Charlie",
  rating: 3,
  text: "Decent, but could be better.",
  date: new Date("2024-06-15")
})

// Update the subset when a new review arrives
db.products.updateOne(
  { _id: ObjectId("65f6e5a7b8c9d0e6f7a8b9c0") },
  {
    $push: {
      recentReviews: {
        $each: [{ user: "Dana", rating: 5, text: "Love it!", date: new Date() }],
        $sort: { date: -1 },
        $slice: 10  // keep only the 10 most recent
      }
    },
    $inc: { totalReviewCount: 1 }
  }
)
```

## Pattern Selection Guide

| Pattern              | Use When                                          |
|----------------------|---------------------------------------------------|
| Embedded document    | Data is read together, "many" side is small       |
| Child reference      | "Many" side is large or unbounded                 |
| Array of references  | Many-to-many relationship                         |
| Extended reference   | You need fast reads with some referenced fields   |
| Subset               | Large arrays where only recent/top items are read |
| Denormalization      | Read-heavy workload, data rarely changes          |

## Tips

- Profile your queries with `db.collection.find().explain()` to validate that
  your chosen pattern avoids unnecessary `$lookup` stages.
- Use MongoDB Atlas Performance Advisor to identify slow queries caused by
  suboptimal data modeling.
- Remember the 16 MB document size limit when deciding between embedding
  and referencing -- unbounded arrays can push documents past this limit.
- Consider change streams for keeping denormalized data in sync across
  collections in real time.
