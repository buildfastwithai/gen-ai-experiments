---
name: mern-auth-best-practices
description: Implement secure JWT or Auth.js/NextAuth authentication flows, including refresh token rotation, session hardening, and secure cookie strategy. Use this whenever users build login, signup, token renewal, role checks, or protected route logic in MERN or Next.js stacks.
---

# MERN Auth Best Practices

Design secure authentication flows for MERN and Next.js ecosystems.

## Use When
- A user needs signup/login and protected routes.
- A user asks for JWT or Auth.js/NextAuth patterns.
- A user needs refresh token rotation and secure cookie design.

## Inputs To Collect
- App type and deployment context.
- Identity providers and session requirements.
- Access-control model (roles/permissions).
- Security constraints and compliance expectations.

## Workflow
1. Select auth architecture (session or token-based).
2. Design token/session lifecycle and rotation logic.
3. Configure cookie and CSRF protections.
4. Implement middleware and route guards.
5. Add revocation, logout, and incident controls.
6. Define security-focused test cases.

## Output Template
Use this exact template:

# Auth Architecture
## Flow Summary
## Token or Session Strategy
## Cookie and CSRF Strategy
## Endpoint Design
## Middleware and Authorization
## Failure and Recovery Cases
## Security Test Cases

## Quality Bar
- Never suggest insecure token storage patterns.
- Include refresh token abuse protections.
- Ensure clear separation of auth and authorization.


## Advanced Guidelines & Deep Dive
### Token Lifecycle & Hardening
- **Access vs Refresh Tokens**: Provide an exact blueprint: Access Tokens live 15 mins (in memory or short-lived cookie). Refresh Tokens live 7-30 days (Strict `httpOnly`, `Secure`, `SameSite=Strict` cookie).
- **Refresh Token Rotation**: Implement automatic invalidation of the entire token family if a reused refresh token is detected to prevent active session hijacking.
- **Auth.js/NextAuth Specifics**: Guide developers to explicitly configure NextAuth callbacks (`jwt`, `session`) to selectively forward only non-PII, necessary claims (like `role` or `id`) to the client.

### Defense in Depth
- **Bcrypt Work Factors**: Ensure password hashing uses a safe work factor (Min 10-12 rounds for bcrypt, or recommend Argon2).
- **Rate Limiting Login**: Detail implementation of strict rate limiting and progressive delays on `/api/auth/login` to thwart credential stuffing or brute-forcing.

### Anti-Patterns to Avoid
- **JSON Web Tokens in LocalStorage**: Exposing tokens to XSS entirely. Always mandate HttpOnly cookies for persistent sessions.
- **Missing Logout Invalidation**: Just deleting the cookie client-side. The server must maintain a blacklist or invalidate the refresh token family backend-side.
