// Verifies that every Obsidian Feature doc in the configured vault has an
// Evidence section whose repo-relative paths actually exist on disk. The
// vault root is the folder containing Welcome.md, read from .obsidian.json
// or overridden with PFN_VAULT_ROOT.
//
// ponytail: scoped to Features/ docs only. Run after audit:features or
// on PRs that touch modules/, app/, or lib/ to surface stale documentation
// before merge. Add cross-vault checks when the legacy Domain docs are
// folded into Features Index.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dir, "..")
const VAULT_CONFIG_PATH = resolve(REPO_ROOT, ".obsidian.json")

const resolveVaultRoot = (): string | undefined => {
  if (process.env.PFN_VAULT_ROOT?.trim()) {
    return process.env.PFN_VAULT_ROOT
  }

  if (!existsSync(VAULT_CONFIG_PATH)) {
    console.error(
      "Missing vault config. Copy .obsidian.json.example to .obsidian.json " +
        "or set PFN_VAULT_ROOT."
    )
    return undefined
  }

  try {
    const config: unknown = JSON.parse(readFileSync(VAULT_CONFIG_PATH, "utf8"))
    if (
      typeof config !== "object" ||
      config === null ||
      !("directory" in config) ||
      typeof config.directory !== "string"
    ) {
      throw new Error('"directory" must be a string')
    }
    return config.directory
  } catch (error) {
    console.error(
      `Invalid .obsidian.json: ${error instanceof Error ? error.message : error}`
    )
    return undefined
  }
}
const INDEX_FILE = "Projects Green - Features Index.md"

type Finding = {
  file: string
  kind: "missing-section" | "no-evidence-paths" | "missing-path"
  detail: string
}

const walk = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...walk(full))
    } else if (entry.endsWith(".md")) {
      out.push(full)
    }
  }
  return out
}

// Convert a captured path to a single repo-relative form.
// - Absolute paths: strip everything through "/projects-green/".
// - Repo-relative: return as-is.
const normalizePath = (raw: string): string[] => {
  if (raw.startsWith("/")) {
    const marker = "/projects-green/"
    const cut = raw.indexOf(marker)
    if (cut === -1) return []
    return [raw.slice(cut + marker.length)]
  }
  return [raw]
}

// Extract repo-relative paths from an Evidence section.
// Accepts backticked repo-relative (`modules/foo.ts`), backticked absolute
// (`/home/.../projects-green/modules/foo.ts`), and unbackticked absolute
// in list items.
const extractPaths = (content: string): string[] => {
  const headingIdx = content.indexOf("\n## Evidence")
  if (headingIdx === -1) return []
  const bodyStart = content.indexOf("\n", headingIdx + 1) + 1
  const tail = content.slice(bodyStart)
  const next = tail.search(/\n## [^#]/)
  const section = next === -1 ? tail : tail.slice(0, next)

  const paths: string[] = []
  const backtickRe =
    /`([a-zA-Z][\w./\-:[\]@]*?\.(?:ts|tsx|js|jsx|json|yaml|yml|prisma|md))`/g
  for (const m of section.matchAll(backtickRe)) {
    paths.push(...normalizePath(m[1]))
  }
  const absRe =
    /(\/[^\s`]+\/projects-green\/[\w./\-:[\]@]*?\.(?:ts|tsx|js|jsx|json|yaml|yml|prisma|md))/g
  for (const m of section.matchAll(absRe)) {
    paths.push(...normalizePath(m[1]))
  }
  return paths
}

const findFilesWithoutSection = (files: string[]): Finding[] => {
  const findings: Finding[] = []
  for (const file of files) {
    const base = file.split("/").pop() ?? file
    if (base === INDEX_FILE) continue
    const content = readFileSync(file, "utf8")
    if (!content.includes("\n## Evidence")) {
      findings.push({
        file,
        kind: "missing-section",
        detail: "no ## Evidence section",
      })
    }
  }
  return findings
}

const verifyPaths = (files: string[]): Finding[] => {
  const findings: Finding[] = []
  for (const file of files) {
    const base = file.split("/").pop() ?? file
    if (base === INDEX_FILE) continue
    const content = readFileSync(file, "utf8")
    const paths = extractPaths(content)
    if (paths.length === 0) {
      findings.push({
        file,
        kind: "no-evidence-paths",
        detail: "Evidence section has no resolvable paths",
      })
      continue
    }
    for (const raw of paths) {
      // Strip `:line-line` or `:line` reference ranges before existence check
      const rel = raw.replace(/:\d+(-\d+)?$/, "")
      const candidates = [rel]
      // Common subagent typo: `.ts` for `.tsx` (UI components). Try the
      // alternate extension as a fallback.
      if (rel.endsWith(".ts")) candidates.push(`${rel}x`)
      else if (rel.endsWith(".tsx")) candidates.push(rel.slice(0, -1))
      const found = candidates.find((p) => existsSync(resolve(REPO_ROOT, p)))
      if (!found) {
        findings.push({ file, kind: "missing-path", detail: raw })
      }
    }
  }
  return findings
}

const main = (): number => {
  const vaultRoot = resolveVaultRoot()
  if (!vaultRoot) return 2

  const vaultFeaturesDir = resolve(
    vaultRoot,
    "Projects/Projects Green/Features"
  )
  if (!existsSync(vaultFeaturesDir)) {
    console.error(`Vault not found at ${vaultFeaturesDir}`)
    return 2
  }
  const files = walk(vaultFeaturesDir)
  const findings = [...findFilesWithoutSection(files), ...verifyPaths(files)]

  if (findings.length === 0) {
    console.log(`OK: ${files.length} feature docs verified, 0 findings.`)
    return 0
  }

  console.error(`FAIL: ${findings.length} finding(s) across feature docs:\n`)
  for (const f of findings) {
    console.error(`  [${f.kind}] ${f.file}`)
    console.error(`    ${f.detail}`)
  }
  return 1
}

process.exitCode = main()
