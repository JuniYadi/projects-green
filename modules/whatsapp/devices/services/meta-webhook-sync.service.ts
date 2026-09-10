import { prisma } from "@/lib/prisma"
import { resolveDecryptedDeviceMetaToken } from "@/modules/whatsapp/meta-apps/services/meta-credentials-resolver.service"

export type MetaWebhookSubscribedApp = {
  id: string
  name?: string
}

export type MetaWebhookSyncStatus =
  | "SUBSCRIBED"
  | "TOKEN_APP_MISMATCH"
  | "NOT_SUBSCRIBED"
  | "NO_WABA_CONFIGURED"
  | "NO_TOKEN"
  | "NO_META_APP_LINKED"
  | "ERROR"

export type MetaWebhookFeatureData = {
  active: boolean
  status: MetaWebhookSyncStatus
  metaAppId: string | null
  metaAppName: string | null
  tokenSource: "DEVICE_OVERRIDE" | "INHERITED_META_APP" | null
  effectiveVersion: string
  subscribedApps: MetaWebhookSubscribedApp[]
  lastCheckedAt: string
  warning: string | null
}

const META_GRAPH_BASE_URL =
  process.env.graphApiBaseUrl || "https://graph.facebook.com"

function extractSubscribedApps(data: unknown): MetaWebhookSubscribedApp[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("data" in data) ||
    !Array.isArray(data.data)
  ) {
    return []
  }
  return data.data.map((item: unknown) => {
    if (!item || typeof item !== "object") return { id: "" }
    const waData =
      "whatsapp_business_api_data" in item &&
      item.whatsapp_business_api_data &&
      typeof item.whatsapp_business_api_data === "object"
        ? (item.whatsapp_business_api_data as Record<string, unknown>)
        : undefined
    const id =
      (waData && "id" in waData && String(waData.id)) ||
      ("id" in item && String(item.id)) ||
      ""
    const name =
      waData && "name" in waData && typeof waData.name === "string"
        ? waData.name
        : undefined
    return { id, name }
  })
}
export async function syncMetaWebhookSubscription(
  deviceId: string
): Promise<MetaWebhookFeatureData> {
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
  const defaultVersion =
    device.whatsappVersion?.trim() ||
    device.whatsappMetaApp?.defaultVersion?.trim() ||
    "v24.0"

  const wabaId = device.whatsappBusinessAccountId?.trim()
  if (!wabaId) {
    const featureData: MetaWebhookFeatureData = {
      active: false,
      status: "NO_WABA_CONFIGURED",
      metaAppId: device.whatsappMetaApp?.metaAppId ?? null,
      metaAppName: device.whatsappMetaApp?.name ?? null,
      tokenSource: null,
      effectiveVersion: defaultVersion,
      subscribedApps: [],
      lastCheckedAt: now,
      warning: "No WhatsApp Business Account ID configured on device.",
    }
    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaWebhook: featureData,
        },
      },
    })
    return featureData
  }

  const targetMetaAppId = device.whatsappMetaApp?.metaAppId?.trim()
  if (!targetMetaAppId) {
    const featureData: MetaWebhookFeatureData = {
      active: false,
      status: "NO_META_APP_LINKED",
      metaAppId: null,
      metaAppName: null,
      tokenSource: null,
      effectiveVersion: defaultVersion,
      subscribedApps: [],
      lastCheckedAt: now,
      warning: "Device is not associated with an active Meta App.",
    }
    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaWebhook: featureData,
        },
      },
    })
    return featureData
  }

  let resolvedCredentials
  try {
    resolvedCredentials = await resolveDecryptedDeviceMetaToken(device)
  } catch (credErr) {
    const featureData: MetaWebhookFeatureData = {
      active: false,
      status: "NO_TOKEN",
      metaAppId: targetMetaAppId,
      metaAppName: device.whatsappMetaApp?.name ?? null,
      tokenSource: null,
      effectiveVersion: defaultVersion,
      subscribedApps: [],
      lastCheckedAt: now,
      warning:
        credErr instanceof Error
          ? credErr.message
          : "No access token configured on device or Meta App.",
    }
    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaWebhook: featureData,
        },
      },
    })
    return featureData
  }

  const { token, version, tokenSource } = resolvedCredentials

  try {
    // 1. Fetch current subscriptions
    const getUrl = `${META_GRAPH_BASE_URL}/${version}/${wabaId}/subscribed_apps`
    let getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!getRes.ok) {
      const errData = await getRes.json().catch(() => ({}))
      throw new Error(
        errData.error?.message ||
          `Meta Graph API returned status ${getRes.status}`
      )
    }

    let getData = await getRes.json()
    let subscribedApps = extractSubscribedApps(getData)
    let isSubscribed = subscribedApps.some((app) => app.id === targetMetaAppId)

    // 2. If not subscribed, attempt auto-subscription
    if (!isSubscribed) {
      const postUrl = `${META_GRAPH_BASE_URL}/${version}/${wabaId}/subscribed_apps`
      const postRes = await fetch(postUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!postRes.ok) {
        console.warn(
          `[meta-webhook-sync] Auto-subscribe POST returned status ${postRes.status}`
        )
      }

      // Re-check subscriptions after POST
      getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (getRes.ok) {
        getData = await getRes.json()
        subscribedApps = extractSubscribedApps(getData)
        isSubscribed = subscribedApps.some((app) => app.id === targetMetaAppId)
      }
    }

    const status: MetaWebhookSyncStatus = isSubscribed
      ? "SUBSCRIBED"
      : "TOKEN_APP_MISMATCH"

    const warning = isSubscribed
      ? null
      : `Access token belongs to an alternate Meta App. Subscribing with this token did not link target Meta App ${device.whatsappMetaApp?.name ?? targetMetaAppId} (${targetMetaAppId}). Please generate a System User token from ${device.whatsappMetaApp?.name ?? targetMetaAppId}.`

    const featureData: MetaWebhookFeatureData = {
      active: isSubscribed,
      status,
      metaAppId: targetMetaAppId,
      metaAppName: device.whatsappMetaApp?.name ?? null,
      tokenSource,
      effectiveVersion: version,
      subscribedApps,
      lastCheckedAt: now,
      warning,
    }

    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaWebhook: featureData,
        },
      },
    })

    return featureData
  } catch (error: unknown) {
    const warning =
      error instanceof Error
        ? error.message
        : "Failed to verify Meta webhook subscriptions."

    const featureData: MetaWebhookFeatureData = {
      active: false,
      status: "ERROR",
      metaAppId: targetMetaAppId,
      metaAppName: device.whatsappMetaApp?.name ?? null,
      tokenSource,
      effectiveVersion: version,
      subscribedApps: [],
      lastCheckedAt: now,
      warning,
    }

    await prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: {
        features: {
          ...currentFeatures,
          metaWebhook: featureData,
        },
      },
    })

    return featureData
  }
}
