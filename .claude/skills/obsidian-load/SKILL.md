---
name: obsidian-load
description: "Read vault notes and navigate vault structure. Use when asked to open, read, or find a note in the Obsidian vault."
---

# obsidian-load

Read notes from the Obsidian vault. Always invoke before accessing vault content.

## Vault discovery

1. Read `{repo-root}/.obsidian.json` (at `{repo-root}/.obsidian.json`, NOT anywhere else).
2. Extract `directory` (vault root path) and `entry` (entry note filename).
3. If `.obsidian.json` is absent: fail and instruct user to copy `.obsidian.json.example` → `.obsidian.json` and set `directory` to an absolute vault path.

## Boot

After loading `.obsidian.json`, run the boot command before any parallel reads:

```
bun run obsidian:boot
```

It prints the entry note plus the notes linked from the entry's `## Agent entry flow` section, each as `{requested, path, absolutePath}` JSON. Boot must complete before parallel reads start. Missing, duplicate, or unreadable notes are blocking: report them and stop, never work around them. Boot is a starting point, not a full vault index — resolve any other note by logical name.

## Reading a note

Address notes by logical name — never by filesystem path:

```
bun run obsidian:read -- "Note Name"
bun run obsidian:resolve -- "Note Name"   # only when a path is needed
```

- The `--` separates the note name from the script args; keep the name in quotes.
- `obsidian:read` prints the vault-relative path header, then the note content.
- `obsidian:resolve` prints `{"requested","path"}` for a single unambiguous match.
- Never construct filesystem paths from `[[wikilinks]]` — a wikilink is a logical name, not a path. Never use grep/find to resolve notes.
- Explicit, already-resolved vault-relative paths (from boot output, resolve output, or an `obsidian://open` URL's `file=` param) stay paths; only logical names go through the resolver.
- On WSL: `directory` is a `/mnt/c/...` path — use as-is.
- The `obsidian` desktop CLI is optional and only works when Obsidian is installed and running; on headless VPS hosts, skip it and use the adapter commands above.

## Entry flow

After reading the entry note, follow **that note's** Agent section — do not hardcode a sequence. Derive the flow from the note content.
