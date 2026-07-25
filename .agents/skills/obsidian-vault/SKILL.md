---
name: obsidian-vault
description: Search, create, and manage notes in the Obsidian vault with wikilinks and index notes. Use when user wants to find, create, or organize notes in Obsidian.
---

# Obsidian Vault

## Vault location

Read repo-root `.obsidian.json` for `directory` and `entry`. Use `directory`
for all vault operations; do not hardcode machine paths. In the examples
below, `VAULT` is the `.obsidian.json` `directory` value.

**Your Obsidian vault at PFNApp.** Organized in subdirectories by topic. Use Title Case for note names. Index notes aggregate related topics (e.g., `Work Index.md`, `Coding Index.md`, `Research Index.md`). Use directories to keep structure clean (`Index/`, `Projects Green/Domains/`, etc.). All [[wikilinks]] resolve regardless of directory depth.

## Linking

- Use Obsidian `[[wikilinks]]` syntax: `[[Note Title]]`
- Notes link to dependencies/related notes at the bottom
- Index notes are just lists of `[[wikilinks]]`

## Workflows

```bash
# Search by filename
find "$VAULT" -name "*.md" | grep -i "keyword"

# Search by content
grep -rl "keyword" "$VAULT" --include="*.md"
```

Or use Grep/Glob tools directly on the vault path.

### Create a new note

1. Use **Title Case** for filename
2. Write content as a unit of learning (per vault rules)
3. Add `[[wikilinks]]` to related notes at the bottom
4. If part of a numbered sequence, use the hierarchical numbering scheme

### Find related notes
```bash
grep -rl "\\[\\[Note Title\\]\\]" "$VAULT"
```

### Find index notes

```bash
find "$VAULT" -name "*Index*"
```
