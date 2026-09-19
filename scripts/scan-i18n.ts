import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join, relative, resolve } from "node:path"
import ts from "typescript"
import { collectChangedFiles } from "./changed-files"

export interface StringIssue {
  file: string
  line: number
  character: number
  text: string
  context: "jsx_text" | "jsx_attribute"
  attributeName?: string
}

export interface FileReport {
  file: string
  totalStrings: number
  hardcodedCount: number
  translatedCount: number
  coverage: number
  issues: StringIssue[]
}

export interface ScanReport {
  timestamp: string
  totalFiles: number
  totalStrings: number
  totalHardcoded: number
  totalTranslated: number
  overallCoverage: number
  files: FileReport[]
}

export interface ScanOptions {
  rootDir?: string
  targetPaths?: string[]
  changedFilesOnly?: boolean
  changedFilesList?: string[]
  failBelow?: number
  maxUntranslated?: number
  emitAnnotations?: boolean
  outputPath?: string
  markdownOutputPath?: string
}

const DEFAULT_TARGET_DIRS = ["app", "components", "modules"]

const TEXT_ATTRIBUTE_NAMES = new Set([
  "alt",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "description",
  "helperText",
  "label",
  "placeholder",
  "title",
  "tooltip",
])

const CODE_ATTRIBUTE_NAMES = new Set([
  "accept",
  "action",
  "activeDoc",
  "activeTab",
  "align",
  "aria-atomic",
  "aria-busy",
  "aria-checked",
  "aria-controls",
  "aria-current",
  "aria-describedby",
  "aria-disabled",
  "aria-expanded",
  "aria-haspopup",
  "aria-hidden",
  "aria-invalid",
  "aria-labelledby",
  "aria-live",
  "aria-modal",
  "aria-multiselectable",
  "aria-orientation",
  "aria-owns",
  "aria-pressed",
  "aria-readonly",
  "aria-relevant",
  "aria-required",
  "aria-selected",
  "asChild",
  "autoCapitalize",
  "autoComplete",
  "autoFocus",
  "calcMode",
  "class",
  "className",
  "clipRule",
  "collapsible",
  "colorInterpolationFilters",
  "country",
  "cx",
  "cy",
  "d",
  "data-state",
  "data-testid",
  "dataKey",
  "defaultTheme",
  "defaultValue",
  "diagnosticMode",
  "dir",
  "docKey",
  "dx",
  "dy",
  "environmentId",
  "fill",
  "fillRule",
  "filter",
  "filterUnits",
  "gradientTransform",
  "gradientUnits",
  "height",
  "href",
  "htmlFor",
  "id",
  "idPrefix",
  "imageClassName",
  "in",
  "in2",
  "inputMode",
  "key",
  "keySplines",
  "keyTimes",
  "loading",
  "markerHeight",
  "markerWidth",
  "mask",
  "maskColor",
  "maskContentUnits",
  "maskUnits",
  "memLimit",
  "method",
  "mode",
  "name",
  "operator",
  "orient",
  "orientation",
  "pattern",
  "patternUnits",
  "persistence",
  "points",
  "preload",
  "preserveAspectRatio",
  "purpose",
  "r",
  "rel",
  "resource",
  "result",
  "role",
  "rootSegment",
  "rx",
  "ry",
  "sandbox",
  "scope",
  "side",
  "size",
  "spellCheck",
  "spreadMethod",
  "src",
  "stackId",
  "stdDeviation",
  "step",
  "strategy",
  "stroke",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeWidth",
  "style",
  "surface",
  "tabIndex",
  "tableId",
  "target",
  "testIdPrefix",
  "textAnchor",
  "tone",
  "transform",
  "type",
  "unit",
  "value",
  "values",
  "variant",
  "vectorEffect",
  "viewBox",
  "weight",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
])

const TECHNICAL_TERMS = new Set([
  "API",
  "APP",
  "ASTRO",
  "BUN",
  "CPU",
  "CSV",
  "CURL",
  "DELETE",
  "DENO",
  "DJANGO",
  "DNS",
  "DOCKER",
  "DOCKERFILE",
  "DOM",
  "ERR",
  "ESC",
  "EXPRESS",
  "FASTAPI",
  "FLASK",
  "GB",
  "GET",
  "GHZ",
  "GIT",
  "GITHUB",
  "GOLANG",
  "GRAFANA",
  "HEAD",
  "HTML",
  "HTTP",
  "HTTPS",
  "ID",
  "IDR",
  "IP",
  "JAVA",
  "JSON",
  "KB",
  "KUBERNETES",
  "LARAVEL",
  "MB",
  "META",
  "MI",
  "MONGODB",
  "MS",
  "MYSQL",
  "NESTJS",
  "NEXTJS",
  "NGINX",
  "NODEJS",
  "NUXT",
  "OPTIONS",
  "OTP",
  "PATCH",
  "PDF",
  "PFN",
  "PFNAPP",
  "PGN",
  "PHP",
  "PID",
  "PNG",
  "POST",
  "POSTGRES",
  "POSTGRESQL",
  "PPN",
  "PROMETHEUS",
  "PUT",
  "PYTHON",
  "QRIS",
  "RAILS",
  "RAM",
  "REACT",
  "REDIS",
  "REMIX",
  "REQ",
  "REST",
  "RP",
  "RPM",
  "RUBY",
  "RUST",
  "SDK",
  "SINATRA",
  "SPRING BOOT",
  "SQL",
  "SSH",
  "SSL",
  "SVELTE",
  "SVG",
  "TB",
  "TLS",
  "TRAEFIK",
  "UI",
  "URL",
  "USD",
  "UTC",
  "UUID",
  "UX",
  "VA",
  "VCPU",
  "VPN",
  "VUE",
  "WA",
  "WEBHOOK",
  "WHATSAPP",
  "WIREGUARD",
  "XML",
  "YAML",
])

const DATA_PATTERNS = [
  /^[0-9\s.,/:-]+$/,
  /^(https?:\/\/|\/|#)/,
  /^[a-z0-9_-]+@[a-z0-9_-]+\.[a-z0-9_-]+$/i,
  /^[A-Z0-9_-]{4,}$/,
  /^\+?[0-9\s-]{6,}$/,
  /^INV-[A-Z0-9-]+$/i,
  /^SUB-[A-Z0-9-]+$/i,
  /^ORD-[A-Z0-9-]+$/i,
  /^TX-[A-Z0-9-]+$/i,
  /^[a-z0-9_.-]+\.[a-z]{2,}$/i,
  /^\(?[0-9\s.,/:-]+\s*(MB|GB|TB|KB|%|ms|s|m|h|d|mo|yr|px|rem|em|req|err|RPM|MiB)\)?$/i,
  /^[1-5]xx:?$/i,
  /^[A-Za-z0-9_-]{1,6}:$/,
  /^\(?@?[A-Z0-9_-]{1,4}\)?$/,
]

export function isHumanReadableText(
  text: string,
  context: "jsx_text" | "jsx_attribute",
  attributeName?: string
): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 2) return false

  if (/^&[a-z]+;$/i.test(trimmed)) return false
  if (/^[^\p{L}\p{N}]+$/u.test(trimmed)) return false

  const upper = trimmed.toUpperCase()
  if (TECHNICAL_TERMS.has(upper)) return false

  for (const pattern of DATA_PATTERNS) {
    if (pattern.test(trimmed)) {
      if (
        context === "jsx_attribute" &&
        attributeName &&
        TEXT_ATTRIBUTE_NAMES.has(attributeName) &&
        /[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(trimmed)
      ) {
        return true
      }
      return false
    }
  }

  if (
    trimmed.startsWith("bg-") ||
    trimmed.startsWith("text-") ||
    trimmed.startsWith("p-") ||
    trimmed.startsWith("m-") ||
    trimmed.startsWith("flex") ||
    trimmed.startsWith("grid") ||
    trimmed.startsWith("border") ||
    trimmed.startsWith("w-") ||
    trimmed.startsWith("h-")
  ) {
    return false
  }

  return /\p{L}{2,}/u.test(trimmed)
}

function collectSourceFiles(dir: string, root: string): string[] {
  const files: string[] = []
  if (!existsSync(dir)) return files

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const relPath = relative(root, fullPath)

      if (
        entry.startsWith(".") ||
        entry.endsWith(".test.tsx") ||
        entry.endsWith(".test.ts") ||
        entry.endsWith(".spec.tsx") ||
        entry.endsWith(".spec.ts") ||
        entry.endsWith(".d.ts")
      ) {
        continue
      }

      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        files.push(...collectSourceFiles(fullPath, root))
      } else if (entry.endsWith(".tsx") || entry.endsWith(".jsx")) {
        files.push(relPath)
      }
    }
  } catch {
    // Ignore unreadable directory
  }

  return files
}

export function scanSourceFile(filePath: string, rootDir: string): FileReport {
  const fullPath = resolve(rootDir, filePath)
  const sourceCode = readFileSync(fullPath, "utf-8")
  const sourceFile = ts.createSourceFile(
    fullPath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  const issues: StringIssue[] = []
  let translatedCount = 0
  let hardcodedCount = 0

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile)
      const trimmed = text.trim()
      if (trimmed && isHumanReadableText(trimmed, "jsx_text")) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        )
        issues.push({
          file: filePath,
          line: line + 1,
          character: character + 1,
          text: trimmed,
          context: "jsx_text",
        })
        hardcodedCount++
      }
    }

    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile)
      if (
        !attrName.startsWith("data-") &&
        !CODE_ATTRIBUTE_NAMES.has(attrName) &&
        (TEXT_ATTRIBUTE_NAMES.has(attrName) || !attrName.startsWith("on"))
      ) {
        if (node.initializer && ts.isStringLiteral(node.initializer)) {
          const text = node.initializer.text
          if (isHumanReadableText(text, "jsx_attribute", attrName)) {
            const { line, character } =
              sourceFile.getLineAndCharacterOfPosition(
                node.initializer.getStart(sourceFile)
              )
            issues.push({
              file: filePath,
              line: line + 1,
              character: character + 1,
              text,
              context: "jsx_attribute",
              attributeName: attrName,
            })
            hardcodedCount++
          }
        }
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const exprText = node.expression.getText(sourceFile)
      if (
        exprText === "messages" ||
        exprText === "dict" ||
        exprText === "m" ||
        exprText === "t" ||
        exprText.endsWith("Messages")
      ) {
        translatedCount++
      }
    } else if (ts.isCallExpression(node)) {
      const calleeText = node.expression.getText(sourceFile)
      if (
        calleeText === "getMessages" ||
        calleeText === "getMessagesForMaybeLocale" ||
        calleeText === "getWhatsAppText" ||
        calleeText === "formatWhatsAppText" ||
        calleeText === "t" ||
        calleeText === "formatMessage" ||
        calleeText === "useTranslations"
      ) {
        translatedCount++
      }
    } else if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? node.openingElement.tagName.getText(sourceFile)
        : node.tagName.getText(sourceFile)
      if (
        tagName === "WhatsAppText" ||
        tagName === "FormattedMessage" ||
        tagName === "Trans"
      ) {
        translatedCount++
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  const totalStrings = hardcodedCount + translatedCount
  const coverage =
    totalStrings === 0
      ? 100
      : Number(((translatedCount / totalStrings) * 100).toFixed(1))

  return {
    file: filePath,
    totalStrings,
    hardcodedCount,
    translatedCount,
    coverage,
    issues,
  }
}

export function scanCodebase(options: ScanOptions = {}): ScanReport {
  const rootDir = options.rootDir || process.cwd()
  let filePaths: string[] = []

  if (options.changedFilesOnly) {
    const changed = collectChangedFiles()
    filePaths = changed.filter(
      (f) =>
        (f.endsWith(".tsx") || f.endsWith(".jsx")) &&
        !f.includes(".test.") &&
        !f.includes(".spec.") &&
        existsSync(resolve(rootDir, f))
    )
  } else if (options.changedFilesList && options.changedFilesList.length > 0) {
    filePaths = options.changedFilesList.filter(
      (f) =>
        (f.endsWith(".tsx") || f.endsWith(".jsx")) &&
        !f.includes(".test.") &&
        !f.includes(".spec.") &&
        existsSync(resolve(rootDir, f))
    )
  } else {
    const targetDirs = options.targetPaths || DEFAULT_TARGET_DIRS
    for (const dir of targetDirs) {
      filePaths.push(...collectSourceFiles(resolve(rootDir, dir), rootDir))
    }
  }

  filePaths = Array.from(new Set(filePaths))

  const fileReports: FileReport[] = []
  let globalHardcoded = 0
  let globalTranslated = 0

  for (const filePath of filePaths) {
    const report = scanSourceFile(filePath, rootDir)
    fileReports.push(report)
    globalHardcoded += report.hardcodedCount
    globalTranslated += report.translatedCount
  }

  const totalStrings = globalHardcoded + globalTranslated
  const overallCoverage =
    totalStrings === 0
      ? 100
      : Number(((globalTranslated / totalStrings) * 100).toFixed(1))

  fileReports.sort((a, b) => {
    if (a.coverage !== b.coverage) return a.coverage - b.coverage
    return b.hardcodedCount - a.hardcodedCount
  })

  return {
    timestamp: new Date().toISOString(),
    totalFiles: fileReports.length,
    totalStrings,
    totalHardcoded: globalHardcoded,
    totalTranslated: globalTranslated,
    overallCoverage,
    files: fileReports,
  }
}

export function generateMarkdownSummary(report: ScanReport): string {
  const offenders = report.files.filter((f) => f.hardcodedCount > 0)
  const topOffenders = offenders.slice(0, 20)

  let tableRows = topOffenders
    .map((f) => {
      const statusIcon = f.coverage >= 80 ? "🟡" : "🔴"
      return `| \`${f.file}\` | ${statusIcon} ${f.coverage}% | ${f.hardcodedCount} | ${f.translatedCount} |`
    })
    .join("\n")

  if (topOffenders.length === 0) {
    tableRows = "| *All scanned files are 100% translated!* | 🟢 100% | 0 | - |"
  }

  const coverageBadge =
    report.overallCoverage >= 90
      ? "🟢 Excellent"
      : report.overallCoverage >= 70
        ? "🟡 Needs Improvement"
        : "🔴 Low Coverage"

  return `## 🌐 i18n Translation & Coverage Report

| Overall Coverage | Status | Untranslated Strings | Translated Nodes | Scanned Files |
| :---: | :---: | :---: | :---: | :---: |
| **${report.overallCoverage}%** | ${coverageBadge} | **${report.totalHardcoded}** | **${report.totalTranslated}** | **${report.totalFiles}** |

<details open>
<summary>📋 <b>Files with Untranslated Text (${offenders.length} file${offenders.length === 1 ? "" : "s"} found${offenders.length > 20 ? ", top 20 shown" : ""})</b></summary>

| File | Coverage | Hardcoded | Translated |
| :--- | :---: | :---: | :---: |
${tableRows}

</details>

${
  offenders.length > 0
    ? `> 💡 **Tip**: Use \`const messages = getMessages(locale)\` and reference dictionary tokens from \`lib/i18n/messages/\` to replace hardcoded strings.`
    : `> 🎉 **Great job!** No untranslated UI text detected in scanned files.`
}

*Report generated by \`scripts/scan-i18n.ts\`*
`
}

export function emitGitHubAnnotations(report: ScanReport): void {
  for (const file of report.files) {
    for (const issue of file.issues) {
      const msg = issue.attributeName
        ? `Hardcoded prop '${issue.attributeName}': "${issue.text}"`
        : `Hardcoded JSX text: "${issue.text}"`
      console.log(
        `::warning file=${issue.file},line=${issue.line},col=${issue.character},title=Untranslated i18n Text::${msg}`
      )
    }
  }
}

export function runCLI(): void {
  const args = process.argv.slice(2)
  const options: ScanOptions = {}

  let outputPath = "i18n-report.json"
  let markdownPath: string | null = null
  let format = "summary"
  let failBelow: number | null = null
  let maxUntranslated: number | null = null
  let emitAnnotations = process.env.GITHUB_ACTIONS === "true"

  for (const arg of args) {
    if (arg.startsWith("--output=")) {
      outputPath = arg.split("=")[1]
    } else if (arg.startsWith("--markdown-output=")) {
      markdownPath = arg.split("=")[1]
    } else if (arg.startsWith("--format=")) {
      format = arg.split("=")[1]
    } else if (arg.startsWith("--fail-below=")) {
      failBelow = Number(arg.split("=")[1])
    } else if (arg.startsWith("--max-untranslated=")) {
      maxUntranslated = Number(arg.split("=")[1])
    } else if (arg.startsWith("--paths=")) {
      options.targetPaths = arg
        .split("=")[1]
        .split(",")
        .map((p) => p.trim())
    } else if (arg === "--changed-only") {
      options.changedFilesOnly = true
    } else if (arg === "--annotations") {
      emitAnnotations = true
    } else if (arg === "--no-annotations") {
      emitAnnotations = false
    }
  }

  const report = scanCodebase(options)

  if (outputPath) {
    writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8")
  }

  const markdown = generateMarkdownSummary(report)
  if (markdownPath) {
    writeFileSync(markdownPath, markdown, "utf-8")
  }

  if (emitAnnotations) {
    emitGitHubAnnotations(report)
  }

  if (format === "json") {
    console.log(JSON.stringify(report, null, 2))
  } else if (format === "markdown") {
    console.log(markdown)
  } else {
    console.log("\n==========================================")
    console.log("       i18n Codebase Scan Report          ")
    console.log("==========================================")
    console.log(`Scanned files       : ${report.totalFiles}`)
    console.log(`Overall Coverage    : ${report.overallCoverage}%`)
    console.log(`Total Translated    : ${report.totalTranslated}`)
    console.log(`Total Hardcoded     : ${report.totalHardcoded}`)
    console.log(`Output Report JSON  : ${outputPath}`)
    if (markdownPath) {
      console.log(`Output Markdown     : ${markdownPath}`)
    }
    console.log("==========================================\n")

    const offenders = report.files.filter((f) => f.hardcodedCount > 0)
    if (offenders.length > 0) {
      console.log(`Found ${offenders.length} files with untranslated strings:`)
      for (const f of offenders.slice(0, 10)) {
        console.log(
          `  - [${f.coverage}%] ${f.file} (${f.hardcodedCount} strings)`
        )
      }
      if (offenders.length > 10) {
        console.log(`  ... and ${offenders.length - 10} more files.`)
      }
      console.log("")
    }
  }

  if (failBelow !== null && report.overallCoverage < failBelow) {
    console.error(
      `❌ Error: Overall i18n coverage (${report.overallCoverage}%) is below the required threshold of ${failBelow}%.`
    )
    process.exit(1)
  }

  if (maxUntranslated !== null && report.totalHardcoded > maxUntranslated) {
    console.error(
      `❌ Error: Total untranslated strings (${report.totalHardcoded}) exceeds maximum allowed (${maxUntranslated}).`
    )
    process.exit(1)
  }
}

if (import.meta.main) {
  runCLI()
}
