# Project TODO

- [x] Define domain enums, typed contracts, workflow states, event taxonomy, and agent dependency graph.
- [x] Extend the durable database schema for projects, structured requirements, tasks, dependencies, agent runs, messages, events, approvals, artifacts, reviews, security findings, CI runs, and deployments.
- [x] Generate and apply database migration SQL, then verify the operational schema.
- [x] Implement database helpers for project state, workflow tasks, runs, events, approvals, artifacts, and audit queries.
- [x] Build the LLM provider abstraction as the sole agent inference interface, using the preconfigured server-side model runtime.
- [x] Build a scoped tool registry with per-agent permissions and safe stubs for filesystem, Git, GitHub, research, test, and deployment capabilities.
- [x] Implement the twelve typed specialized agent modules with distinct responsibilities, structured outputs, logging, and individual state tracking.
- [x] Implement the server-side orchestrator state machine with DAG resolution, concurrency batches, retries, configurable limits, deadlock detection, approval pauses, and restart-safe resumption.
- [x] Implement requirement submission and structured SRS extraction with ambiguity, assumption, constraint, dependency, and acceptance-criteria tracking.
- [x] Implement planning, architecture, research, database-design, development, testing, security, review, documentation, GitHub, and deployment workflow outputs.
- [x] Implement durable event recording and a real-time project activity feed.
- [x] Implement human approval gates for architecture, repository creation, external costs, destructive migrations, and deployment actions.
- [x] Implement approval notifications that identify the project and exact requested action.
- [x] Implement S3-backed artifact persistence with governed artifact metadata and secure downloads.
- [x] Implement typed project, workflow, agent, approval, artifact, review, and deployment API procedures.
- [x] Build the Project submission experience and project list.
- [x] Build the live control-center dashboard with project progress, workflow timeline, active agents, events, approvals, reviews, artifacts, CI, and deployment panels.
- [x] Build project-detail views showing agent execution details, tool calls, output artifacts, errors, token usage when available, and approval controls.
- [x] Add configurable retry and review-iteration limits to project settings.
- [x] Create deployment-provider and agent-runtime interfaces with safe local implementations and clearly marked optional integrations.
- [x] Add repository documentation, system diagrams, environment examples, Docker development guidance, and GitHub Actions quality workflows.
- [x] Write Vitest coverage for schemas, DAG resolution, retry limits, approval gates, tool permissions, requirement extraction, and orchestrator state transitions.
- [x] Run type checking, unit tests, build validation, database verification, and a synthetic end-to-end workflow.
- [x] Perform a visual dashboard review on desktop and mobile and correct identified usability issues.
- [x] Save a final checkpoint after verifying that all completed items are accurately marked.
- [x] Define an event-driven background execution model compatible with managed hosting and durable workflow resumption.
- [x] Configure the persistent worker design for the approved always-on hosting mode and its lifecycle safeguards.
- [x] Extend durable state and event records for queued, leased, completed, and failed background workflow work.
- [x] Implement an idempotent background worker that claims queued workflow work and advances eligible projects without blocking user requests.
- [x] Connect project submission, approval resolution, and manual resume actions to background work scheduling.
- [x] Surface background queue and worker status in the project control room.
- [x] Add automated coverage for job claiming, lease recovery, idempotent scheduling, and background workflow advancement.
- [x] Document runtime behavior, local testing, and hosting constraints for background execution.
- [x] Verify the updated system with tests, type checking, build validation, visual review, and a new checkpoint.
- [x] Add isolated coverage for atomic durable job claiming and competing worker ownership.
- [x] Add isolated coverage for project-level workflow job deduplication and requeue behavior.
- [x] Verify the background-worker setup guidance in the repository documentation before the final checkpoint.
- [x] Define durable in-app notification states, severity, payload, and owner-scoping for background job failures.
- [x] Add database persistence and typed procedures to list, acknowledge, and resolve in-app notifications.
- [x] Create an owner-scoped failure notification whenever the persistent worker marks a background job failed.
- [x] Add notification indicators, an inbox view, and failure-detail links in the control room.
- [x] Add automated coverage for failure notification creation, owner isolation, and acknowledgment state changes.
- [x] Verify alert UX, document notification behavior, and save a checkpoint.
- [x] Add a successful owner-scoped acknowledgement and resolution test for notification state transitions.
- [x] Verify the new Alerts inbox and unread indicator visually before the notification checkpoint.
- [x] Reconfirm the notification documentation updates before delivery.
- [x] Re-read and confirm README and orchestration documentation for in-app failure alerts before the notification checkpoint.

- [x] Define a stable aggregation key and deduplication window for repeated failures in the same project.
- [x] Extend notification persistence with repeat count, last failure details, and aggregation metadata.
- [x] Update the worker failure path to upsert one grouped notification instead of creating alert noise.
- [x] Display grouped failure counts and latest failure time in the Alerts inbox.
- [x] Add tests for first notification, repeated aggregation, resolved-alert reactivation, and owner isolation.
- [x] Verify grouped-alert UX, documentation, full validation, and save a final checkpoint.

## Smart notification aggregation policy

- [x] Aggregate by owner, project, background job kind, and normalized failure fingerprint.
- [x] Keep one active notification per aggregation key and increment its repeat count on recurrence.
- [x] Preserve the latest error message, attempt count, and failure timestamp while retaining the original creation time.
- [x] Reopen a resolved group when the same failure recurs, without creating a second active alert.
- [x] Use a bounded normalized fingerprint so volatile identifiers do not defeat deduplication.
- [x] Keep all underlying worker events and queue records for auditability; aggregation changes only the inbox presentation.

- [x] Fix the alert inbox verification route mismatch discovered during visual review and recheck the actual notifications path.

- [x] Implement and document the 24-hour deduplication window and cover inactivity reset behavior with tests.
- [x] Re-run full tests, type checking, production build, database verification, and mobile alert UX review.
- [x] Save a post-change checkpoint for smart notification aggregation.

- [x] Audit repository files, GitHub workflows, ignore rules, generated artifacts, and secret exposure before packaging.
- [x] Add professional repository metadata and contribution/security guidance for GitHub.
- [x] Verify the source tree with tests, type checking, and production build for the handoff package.
- [x] Create a complete source archive excluding secrets and transient build/cache files.
- [ ] Save a final GitHub-ready checkpoint and deliver the archive with push instructions.

- [x] Complete a successful repository-wide secret-content scan without shell quoting errors.
- [x] Explicitly review all `.github/workflows/*` files for safe secret handling and non-destructive behavior.
- [x] Rebuild and re-verify the GitHub archive after the completed secret audit.
