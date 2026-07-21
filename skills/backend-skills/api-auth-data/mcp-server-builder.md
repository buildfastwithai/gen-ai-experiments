---
name: mcp-server-builder
description: Provide practical instructions to design and build Model Context Protocol servers that connect agents to APIs, tools, filesystems, and databases. Use this for any MCP server planning, implementation, security, or deployment request.
---

# MCP Server Builder

Guide users to design and implement secure, production-grade MCP servers.

## Use When
- A user needs an MCP server from scratch.
- A user wants to connect agents to APIs or databases.
- A user asks for MCP tool schema, security, or deployment patterns.

## Inputs To Collect
- External systems and required operations.
- Auth model and trust boundaries.
- Performance and rate-limit expectations.
- Hosting/deployment constraints.

## Workflow
1. Define tool surface and risk boundaries.
2. Draft strict input and output schemas.
3. Implement handlers with validation and error mapping.
4. Add auth, authorization, and rate limiting.
5. Add logging, auditability, and observability.
6. Package, test, and deploy with a runbook.

## Output Template
Use this exact template:

# MCP Server Plan
## Goal and Scope
## Tool Catalog
## Schema Contracts
## Security Model
## Implementation Steps
## Validation and Test Plan
## Deployment and Operations

## Quality Bar
- Enforce least privilege and explicit schema validation.
- Never expose secrets in logs or responses.
- Include rollback and incident response basics.


## Advanced Guidelines & Deep Dive
### Security & Trust Boundaries
- **Resource Isolation**: MCP servers running locally must restrict file access to specific, absolute root directories using path canonicalization and traversal checks.
- **API Key Management**: Instruct developers to load secrets from environment variables dynamically, never burning them into tool source code.
- **Rate Limiting & Timeouts**: Mandate strict execution timeouts per tool to avoid blocking the MCP client indefinitely on hung DB queries or API calls.

### Schema & Protocol Rigor
- **JSON Schema Strictness**: All tool arguments MUST use strict JSON Schema definitions including `type`, `description`, and `required` fields. Add `additionalProperties: false` where supported.
- **Idempotency**: Clearly distinguish between Read operations (safe to map to standard MCP Read/List) and Mutation operations (must require explicit user confirmation).

### Anti-Patterns to Avoid
- **"God" Tools**: Creating a single `run_database_query` tool that executes raw SQL. Instead, create specific, scoped tools like `get_user_by_id` or `update_order_status`.
- **Silent Failures**: Swallowing exceptions. MCP tools must return clear error messages in the content block with `isError: true` so the agent can self-correct.
