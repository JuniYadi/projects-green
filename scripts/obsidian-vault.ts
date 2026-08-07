import {
  createNoteIndex,
  loadVaultConfig,
  readBootFlow,
  readNote,
  resolveNote,
} from "../lib/obsidian-vault"

async function runObsidianCli(): Promise<void> {
  const command = process.argv[2]
  if (command === "resolve") {
    const target = process.argv[3]
    if (!target)
      throw new Error('Usage: bun run scripts/obsidian-vault.ts resolve "NOTE"')
    const config = await loadVaultConfig()
    const index = await createNoteIndex(config.directory)
    const note = resolveNote(index, target)
    process.stdout.write(
      `${JSON.stringify({ requested: note.requested, path: note.path })}\n`
    )
    return
  }
  if (command === "read") {
    const target = process.argv[3]
    if (!target)
      throw new Error('Usage: bun run scripts/obsidian-vault.ts read "NOTE"')
    const note = await readNote(target)
    process.stderr.write(`${note.path}\n`)
    process.stdout.write(note.content)
    return
  }
  if (command === "boot") {
    process.stdout.write(`${JSON.stringify(await readBootFlow(), null, 2)}\n`)
    return
  }
  throw new Error("Usage: bun run obsidian:{resolve|read|boot} -- [NOTE]")
}

if (import.meta.main) {
  runObsidianCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`obsidian-vault: ${message}\n`)
    process.exitCode = 1
  })
}
