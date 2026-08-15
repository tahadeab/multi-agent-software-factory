# Orchestration and Recovery

The orchestrator derives work readiness from persisted task dependencies. It schedules tasks with only successful predecessors, so architect, research, and database work can form a concurrent batch after planning; testing and security can form another concurrent batch after development. This behavior is deterministic and does not depend on a language model choosing the next agent.

Every task contains a status, dependency list, attempt count, and maximum attempt count. The orchestrator records an `agentRuns` entry before calling a specialized agent. A failed run is returned to `RETRYING` while budget remains, otherwise it becomes `FAILED`. If unfinished tasks have no ready work, no active run, and no terminal task can make progress, the engine emits a workflow-failure event describing the blocked graph.

Process recovery is durable. Interrupted `RUNNING` tasks are marked retryable by `recoverInterruptedWorkflows`, and the project may then be resumed through the protected workflow procedure. The persisted event stream makes recovery, retries, decisions, and approval outcomes visible to the dashboard.

## Persistent event worker

User actions no longer execute the workflow inside their HTTP request. Project submission, a manual run, an approved gate, and a manual resume each create or refresh a durable `WORKFLOW_ADVANCE` queue record with a stable project-level dedupe key. The always-on worker receives an in-process event signal after the database commit and also drains durable queued work on startup, so a restart cannot lose queued work.

Each claimed queue record obtains an owner and a lease expiry. A successful worker marks the record complete and records a `WORKER_COMPLETED_JOB` event. If a process dies after claiming work, the next worker startup moves expired leases back to the queue and records `WORKER_RECOVERED_LEASE`. A queued job may be cancelled when the owner pauses the project; a job already leased is allowed to finish its current atomic agent work, and the orchestrator sees the persisted pause before moving to the next batch.

The worker is deliberately single-process and event-driven. It does not use process-local timers or polling loops. Its authoritative state is the relational queue, so an in-memory event signal is an acceleration mechanism rather than a correctness dependency.

## In-app failure alerts

When a background job reaches the worker failure path, Forgeflow first marks the durable job as failed and then creates an owner-scoped `BACKGROUND_JOB_FAILED` notification. The notification contains the project link, failure summary, attempt count, and durable job reference. It appears in the alert badge and the in-app inbox on the next client refresh, while the worker event records the linked notification identifier for auditability.

Notifications are isolated by owner at the query and mutation boundaries. The owner may acknowledge an unread failure to indicate review, or resolve it after corrective work is complete. A job failure is never erased when a notification is resolved; the queue record and event trail remain available for investigation.

Repeated failures are grouped by owner, project, job type, and a bounded normalized error fingerprint within a 24-hour deduplication window. The existing inbox row is updated atomically with the latest message, attempt count, failure timestamp, and repeat count. After 24 hours without the same failure, the next occurrence starts a fresh count of one while retaining the same owner-scoped inbox record. An acknowledged group remains acknowledged to avoid interrupting the owner again; a resolved group reopens as one unread alert when the same failure returns within the window. Underlying worker failures remain separate audit events.

## Operating boundary

The persistent worker requires a single always-on application process. It must not be enabled on request-scoped autoscaling infrastructure that can terminate an idle process or run multiple competing worker instances. The worker is enabled only when `FORGEFLOW_WORKER_ENABLED=true`, and the dashboard exposes its server-side status. The persistent host remains bounded by its CPU and memory allocation; provider-specific remote execution should be introduced when individual build tasks exceed those limits.
