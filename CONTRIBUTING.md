# Contributing

Discuss substantial changes in an issue before implementation. For a pull request, fork the public repository, create a topic branch, keep scope small, and describe risks, tests and compatibility. Use Node.js 20+ and run `npm ci`, `npm run build`, `npm test`, `npm run check:skill`, and `npm audit --audit-level=moderate`. Never submit secrets, private platform code, credentials, real customer data or generated `dist/` output.

The canonical source is the private product monorepo's `toolkit/` subtree. Maintainers review and apply public contributions there before producing the next verified standalone export; contributors do not need access to that monorepo. See SECURITY.md for sensitive reports and CODE_OF_CONDUCT.md for participation standards.
