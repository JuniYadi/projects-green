const COVERAGE_THRESHOLD = 85

const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "")

const main = async () => {
  const passthroughArgs = process.argv.slice(2)

  const proc = Bun.spawn(
    [
      "bun",
      "test",
      "--coverage",
      "--coverage-reporter=text",
      "--coverage-reporter=lcov",
      ...passthroughArgs,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    }
  )

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (stdout) {
    process.stdout.write(stdout)
  }

  if (stderr) {
    process.stderr.write(stderr)
  }

  if (exitCode !== 0) {
    process.exit(exitCode)
  }

  const normalized = stripAnsi(`${stdout}\n${stderr}`)
  const summaryLine = normalized
    .split("\n")
    .find(
      (line) =>
        line.includes("All files") &&
        line.includes("|") &&
        !line.includes("% Funcs")
    )

  if (!summaryLine) {
    console.error("Could not parse coverage summary for 'All files'.")
    process.exit(1)
  }

  const columns = summaryLine
    .split("|")
    .map((column) => column.trim())
    .filter(Boolean)

  const functionCoverage = Number(columns[1])
  const lineCoverage = Number(columns[2])

  if (!Number.isFinite(functionCoverage) || !Number.isFinite(lineCoverage)) {
    console.error("Parsed coverage summary values are invalid.")
    process.exit(1)
  }

  const lcovFile = Bun.file("coverage/lcov.info")
  if (!(await lcovFile.exists())) {
    console.error("coverage/lcov.info was not generated.")
    process.exit(1)
  }

  console.log(
    `Coverage threshold check: functions ${functionCoverage.toFixed(2)}%, lines ${lineCoverage.toFixed(2)}%, minimum ${COVERAGE_THRESHOLD.toFixed(2)}%`
  )

  if (
    functionCoverage < COVERAGE_THRESHOLD ||
    lineCoverage < COVERAGE_THRESHOLD
  ) {
    console.error(
      `Coverage threshold failed: functions=${functionCoverage.toFixed(2)}%, lines=${lineCoverage.toFixed(2)}%, required>=${COVERAGE_THRESHOLD.toFixed(2)}%`
    )
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
