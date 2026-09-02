import { beforeEach, describe, expect, it, mock } from "bun:test"
import { broadcastPreflightTool } from "./broadcast-preflight.tool"
import type { AgentPContext } from "../../types"

const mockPrisma = {
  whatsappBroadcastCampaign: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("broadcastPreflightTool", () => {
  beforeEach(() => {
    mockPrisma.whatsappBroadcastCampaign.findFirst.mockReset()
  })

  it("has valid tool metadata", () => {
    expect(broadcastPreflightTool.name).toBe("whatsapp.broadcast.preflight")
  })

  it("validates a campaign with complete recipient variables", async () => {
    mockPrisma.whatsappBroadcastCampaign.findFirst.mockResolvedValueOnce({
      id: "bc-1",
      templateParams: "Hello {{1}}",
      recipients: [
        { phoneNumber: "+62812345678", dynamicValues: { "1": "Budi" } },
      ],
    })

    const result = await broadcastPreflightTool.execute(
      { broadcastId: "bc-1" },
      context
    )
    expect(result.broadcastId).toBe("bc-1")
    expect(result.valid).toBe(true)
    expect(result.recipientCount).toBe(1)
    expect(result.issues).toEqual([])
  })

  it("flags missing template variables in recipients", async () => {
    mockPrisma.whatsappBroadcastCampaign.findFirst.mockResolvedValueOnce({
      id: "bc-2",
      templateParams: "Hello {{1}} and {{2}}",
      recipients: [
        { phoneNumber: "+62812345678", dynamicValues: { "1": "Budi" } },
      ],
    })

    const result = await broadcastPreflightTool.execute(
      { broadcastId: "bc-2" },
      context
    )
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it("throws when broadcast is not found in organization", async () => {
    mockPrisma.whatsappBroadcastCampaign.findFirst.mockResolvedValueOnce(null)
    await expect(
      broadcastPreflightTool.execute({ broadcastId: "bc-missing" }, context)
    ).rejects.toThrow("BROADCAST_NOT_FOUND")
  })
})
