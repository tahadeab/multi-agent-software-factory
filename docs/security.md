# Security Model

Forgeflow separates project state, LLM access, external tooling, and approval decisions. Credentials remain server-side; agents invoke the shared LLM abstraction rather than vendor SDKs. Structured output is parsed and validated before it enters persisted requirements state.

## Tool permissions

The tool registry defines a small set of named capabilities. Each agent receives only its declared set, and an authorization check rejects any tool invocation outside that scope. Remote source-control and deployment capabilities are configuration-gated; they do not become active merely because an LLM requested them.

## Data and artifacts

The database retains metadata, links, and audit records. Generated artifact content is stored through object storage, while the database stores its key, URL, content type, size, and source run. This avoids placing file bytes in relational state and allows artifacts to survive application restarts.

## Approval boundaries

Approval requests carry the action, rationale, requester, timestamp, and eventual decision. Architecture approval, repository creation, external-cost activity, destructive migrations, and production deployment should be routed through these records. Notifications describe the specific project and action instead of a generic alert.

## Operational caveats

The supplied agent modules generate structured engineering artifacts but do not themselves execute arbitrary generated code, create repositories, or deploy software. Provider-specific adapters must implement sandboxing, URL validation, allowlists, secret isolation, idempotency, and result verification before enabling those functions.
