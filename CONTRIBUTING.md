# Contributing to Forgeflow

Forgeflow is governed software rather than a prompt collection. Contributions should preserve durable state, scoped permissions, auditable actions, and explicit approval boundaries.

## Development expectations

Create a small branch for each focused change. Read the affected server, schema, and client modules before editing them. Prefer a minimal change over an opportunistic rewrite, preserve existing project state, and write or update Vitest coverage with every behavior change.

## Quality gate

Before opening a pull request, run the test suite, type check, and production build. A change that alters `drizzle/schema.ts` must generate a migration, review the generated SQL for destructive operations, and apply it to a suitable development database before review.

```bash
pnpm test
pnpm check
pnpm build
```

## Security boundary

Do not commit credentials, generated customer content, private artifacts, or database exports. Treat model output, repository content, web content, and uploaded materials as untrusted until validated. Any new external action must be added behind a durable approval record and described in the security documentation.
