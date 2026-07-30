import { collectSuiteFiles } from "./test-suites"
import { TEST_POLICY_ALLOWLIST } from "./test-policy-allowlist"

const PROHIBITED = [
  "describe.skip",
  "test.skip",
  "it.skip",
  "describe.only",
  "test.only",
  "it.only",
] as const

const smokeTests = Array.from(
  new Bun.Glob("e2e/smoke/**/*.spec.ts").scanSync(".")
)
const files = [...collectSuiteFiles("logic"), ...smokeTests].sort()
let issueCount = 0

for (const path of files) {
  const content = await Bun.file(path).text()

  for (const token of PROHIBITED) {
    if (!content.includes(token)) {
      continue
    }

    const allowed = TEST_POLICY_ALLOWLIST.some((entry) => {
      return entry.path === path && entry.token === token
    })
    if (allowed) {
      continue
    }

    console.error(`${path}: prohibited ${token}`)
    issueCount++
  }
}

if (issueCount > 0) {
  console.error(
    `Test policy failed with ${issueCount} unconditional skip/only issue(s).`
  )
  process.exit(1)
}

console.log("Test policy passed")
