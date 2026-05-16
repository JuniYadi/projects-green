import { describe, expect, test } from "bun:test"

import { withOwnershipLock } from "@/modules/tenants/services/tenant-ownership-lock"

describe("withOwnershipLock", () => {
  test("serializes concurrent calls for the same organization", async () => {
    const events: string[] = []

    const taskA = withOwnershipLock("org-1", async () => {
      events.push("A-start")
      await new Promise((r) => setTimeout(r, 50))
      events.push("A-end")
      return "A"
    })

    const taskB = withOwnershipLock("org-1", async () => {
      events.push("B-start")
      await new Promise((r) => setTimeout(r, 10))
      events.push("B-end")
      return "B"
    })

    const [resultA, resultB] = await Promise.all([taskA, taskB])

    expect(resultA).toBe("A")
    expect(resultB).toBe("B")
    // B must not start until A finishes
    expect(events).toEqual(["A-start", "A-end", "B-start", "B-end"])
  })

  test("allows concurrent calls for different organizations", async () => {
    const events: string[] = []

    const taskA = withOwnershipLock("org-1", async () => {
      events.push("A-start")
      await new Promise((r) => setTimeout(r, 50))
      events.push("A-end")
      return "A"
    })

    const taskC = withOwnershipLock("org-2", async () => {
      events.push("C-start")
      await new Promise((r) => setTimeout(r, 10))
      events.push("C-end")
      return "C"
    })

    const [resultA, resultC] = await Promise.all([taskA, taskC])

    expect(resultA).toBe("A")
    expect(resultC).toBe("C")
    // Both should start before either finishes (parallel for different orgs)
    expect(events.indexOf("A-start")).toBeLessThan(events.indexOf("A-end"))
    expect(events.indexOf("C-start")).toBeLessThan(events.indexOf("C-end"))
    // C should start before A ends (they run in parallel)
    expect(events.indexOf("C-start")).toBeLessThan(events.indexOf("A-end"))
  })

  test("releases lock even when fn throws", async () => {
    const events: string[] = []

    const taskA = withOwnershipLock("org-err", async () => {
      events.push("A-start")
      throw new Error("boom")
    }).catch(() => {
      events.push("A-caught")
    })

    const taskB = withOwnershipLock("org-err", async () => {
      events.push("B-start")
      events.push("B-end")
      return "B"
    })

    await Promise.all([taskA, taskB])

    // B must still run after A's error — the lock is released correctly.
    // Note: the .catch() microtask may be scheduled after the lock
    // releases and B starts, so we verify ordering structurally.
    expect(events).toContain("A-start")
    expect(events).toContain("B-start")
    expect(events).toContain("B-end")
    expect(events.indexOf("A-start")).toBeLessThan(events.indexOf("B-start"))
    expect(events.indexOf("B-start")).toBeLessThan(events.indexOf("B-end"))
  })
})
