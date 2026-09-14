import { prisma } from "@/lib/prisma"
import { resolveDecryptedDeviceMetaToken } from "@/modules/whatsapp/meta-apps/services/meta-credentials-resolver.service"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

export type MetaWabaPermissionStatus =
  | "GRANTED"
  | "NOT_ASSIGNED"
  | "MISSING_MANAGE_TASK"
  | "NO_WABA_CONFIGURED"
  | "NO_TOKEN"
  | "ERROR"

export type MetaWabaAssignedUser = {
  id: string
  name?: string
  tasks: string[]
}

export type MetaPermissionsFeatureData = {
  active: boolean
  status: MetaWabaPermissionStatus
  wabaId: string | null
  businessId: string | null
  businessName: string | null
  systemUserId: string | null
  systemUserName: string | null
  assignedUsers: MetaWabaAssignedUser[]
  tokenScopes: string[]
  canManageTemplates: boolean
  lastCheckedAt: string
  warning: string | null
}

const META_GRAPH_BASE_URL =
  process.env.graphApiBaseUrl || "https://graph.facebook.com"

export async function syncMetaDevicePermissions(
  deviceId: string
): Promise<MetaPermissionsFeatureData> {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    include: {
      whatsappMetaApp: {
        select: {
          metaAppId: true,
          name: true,
          systemTokenEncrypted: true,
          defaultVersion: true,
        },
      },
    },
  })

  if (!device) {
    throw new Error(`Device not found: ${deviceId}`)
  }

  const currentFeatures =
    (device.features as Record<string, unknown> | null) ?? {}
  const now = new Date().toISOString()
  const version =
    device.whatsappVersion?.trim() ||
    device.whatsappMetaApp?.defaultVersion?.trim() ||
    "v24.0"
  const wabaId = device.whatsappBusinessAccountId?.trim()

  if (!wabaId) {
    const featureData: MetaPermissionsFeatureData = {
      active: false,
      status: "NO_WABA_CONFIGURED",
      wabaId: null,
      businessId: null,
      businessName: null,
      systemUserId: null,
      systemUserName: null,
      assignedUsers: [],
      tokenScopes: [],
      canManageTemplates: false,
      lastCheckedAt: now,
      warning: "Device has no WhatsApp Business Account ID configured.",
    }

    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaPermissions: featureData,
        },
      },
    })

    return featureData
  }

  let token = ""
  try {
    const resolved = await resolveDecryptedDeviceMetaToken({
      token: device.token,
      tokenEncrypted: device.tokenEncrypted,
      tokenIv: device.tokenIv,
      whatsappVersion: device.whatsappVersion,
      whatsappBusinessAccountId: wabaId,
      whatsappPhoneId: device.whatsappPhoneId,
      whatsappMetaApp: device.whatsappMetaApp,
    })
    token = resolved.token
  } catch (err: unknown) {
    const featureData: MetaPermissionsFeatureData = {
      active: false,
      status: "NO_TOKEN",
      wabaId,
      businessId: null,
      businessName: null,
      systemUserId: null,
      systemUserName: null,
      assignedUsers: [],
      tokenScopes: [],
      canManageTemplates: false,
      lastCheckedAt: now,
      warning:
        err instanceof Error
          ? err.message
          : "No access token configured on device or linked Meta app.",
    }

    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaPermissions: featureData,
        },
      },
    })

    return featureData
  }

  try {
    // 1. Debug token to discover the acting user ID and granted scopes
    const debugUrl = `${META_GRAPH_BASE_URL}/debug_token?input_token=${encodeURIComponent(
      token
    )}&access_token=${encodeURIComponent(token)}`
    const debugRes = await fetch(debugUrl)
    const debugData = (await debugRes.json()) as {
      data?: {
        user_id?: string
        scopes?: string[]
        is_valid?: boolean
        type?: string
      }
    }

    const systemUserId = debugData.data?.user_id ?? null
    const tokenScopes = debugData.data?.scopes ?? []

    // 2. Fetch WABA to get owner business info
    const wabaUrl = `${META_GRAPH_BASE_URL}/${version}/${wabaId}?fields=id,name,owner_business_info`
    const wabaRes = await fetch(wabaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const wabaData = (await wabaRes.json()) as {
      id?: string
      name?: string
      owner_business_info?: {
        id?: string
        name?: string
      }
    }

    const businessId = wabaData.owner_business_info?.id ?? null
    const businessName = wabaData.owner_business_info?.name ?? null

    // 3. If business ID is available, inspect assigned users on this WABA
    let assignedUsers: MetaWabaAssignedUser[] = []
    let status: MetaWabaPermissionStatus = "GRANTED"
    let warning: string | null = null
    let canManageTemplates = true
    let systemUserName: string | null = null

    if (businessId) {
      const usersUrl = `${META_GRAPH_BASE_URL}/${version}/${wabaId}/assigned_users?business=${businessId}`
      const usersRes = await fetch(usersUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (usersRes.ok) {
        const usersData = (await usersRes.json()) as {
          data?: Array<{ id: string; name?: string; tasks?: string[] }>
        }
        if (Array.isArray(usersData.data)) {
          assignedUsers = usersData.data.map((u) => ({
            id: u.id,
            name: u.name,
            tasks: Array.isArray(u.tasks) ? u.tasks : [],
          }))
        }

        if (systemUserId) {
          const matchedUser = assignedUsers.find((u) => u.id === systemUserId)
          if (!matchedUser) {
            status = "NOT_ASSIGNED"
            canManageTemplates = false
            warning =
              "System User token is not assigned to this WhatsApp Business Account in Meta Business Suite. Template operations (create/delete) will be rejected by Meta."
          } else {
            systemUserName = matchedUser.name ?? null
            if (!matchedUser.tasks.includes("MANAGE")) {
              status = "MISSING_MANAGE_TASK"
              canManageTemplates = false
              warning =
                "System User is assigned to this WABA but lacks the MANAGE task. Full control is required for template management."
            }
          }
        }
      }
    }

    // 4. Audit warning if permissions are incomplete
    if (status === "NOT_ASSIGNED" || status === "MISSING_MANAGE_TASK") {
      await logWhatsappAuditEvent({
        action: "DEVICE_META_PERMISSION_MISSING",
        organizationId: device.organizationId,
        deviceId: device.id,
        message: `Meta WABA permission issue for device ${device.phoneNumber}: ${warning}`,
        status: "WARNING",
      }).catch((err) => {
        console.warn("[meta-permissions-sync] Audit log failed:", err)
      })
    }

    const featureData: MetaPermissionsFeatureData = {
      active: canManageTemplates,
      status,
      wabaId,
      businessId,
      businessName,
      systemUserId,
      systemUserName,
      assignedUsers,
      tokenScopes,
      canManageTemplates,
      lastCheckedAt: now,
      warning,
    }

    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaPermissions: featureData,
        },
      },
    })

    return featureData
  } catch (error: unknown) {
    const warning =
      error instanceof Error
        ? error.message
        : "Failed to verify Meta WABA permissions."

    const featureData: MetaPermissionsFeatureData = {
      active: false,
      status: "ERROR",
      wabaId,
      businessId: null,
      businessName: null,
      systemUserId: null,
      systemUserName: null,
      assignedUsers: [],
      tokenScopes: [],
      canManageTemplates: false,
      lastCheckedAt: now,
      warning,
    }

    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaPermissions: featureData,
        },
      },
    })

    return featureData
  }
}
