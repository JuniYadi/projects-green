import { NIGHTLY_QUARANTINE } from "./nightly-quarantine"
import { FEATURE_MAPPINGS } from "./test-suites"

type NightlyCommand = {
  name: string
  command: string[]
}

const smokeProjects = [
  ...new Set(FEATURE_MAPPINGS.flatMap((mapping) => mapping.smokeProjects)),
].sort()

const commands: NightlyCommand[] = [
  {
    name: "logic",
    command: ["bun", "run", "test"],
  },
  {
    name: "component",
    command: ["bun", "run", "test:component"],
  },
  {
    name: "functional-smoke-and-legacy-public",
    command: [
      "bun",
      "x",
      "playwright",
      "test",
      ...smokeProjects.map((project) => `--project=${project}`),
      "--project=public",
    ],
  },
]

const failures: string[] = []

for (const suite of commands) {
  console.log(`nightly: starting ${suite.name}`)
  const result = Bun.spawnSync(suite.command, {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  })

  if (result.exitCode === 0) {
    console.log(`nightly: passed ${suite.name}`)
    continue
  }

  failures.push(suite.name)
  console.error(`nightly: failed ${suite.name}`)

  for (const entry of NIGHTLY_QUARANTINE.filter(
    (candidate) => candidate.suite === suite.name
  )) {
    console.error(
      `nightly: quarantine owner=${entry.owner} ` +
        `reviewAfter=${entry.reviewAfter} reason=${entry.reason}`
    )
  }
}

if (failures.length > 0) {
  console.error(`nightly: failed suites: ${failures.join(", ")}`)
  process.exit(1)
}

console.log("nightly: all suites passed")
