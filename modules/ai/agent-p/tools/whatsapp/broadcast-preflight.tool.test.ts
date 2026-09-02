import { describe, expect, it } from "bun:test"
import { broadcastPreflightTool } from "./broadcast-preflight.tool"

describe("broadcastPreflightTool", () => {
  it("has valid tool metadata", () => {
    expect(broadcastPreflightTool.name).toBe("whatsapp.broadcast.preflight")
  })
})
