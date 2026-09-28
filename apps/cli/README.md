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

The login password is read from an interactive hidden prompt. Login sessions rotate and persist refresh tokens; ENV-owned `HODMAN_REFRESH_TOKEN` is not rotated or saved, and concurrent CLI sessions serialize refresh/logout. Run `hodman --help` for the current command list.

## Create a project

```bash
hodman project create --slug customer-portal --intent webApplication --prompt "Build a customer portal"
hodman project create --slug marketing-analyst --intent aiAgent --prompt "Monitor acquisition and campaign performance"
```

The existing `projectIntent` selects the platform-managed harness: `aiAgent` uses agent instructions, while every other intent uses builder instructions. The CLI does not download or reproduce those internal prompts.

Tenant owners, tenant managers, and global administrators can assign a personal project to an active user of the selected tenant:

```bash
hodman project create --slug customer-agent --intent aiAgent --owner-user USER_UUID --defer-run
```

The platform validates both the caller's permission and the target user's active tenant membership. Without `--owner-user`, a personal project belongs to the current user; `--visibility tenant` creates a shared tenant project.

## Projects and sub-projects

A project is an independent top-level product with its own host, ownership, runtime, and settings. Use it when the result should stand on its own: for example, a SaaS product, an internal tool, a customer website, or an ongoing AI agent.

A sub-project is an independently managed part of a parent product, mounted at a pathname on the parent's host. Use sub-projects when one product needs separately built and published areas, such as multiple landing pages, a documentation site, a campaign microsite, an embedded application, or a specialized AI agent. Sub-projects cannot be nested.

Create a sub-project under the currently selected parent, or pass the parent explicitly with `--project`:

```bash
hodman project create-subproject --pathname /campaign --type landing-page --prompt "Build the campaign landing page"
hodman project create-subproject --project <parent-uuid> --pathname /assistant --type prompt --intent aiAgent --prompt "Handle support operations"
```

After creation, select the returned sub-project UUID with `hodman project use <uuid>`. The normal project commands then work with it, including configuration, runtime operations, publication, files, ENV, logs, shell, SQL, tasks, and Git.

## Publication and release history

```bash
hodman project publish
hodman project publish-status
hodman project releases --limit 20
hodman project release --release <release-uuid>
```

`publish-status` reports the current temporary publication job. `releases` and `release` read the persistent Release records already exposed by the platform API, including publication metadata, review, related Thread IDs, and Git status.

## Task boundary

The CLI creates `backlog` and `todo` tasks. Inbox conversations are created only by supported human-facing UI and chat channels. Continue a known conversation with `hodman thread send` rather than creating an Inbox thread through the CLI.
