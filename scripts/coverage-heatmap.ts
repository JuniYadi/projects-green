import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

interface FileCoverage {
  file: string
  module: string
  funcPct: number
  linePct: number
  uncoveredLines: string
}

const EXCLUDED_PATTERNS = ["whatsapp", "test/", "modules/deploy/"]

function isExcluded(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/")
  return EXCLUDED_PATTERNS.some((p) => normalized.includes(p))
}

function groupModule(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/")

  if (normalized.startsWith("lib/")) return "lib"
  if (normalized.startsWith("components/ui/")) return "components/ui"
  if (normalized.startsWith("components/")) return "components"
  if (normalized.startsWith("app/")) return "app"
  if (normalized.startsWith("modules/")) {
    const parts = normalized.split("/")
    return parts.slice(0, 3).join("/")
  }
  if (normalized.startsWith("hooks/")) return "hooks"
  if (normalized.startsWith("scripts/")) return "scripts"
  return "other"
}

function parseLcov(lcovPath: string): FileCoverage[] {
  const content = readFileSync(lcovPath, "utf-8")
  const records = content.split("end_of_record").filter(Boolean)
  const results: FileCoverage[] = []

  for (const rec of records) {
    const sfMatch = rec.match(/^SF:(.+)$/m)
    if (!sfMatch) continue
    const file = sfMatch[1].replace(/\\\\/g, "/").replace(/\\/g, "/")
    if (isExcluded(file)) continue

    const daLines = [...rec.matchAll(/^DA:(\d+),(\d+)$/gm)]
    const totalLines = daLines.length
    const hitLines = daLines.filter(([, , h]) => parseInt(h) > 0).length

    const fnfMatch = rec.match(/^FNF:(\d+)$/m)
    const fnhMatch = rec.match(/^FNH:(\d+)$/m)
    const totalFuncs = fnfMatch ? parseInt(fnfMatch[1]) : 0
    const hitFuncs = fnhMatch ? parseInt(fnhMatch[1]) : 0

    // Collect uncovered line numbers
    const uncovered: number[] = []
    for (const da of daLines) {
      const lineNum = parseInt(da[1])
      const hit = parseInt(da[2])
      if (hit === 0) uncovered.push(lineNum)
    }

    results.push({
      file,
      module: groupModule(file),
      funcPct: totalFuncs > 0 ? (hitFuncs / totalFuncs) * 100 : 100,
      linePct: totalLines > 0 ? (hitLines / totalLines) * 100 : 100,
      uncoveredLines: uncovered.length > 0 ? uncovered.join(",") : "",
    })
  }

  return results
}

function main() {
  const coverageDir = resolve(process.cwd(), "coverage")
  const lcovPath = resolve(coverageDir, "lcov.info")

  if (!existsSync(lcovPath)) {
    console.error("No coverage/lcov.info found. Run 'bun run test:coverage' first.")
    process.exit(1)
  }

  const files = parseLcov(lcovPath)

  // Group by module
  const byModule = new Map<string, FileCoverage[]>()
  for (const f of files) {
    const list = byModule.get(f.module) || []
    list.push(f)
    byModule.set(f.module, list)
  }

  // Sort modules by average line coverage (ascending - worst first)
  const sortedModules = [...byModule.entries()]
    .map(([mod, list]) => ({
      module: mod,
      avgLinePct: list.reduce((s, f) => s + f.linePct, 0) / list.length,
      avgFuncPct: list.reduce((s, f) => s + f.funcPct, 0) / list.length,
      files: list,
      totalFiles: list.length,
    }))
    .sort((a, b) => a.avgLinePct - b.avgLinePct)

  console.log("\n=== COVERAGE HEATMAP ===\n")
  console.log(
    `${"Module".padEnd(45)} ${"Files".padEnd(6)} ${"Func%".padEnd(8)} ${"Line%".padEnd(8)} Status`
  )
  console.log("-".repeat(80))

  for (const mod of sortedModules) {
    const status =
      mod.avgLinePct >= 95 ? "✅" : mod.avgLinePct >= 85 ? "⚠️" : "🔴"
    console.log(
      `${mod.module.padEnd(45)} ${String(mod.totalFiles).padEnd(6)} ${mod.avgFuncPct.toFixed(1).padEnd(8)} ${mod.avgLinePct.toFixed(1).padEnd(8)} ${status}`
    )
  }

  // Per-file detail for modules below threshold
  const THRESHOLD = parseInt(process.argv[2] || "95", 10)
  console.log(`\n\n=== FILES BELOW ${THRESHOLD}% LINE COVERAGE ===\n`)

  const below = files
    .filter((f) => f.linePct < THRESHOLD)
    .sort((a, b) => a.linePct - b.linePct)

  for (const f of below) {
    console.log(
      `${f.linePct.toFixed(1).padStart(6)}%  ${f.funcPct.toFixed(1).padStart(6)}%  ${f.file}`
    )
    if (f.uncoveredLines) {
      console.log(`       uncovered lines: ${f.uncoveredLines}`)
    }
  }

  console.log(
    `\nTotal files below ${THRESHOLD}%: ${below.length} / ${files.length}`
  )
  console.log(
    `Average: ${(files.reduce((s, f) => s + f.funcPct, 0) / files.length).toFixed(2)}% func, ${(files.reduce((s, f) => s + f.linePct, 0) / files.length).toFixed(2)}% line`
  )
}

main()
