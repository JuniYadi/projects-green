import { describe, expect, it } from "bun:test"
import type { AgentPTool } from "./types"

describe("AgentP types", () => {
  it("exports types", () => {
    const dummy: Partial<AgentPTool<unknown, unknown>> = { name: "test" }
    expect(dummy.name).toBe("test")
  })
})
