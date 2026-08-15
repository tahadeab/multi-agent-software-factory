# GitHub Handoff

This repository is prepared for a private or public GitHub repository. The source tree contains application code, migrations, tests, documentation, Docker Compose development guidance, and CI workflows. Runtime logs, environment files, build output, and temporary review files are excluded by `.gitignore`.

## Before the first push

Create an empty repository under the intended GitHub owner. Do not initialize it with a README, license, or `.gitignore`; those files are already part of this project. Review the repository visibility and branch protection policy before pushing.

Confirm that the local tree does not contain `.env`, private keys, database exports, customer artifacts, or platform logs. Configure required production values through GitHub Actions secrets or the deployment platform's secret manager. At minimum, protect the database connection, authentication secrets, built-in runtime credentials, OAuth settings, and `FORGEFLOW_WORKER_ENABLED`.

## Push an existing checkout

Run these commands from the project root, replacing the placeholder URL with the repository you created:

```bash
git status --short
git add .
git diff --cached --check
git commit -m "chore: prepare Forgeflow for GitHub"
git branch -M main
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

If a remote already exists, inspect it before changing it:

```bash
git remote -v
git remote set-url origin https://github.com/OWNER/REPOSITORY.git
```

Do not use `git add -f` for ignored environment files or logs. If a secret was ever committed, rotate it first; deleting the file in a later commit does not make the secret safe.

## Configure GitHub Actions

The repository includes continuous integration, dependency audit, and deployment-readiness workflows. Add the environment variables required by the target deployment platform through repository or environment secrets. Keep production deployment protected with required reviewers, and ensure the Forgeflow approval gate remains a separate application-level control.

Recommended branch protections for `main` are a required pull request, passing CI, dependency-audit review, and no direct force pushes. Use a staging environment before production and keep rollback references in the deployment records.

## Verify after pushing

Open the Actions tab and confirm the CI workflow passes its unit tests, type check, and production build. Confirm the dependency audit is active, then inspect the deployed application's authentication, project submission, worker status, approvals, Alerts inbox, notification grouping, and artifact links. The persistent worker requires an always-on hosting mode and `FORGEFLOW_WORKER_ENABLED=true`; do not enable it on request-scoped autoscaling infrastructure.
