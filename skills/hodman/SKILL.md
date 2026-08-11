---
name: hodman
description: Use the user-authorized Hodman CLI to select projects, delegate work to their agents, and perform bounded project operations from an external coding harness.
---

# Hodman

Use `hodman` when the user asks you to work with a project hosted on Hodman rather than only with the current local workspace.

Hodman projects combine a durable code workspace, an application runtime, project data and Postgres access, and an AI harness. Prefer the project agent for product-level outcomes; use direct file, shell, SQL, log, ENV, and Git commands for bounded inspection, diagnostics, and explicitly requested operations.

## CLI discovery

1. Run `command -v hodman` before the first CLI call.
2. If it is not on `PATH`, check the user-local executable `~/.cargo/bin/hodman` and use that absolute path for subsequent calls.
3. If neither executable exists, ask the human to install the CLI from `https://github.com/hodman-ai/hodman-toolkit`. Do not download or execute an unverified replacement.

## Authenticate and select context

1. Run `hodman auth status`.
2. If unauthenticated, ask the human to run `hodman auth login --host <host> --email <email>` in an interactive terminal. Never request or handle their password yourself.
3. Run `hodman tenant list --limit 20`. Use `--search <text>` and `--offset <n>` instead of requesting an unbounded tenant list. Select with `hodman tenant use <name>`.
4. Run `hodman project list`, then select with `hodman project use <uuid>`.
5. Inspect `hodman project show` before acting.

Successful commands print JSON. Check for `{ "err": ... }`; do not infer success from empty output.

## Project modes

Hodman projects use one of two AI instruction modes:

- **builder** — builds and maintains a system that solves the user's problem. Use this for applications, websites, SaaS products, automations, and other software outcomes.
- **agent** — acts as an ongoing assistant and solves operational tasks directly, while still being able to extend its own project when code, UI, storage, or integrations make the work more reliable.

The platform selects the correct internal instruction set. Do not recreate or override those private instructions from the external harness.

Create projects explicitly:

```bash
hodman project create --slug customer-portal --mode builder --prompt "Build a customer portal"
hodman project create --slug marketing-analyst --mode agent --prompt "Monitor acquisition and help improve campaign performance"
```

Use an existing project unless the user asked to create a new one. Project mode is separate from the low-level `--type custom|prompt` provisioning option.

## Conversations, tasks, and delegation

- **Inbox** conversations originate from a human-facing UI or an external chat channel such as Telegram. The CLI does not create Inbox threads.
- Use `thread send` to continue an existing conversation when the user has identified that thread.
- Use a `todo` task for approved asynchronous work that should run when the project executor is available.
- Use `backlog` only to record work that is not ready to run.
- Multiple Inbox conversations may be active, while background `in-progress` work is serialized per project. Do not try to bypass project-busy or lock responses with parallel writes.
- Project agents can delegate work internally and receive durable follow-up or steering inputs. Do not emulate that internal return-routing mechanism by creating unrelated external tasks.
- Project agents can create scheduled tasks for recurring checks and workflows. The current external CLI has no dedicated schedule command; request the schedule through the selected project agent instead of inventing a cron process outside the project.

Examples:

```bash
hodman task create --title "Analyze failed signups" --message "Find the cause, fix it, and verify the result" --status todo
hodman task create --title "Consider CRM import" --message "Keep this for later planning" --status backlog
hodman task show --task <uuid>
hodman thread send --thread <uuid> --message "Continue with the approved option" --wait
```

Use `--wait` only when the result is expected within the command timeout. Otherwise keep the returned task/thread UUID and inspect it later.

## Choosing direct tools vs. the project agent

Delegate to the project agent when the request needs product judgment, multi-step implementation, an integration flow, durable workflow state, or user-facing output. The in-project harness knows its own engineering rules and runtime capabilities.

Use direct CLI tools when you need to:

- inspect code, runtime status, logs, or a bounded data sample;
- download a known bounded file or upload a known bounded text file;
- run a specific build or diagnostic command;
- perform an explicit, reviewed ENV, SQL, or Git operation.

A project agent may implement UI for rich results, browser authorization, or large file exchange, and may use its project application and Postgres database for durable workflow state. State the user outcome in the task; do not prescribe internal Hono, Vite, Drizzle, migration, static-serving, or storage details unless the user explicitly asked for that implementation or the existing project conventions require it.

## Safe direct workflow

- Inspect before changing: `project show`, `file tree`, `file cat`, and `logs`.
- Use `file get` for bounded files and `file put` only for bounded text files. The current CLI does not support binary writes.
- Run builds and diagnostics through `shell exec`; output and execution time are bounded.
- Use `sql query` only for the selected project's database. Start with `SELECT ... LIMIT ...` before reviewed mutations.
- Project ENV and Git secrets are redacted by default. Reveal only an exact required key or field with `--unsafe`.
- Never print, persist, summarize, or send revealed credentials to a task, thread, log, analytics event, or model-visible report.
- Respect project locks and busy responses. Re-inspect state after another agent or operation finishes.

## Common direct commands

```bash
hodman project show
hodman file tree
hodman file cat --path package.json
hodman file get --path apps/web/src/app.tsx --output /tmp/app.tsx
hodman file put --path apps/web/src/app.tsx --local /tmp/app.tsx
hodman shell exec --command "npm run build" --timeout 1800
hodman logs --env dev --limit 20
hodman sql query --query "select * from analytics_events order by created_at desc limit 20"
```

## Secret reveal

```bash
hodman env get OPENAI_API_KEY --env dev --unsafe
hodman git secret --connection <uuid> --field privateKey --unsafe
```

Treat these outputs as credentials. If a task can be completed without revealing them, do not reveal them.
