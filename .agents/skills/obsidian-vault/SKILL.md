---
name: obsidian-vault
description: Search, create, and manage notes in the Obsidian vault with wikilinks and index notes. Use when user wants to find, create, or organize notes in Obsidian.
---

# Obsidian Vault

## Vault location

`/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/`

**Your Obsidian vault at PFNApp.** Organized in subdirectories by topic. Use Title Case for note names. Index notes aggregate related topics (e.g., `Work Index.md`, `Coding Index.md`, `Research Index.md`). Use directories to keep structure clean (`Index/`, `Projects Green/Domains/`, etc.). All [[wikilinks]] resolve regardless of directory depth.

## Linking

- Use Obsidian `[[wikilinks]]` syntax: `[[Note Title]]`
- Notes link to dependencies/related notes at the bottom
- Index notes are just lists of `[[wikilinks]]`

## Workflows

```bash
# Search by filename
find "/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/" -name "*.md" | grep -i "keyword"

# Search by content
grep -rl "keyword" "/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/" --include="*.md"
```

Or use Grep/Glob tools directly on the vault path.

### Create a new note

1. Use **Title Case** for filename
2. Write content as a unit of learning (per vault rules)
3. Add `[[wikilinks]]` to related notes at the bottom
4. If part of a numbered sequence, use the hierarchical numbering scheme

### Find related notes
```bash
grep -rl "\\[\\[Note Title\\]\\]" "/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/"
```

### Find index notes

```bash
find "/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/" -name "*Index*"
```
