import { prisma } from "@/lib/prisma"

export class ApiCallTracker {
  /**
   * Record an API call to the Meta WhatsApp Business API.
   */
  async recordCall(params: {
    organizationId?: string // Make optional as it seems to be inferred from device or not directly on the call
    operation: string
    phoneNumberId?: string // Make optional
    status: number
  }): Promise<void> {
    // If organizationId is directly available or derivable, it should be passed here.
    // For now, setting it to undefined as per current modification.
    await prisma.whatsappApiCall.create({
      data: {
        organizationId: params.organizationId ?? null,
        operation: params.operation,
        phoneNumberId: params.phoneNumberId,
        status: params.status,
      },
    })
  }

  /**
   * Count API calls for a phone number in a recent time window.
   */
  async getCallCount(
    phoneNumberId: string,
    windowMinutes: number = 1
  ): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60_000)
    return prisma.whatsappApiCall.count({
      where: { phoneNumberId, createdAt: { gte: since } },
    })
  }

  /**
   * Count recent error responses (429, 5xx) for a phone number.
   */
  async getRecentErrors(
    phoneNumberId: string,
    minutes: number = 5
  ): Promise<number> {
    const since = new Date(Date.now() - minutes * 60_000)
    return prisma.whatsappApiCall.count({
      where: {
        phoneNumberId,
        createdAt: { gte: since },
        status: { in: [429, 500, 502, 503, 504] },
      },
    })
  }

  /**
   * Get today's call volume grouped by phone number for an org.
   */
  async getDailyVolume(
    organizationId: string
  ): Promise<{ phoneNumberId: string; count: number }[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await prisma.whatsappApiCall.groupBy({
      by: ["phoneNumberId"],
      where: {
        organizationId: organizationId,
        createdAt: { gte: today },
      },
      _count: { id: true },
    })

    return result.map((r) => ({
      phoneNumberId: r.phoneNumberId ?? "unknown", // Provide a default or handle null explicitly
      count: r._count.id,
    }))
  }
}

export const apiCallTracker = new ApiCallTracker()
