export {}

// Runs bun test scoped to files changed vs origin/main (or main fallback),
// mapping each changed *.ts(x) to its co-located *.test.ts(x) when present.

const base = (() => {
  const candidates = ["origin/main", "main"]
  for (const ref of candidates) {
    const probe = Bun.spawnSync(["git", "rev-parse", "--verify", ref], {
      stderr: "ignore",
    })
    if (probe.exitCode === 0) return ref
  }
  return null
})()

if (!base) {
  console.error("run-changed-tests: no origin/main or main ref found")
  process.exit(1)
}

const diff = Bun.spawnSync(["git", "diff", "--name-only", `${base}...HEAD`], {
  stdout: "pipe",
})
if (diff.exitCode !== 0) {
  console.error(`run-changed-tests: git diff ${base}...HEAD failed`)
  process.exit(1)
}

const changed = new Set(
  diff.stdout
    .toString()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
)

// Static table mapping .ts/.tsx to candidate .test.* suffixes.
const TEST_EXTENSIONS: Record<string, readonly string[]> = {
  ts: ["test.ts"],
  tsx: ["test.tsx"],
}

const tests = new Set<string>()
for (const path of changed) {
  if (/\.test\.(ts|tsx)$/.test(path)) {
    tests.add(path)
    continue
  }
  const m = path.match(/\.(ts|tsx)$/)
  if (!m) continue
  const ext = m[1]
  for (const suffix of TEST_EXTENSIONS[ext] ?? []) {
    const candidate = path.replace(/\.(ts|tsx)$/, `.${suffix}`)
    if (await Bun.file(candidate).exists()) tests.add(candidate)
  }
}

if (changed.has("test/setup.ts")) {
  console.warn(
    "run-changed-tests: test/setup.ts changed; preload is global — verify CI separately."
  )
}

if (tests.size === 0) {
  console.log("run-changed-tests: no *.test.ts(x) files map to this diff")
  process.exit(0)
}

const sorted = [...tests].sort()
console.log(`run-changed-tests: ${sorted.join(", ")}`)
const proc = Bun.spawnSync(["bun", "run", "scripts/run-tests.ts", ...sorted], {
  stdout: "inherit",
  stderr: "inherit",
})
process.exit(proc.exitCode)
