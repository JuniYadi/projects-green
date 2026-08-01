---
name: obsidian-load
description: "Read vault notes and navigate vault structure. Use when asked to open, read, or find a note in the Obsidian vault."
---

# obsidian-load

Read notes from the Obsidian vault. Always invoke before accessing vault content.

## Vault discovery

1. Read `{repo-root}/.obsidian.json`.
2. Extract `directory` (vault root path) and `entry` (entry note filename).
3. If `.obsidian.json` is absent: fail and instruct user to copy `.obsidian.json.example` → `.obsidian.json` and set `directory` to an absolute vault path.

## Reading a note

```
{directory}/{note-path}
```

- `note-path` is vault-relative, no `.md` extension needed.
- On WSL: `directory` is a `/mnt/c/...` path — use as-is.
- Try `obsidian` CLI first (if installed and Obsidian is open):
  ```
  obsidian vault="<vault-name-from-dir>" read path="<note-path>"
  ```
- Fall back to reading the file directly at `{directory}/{note-path}`.

## Vault name

Derive vault name from `directory`:
- Strip the Obsidian vault root from the path.
- E.g. `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp` → vault name `PFNApp`.
- Use this name when calling `obsidian` CLI commands.

## Entry flow

After reading the entry note, follow **that note's** Agent section — do not hardcode a sequence (e.g. `[[SESSION-BRIEFING]]` → `[[index]]` → etc.). Derive the flow from the note content.
