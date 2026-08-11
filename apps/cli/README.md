# @hodman-ai/cli

User-authorized command-line client for Hodman. Commands return JSON so humans and external coding harnesses can consume results consistently.

## Build and link from the repository

```bash
npm ci
npm run build
npm link --workspace @hodman-ai/cli
hodman version
```

## Authenticate and select a project

```bash
hodman auth login --host https://hodman.ai --email user@example.com
hodman tenant list --limit 20
hodman tenant use my-tenant
hodman project list
hodman project use <project-uuid>
```

The login password is read from an interactive hidden prompt. Run `hodman --help` for the current command list.

## Create a project

```bash
hodman project create --slug customer-portal --mode builder --prompt "Build a customer portal"
hodman project create --slug marketing-analyst --mode agent --prompt "Monitor acquisition and campaign performance"
```

Builder and agent projects receive different platform-managed instruction sets. The CLI does not download or reproduce those internal prompts.

## Task boundary

The CLI creates `backlog` and `todo` tasks. Inbox conversations are created only by supported human-facing UI and chat channels. Continue a known conversation with `hodman thread send` rather than creating an Inbox thread through the CLI.
