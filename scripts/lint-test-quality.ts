/**
 * Scans test files for common AI-generated anti-patterns.
 * Run as part of CI to block low-quality tests.
 */

import { Glob } from "bun"

const ANTI_PATTERNS = [
  {
    id: "no-assertion",
    pattern: /it\(["'].*["'],\s*(async\s*)?\(\)\s*=>\s*{[^}]*}\s*\)/g,
    message:
      "Test has no assertions — it just runs code without checking results",
  },
  {
    id: "assert-not-null",
    pattern: /expect\([^)]+\)\.not\.toBe\(null\)/g,
    message: "Weak assertion: prefer toBeDefined() or assert specific values",
  },
  {
    id: "swallow-error",
    pattern: /try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{\s*\}/g,
    message: "Empty catch block swallows errors — test will always pass",
  },
  {
    id: "mock-everything",
    // Heuristic: more than 5 mock.module calls in a single describe block
    pattern:
      /describe\(["'].*["'],\s*(async\s*)?\(\)\s*=>\s*{((?!describe)[\s\S])*?mock\.module/g,
    message: "Heavy mocking detected — test may not validate real behavior",
  },
  {
    id: "snapshot-only",
    pattern: /expect\([^)]+\)\.toMatchInlineSnapshot\(\)/g,
    message:
      "Inline snapshot without assertions — snapshot tests alone don't catch regressions",
  },
]

const collectTestFiles = (): string[] => {
  const files: string[] = []
  for (const pattern of ["**/*.test.ts", "**/*.test.tsx"]) {
    for (const file of new Glob(pattern).scanSync(".")) {
      if (file.includes("node_modules") || file.includes(".next")) continue
      files.push(file)
    }
  }
  return files
}

const main = async () => {
  let issues = 0

  for (const file of collectTestFiles()) {
    const content = await Bun.file(file).text()

    for (const rule of ANTI_PATTERNS) {
      const matches = content.match(rule.pattern)
      if (matches) {
        console.log(
          `⚠️  ${file}: ${rule.message} (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`
        )
        issues++
      }
    }
  }

  if (issues > 0) {
    console.log(
      `\n❌ Found ${issues} test quality issue(s). Fix before merging.`
    )
    process.exit(1)
  }

  console.log("✅ Test quality check passed")
}

if (import.meta.main) {
  await main()
}
