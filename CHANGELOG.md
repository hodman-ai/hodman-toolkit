# Changelog

## 1.2.0 (release candidate; not published)

- CLI 0.3.0; typed API packages remain independently versioned 1.0.0 (backwards-compatible additions).
- Preserve Mattermost, Slack Socket Mode, Teams connector discovery and Telegram guidance alongside public 1.1.0 authentication and concurrent refresh hardening.
- Set timeouts on refresh/logout, fail closed on corrupted credential files, retain ENV credential ownership and prevent concurrent rotation races.
- Add API contract fixtures/tests, security/OSS documentation, Node CI, release-gate audit and scoped MIT-0 Agent Skill package. The Toolkit code and packages remain Apache-2.0.
- Update Vitest to 4.1.11 to resolve two moderate audit findings.

## 1.1.0 (public baseline)

- CLI 0.2.0: credential-store and session-rotation hardening with bounded auth timeouts.

## 1.0.0

- Initial public Toolkit release (CLI 0.1.0).
