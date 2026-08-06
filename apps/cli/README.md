# @hodman-ai/cli

User-authorized command-line client for Hodman.

```bash
npm install -g @hodman-ai/cli
hodman auth login --host https://hodman.ai --email user@example.com
hodman tenant list
hodman tenant use my-tenant
hodman project list
```

Commands output JSON by default so coding harnesses can consume them reliably. Run `hodman --help` for the current MVP command list.
