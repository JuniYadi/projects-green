---
name: pr-minimum-coverage
description: "Ensure changed files achieve at least 85% code coverage before PR submission rather than relying solely on targeted unit tests"
condition: "fast targeted testing|bun test\\s*<file>"
scope: "text"
---

When discussing test workflows or preparing changes for a pull request, do not rely solely on targeted unit tests (`bun test <file>`).

All modified files must achieve at least 85% code coverage before submitting a PR:

1. Run `bun run test:coverage:changed` to measure coverage across all changed files.
2. Verify that statement and branch coverage on every changed file reaches or exceeds 85%.
3. Add unit tests for any uncovered lines or branches before creating the PR.
