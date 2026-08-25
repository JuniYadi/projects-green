import { Elysia } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

export const onboardingRoutes = new Elysia({ prefix: "/onboarding" }).get(
  "/status",
  async ({ request, set }) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }

    const organizationId = auth.organizationId
    if (!organizationId) {
      return {
        ok: true,
        data: {
          hasSubscription: false,
          deviceCount: 0,
          templateCount: 0,
          messageCount: 0,
          apiKeyCount: 0,
        },
      }
    }

    const [
      deviceCount,
      templateCount,
      messageCount,
      legacyApiKeyCount,
      orgApiKeyCount,
      subscription,
    ] = await Promise.all([
      prisma.whatsappDevice.count({
        where: { organizationId },
      }),
      prisma.whatsappTemplate.count({
        where: { organizationId },
      }),
      prisma.whatsappMessage.count({
        where: {
          conversation: { organizationId },
        },
      }),
      prisma.whatsappApiKey.count({
        where: { organizationId },
      }),
      prisma.whatsappOrganizationApiKey.count({
        where: { organizationId, status: "ACTIVE" },
      }),
      prisma.serviceSubscription.findFirst({
        where: {
          organizationId,
          package: {
            code: "WHATSAPP",
          },
          status: "ACTIVE",
        },
        select: { id: true },
      }),
    ])

    return {
      ok: true,
      data: {
        hasSubscription: Boolean(subscription || deviceCount > 0),
        deviceCount,
        templateCount,
        messageCount,
        apiKeyCount: legacyApiKeyCount + orgApiKeyCount,
      },
    }
  }
)
