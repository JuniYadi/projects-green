import { collectSuiteFiles, type TestSuiteName } from "./test-suites"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

const suite = process.argv[2] as TestSuiteName | undefined
const coverage = process.argv.includes("--coverage")
const passthroughArgs = process.argv.slice(3).filter((arg) => {
  return arg !== "--coverage"
})

if (!suite || !["logic", "component", "all"].includes(suite)) {
  console.error("Usage: run-test-suite.ts <logic|component|all> [--coverage]")
  process.exit(1)
}

const testFiles = collectSuiteFiles(suite)
const concurrency =
  process.env.TEST_CONCURRENCY?.trim() || (process.env.CI ? "4" : "2")
const preload = import.meta.dir + "/../test/setup.ts"
if (coverage) {
  mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true })
}

const args = [
  "test",
  "--isolate",
  "--preload",
  preload,
  `--max-concurrency=${concurrency}`,
  "--path-ignore-patterns=**/*.e2e.test.ts",
  "--path-ignore-patterns=**/e2e/**",
  "--path-ignore-patterns=**/integration/**",
  ...(suite === "logic" ? ["--path-ignore-patterns=**/*.test.tsx"] : []),
  ...(coverage ? ["--coverage", "--coverage-reporter=lcov"] : []),
  ...testFiles,
  ...passthroughArgs,
]

console.log(
  `test:${suite}: ${testFiles.length} files, concurrency ${concurrency}` +
    (coverage ? ", coverage enabled" : "")
)

const processResult = Bun.spawnSync(["bun", ...args], {
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})

// Bun exits 1 when coverage is enabled and there are uncovered lines/functions,
// even if all tests pass. If tests ran successfully (processResult.success),
// exit 0 so Codecov can analyze coverage gaps without aborting CI.
const exitCode =
  processResult.success && processResult.exitCode === 1 && coverage
    ? 0
    : processResult.exitCode
process.exit(exitCode)
