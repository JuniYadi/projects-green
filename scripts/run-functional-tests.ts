import { collectChangedFiles } from "./changed-files"
import { FEATURE_MAPPINGS, selectSmokeProjects } from "./test-suites"

const allProjects = [
  ...new Set(FEATURE_MAPPINGS.flatMap((mapping) => mapping.smokeProjects)),
].sort()
const runAll = process.argv.includes("--all")
const changedFiles = collectChangedFiles()
const selection = runAll
  ? { projects: allProjects, unmappedUiPaths: [] }
  : selectSmokeProjects(changedFiles)
const projects = new Set(selection.projects)
const unmappedUiPaths = selection.unmappedUiPaths

if (unmappedUiPaths.length > 0) {
  console.error("Unmapped UI feature paths:")
  for (const path of unmappedUiPaths) {
    console.error(`- ${path}`)
  }
  console.error(
    "Add a directory mapping and functional smoke project before merging."
  )
  process.exit(1)
}

if (projects.size === 0) {
  console.log("test:functional: no affected UI smoke projects")
  process.exit(0)
}

const args = [
  "x",
  "playwright",
  "test",
  ...[...projects].sort().map((project) => `--project=${project}`),
]
console.log(`test:functional: ${[...projects].sort().join(", ")}`)

const result = Bun.spawnSync(["bun", ...args], {
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})

process.exit(result.exitCode)
