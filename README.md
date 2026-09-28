# Hodman Toolkit

Open-source, user-authorized tools for turning useful personal AI work into controlled, auditable company projects on [Hodman](https://hodman.ai).

## What is Hodman?

[Hodman](https://hodman.ai) is an extensible AI workspace for companies. A person can start with a local application or personal agent, then bring useful work into a shared environment where colleagues, applications, and AI agents operate through explicit access and auditable connections. Each project combines an AI harness with a durable code workspace, an application runtime, Postgres data, tasks, conversations, and scheduled workflows.

Hodman can build and maintain web applications, SaaS products, internal tools, and automations, or run an ongoing AI agent that handles operational work directly. Applications can also extend the company environment by using Hodman platform capabilities and exposing stable CLI capabilities to explicitly authorized projects. The Toolkit lets external environments such as Codex, Claude Code, Hermes, and other Agent Skills-compatible harnesses discover and operate user-authorized Hodman projects without exposing private server implementation or internal prompts.

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

For Agent Skills-compatible harnesses, install directly from the public repository:

```bash
npx skills add hodman-ai/hodman-toolkit --skill hodman
```

The standalone skill folder (SKILL.md and its own MIT-0 LICENSE) is independent guidance; Toolkit CLI, API packages and repository code are Apache-2.0. No registry publication is performed by this repository. The same standards-compatible `SKILL.md` can be discovered by harnesses such as Hermes through GitHub or skills.sh.

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

## Development and release candidate verification

From a clean standalone checkout (Node.js 20+):

```bash
npm ci
npm run build
npm test
npm run check:skill
npm audit --audit-level=moderate
npm pack --workspace @hodman-ai/cli --dry-run --json
npm pack --workspace @hodman-ai/api-client --dry-run --json
npm pack --workspace @hodman-ai/api-contract --dry-run --json
```

The private product monorepo's `toolkit/` subtree is canonical. After committing it, from the **private monorepo root** run:

```bash
node toolkit/scripts/export.mjs /data/toolkit-rc-export
cd /data/toolkit-rc-export
npm ci && npm run build && npm test && npm run check:skill
npm audit --audit-level=moderate
```

The exporter archives only the committed Toolkit Git tree and prints its tree ID and sorted file-inventory SHA-256. It carries **no private Git history**, refuses dirty Toolkit changes, and blocks binary/oversized files, selected credential pathnames and known private package/secret patterns. It is not a comprehensive history or secret audit. Review the snapshot and the public diff before manually synchronizing into a standalone Git repository. This script never pushes, publishes, or changes GitHub settings. The public repository must never contain platform server code, internal prompts, customer data, generated output, or credentials.

## Security

Login sessions persist refresh-token rotation in a permission-restricted store with cross-process locks. ENV-owned `HODMAN_REFRESH_TOKEN` credentials opt out of rotation and are never saved. ENV and Git secrets are redacted by default; `--unsafe` requires explicit authorization for an exact field. Treat all CLI JSON as potentially sensitive and follow [SECURITY.md](SECURITY.md) for vulnerability reports.

## License

Toolkit CLI, API packages and repository code: Apache-2.0 (see [LICENSE](LICENSE)). Only the independently packaged instructions in `skills/hodman/` are MIT-0 (see [skills/hodman/LICENSE](skills/hodman/LICENSE)); the skill requires the separately installed CLI. This does not license the Hodman name or marks for unrelated use.
