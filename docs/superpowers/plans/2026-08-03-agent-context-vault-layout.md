# Agent Context and Vault Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone the PFNApp Obsidian vault into `/home/juniyadi/github/knowledge` and make `projects-green` boot with detailed, graph-aware agent instructions.

**Architecture:** Keep the vault as an independent Git repository beside the application repository. The ignored project `.obsidian.json` points to the sibling vault. `AGENTS.md` owns detailed project rules; `CLAUDE.md` remains a thin Claude-specific boot pointer.

**Tech Stack:** Git, JSON, Markdown, Bun, installed `graphify` CLI.

## Global Constraints

- Use Bun for project commands; do not use npm or yarn.
- Never run destructive Prisma commands.
- Keep `.obsidian.json` machine-local and ignored.
- Do not copy vault files into `projects-green` or use a submodule.
- Do not modify vault notes, plugins, or the original external vault.
- Do not place credentials or secret values in agent instructions.
- Stop before clone if `/home/juniyadi/github/knowledge` exists and is non-empty.
- No application runtime-code changes.

---

## File map

- External create: `/home/juniyadi/github/knowledge/` — independent clone of the existing vault repository.
- Modify: `JuniYadi/projects-green/.obsidian.json` — ignored local vault pointer.
- Modify: `JuniYadi/projects-green/AGENTS.md` — detailed project bootloader and operating rules.
- Modify: `JuniYadi/projects-green/CLAUDE.md` — concise Claude-specific pointer.
- Existing: `JuniYadi/projects-green/graphify-out/graph.json` — read-only graph used for verification.

### Task 1: Clone vault and configure local pointer

**Files:**
- Create external repository: `/home/juniyadi/github/knowledge/`
- Modify: `JuniYadi/projects-green/.obsidian.json`

**Interfaces:**
- Produces vault root `/home/juniyadi/github/knowledge`.
- Produces JSON `{ "directory": "/home/juniyadi/github/knowledge", "entry": "Welcome.md" }`.

- [ ] Confirm the target is absent or empty. If it is non-empty, stop without changing anything.

```bash
if [ -e /home/juniyadi/github/knowledge ]; then
  test -d /home/juniyadi/github/knowledge
  shopt -s nullglob dotglob
  entries=(/home/juniyadi/github/knowledge/*)
  test "${#entries[@]}" -eq 0
fi
```

- [ ] Clone the observed vault remote into the target.

```bash
git clone git@github.com:JuniYadi/obdisian-vault.git /home/juniyadi/github/knowledge
```

- [ ] Write the ignored project pointer with the exact JSON above.

- [ ] Verify clone identity and required boot files.

```bash
git -C /home/juniyadi/github/knowledge remote get-url origin
for file in Welcome.md AGENTS.md Meta/SESSION-BRIEFING.md index.md log.md SCHEMA.md; do
  test -f "/home/juniyadi/github/knowledge/$file"
done
bun -e 'const value = JSON.parse(await Bun.file(".obsidian.json").text()); if (value.directory !== "/home/juniyadi/github/knowledge" || value.entry !== "Welcome.md") process.exit(1)' 
```

### Task 2: Expand project bootloader instructions

**Files:**
- Modify: `JuniYadi/projects-green/AGENTS.md`

**Interfaces:**
- Produces the canonical project-local agent contract consumed by `CLAUDE.md` and other coding agents.
- Keeps existing local rules intact while adding exact navigation and graphify behavior.

- [ ] Preserve current hard rules: Bun-only commands, Prisma safety, TypeScript style, DTO mapping, WorkOS directory resolution, Bun mock ordering, shared console layout, and vault source-of-truth policy.

- [ ] Add mandatory boot order:
  1. Read project `AGENTS.md`.
  2. Read `.obsidian.json` and resolve `directory` plus `entry`.
  3. Read the vault `AGENTS.md`, then `directory/entry` and its linked agent flow.
  4. Use graphify for codebase architecture questions when `graphify-out/graph.json` exists.

- [ ] Add the actual project map for `app/`, `modules/`, `components/`, `lib/`, `prisma/`, `scripts/`, `test/`, `docs/`, and `graphify-out/`, plus the route/service boundaries described by the current README and vault project hub.

- [ ] Add graphify rules: query existing graph first, use `path`/`explain` for focused traversal, run `graphify update .` after code changes, and read `GRAPH_REPORT.md` only for broad architecture review or query gaps.

- [ ] Add focused verification commands: `bun run lint`, `bun run typecheck`, `bun run test`, and changed-scope tests as appropriate; retain the existing safe-Prisma command list.

- [ ] Add a security rule not to read, copy, or quote `.env` secrets into generated notes or agent instructions.

### Task 3: Keep Claude bootloader thin

**Files:**
- Modify: `JuniYadi/projects-green/CLAUDE.md`

**Interfaces:**
- Consumes the canonical rules from `AGENTS.md`.
- Produces no duplicate project policy.

- [ ] Keep the first instruction as `Read AGENTS.md first.`
- [ ] Point vault discovery to the project `.obsidian.json` rather than hardcoding a machine path.
- [ ] State that detailed project knowledge belongs in the configured vault and graphify output.
- [ ] Do not add a second copy of the `AGENTS.md` rules.

### Task 4: Verify end-to-end navigation and graph access

**Files:**
- Read: `/home/juniyadi/github/knowledge/Welcome.md`, `Meta/SESSION-BRIEFING.md`, `index.md`, `log.md`, `SCHEMA.md`.
- Read: `JuniYadi/projects-green/AGENTS.md`, `JuniYadi/projects-green/CLAUDE.md`, `.obsidian.json`.
- Read: `JuniYadi/projects-green/graphify-out/graph.json` through graphify CLI only for query verification.

**Interfaces:**
- Verifies all outputs from Tasks 1–3 without changing vault content or rebuilding the graph.

- [ ] Verify all six vault boot files exist and the entry flow points to the expected notes.
- [ ] Run a graph query that returns project architecture context:

```bash
graphify query "What are the main architectural domains and request entry points in projects-green?" --budget 1000
```

- [ ] Confirm generated `AGENTS.md` and `CLAUDE.md` contain no known secret-value patterns and do not contain `.env` contents.
- [ ] Confirm the application repository does not contain a second vault tree.
- [ ] Confirm the new vault repository is clean and the application diff contains only the intended pointer/instruction/spec-plan files.

## Final acceptance

- `/home/juniyadi/github/knowledge` is an independent clean clone of `git@github.com:JuniYadi/obdisian-vault.git`.
- `.obsidian.json` parses and points to the new sibling clone with `Welcome.md` entry.
- `AGENTS.md` contains detailed, current project navigation and graphify workflow.
- `CLAUDE.md` delegates to `AGENTS.md` without policy duplication.
- Vault boot notes remain intact and readable.
- Graph query returns project context.
- No runtime code, vault content, plugin state, credentials, or submodule changed.
