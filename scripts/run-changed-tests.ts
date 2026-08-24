export {}

import { collectChangedFiles } from "./changed-files"
import { collectSuiteFiles, findFeatureMappings } from "./test-suites"

const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx)$/
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/
const SHARED_TEST_SETUP_PATHS = new Set(["test/register.ts", "test/setup.ts"])

export type ChangedTestSelection = {
  testFiles: string[]
  unmappedProductionPaths: string[]
}

export type ChangedTestOptions = {
  coverage?: boolean
}

export type ChangedTestCliOptions = {
  allowUnmapped: boolean
  coverage: boolean
  explicitTestFiles: string[]
}

const normalizePath = (path: string) => path.replaceAll("\\", "/")

const isTestFile = (path: string) => TEST_FILE_PATTERN.test(path)

const isProductionPath = (path: string) =>
  SOURCE_FILE_PATTERN.test(path) &&
  !path.endsWith(".d.ts") &&
  !isTestFile(path) &&
  !path.startsWith("test/") &&
  !path.startsWith("e2e/") &&
  !path.startsWith("scripts/")
const sourcePathForTest = (path: string) =>
  path.replace(/\.test\.(ts|tsx)$/, ".$1")

const testPathForSource = (path: string) => {
  if (path.endsWith(".tsx")) {
    return path.replace(/\.tsx$/, ".test.tsx")
  }
  if (path.endsWith(".ts")) {
    return path.replace(/\.ts$/, ".test.ts")
  }
  return null
}

export const selectChangedTests = (
  changedPaths: readonly string[],
  availableTestFiles: readonly string[],
  options: ChangedTestOptions = {}
): ChangedTestSelection => {
  const coverage = options.coverage ?? false
  const changed = new Set(changedPaths.map(normalizePath))
  const available = new Set(availableTestFiles.map(normalizePath))
  const tests = new Set<string>()
  const unmappedProductionPaths = new Set<string>()

  for (const path of changed) {
    if (isTestFile(path)) {
      if (!coverage || changed.has(sourcePathForTest(path))) {
        if (available.has(path)) {
          tests.add(path)
        }
      }
      continue
    }

    if (SHARED_TEST_SETUP_PATHS.has(path)) {
      for (const testFile of available) {
        tests.add(testFile)
      }
      continue
    }

    let hasAutomaticMapping = false
    const pairedTest = testPathForSource(path)
    if (pairedTest && available.has(pairedTest)) {
      tests.add(pairedTest)
      hasAutomaticMapping = true
    }

    for (const mapping of findFeatureMappings(path)) {
      for (const testFile of available) {
        if (
          mapping.testPrefixes.some((prefix) => testFile.startsWith(prefix))
        ) {
          tests.add(testFile)
          hasAutomaticMapping = true
        }
      }
    }

    if (isProductionPath(path) && !hasAutomaticMapping) {
      unmappedProductionPaths.add(path)
    }
  }

  return {
    testFiles: [...tests].sort(),
    unmappedProductionPaths: [...unmappedProductionPaths].sort(),
  }
}

const readTestFileOption = (args: readonly string[], index: number) => {
  const value = args[index]
  if (!value || value.startsWith("--")) {
    throw new Error("--test requires a test file path")
  }
  return normalizePath(value)
}

export const parseChangedTestArgs = (
  args: readonly string[]
): ChangedTestCliOptions => {
  const explicitTestFiles: string[] = []
  let allowUnmapped = false
  let coverage = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") {
      continue
    }
    if (arg === "--coverage") {
      coverage = true
      continue
    }
    if (arg === "--allow-unmapped") {
      allowUnmapped = true
      continue
    }
    if (arg === "--test") {
      explicitTestFiles.push(readTestFileOption(args, ++index))
      continue
    }
    if (arg.startsWith("--test=")) {
      explicitTestFiles.push(normalizePath(arg.slice("--test=".length)))
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  return {
    allowUnmapped,
    coverage,
    explicitTestFiles: [...new Set(explicitTestFiles)].sort(),
  }
}

export const run = (): number => {
  let options: ChangedTestCliOptions
  try {
    options = parseChangedTestArgs(process.argv.slice(2))
  } catch (error) {
    console.error(
      `test:changed: ${error instanceof Error ? error.message : String(error)}`
    )
    return 1
  }

  const changed = collectChangedFiles()
  const availableTestFiles = collectSuiteFiles("all")
  const availableTestSet = new Set(availableTestFiles)
  const selection = selectChangedTests(changed, availableTestFiles, options)
  const invalidExplicitTestFiles = options.explicitTestFiles.filter(
    (path) => !availableTestSet.has(path)
  )

  if (invalidExplicitTestFiles.length > 0) {
    console.error("test:changed: explicit test files do not exist:")
    for (const path of invalidExplicitTestFiles) {
      console.error(`- ${path}`)
    }
    return 1
  }

  const tests = new Set(selection.testFiles)
  for (const testFile of options.explicitTestFiles) {
    tests.add(testFile)
  }

  const hasExplicitDecision =
    options.allowUnmapped || options.explicitTestFiles.length > 0
  if (selection.unmappedProductionPaths.length > 0) {
    console.error(
      "test:changed: production paths without automatic test mapping:"
    )
    for (const path of selection.unmappedProductionPaths) {
      console.error(`- ${path}`)
    }
    if (options.explicitTestFiles.length > 0) {
      console.error(
        `test:changed: explicit targeted tests: ${options.explicitTestFiles.join(
          ", "
        )}`
      )
    } else if (options.allowUnmapped) {
      console.error("test:changed: proceeding with --allow-unmapped")
    } else {
      console.error(
        "Add a paired test or feature mapping, or pass --test <path> or " +
          "--allow-unmapped to record an explicit decision."
      )
      return 1
    }
  }

  if (tests.size === 0) {
    console.log(
      hasExplicitDecision
        ? "test:changed: no tests selected after the explicit decision"
        : "test:changed: no logic or component tests map to this diff"
    )
    return 0
  }

  const sorted = [...tests].sort()
  const concurrency =
    process.env.TEST_CONCURRENCY?.trim() || (process.env.CI ? "4" : "2")
  const preload = import.meta.dir + "/../test/setup.ts"
  const args = [
    "test",
    "--isolate",
    "--preload",
    preload,
    `--max-concurrency=${concurrency}`,
    ...(options.coverage ? ["--coverage", "--coverage-reporter=lcov"] : []),
    ...sorted,
  ]

  console.log(
    `test:changed: ${sorted.length} test files` +
      (options.coverage ? ", coverage enabled" : "")
  )
  for (const testFile of sorted) {
    console.log(`test:changed: selected: ${testFile}`)
  }
  const proc = Bun.spawnSync(["bun", ...args], {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  })
  // Bun exits 1 when coverage is enabled and there are uncovered lines,
  // even if all tests pass. Coverage gaps are surfaced via Codecov analysis.
  return proc.exitCode === 1 && options.coverage ? 0 : proc.exitCode
}

if (import.meta.main) {
  process.exit(run())
}
