import { beforeEach, describe, expect, it, mock } from "bun:test"
import { deviceDiagnoseTool } from "./device-diagnose.tool"
import type { AgentPContext } from "../../types"

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("deviceDiagnoseTool", () => {
  beforeEach(() => {
    mockPrisma.whatsappDevice.findFirst.mockReset()
  })

  it("has valid tool metadata", () => {
    expect(deviceDiagnoseTool.name).toBe("whatsapp.device.diagnose")
  })

  it("diagnoses an active connected device", async () => {
    mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
      id: "dev-1",
      status: "ACTIVE",
      phoneNumber: "+62812345678",
      lastHeartbeatAt: new Date("2026-09-02T10:00:00Z"),
    })

    const result = await deviceDiagnoseTool.execute(
      { deviceId: "dev-1" },
      context
    )
    expect(result).toEqual({
      deviceId: "dev-1",
      status: "ACTIVE",
      phoneNumber: "+62812345678",
      connected: true,
      lastHeartbeatAt: "2026-09-02T10:00:00.000Z",
      checks: ["device-status-ok"],
    })
  })

  it("diagnoses a disconnected device", async () => {
    mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
      id: "dev-2",
      status: "DISCONNECTED",
      phoneNumber: "+62812345678",
      lastHeartbeatAt: null,
    })

    const result = await deviceDiagnoseTool.execute(
      { deviceId: "dev-2" },
      context
    )
    expect(result.connected).toBe(false)
    expect(result.checks).toEqual(["device-disconnected"])
  })

  it("throws when device not found in organization", async () => {
    mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce(null)
    await expect(
      deviceDiagnoseTool.execute({ deviceId: "dev-none" }, context)
    ).rejects.toThrow("DEVICE_NOT_FOUND")
  })
  it("diagnoses a device using phoneNumber", async () => {
    mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
      id: "dev-phone-1",
      status: "ACTIVE",
      phoneNumber: "+6283138855774",
      lastHeartbeatAt: new Date("2026-09-11T05:00:00Z"),
    })

    const result = await deviceDiagnoseTool.execute(
      { phoneNumber: "+6283138855774" },
      context
    )
    expect(result.deviceId).toBe("dev-phone-1")
    expect(result.phoneNumber).toBe("+6283138855774")
    expect(result.connected).toBe(true)
  })

  it("throws when neither deviceId nor phoneNumber is provided", async () => {
    await expect(deviceDiagnoseTool.execute({}, context)).rejects.toThrow(
      "DEVICE_ID_OR_PHONE_REQUIRED"
    )
  })
})
