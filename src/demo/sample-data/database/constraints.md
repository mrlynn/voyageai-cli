# Schema Validation

MongoDB provides flexible schema validation using JSON Schema, allowing you to enforce
document structure at the collection level while preserving the document model's flexibility.

## Creating a Collection with Validation

Use `db.createCollection()` with a `$jsonSchema` validator to enforce structure on insert and update operations.

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "User Validation",
      required: ["email", "name", "createdAt"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Must be a valid email address and is required"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Full name of the user"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150,
          description: "Age must be an integer between 0 and 150"
        },
        role: {
          enum: ["admin", "editor", "viewer"],
          description: "Must be one of the allowed roles"
        },
        createdAt: {
          bsonType: "date",
          description: "Timestamp of account creation"
        }
      }
    }
  }
})
```

## Required Fields

The `required` array ensures specified fields are present in every document.

```javascript
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["sku", "name", "price", "category"],
      properties: {
        sku: { bsonType: "string" },
        name: { bsonType: "string" },
        price: { bsonType: "decimal" },
        category: { bsonType: "string" }
      }
    }
  }
})

// This insert will fail — missing required field "category"
db.products.insertOne({ sku: "ABC-123", name: "Widget", price: NumberDecimal("9.99") })
// MongoServerError: Document failed validation
```

## BSON Type Validators

Enforce specific BSON types for fields using `bsonType`.

```javascript
properties: {
  count: { bsonType: "int" },           // 32-bit integer
  total: { bsonType: "long" },          // 64-bit integer
  score: { bsonType: "double" },        // floating point
  price: { bsonType: "decimal" },       // Decimal128 (precise)
  active: { bsonType: "bool" },         // boolean
  tags: { bsonType: "array" },          // array
  metadata: { bsonType: "object" },     // embedded document
  _id: { bsonType: "objectId" },        // ObjectId
  timestamp: { bsonType: "date" }       // ISODate
}
```

You can also allow multiple types for a single field:

```javascript
properties: {
  value: {
    bsonType: ["int", "double", "decimal"],
    description: "Accepts any numeric type"
  }
}
```

## Enum Validators

Restrict field values to a predefined set.

```javascript
properties: {
  status: {
    enum: ["pending", "active", "suspended", "deleted"],
    description: "Must be a valid account status"
  },
  priority: {
    bsonType: "int",
    enum: [1, 2, 3, 4, 5],
    description: "Priority level from 1 (highest) to 5 (lowest)"
  }
}
```

## Min/Max Validators

Apply numeric range and string length constraints.

```javascript
properties: {
  quantity: {
    bsonType: "int",
    minimum: 0,
    maximum: 10000,
    description: "Stock quantity must be between 0 and 10,000"
  },
  discount: {
    bsonType: "double",
    minimum: 0,
    maximum: 1,
    description: "Discount as a fraction between 0.0 and 1.0"
  },
  title: {
    bsonType: "string",
    minLength: 3,
    maxLength: 500
  }
}
```

## Nested Document Validation

Validate the structure of embedded documents and arrays of documents.

```javascript
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customer", "items", "orderDate"],
      properties: {
        customer: {
          bsonType: "object",
          required: ["name", "email"],
          properties: {
            name: { bsonType: "string" },
            email: { bsonType: "string" },
            address: {
              bsonType: "object",
              properties: {
                street: { bsonType: "string" },
                city: { bsonType: "string" },
                state: { bsonType: "string" },
                zip: { bsonType: "string" }
              }
            }
          }
        },
        items: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["productId", "quantity", "price"],
            properties: {
              productId: { bsonType: "objectId" },
              quantity: { bsonType: "int", minimum: 1 },
              price: { bsonType: "decimal" }
            }
          }
        },
        orderDate: { bsonType: "date" }
      }
    }
  }
})
```

## Modifying Validation on Existing Collections

Use `collMod` to add or update validation rules on an existing collection.

```javascript
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name", "role", "createdAt"],
      properties: {
        email: { bsonType: "string" },
        name: { bsonType: "string" },
        role: { enum: ["admin", "editor", "viewer", "superadmin"] },
        createdAt: { bsonType: "date" }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "warn"
})
```

## Validation Level

Controls which documents the validation applies to.

| Level        | Behavior                                                        |
|--------------|-----------------------------------------------------------------|
| `strict`     | Validates all inserts and updates (default)                     |
| `moderate`   | Validates inserts and updates to documents that already match   |
| `off`        | Disables validation entirely                                    |

```javascript
// Strict: every write must pass validation
db.runCommand({ collMod: "users", validationLevel: "strict" })

// Moderate: existing non-conforming documents can still be updated
db.runCommand({ collMod: "users", validationLevel: "moderate" })
```

## Validation Action

Controls what happens when a document fails validation.

| Action   | Behavior                                           |
|----------|----------------------------------------------------|
| `error`  | Rejects the write operation (default)              |
| `warn`   | Allows the write but logs a warning to the server  |

```javascript
// Reject invalid documents
db.runCommand({ collMod: "products", validationAction: "error" })

// Allow invalid documents but log warnings
db.runCommand({ collMod: "products", validationAction: "warn" })
```

## Inspecting Existing Validation Rules

```javascript
// View the validation rules for a collection
db.getCollectionInfos({ name: "users" })[0].options.validator

// List all collections with their validation settings
db.getCollectionInfos().forEach(c => {
  if (c.options.validator) {
    print(`${c.name}: validationLevel=${c.options.validationLevel || "strict"}`)
  }
})
```

## Tips

- Start with `validationAction: "warn"` when adding rules to existing collections
  to identify non-conforming documents before enforcing strict validation.
- Use `moderate` validation level during migrations so legacy documents are not
  blocked from unrelated updates.
- Combine schema validation with unique indexes for complete data integrity.
- In MongoDB Atlas, you can manage validation rules through the Atlas UI under
  the collection's Validation tab.
