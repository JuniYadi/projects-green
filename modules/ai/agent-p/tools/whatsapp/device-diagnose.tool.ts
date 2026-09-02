import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({ deviceId: z.string().min(1) })
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
    "Diagnose WhatsApp device connection health without exposing credentials",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const device = await prisma.whatsappDevice.findFirst({
      where: { organizationId: ctx.session.organizationId, id: input.deviceId },
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
