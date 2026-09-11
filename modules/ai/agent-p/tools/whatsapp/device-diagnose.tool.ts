import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  extractPhoneVariants,
  isPotentialPhoneNumber,
} from "@/modules/whatsapp/messages/phone-number"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({
  deviceId: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
})
const outputSchema = z.object({
  deviceId: z.string(),
  status: z.string(),
  phoneNumber: z.string(),
  connected: z.boolean(),
  lastHeartbeatAt: z.string().nullable(),
  checks: z.array(z.string()),
})

export const deviceDiagnoseTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "whatsapp.device.diagnose",
  description:
    "Diagnose WhatsApp device connection health without exposing credentials by deviceId or phoneNumber",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const phoneCandidates = [
      ...(input.phoneNumber && isPotentialPhoneNumber(input.phoneNumber)
        ? extractPhoneVariants(input.phoneNumber)
        : []),
      ...(input.deviceId && isPotentialPhoneNumber(input.deviceId)
        ? extractPhoneVariants(input.deviceId)
        : []),
    ]

    const orConditions = [
      ...(input.deviceId ? [{ id: input.deviceId }] : []),
      ...(phoneCandidates.length > 0
        ? [{ phoneNumber: { in: phoneCandidates } }]
        : []),
    ]

    if (orConditions.length === 0) {
      throw new Error("DEVICE_ID_OR_PHONE_REQUIRED")
    }

    const device = await prisma.whatsappDevice.findFirst({
      where: {
        organizationId: ctx.session.organizationId,
        OR: orConditions,
      },
      select: {
        id: true,
        status: true,
        phoneNumber: true,
        lastHeartbeatAt: true,
      },
    })
    if (!device) throw new Error("DEVICE_NOT_FOUND")
    const connected = device.status === "ACTIVE"
    return {
      deviceId: device.id,
      status: device.status,
      phoneNumber: device.phoneNumber,
      connected,
      lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
      checks: connected ? ["device-status-ok"] : ["device-disconnected"],
    }
  },
}
