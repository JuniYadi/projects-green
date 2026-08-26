import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import ts from "typescript"

const root = process.cwd()
const routeRoot = join(root, "app/[lang]/console/billing")
const componentRoot = join(root, "components/billing")
const attributeNames = new Set(["aria-label", "placeholder", "title"])
const excludedFiles = new Set<string>([
  "components/billing/admin", // Portal / admin components are excluded from console localization scope
])

// These are UI-independent values: identifiers, config fragments, currencies, or data terms.
const technicalTerms = new Set([
  "API",
  "CSV",
  "cURL",
  "HTTP",
  "HTTPS",
  "ID",
  "IDR",
  "JSON",
  "PDF",
  "PGN",
  "PPN",
  "QRIS",
  "REST",
  "SDK",
  "SQL",
  "URL",
  "USD",
  "UTC",
  "VA",
  "WhatsApp",
  "Rp",
  "&mdash;",
  "&nbsp;",
  "&ndash;",
  "&hellip;",
])

const dataPlaceholderPatterns = [
  /^[0-9\s.,/:-]+$/,
  /^(https?:\/\/|\/|#)/,
  /^[a-z0-9_-]+@[a-z0-9_-]+\.[a-z0-9_-]+$/i,
  /^[A-Z0-9_-]{3,}$/,
  /^\+?[0-9\s-]{6,}$/,
  /^INV-[A-Z0-9-]+$/i,
  /^SUB-[A-Z0-9-]+$/i,
  /^ORD-[A-Z0-9-]+$/i,
  /^TX-[A-Z0-9-]+$/i,
  /^[a-z0-9_.-]+\.[a-z]{2,}$/i,
  /^\d+(\.\d+)?\s*(MB|GB|TB|KB|%|ms|s|m|h|d|mo|yr)$/i,
]

interface StringCandidate {
  file: string
  line: number
  character: number
  text: string
  context: "jsx_text" | "jsx_attribute" | "string_literal"
  attributeName?: string
  classification:
    | "translated"
    | "product_static_untranslated"
    | "excluded_data"
    | "excluded_code"
  reason?: string
}

function collectFiles(dir: string): string[] {
  const entries: string[] = []
  if (!dir) return entries
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const relPath = relative(root, fullPath)

      // Skip test files, test utils, and excluded admin directories
      if (
        entry.endsWith(".test.tsx") ||
        entry.endsWith(".test.ts") ||
        entry.endsWith(".spec.tsx") ||
        entry.endsWith(".spec.ts")
      ) {
        continue
      }
      if (relPath.includes("components/billing/admin")) {
        continue
      }

      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        entries.push(...collectFiles(fullPath))
      } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        entries.push(fullPath)
      }
    }
  } catch (e) {
    // Directory might not exist or error
  }
  return entries
}

function classifyString(
  text: string,
  context: StringCandidate["context"],
  attributeName?: string
): { classification: StringCandidate["classification"]; reason?: string } {
  const trimmed = text.trim()
  if (!trimmed) {
    return { classification: "excluded_code", reason: "empty_or_whitespace" }
  }

  // Check technical terms
  if (technicalTerms.has(trimmed)) {
    return {
      classification: "excluded_data",
      reason: "technical_acronym_or_brand",
    }
  }

  // Check data placeholders / numbers / URLs / IDs
  for (const pattern of dataPlaceholderPatterns) {
    if (pattern.test(trimmed)) {
      return { classification: "excluded_data", reason: "pattern_match_data" }
    }
  }

  // Check if it's purely punctuation or symbols
  if (/^[^\p{L}\p{N}]+$/u.test(trimmed)) {
    return { classification: "excluded_code", reason: "punctuation_or_symbol" }
  }

  // Check if it looks like code / CSS class / HTML attribute / object key
  if (
    trimmed.startsWith("bg-") ||
    trimmed.startsWith("text-") ||
    trimmed.startsWith("p-") ||
    trimmed.startsWith("m-") ||
    trimmed.startsWith("flex") ||
    trimmed.startsWith("grid") ||
    trimmed.startsWith("border") ||
    trimmed.startsWith("w-") ||
    trimmed.startsWith("h-") ||
    (trimmed.includes(" ") === false &&
      /^[a-z][a-zA-Z0-9_-]*$/.test(trimmed) &&
      context === "string_literal" &&
      !attributeName)
  ) {
    return { classification: "excluded_code", reason: "tailwind_or_identifier" }
  }

  // If it's a visible English word or phrase
  if (/[a-zA-Z]{2,}/.test(trimmed)) {
    return {
      classification: "product_static_untranslated",
      reason: "visible_english_text",
    }
  }

  return { classification: "excluded_data", reason: "unclassified_non_text" }
}

function auditFile(filePath: string): StringCandidate[] {
  const sourceCode = readFileSync(filePath, "utf-8")
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  )
  const relPath = relative(root, filePath)
  const candidates: StringCandidate[] = []

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile)
      const trimmed = text.trim()
      if (trimmed) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        )
        const { classification, reason } = classifyString(trimmed, "jsx_text")
        candidates.push({
          file: relPath,
          line: line + 1,
          character: character + 1,
          text: trimmed,
          context: "jsx_text",
          classification,
          reason,
        })
      }
    } else if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile)
      if (attributeNames.has(attrName) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          const text = node.initializer.text
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            node.initializer.getStart(sourceFile)
          )
          const { classification, reason } = classifyString(
            text,
            "jsx_attribute",
            attrName
          )
          candidates.push({
            file: relPath,
            line: line + 1,
            character: character + 1,
            text,
            context: "jsx_attribute",
            attributeName: attrName,
            classification,
            reason,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return candidates
}

function main() {
  const billingFiles = [
    ...collectFiles(routeRoot),
    ...collectFiles(componentRoot),
  ]
  const allCandidates: StringCandidate[] = []

  for (const file of billingFiles) {
    allCandidates.push(...auditFile(file))
  }

  const untranslated = allCandidates.filter(
    (c) => c.classification === "product_static_untranslated"
  )
  const dataExcluded = allCandidates.filter(
    (c) => c.classification === "excluded_data"
  )
  const codeExcluded = allCandidates.filter(
    (c) => c.classification === "excluded_code"
  )

  const summary = {
    timestamp: new Date().toISOString(),
    totalFilesAudited: billingFiles.length,
    totalCandidates: allCandidates.length,
    untranslatedCount: untranslated.length,
    dataExcludedCount: dataExcluded.length,
    codeExcludedCount: codeExcluded.length,
    untranslated: untranslated.map((u) => ({
      file: u.file,
      line: u.line,
      text: u.text,
      context: u.context,
      attribute: u.attributeName,
    })),
  }

  const outPath = join(root, "billing-console-ui-text-audit.json")
  writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf-8")

  console.log(`Audited ${billingFiles.length} billing files.`)
  console.log(
    `Found ${untranslated.length} untranslated product static strings.`
  )
  console.log(
    `Excluded ${dataExcluded.length} data strings and ${codeExcluded.length} code strings.`
  )
  console.log(`Results written to ${relative(root, outPath)}`)

  if (untranslated.length > 0) {
    console.log("\nTop 15 untranslated examples:")
    for (const item of untranslated.slice(0, 15)) {
      console.log(`  - [${item.file}:${item.line}] "${item.text}"`)
    }
  }
}

main()
