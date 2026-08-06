---
name: hodman
description: Use the user-authorized Hodman CLI to inspect and operate Hodman projects from an external coding harness.
---

# Hodman CLI

Use `hodman` when the user asks you to work with a project hosted in Hodman/Dzun rather than the current local workspace.

## Discovery

1. Run `hodman auth status`.
2. If unauthenticated, ask the human to run `hodman auth login --host <host> --email <email>` in an interactive terminal. Never request or handle their password yourself.
3. Run `hodman tenant list`, then `hodman tenant use <name>` when no tenant is selected.
4. Run `hodman project list`, then `hodman project use <uuid>` when no project is selected.

Every successful command returns JSON. Check for `{ "err": ... }` and do not infer success from empty output.

## Safe workflow

- Inspect before changing: `project show`, `file tree`, `file cat`, `logs`.
- Use `file get`/`file put` for bounded files. The MVP supports text writes; do not use it for binary files.
- Run builds and diagnostics through `shell exec`; commands are executed in the selected project runtime with bounded output.
- Use `sql query` only for the selected project database. Prefer `SELECT ... LIMIT ...` before mutations.
- Project ENV and Git secrets are redacted by default. Use exact-key/field `--unsafe` reveal only when the value is required to diagnose a concrete problem; never dump all secrets or repeat values in your answer.
- Avoid concurrent writes while a Hodman agent or another project operation is active. Respect lock/project-busy errors and retry only after the operation finishes.

## Common commands

```bash
hodman project show
hodman file tree
hodman file cat --path package.json
hodman file get --path apps/web/src/app.tsx --output /tmp/app.tsx
hodman file put --path apps/web/src/app.tsx --local /tmp/app.tsx
hodman shell exec --command "npm run build" --timeout 1800
hodman logs --env dev --limit 20
hodman sql query --query "select * from analytics_events order by created_at desc limit 20"
hodman task create --title "Fix build" --message "Investigate and fix the current build failure" --status todo
hodman thread send --thread <uuid> --message "Continue with the approved fix" --wait
```

## Secret reveal

```bash
hodman env get OPENAI_API_KEY --env dev --unsafe
hodman git secret --connection <uuid> --field privateKey --unsafe
```

Treat these outputs as credentials. Do not persist them to project files, command history, logs, Tasks, or model-visible summaries.
