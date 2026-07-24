// Verifies that every Obsidian Feature doc in
// /mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects Green/Features/
// has an Evidence section whose repo-relative paths actually exist on disk.
//
// ponytail: scoped to Features/ docs only. Run after audit:features or
// on PRs that touch modules/, app/, or lib/ to surface stale documentation
// before merge. Add cross-vault checks when the legacy Domain docs are
// folded into Features Index.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dir, "..")
const VAULT_FEATURES_DIR =
  "/mnt/c/Users/Juni Yadi/Documents/Obsidian/PFNApp/Projects Green/Features"
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
  if (!existsSync(VAULT_FEATURES_DIR)) {
    console.error(`Vault not found at ${VAULT_FEATURES_DIR}`)
    return 2
  }
  const files = walk(VAULT_FEATURES_DIR)
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

main()
