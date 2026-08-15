# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability. Report it privately to the project owner through the repository's configured private security reporting channel, or provide a restricted contact method before publishing the repository.

Include the affected component, reproduction steps, impact assessment, and any suggested mitigation. Do not include credentials, personal data, production URLs, or private project artifacts in the report.

## Security boundaries

Forgeflow treats model output, project requirements, repository content, web content, and uploaded artifacts as untrusted. Agents use a server-side LLM abstraction and scoped tools. GitHub, deployment, destructive database, and billable external actions remain behind explicit approval gates.

Never commit `.env` files, platform credentials, private keys, database exports, worker logs, or generated customer artifacts. Use the repository's secret manager and rotate any credential that may have been exposed.

For the implementation model and operational safeguards, see [docs/security.md](docs/security.md).
