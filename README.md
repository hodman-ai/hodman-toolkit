# Hodman Toolkit

Open-source client-side tools for Hodman: the `hodman` CLI, public API contracts, API clients, and agent skills.

> The Hodman platform backend, web console, hosted runtime orchestration, and self-hosted server distribution are not included in this repository.

## Packages

- `@hodman-ai/cli` — user-authorized command-line client.
- `@hodman-ai/api-client` — typed HTTP client used by the CLI.
- `@hodman-ai/api-contract` — public DTOs shared with selected platform endpoints.

## Development

```bash
npm ci
npm run build
npm test
```

The source is developed inside the private product monorepo and exported from its `toolkit/` subtree. No platform credentials or server implementation belong here.
