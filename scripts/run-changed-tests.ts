export {}

import { collectChangedFiles } from "./changed-files"
import { collectSuiteFiles, findFeatureMappings } from "./test-suites"

const changed = new Set(collectChangedFiles())
const allLogicTests = collectSuiteFiles("logic")
const coverage = process.argv.includes("--coverage")

const tests = new Set<string>()
for (const path of changed) {
  if (path.endsWith(".test.ts")) {
    const sourcePath = path.replace(/\.test\.ts$/, ".ts")
    if (
      (await Bun.file(path).exists()) &&
      (!coverage || changed.has(sourcePath))
    ) {
      tests.add(path)
    }
    continue
  }
  if (path.endsWith(".tsx")) {
    const candidate = path.replace(/\.tsx$/, ".test.tsx")
    if (await Bun.file(candidate).exists()) {
      tests.add(candidate)
    }
    continue
  }

  if (path.endsWith(".ts")) {
    const candidate = path.replace(/\.ts$/, ".test.ts")
    if (await Bun.file(candidate).exists()) {
      tests.add(candidate)
    }
  }

  if (!coverage) {
    for (const mapping of findFeatureMappings(path)) {
      for (const testFile of allLogicTests) {
        if (
          mapping.testPrefixes.some((prefix) => testFile.startsWith(prefix))
        ) {
          tests.add(testFile)
        }
      }
    }
  }
}

if (changed.has("test/setup.ts")) {
  for (const testFile of allLogicTests) {
    tests.add(testFile)
  }
}

if (tests.size === 0) {
  console.log("test:changed: no logic tests map to this diff")
  process.exit(0)
}

const sorted = [...tests].sort()
const concurrency =
  process.env.TEST_CONCURRENCY?.trim() || (process.env.CI ? "8" : "2")
const preload = import.meta.dir + "/../test/setup.ts"
const args = [
  "test",
  "--isolate",
  "--preload",
  preload,
  `--max-concurrency=${concurrency}`,
  ...(coverage
    ? ["--coverage", "--coverage-reporter=text", "--coverage-reporter=lcov"]
    : []),
  ...sorted,
]

console.log(
  `test:changed: ${sorted.length} logic files` +
    (coverage ? ", coverage enabled" : "")
)
const proc = Bun.spawnSync(["bun", ...args], {
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})
// Bun exits 1 when coverage is enabled and there are uncovered lines,
// even if all tests pass. We only care about test pass/fail for the
// step exit code; coverage gaps are surfaced via codecov patch analysis.
process.exit(proc.exitCode === 1 && coverage ? 0 : proc.exitCode)
