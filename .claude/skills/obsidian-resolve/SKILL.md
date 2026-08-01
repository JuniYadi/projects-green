---
name: obsidian-resolve
description: Parse obsidian:// URLs into vault file paths. Use when given an obsidian:// open URL.
---

# obsidian-resolve

Parse `obsidian://` URLs and convert them to vault file paths.

## obsidian:// URL format

```
obsidian://open?vault=<vault-name>&file=<vault-relative-path>
```

## Parsing steps

1. Extract `vault` param → vault name.
2. Extract `file` param → vault-relative path (URL-decode it; spaces become ` ` not `%20`).
3. Read `{repo-root}/.obsidian.json` to resolve `directory` for that vault name.
4. Compute absolute path: `{directory}/{decoded-file}`.

## Example

URL: `obsidian://open?vault=PFNApp&file=Projects%2FProjects%20Green%2FIssues%2FIssue%20-%20App%20Hosting%20Deployment%20UI%20Parity`

- `vault` = `PFNApp`
- `file` = `Projects/Projects Green/Issues/Issue - App Hosting Deployment UI Parity`
- Result: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects/Projects Green/Issues/Issue - App Hosting Deployment UI Parity.md`

## After resolving

Hand off to `obsidian-load` skill to read the resolved file. Do not read the file directly from this skill.
