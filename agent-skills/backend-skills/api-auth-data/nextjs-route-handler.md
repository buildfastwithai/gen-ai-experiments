---
name: nextjs-route-handler
description: Build Next.js 14+ route handlers and server actions that are Edge-compatible, validated with Zod, and safe by default. Use this whenever users ask for API routes, mutation actions, request validation, or robust Next.js backend logic.
---

# Next.js Route Handler

Create Next.js 14+ route handlers and server actions with Edge-safe patterns and Zod validation.

## Use When
- A user needs app-router API endpoints.
- A user asks for Edge runtime compatibility.
- A user needs validated request parsing and robust errors.

## Inputs To Collect
- Route path, method(s), and runtime target.
- Request schema and response contract.
- Auth and authorization requirements.
- Error and observability expectations.

## Workflow
1. Confirm runtime constraints (Edge vs Node).
2. Define request/response contracts.
3. Add Zod schemas for params/query/body.
4. Implement handler and error mapping.
5. Add auth and rate-limiting hook points.
6. Provide focused test cases.

## Output Template
Use this exact template:

# Route Plan
- Endpoint:
- Methods:
- Runtime:
- Validation:
- Auth:

# Implementation
- Route handler code
- Server action code (if requested)

# Test Cases
- Success case
- Validation error case
- Auth error case
- Edge case

## Quality Bar
- No Node-only API usage for Edge handlers.
- Validate inputs before any side effects.
- Keep response envelopes consistent.


## Advanced Guidelines & Deep Dive
### Edge vs Node Runtime Nuances
- **Edge Limitations**: Explicitly catch dependencies that rely on Node.js core modules (`fs`, `child_process`, `crypto`) when targeting Edge. Provide Edge-compatible alternatives (e.g., Web Crypto API).
- **Streaming Responses**: detail patterns for using `NextResponse` with streams for long-running AI or file operations to prevent Vercel/lambda timeouts.

### Robust Validation via Zod
- **Safe Parsing**: Always use `schema.safeParse(data)` instead of `.parse()` to avoid unhandled exceptions crashing the route.
- **FormData vs JSON**: Distinguish parsing strategies for Server Actions (FormData, requires `zfd` or custom coercion) vs API Routes (JSON `req.json()`).

### Anti-Patterns to Avoid
- **Leaking PII**: Returning the full raw database object to the client when only 2 fields are needed.
- **Missing CORS/Auth**: Forgetting to wrap sensitive mutations in session checks or failing to validate CSRF tokens on standard routes.
- **Dynamic Deopt**: Accidentally opting into dynamic rendering when a route could be statically cached, or vice versa.
