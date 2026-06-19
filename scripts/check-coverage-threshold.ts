import { Glob } from "bun"

const COVERAGE_THRESHOLD = 90
const LINE_THRESHOLD = 90

const EXCLUDED_DIR_PATTERNS = ["whatsapp", "test/", "modules/deploy/"]

export const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, "")

const isExcludedTestFile = (filePath: string): boolean =>
  EXCLUDED_DIR_PATTERNS.some((pattern) => filePath.includes(pattern))

export const collectTestFiles = (): string[] => {
  const files: string[] = []
  for (const pattern of ["**/*.test.ts", "**/*.test.tsx"]) {
    const glob = new Glob(pattern)
    for (const f of glob.scanSync(".")) {
      files.push(f.replace(/\\/g, "/"))
    }
  }
  return files.filter((f) => !isExcludedTestFile(f))
}

export const streamAndCollect = async (
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void
) => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    const chunk = decoder.decode(value, { stream: true })
    output += chunk
    onChunk(chunk)
  }

  const tail = decoder.decode()
  if (tail) {
    output += tail
    onChunk(tail)
  }

  return output
}

export const collectCoverageSummary = (output: string) => {
  const normalized = stripAnsi(output)
  const lines = normalized.split("\n")

  let totalFunctions = 0
  let totalLines = 0
  let fileCount = 0

  for (const line of lines) {
    if (
      line.includes("|") &&
      !line.includes("% Funcs") &&
      line.includes("All files") === false
    ) {
      const columns = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
      if (columns.length >= 3) {
        const funcCov = Number(columns[1])
        const lineCov = Number(columns[2])
        const filename = columns[0]

        if (
          filename.includes("whatsapp") ||
          filename.includes("test/") ||
          filename.includes("modules/deploy/")
        ) {
          continue
        }

        if (Number.isFinite(funcCov) && Number.isFinite(lineCov)) {
          totalFunctions += funcCov
          totalLines += lineCov
          fileCount++
        }
      }
    }
  }

  return {
    functionCoverage: fileCount > 0 ? totalFunctions / fileCount : 0,
    lineCoverage: fileCount > 0 ? totalLines / fileCount : 0,
    fileCount,
  }
}

const main = async () => {
  const passthroughArgs = process.argv.slice(2)

  // Collect test files, excluding directories not counted in coverage
  // to reduce memory pressure on CI runners (single-process coverage mode)
  const testFiles = collectTestFiles()

  const proc = Bun.spawn(
    [
      "bun",
      "test",
      "--coverage",
      "--coverage-reporter=text",
      "--coverage-reporter=lcov",
      ...testFiles,
      ...passthroughArgs,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    }
  )

  const [stdout, stderr, exitCode] = await Promise.all([
    streamAndCollect(proc.stdout, (chunk) => {
      process.stdout.write(chunk)
    }),
    streamAndCollect(proc.stderr, (chunk) => {
      process.stderr.write(chunk)
    }),
    proc.exited,
  ])

  if (exitCode !== 0) {
    console.warn(`Note: Test suite had failures (exit code ${exitCode})`)
  }

  const { functionCoverage, lineCoverage } = collectCoverageSummary(
    `${stdout}\n${stderr}`
  )

  console.log(
    `\nCoverage (excluding whatsapp/test/deploy): functions ${functionCoverage.toFixed(2)}%, lines ${lineCoverage.toFixed(2)}%`
  )

  // Base threshold - fail if below this
  const BASE_THRESHOLD = 80

  if (functionCoverage < COVERAGE_THRESHOLD || lineCoverage < LINE_THRESHOLD) {
    console.error(
      `Coverage below target: functions=${functionCoverage.toFixed(2)}%, lines=${lineCoverage.toFixed(2)}%`
    )
    // Only fail if below base threshold
    if (functionCoverage < BASE_THRESHOLD || lineCoverage < BASE_THRESHOLD) {
      process.exit(1)
    }
    console.warn("Below target but above base - continuing.")
  }

  // At the end, exit with test failure if tests failed
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
