import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import {
  createNoteIndex,
  extractAgentLinks,
  loadVaultConfig,
  normalizeNoteTarget,
  readBootFlow,
  resolveNote,
} from "./obsidian-vault"

const temporaryVaults: string[] = []

async function makeVault(
  files: Record<string, string>,
  entry = "Welcome.md"
): Promise<{ directory: string; configPath: string }> {
  const directory = await mkdtemp(join("/tmp", "obsidian-vault-test-"))
  temporaryVaults.push(directory)

  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(directory, relativePath)
    await mkdir(resolve(path, ".."), { recursive: true })
    await writeFile(path, content, "utf8")
  }

  const configPath = join(directory, ".obsidian.json")
  await writeFile(configPath, JSON.stringify({ directory, entry }), "utf8")
  return { directory, configPath }
}

afterEach(async () => {
  await Promise.all(
    temporaryVaults
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe("obsidian vault note resolution", () => {
  it("resolves exact nested logical names", async () => {
    const { directory, configPath } = await makeVault({
      "Welcome.md": "# Welcome",
      "Meta/SESSION-BRIEFING.md": "# Session",
      "Projects/Projects Green/Infrastructure - Deploy Flow.md": "# Flow",
    })
    const config = await loadVaultConfig(configPath)
    const index = await createNoteIndex(directory)

    expect(resolveNote(index, "SESSION-BRIEFING").path).toBe(
      "Meta/SESSION-BRIEFING.md"
    )
    expect(resolveNote(index, "Infrastructure - Deploy Flow").path).toBe(
      "Projects/Projects Green/Infrastructure - Deploy Flow.md"
    )
    expect(config.directory).toBe(directory)
  })

  it("reports the vault root and requested name for missing notes", async () => {
    const { directory } = await makeVault({ "Welcome.md": "# Welcome" })
    const index = await createNoteIndex(directory)

    expect(() => resolveNote(index, "Does Not Exist")).toThrow(
      `Note "Does Not Exist" not found in vault "${directory}".`
    )
  })

  it("reports every relative path for duplicate logical names", async () => {
    const { directory } = await makeVault({
      "Welcome.md": "# Welcome",
      "Alpha/Duplicate.md": "# Alpha",
      "Beta/Duplicate.md": "# Beta",
    })
    const index = await createNoteIndex(directory)

    expect(() => resolveNote(index, "Duplicate")).toThrow(
      /Note "Duplicate" is ambiguous.*Alpha\/Duplicate\.md.*Beta\/Duplicate\.md/
    )
  })

  it("normalizes aliases, headings, blocks, and markdown suffixes", async () => {
    const { directory } = await makeVault({
      "Welcome.md": "# Welcome",
      "Meta/SESSION-BRIEFING.md": "# Session",
    })
    const index = await createNoteIndex(directory)
    const targets = [
      "[[SESSION-BRIEFING]]",
      "[[SESSION-BRIEFING|Boot context]]",
      "[[SESSION-BRIEFING#Orientation protocol]]",
      "[[SESSION-BRIEFING^block]]",
    ]

    expect(targets.map((target) => resolveNote(index, target).path)).toEqual([
      "Meta/SESSION-BRIEFING.md",
      "Meta/SESSION-BRIEFING.md",
      "Meta/SESSION-BRIEFING.md",
      "Meta/SESSION-BRIEFING.md",
    ])
    expect(normalizeNoteTarget("[[SESSION-BRIEFING.md|Boot context]]")).toBe(
      "SESSION-BRIEFING"
    )
  })
})

describe("obsidian vault boot flow", () => {
  it("preserves Agent entry flow link order and resolves paths", async () => {
    const { configPath } = await makeVault({
      "Welcome.md": `# Welcome\n\n## Agent entry flow\n\n1. [[Meta/First|First note]]\n2. [[Projects/Second#Setup]]\n3. [[Meta/First^handoff]]\n\n## Later section\nIgnored`,
      "Meta/First.md": "# First",
      "Projects/Second.md": "# Second",
    })

    const links = extractAgentLinks(
      await Bun.file(
        join((await loadVaultConfig(configPath)).directory, "Welcome.md")
      ).text()
    )
    expect(links).toEqual([
      "Meta/First|First note",
      "Projects/Second#Setup",
      "Meta/First^handoff",
    ])

    const flow = await readBootFlow({ configPath })
    expect(flow.entry.path).toBe("Welcome.md")
    expect(flow.notes.map((note) => note.path)).toEqual([
      "Meta/First.md",
      "Projects/Second.md",
      "Meta/First.md",
    ])
  })

  it("fails when the configured entry has no Agent entry flow section", async () => {
    const { configPath } = await makeVault({
      "Welcome.md": "# Welcome\n\n## Other section\nNo boot links",
    })

    expect(readBootFlow({ configPath })).rejects.toThrow(
      'Configured entry "Welcome.md" is missing the "## Agent entry flow" section.'
    )
  })

  it("fails when an Agent entry flow link cannot be resolved", async () => {
    const { configPath } = await makeVault({
      "Welcome.md":
        "# Welcome\n\n## Agent entry flow\n\n- [[Missing boot note]]",
    })

    expect(readBootFlow({ configPath })).rejects.toThrow(
      /Note "Missing boot note" not found.*vault.*Matches: none/
    )
  })
})
