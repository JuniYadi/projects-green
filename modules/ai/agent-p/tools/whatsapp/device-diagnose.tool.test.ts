import { describe, expect, it } from "bun:test"
import { deviceDiagnoseTool } from "./device-diagnose.tool"

describe("deviceDiagnoseTool", () => {
  it("has valid tool metadata", () => {
    expect(deviceDiagnoseTool.name).toBe("whatsapp.device.diagnose")
  })
})
