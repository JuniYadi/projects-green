import { readFile, readdir, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

type VaultConfig = {
  directory: string
  entry: string
}

type ResolvedNote = {
  requested: string
  path: string
  absolutePath: string
}

type BootFlow = {
  entry: ResolvedNote
  notes: ResolvedNote[]
}

type VaultOptions = {
  configPath?: string
  config?: VaultConfig
  index?: ReadonlyMap<string, readonly string[]>
}

const indexRoots = new WeakMap<object, string>()
const skippedDirectories = new Set([".obsidian", ".trash", ".git"])

function diagnostic(message: string): Error {
  return new Error(message)
}
function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function isInside(root: string, candidate: string): boolean {
  const child = relative(root, candidate)
  return (
    child !== "" &&
    child !== ".." &&
    !child.startsWith(`..${sep}`) &&
    !isAbsolute(child)
  )
}

async function requireDirectory(directory: string): Promise<void> {
  try {
    if (!(await stat(directory)).isDirectory()) {
      throw diagnostic(`Vault directory is not a directory: ${directory}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Vault directory"))
      throw error
    throw diagnostic(`Vault directory is missing or unreadable: ${directory}`)
  }
}

export async function loadVaultConfig(
  configPath = resolve(import.meta.dir, "../.obsidian.json")
): Promise<VaultConfig> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8"))
  } catch {
    throw diagnostic(`Unable to read valid JSON config: ${configPath}`)
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw diagnostic(`Invalid vault config (expected an object): ${configPath}`)
  }

  const candidate = parsed as Record<string, unknown>
  if (
    typeof candidate.directory !== "string" ||
    !isAbsolute(candidate.directory)
  ) {
    throw diagnostic(
      `Invalid vault directory (must be absolute): ${configPath}`
    )
  }
  if (typeof candidate.entry !== "string" || candidate.entry.trim() === "") {
    throw diagnostic(`Invalid vault entry (must be non-empty): ${configPath}`)
  }

  const directory = resolve(candidate.directory)
  await requireDirectory(directory)

  const entry = candidate.entry.trim()
  if (isAbsolute(entry)) {
    throw diagnostic(`Invalid vault entry (must be vault-relative): ${entry}`)
  }
  const entryPath = resolve(directory, entry)
  if (!isInside(directory, entryPath)) {
    throw diagnostic(
      `Invalid vault entry outside vault root "${directory}": ${entry}`
    )
  }
  try {
    if (!(await stat(entryPath)).isFile()) {
      throw diagnostic(
        `Configured entry is not a file in vault "${directory}": ${entry}`
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Configured entry"))
      throw error
    throw diagnostic(
      `Configured entry is missing in vault "${directory}": ${entry}`
    )
  }

  return { directory, entry }
}

export async function createNoteIndex(
  directory: string
): Promise<ReadonlyMap<string, readonly string[]>> {
  const root = resolve(directory)
  const matches = new Map<string, string[]>()

  async function walk(
    current: string,
    relativeDirectory: string
  ): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true })
    entries.sort((left, right) => compareCodeUnits(left.name, right.name))
    for (const entry of entries) {
      if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue
      const child = resolve(current, entry.name)
      const childRelative = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name
      if (entry.isDirectory()) {
        await walk(child, childRelative)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const basename = entry.name.slice(0, -3)
        const list = matches.get(basename) ?? []
        list.push(childRelative.split(sep).join("/"))
        matches.set(basename, list)
      }
    }
  }

  await walk(root, "")
  const sorted = new Map(
    [...matches.entries()]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([name, paths]) => [name, paths.sort(compareCodeUnits)] as const)
  )
  indexRoots.set(sorted, root)
  return sorted
}

export function normalizeNoteTarget(target: string): string {
  let normalized = target.trim()
  if (normalized.startsWith("[[") && normalized.endsWith("]]")) {
    normalized = normalized.slice(2, -2)
  }
  const alias = normalized.indexOf("|")
  if (alias >= 0) normalized = normalized.slice(0, alias)
  const suffix = normalized.search(/[#^]/)
  if (suffix >= 0) normalized = normalized.slice(0, suffix)
  if (normalized.toLowerCase().endsWith(".md"))
    normalized = normalized.slice(0, -3)
  return normalized.trim()
}

export function resolveNote(
  index: ReadonlyMap<string, readonly string[]>,
  target: string
): ResolvedNote {
  const requested = normalizeNoteTarget(target)
  const root = indexRoots.get(index as object) ?? resolve(process.cwd())
  if (!requested)
    throw diagnostic(`Cannot resolve an empty note target in vault "${root}".`)

  let matches = index.get(requested) ?? []
  if (requested.includes("/")) {
    const requestedPath = requested.toLowerCase().endsWith(".md")
      ? requested
      : `${requested}.md`
    const candidate = resolve(root, requestedPath)
    if (!isInside(root, candidate)) {
      throw diagnostic(
        `Note target "${requested}" escapes vault root "${root}".`
      )
    }
    const relativePath = relative(root, candidate).split(sep).join("/")
    matches = [...index.values()]
      .flatMap((paths) => paths)
      .filter((path) => path === relativePath)
  }

  if (matches.length === 0) {
    throw diagnostic(
      `Note "${requested}" not found in vault "${root}". Matches: none.`
    )
  }
  if (matches.length > 1) {
    throw diagnostic(
      `Note "${requested}" is ambiguous in vault "${root}". Matches: ${matches.join(", ")}.`
    )
  }

  const path = matches[0]
  return { requested, path, absolutePath: resolve(root, path) }
}

async function prepare(options: VaultOptions): Promise<{
  config: VaultConfig
  index: ReadonlyMap<string, readonly string[]>
}> {
  const config = options.config ?? (await loadVaultConfig(options.configPath))
  const index = options.index ?? (await createNoteIndex(config.directory))
  return { config, index }
}

export async function readNote(
  target: string,
  options: VaultOptions = {}
): Promise<ResolvedNote & { content: string }> {
  const { index } = await prepare(options)
  const note = resolveNote(index, target)
  let content: string
  try {
    content = await readFile(note.absolutePath, "utf8")
  } catch {
    throw diagnostic(
      `Unable to read note "${note.requested}" at "${note.absolutePath}".`
    )
  }
  return { ...note, content }
}

function extractSection(markdown: string): string[] | null {
  const lines = markdown.split(/\r?\n/)
  let start = -1
  let level = 0
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/)
    if (!match) continue
    const heading = match[2].replace(/[ \t]+#+[ \t]*$/, "").trim()
    if (match[1].length === 2 && heading === "Agent entry flow") {
      start = index + 1
      level = match[1].length
      break
    }
  }
  if (start < 0) return null

  const section: string[] = []
  const headingPattern = /^ {0,3}(#{1,6})[ \t]+/
  for (let index = start; index < lines.length; index += 1) {
    const match = lines[index].match(headingPattern)
    if (match && match[1].length <= level) break
    section.push(lines[index])
  }
  return section
}

export function extractAgentLinks(markdown: string): string[] {
  const section = extractSection(markdown)
  if (!section) return []
  const links: string[] = []
  for (const line of section) {
    for (const match of line.matchAll(/\[\[([^\]]+)\]\]/g)) links.push(match[1])
  }
  return links
}

export async function readBootFlow(
  options: VaultOptions = {}
): Promise<BootFlow> {
  const { config, index } = await prepare(options)
  const entry = resolveNote(index, config.entry)
  let content: string
  try {
    content = await readFile(entry.absolutePath, "utf8")
  } catch {
    throw diagnostic(
      `Unable to read configured entry at "${entry.absolutePath}".`
    )
  }
  const section = extractSection(content)
  if (!section) {
    throw diagnostic(
      `Configured entry "${config.entry}" is missing the "## Agent entry flow" section.`
    )
  }
  const notes: ResolvedNote[] = []
  for (const target of extractAgentLinks(content)) {
    const note = resolveNote(index, target)
    try {
      await readFile(note.absolutePath, "utf8")
    } catch {
      throw diagnostic(
        `Unable to read note "${note.requested}" at "${note.absolutePath}".`
      )
    }
    notes.push(note)
  }
  return { entry, notes }
}

async function runCli(): Promise<void> {
  const command = process.argv[2]
  if (command === "resolve") {
    const target = process.argv[3]
    if (!target)
      throw diagnostic(
        'Usage: bun run scripts/obsidian-vault.ts resolve "NOTE"'
      )
    const { index } = await prepare({})
    const note = resolveNote(index, target)
    process.stdout.write(
      `${JSON.stringify({ requested: note.requested, path: note.path })}\n`
    )
    return
  }
  if (command === "read") {
    const target = process.argv[3]
    if (!target)
      throw diagnostic('Usage: bun run scripts/obsidian-vault.ts read "NOTE"')
    const note = await readNote(target)
    process.stderr.write(`${note.path}\n`)
    process.stdout.write(note.content)
    return
  }
  if (command === "boot") {
    process.stdout.write(`${JSON.stringify(await readBootFlow(), null, 2)}\n`)
    return
  }
  throw diagnostic("Usage: bun run obsidian:{resolve|read|boot} -- [NOTE]")
}

if (import.meta.main) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`obsidian-vault: ${message}\n`)
    process.exitCode = 1
  })
}

export type { BootFlow, ResolvedNote, VaultConfig, VaultOptions }
