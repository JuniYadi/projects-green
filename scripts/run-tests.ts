// Runs bun test with an absolute preload path so --isolate workers
// never fail from a CWD mismatch.

const preload = import.meta.dir + "/../test/setup.ts"
const args = [
  "test",
  "--isolate",
  "--preload",
  preload,
  "--path-ignore-patterns=**/*.e2e.test.ts",
  "--path-ignore-patterns=e2e/**",
  ...process.argv.slice(2),
]

const proc = Bun.spawnSync(["bun", ...args], {
  stdout: "inherit",
  stderr: "inherit",
})

process.exit(proc.exitCode)
