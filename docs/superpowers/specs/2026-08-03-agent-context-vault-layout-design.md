# Agent Context and Vault Layout Design

## Goal

Make `projects-green` easier to operate as a large codebase by keeping its
agent instructions project-local while relocating the existing PFNApp Obsidian
vault to a stable sibling path under `~/github`.

## Current context

- Project root: `/home/juniyadi/github/JuniYadi/projects-green`
- Existing vault remote: `git@github.com:JuniYadi/obdisian-vault.git`
- Existing vault source: `/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp`
- Existing vault size: 278 files; clean Git state observed
- Existing graph: `9,871` nodes, `21,414` edges, `553` communities
- Existing project `AGENTS.md` and `CLAUDE.md` are present but compact
- `.obsidian.json` is intentionally ignored because it contains a machine-local
  path

## Decision

Clone the vault as a separate repository at:

```text
/home/juniyadi/github/knowledge
```

Keep the two repositories independent. Configure the project-local ignored
`.obsidian.json` to point to that clone with `Welcome.md` as its entry note.
Do not copy vault files into `projects-green`, use a submodule, or alter vault
content during relocation.

## Agent instruction contract

`projects-green/AGENTS.md` becomes the canonical project bootloader. It will
contain:

1. Mandatory read order: project `AGENTS.md`, project `.obsidian.json`, vault
   `AGENTS.md`/entry flow, then graphify guidance for codebase questions.
2. Project map covering `app/`, `modules/`, `components/`, `lib/`, `prisma/`,
   `scripts/`, `test/`, and `graphify-out/`.
3. Existing local rules: Bun-only commands, Prisma destructive-command ban,
   TypeScript conventions, DTO boundaries, WorkOS directory usage, test
   mocking rules, shared console layout, and vault source-of-truth policy.
4. Graphify rules: query the existing graph for architecture questions, run
   `graphify update .` after code changes, and use report/wiki only when query
   output is insufficient.
5. Verification commands and security boundaries without copying secrets into
   agent documentation.

`projects-green/CLAUDE.md` stays a short Claude-specific pointer to
`AGENTS.md` and the configured vault entry note. Detailed project knowledge
belongs in the vault and graph output, not duplicated in `CLAUDE.md`.

## Relocation flow

1. Confirm target path does not contain an unrelated repository.
2. Clone the existing vault remote into `/home/juniyadi/github/knowledge`.
3. Verify the clone remote, expected entry notes, and vault Git state.
4. Write ignored `projects-green/.obsidian.json` with the sibling absolute path.
5. Update `projects-green/AGENTS.md` and `projects-green/CLAUDE.md`.
6. Verify the vault entry flow from `Welcome.md` through
   `Meta/SESSION-BRIEFING.md`, `index.md`, `log.md`, and `SCHEMA.md`.
7. Verify graphify can query the project graph and that project instructions
   reference the new vault path without embedding credentials.

If the target exists and is non-empty, stop rather than merge or overwrite.
The original external vault remains untouched; rollback is deleting only the
new clone and restoring the old `.obsidian.json` path.

## Error handling

- Existing non-empty target: abort before clone.
- Clone failure: leave no partial target, report Git error, and do not edit
  project instructions.
- Missing vault entry files: abort configuration update and report the missing
  paths.
- Invalid `.obsidian.json`: fail verification; keep the prior config until the
  replacement is valid.
- Graph query failure: report the failure separately; instruction and vault
  relocation remain independently verifiable.

## Verification

The implementation is complete only when all are true:

- `/home/juniyadi/github/knowledge/.git` exists and points to the expected
  remote.
- `/home/juniyadi/github/knowledge/Welcome.md` and the four boot notes resolve.
- `projects-green/.obsidian.json` parses and points to the new clone.
- `projects-green/AGENTS.md` names the actual project directories and commands.
- `projects-green/CLAUDE.md` points to `AGENTS.md` without duplicated rules.
- `graphify query` returns project context from the existing graph.
- No vault content was added to the application repository.
- No credentials or secret values appear in the generated instruction files.

## Scope exclusions

- No vault note rewrite, mass rename, plugin change, or link migration.
- No graph rebuild unless verification finds the existing graph unusable.
- No new dependency, submodule, automation hook, or CI workflow.
- No changes to application runtime code.
