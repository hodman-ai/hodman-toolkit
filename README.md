# Hodman Toolkit

Open-source, user-authorized tools for operating [Hodman](https://hodman.ai) projects from a terminal or an external coding agent.

## What is Hodman?

[Hodman](https://hodman.ai) is an AI work and software-building platform. Each project combines an AI harness with a durable code workspace, an application runtime, Postgres data, tasks, conversations, and scheduled workflows.

Hodman can build and maintain web applications, SaaS products, internal tools, and automations, or run an ongoing AI agent that handles operational work directly. The Toolkit lets external environments such as Codex and Claude Code access user-authorized Hodman projects without exposing the platform's private server implementation or internal prompts.

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

The password prompt is interactive. Do not pass a password through an AI agent or command-line argument.

## Install the skill

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

## Development

```bash
npm ci
npm run build
npm test
```

The source is developed in a private product monorepo and exported from its `toolkit/` subtree. Public history must contain only this subtree. Credentials, `.env` files, platform server code, generated output, and internal prompts must never be exported.

## Security

- Authentication tokens are stored in the operating-system credential store when available, with a permission-restricted local fallback.
- ENV and Git secrets are redacted unless an exact field is requested with `--unsafe`.
- Treat CLI JSON as potentially sensitive operational output and do not attach it to public issues without review.

## License

MIT
