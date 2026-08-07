---
name: obsidian-vault
description: Search, create, and manage notes in the Obsidian vault with wikilinks and index notes. Use when user wants to find, create, or organize notes in Obsidian.
---

# Obsidian Vault

## Vault location

Read repo-root `.obsidian.json` for `directory` and `entry`. Use `directory`
for vault operations; do not hardcode machine paths. `directory` is an
explicit already-resolved path — keep it distinct from logical note names.

**Your Obsidian vault at PFNApp.** Organized in subdirectories by topic. Use Title Case for note names. Index notes aggregate related topics (e.g., `Work Index.md`, `Coding Index.md`, `Research Index.md`). Use directories to keep structure clean (`Index/`, `Projects Green/Domains/`, etc.). All [[wikilinks]] resolve regardless of directory depth.

## Boot

Run `bun run obsidian:boot` after loading `.obsidian.json` and before any
parallel reads. It prints the entry note plus the notes linked from the
entry's `## Agent entry flow` section, each as `{requested, path, absolutePath}`
JSON. Missing, duplicate, or unreadable notes are blocking: report them and
stop, never work around them.

## Reading and resolving notes

Address notes by logical name — never by filesystem path:

```bash
bun run obsidian:read -- "Note Name"
bun run obsidian:resolve -- "Note Name"   # only when a path is needed
```

- Never construct filesystem paths from `[[wikilinks]]` — a wikilink is a
  logical name, not a path. Never use grep/find to resolve notes.
- Boot output is a starting point, not a full vault index: resolve any note
  not listed there by logical name with `obsidian:resolve`.

## Linking

- Use Obsidian `[[wikilinks]]` syntax: `[[Note Title]]`
- Notes link to dependencies/related notes at the bottom
- Index notes are just lists of `[[wikilinks]]`

## Create a new note

1. Use **Title Case** for filename
2. Write content as a unit of learning (per vault rules)
3. Add `[[wikilinks]]` to related notes at the bottom
4. If part of a numbered sequence, use the hierarchical numbering scheme

### Find related notes

Resolve the note's name with `bun run obsidian:resolve -- "Note Title"` to get
its vault-relative path, then follow its `[[wikilinks]]` by logical name.

### Find index notes

For a known logical name, resolve it directly:

```bash
bun run obsidian:resolve -- "<Index Name>"
```

Index notes not linked from the entry flow will not appear in boot output;
resolve them by their logical name instead of scanning the vault.
