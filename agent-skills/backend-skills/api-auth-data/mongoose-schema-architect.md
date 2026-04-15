---
name: mongoose-schema-architect
description: Design high-performance Mongoose schemas with proper indexing, middleware, validation, and population strategy. Use this whenever users model MongoDB data, optimize query patterns, or need scalable schema design.
---

# Mongoose Schema Architect

Design performant, maintainable Mongoose schemas aligned to real query patterns.

## Use When
- Modeling new MongoDB collections.
- Refactoring slow or complex schemas.
- Designing indexes, middleware, and population strategy.

## Inputs To Collect
- Entities and their relationships.
- Top read/write query patterns.
- Data growth and retention assumptions.
- Consistency and validation requirements.

## Workflow
1. Map access patterns before schema drafting.
2. Choose embedding vs referencing per relationship.
3. Define schema fields and validation constraints.
4. Design index strategy from query hotspots.
5. Add middleware for invariants and audit fields.
6. Document migration and compatibility considerations.

## Output Template
Use this exact template:

# Data Model Plan
## Entities
## Access Patterns
## Schema Definition
## Index Plan
## Middleware Plan
## Population Strategy
## Migration Notes

## Quality Bar
- Justify each index with a query pattern.
- Avoid expensive population in hot paths.
- Call out operational tradeoffs explicitly.


## Advanced Guidelines & Deep Dive
### Optimization & Indexing Strategies
- **Compound Indexes**: Order matters (Equality, Sort, Range - the ESR Rule). Ensure developers place highly selective query fields first in the index.
- **Lean Queries**: Explicitly encourage `Model.find().lean()` for read-heavy API paths to bypass the heavy overhead of Mongoose document hydration.
- **Bounded Arrays**: Prevent unbound document growth (the 16MB limit). If an array is expected to exceed 100 items (e.g., comments on a post), force the move from Embedding to Referencing.

### Robust Middleware
- **Pre-save Hooks**: Handle computed fields gracefully. Warn against using arrow functions in hooks to preserve `'this'` context binding.
- **Soft Deletes**: Detail approaches for an `isDeleted` schema flag paired with a custom query middleware to automatically filter them from `find/findOne`.

### Anti-Patterns to Avoid
- **N+1 Queries**: Using `.populate()` inside loops. Design the schema to handle bulk lookups or embedded denormalization where appropriate.
- **Over-Indexing**: Adding indexes to every field randomly, severely impacting `insert/update` performance.
