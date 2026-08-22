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
  process.env.TEST_CONCURRENCY?.trim() || (process.env.CI ? "8" : "2")
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
  ...(coverage ? ["--only-failures"] : []),
  "--path-ignore-patterns=**/*.e2e.test.ts",
  "--path-ignore-patterns=**/e2e/**",
  "--path-ignore-patterns=**/integration/**",
  ...(suite === "logic" ? ["--path-ignore-patterns=**/*.test.tsx"] : []),
  ...(coverage
    ? ["--coverage", "--coverage-reporter=text", "--coverage-reporter=lcov"]
    : []),
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

process.exit(processResult.exitCode)
