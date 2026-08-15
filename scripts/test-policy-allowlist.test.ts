import { describe, expect, test } from "bun:test"

import { TEST_POLICY_ALLOWLIST } from "./test-policy-allowlist"

describe("TEST_POLICY_ALLOWLIST", () => {
  test("every entry documents an owner, reason, and review date", () => {
    for (const entry of TEST_POLICY_ALLOWLIST) {
      expect(entry.owner).toMatch(/^@/)
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(entry.reviewAfter).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  test("has no duplicate path/token pairs", () => {
    const keys = TEST_POLICY_ALLOWLIST.map(
      (entry) => `${entry.path}:${entry.token}`
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})
