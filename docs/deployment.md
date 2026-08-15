# Deployment Model

The platform exposes a deployment abstraction and keeps deployment preparation distinct from deployment execution. A Deployment Agent may assess readiness and record a plan, but production deployment remains blocked until an approval record is resolved and a provider adapter returns a verifiable result.

## Local development

`docker-compose.yml` provides an application process and MySQL-compatible service for local experimentation. It should not be interpreted as a production release mechanism.

## Provider adapters

A production provider adapter should implement three operations: deploy, retrieve deployment status, and rollback. It must associate an external run identifier with the internal project, record state transitions in the event store, make callbacks idempotent, and require deployment approval before making a remote call.

## Managed hosting

The web application can run with the default managed Node environment without a custom Dockerfile. Do not add a Dockerfile merely for caching or reproducibility; introduce one only if production requires system binaries or an additional runtime. Long-running worker processes require a hosting configuration designed for persistent execution rather than a request-bound deployment.
