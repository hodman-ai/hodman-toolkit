# Hodman Toolkit

Use Codex, Claude Code, or another AI agent to work on shared projects with your team.

## What is Hodman?

[Hodman AI](https://hodman.ai) is a collaborative workspace where you share software projects with teammates and work on them together — both with people and AI agents.

Instead of keeping AI-assisted work inside one developer's local session, Hodman gives the project a shared, persistent home. Teammates can access the same project, create and review tasks, follow conversations, inspect results, and continue the work with their own AI agents.

Hodman does not replace Codex, Claude Code, or your preferred agent harness. Hodman Toolkit connects those tools to the projects you are authorized to access.

## How it works

1. A project is created or connected in Hodman.
2. The project owner gives teammates access through the Hodman workspace.
3. Each teammate signs in with their own Hodman account.
4. Codex, Claude Code, or another compatible agent uses Hodman Toolkit to work with the selected project.
5. Tasks, conversations, releases, and operational history remain attached to the shared project rather than to one local AI session.

Through the Toolkit, an authorized agent can:

- discover and select shared projects;
- create tasks and continue project conversations;
- inspect files, logs, environments, and project state;
- run builds and controlled shell or SQL operations;
- create and configure projects and sub-projects;
- publish changes and inspect release history.

## What's included

This repository contains:

- `@hodman-ai/cli` — the `hodman` command-line client;
- `@hodman-ai/api-client` — the typed HTTP client used by the CLI;
- `@hodman-ai/api-contract` — public DTOs for supported platform endpoints;
- `skills/hodman` — an English-language skill for external coding agents.

The Hodman backend, web console, hosted runtime orchestration, internal agent prompts, and self-hosted platform distribution are intentionally not included.

## Install from source

Requirements: Node.js 20 or newer and npm 10 or newer.

```bash
git clone https://github.com/hodman-ai/hodman-toolkit.git
cd hodman-toolkit
npm ci
npm run build
npm link --workspace @hodman-ai/cli
hodman version
```

Then authenticate against Hodman or an authorized local installation:

```bash
hodman auth login --host https://hodman.ai --email user@example.com
hodman tenant list --limit 20
hodman project list
```

The password prompt is interactive. Do not pass a password through an AI agent or command-line argument. `auth login` stores a mutable session in the operating-system credential store (or the permission-restricted file fallback), and the CLI atomically persists each rotated refresh token. Concurrent CLI processes serialize refresh so they do not rotate the same stored credential independently.

`HODMAN_REFRESH_TOKEN` is a compatibility option for ephemeral CI environments. Because a process cannot update its parent environment, ENV credentials opt out of refresh-token rotation and are never copied into the local credential store. While it is set, `auth login` refuses to create a shadowed persisted session; `auth logout` revokes only the ENV token and leaves any separately stored session untouched. Prefer `auth login` with persistent credential storage for long-running harnesses.

## Install the skill

For Agent Skills-compatible harnesses, install directly from the public repository:

```bash
npx skills add hodman-ai/hodman-toolkit --skill hodman
```

The same standards-compatible `SKILL.md` can be discovered by harnesses such as Hermes through GitHub or skills.sh.

### Codex

```bash
mkdir -p ~/.codex/skills/hodman
cp skills/hodman/SKILL.md ~/.codex/skills/hodman/SKILL.md
```

### Claude Code

```bash
mkdir -p ~/.claude/skills/hodman
cp skills/hodman/SKILL.md ~/.claude/skills/hodman/SKILL.md
```

Start a new agent session after installing or updating the skill.

## Project types and AI harnesses

The existing `projectIntent` determines which platform-managed AI harness a project receives:

- `aiAgent` uses the **agent harness** and handles ongoing operational work directly;
- every other project intent uses the **builder harness** and creates or maintains a system that solves the user's problem.

For example, use `--intent aiAgent` for an agent project or `--intent webApplication` for an application project. This is separate from the low-level `--type custom|prompt` provisioning field. Internal prompts and runtime implementation remain platform-owned.

## Projects, sub-projects, and releases

A project is an independent top-level product with its own host and settings. A sub-project is a separately managed part of that product, mounted at a pathname on the parent host. Sub-projects are useful for independently built and published landing pages, documentation, campaign sites, embedded applications, or specialized AI agents that should remain inside one product. They cannot be nested.

Create one under the selected parent and then use it like any other selected project:

```bash
hodman project create-subproject --pathname /docs --type web-app --prompt "Build the product documentation"
hodman project use <returned-subproject-uuid>
hodman project publish
```

Publication history uses the platform's existing persistent Release API:

```bash
hodman project releases --limit 20
hodman project release --release <release-uuid>
```

## Telegram channels and App Connections

Platform-managed Telegram channels and inter-project App Connections are separate command families:

```bash
hodman messengers telegram status
hodman messengers telegram requests list
hodman connectors list
```

Use `messengers telegram` when Telegram should act as a conversation channel for the selected Hodman project agent. Use `connectors` to create project CLI App Connections and configure which source projects may call a target project's CLI.

## Development

```bash
npm ci
npm run build
npm test
npm audit --audit-level=moderate
```

The source is developed in a private product monorepo and exported from its `toolkit/` subtree. The private monorepo is the canonical source; the public repository is a verified `git subtree split`, not a manually copied directory or a Git submodule. Public history must contain only this subtree. Credentials, `.env` files, platform server code, generated output, and internal prompts must never be exported.

Maintainers run the release gates from the private monorepo root:

```bash
npm run toolkit:verify   # standalone install, build, tests, audit, pack and public-boundary scan
npm run toolkit:export   # same gates plus a dry-run subtree split; never pushes
npm run toolkit:publish  # explicit fast-forward-only push through the configured hodman-toolkit remote
```

Export and publish require a clean worktree. The exporter scans every historical pathname and unique blob, not only the current checkout, and rejects binary, oversized, credential-named, generated, secret-bearing, and private-package content by default. The publish command refuses a non-fast-forward update. Configure the public remote once with `git remote add hodman-toolkit <public-repository-url>`.

## Security

- Authentication tokens created by `auth login` are stored in the operating-system credential store when available, with a permission-restricted local fallback; rotated successors replace the stored refresh token.
- `HODMAN_REFRESH_TOKEN` remains ENV-owned: it is used without rotation and is not persisted by the CLI.
- ENV and Git secrets are redacted unless an exact field is requested with `--unsafe`.
- Treat CLI JSON as potentially sensitive operational output and do not attach it to public issues without review.

## License

MIT
