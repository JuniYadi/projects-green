import {
  type DeviceListItem,
  type DeviceDetail,
  updateDeviceSchema,
} from "@/modules/whatsapp/devices/devices.schemas"
import { eden } from "@/lib/eden"
import { z } from "zod"

// --- Response Types for other entities (inferred from routes until schemas are extracted) ---

export interface WhatsAppTemplate {
  id: string
  slug: string
  name: string
  description?: string | null
  whatsappDeviceId?: string | null
  organizationId: string
  syncStatus?: "NOT_SYNCED" | "SYNCING" | "SYNCED" | "FAILED"
  metaStatus?: "APPROVED" | "PENDING" | "REJECTED" | null
  languages: WhatsAppTemplateLanguage[]
  createdAt: string
  updatedAt: string
}

export interface WhatsAppTemplateLanguage {
  id: string
  lang: string
  headerType?: string | null
  headerUrl?: string | null
  headerText?: string | null
  body?: string | null
  parameters?: any
  footer?: string | null
  buttons?: any
}

export interface WhatsAppMessage {
  id: string
  conversationId: string
  direction: "INBOX" | "OUTBOX"
  messageType: string
  body?: string | null
  mediaUrl?: string | null
  waMessageId?: string | null
  metadata?: any
  createdAt: string
  updatedAt: string
  statusHistory?: any[]
}

export interface WhatsAppContact {
  id: string
  phoneNumber: string
  name: string
  email: string
  contactGroupId: string
  status: "ACTIVE" | "INACTIVE"
  whatsappDeviceId?: string | null
  dynamicValues?: any
  dynamicRaw?: string | null
  organizationId: string
  createdAt: string
  updatedAt: string
}

// --- Server-side fetch wrapper ---

async function serverFetch<T>(
  path: string,
  options?: RequestInit & {
    params?: Record<string, string | number | boolean | undefined>
  }
): Promise<T> {
  const url = new URL(
    path,
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3300"
  )
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  // Note: credentials "include" is used to pass the session cookie (workos-inc/authkit-nextjs)
  const res = await fetch(url.toString(), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))

    // 401 UNAUTHORIZED → redirect to login (session expired / missing)
    if (res.status === 401 && body.error === "UNAUTHORIZED") {
      if (typeof window !== "undefined") {
        const pathParts = window.location.pathname.split("/")
        const locale = pathParts[1] || "en"
        window.location.href = `/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`
      }
    }

    const error = new Error(body.message ?? `HTTP ${res.status}`) as Error & {
      error?: string
      required?: string
      current?: string | null
      action?: string
    }
    if (body.error === "FORBIDDEN" && body.required) {
      error.error = body.error
      error.required = body.required
      error.current = body.current ?? null
      error.action = body.action ?? ""
    }
    if (body.error === "UNAUTHORIZED") {
      error.error = body.error
    }
    throw error
  }

  return res.json() as Promise<T>
}

export const whatsappClient = {
  devices: {
    list: () =>
      serverFetch<{ ok: boolean; devices: DeviceListItem[] }>(
        "/api/whatsapp/devices"
      ),
    get: (id: string) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(
        `/api/whatsapp/devices/${id}`
      ),
    update: (id: string, input: z.infer<typeof updateDeviceSchema>) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(
        `/api/whatsapp/devices/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(updateDeviceSchema.parse(input)),
        }
      ),
    verify: (id: string) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(
        `/api/whatsapp/devices/${id}/verify`,
        {
          method: "POST",
        }
      ),
    reconnect: (id: string) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(
        `/api/whatsapp/devices/${id}/reconnect`,
        {
          method: "POST",
        }
      ),
    syncTemplates: async (id: string) => {
      const res = (await eden.api.whatsapp.devices[id][
        "sync-templates"
      ].post()) as {
        data: { ok: boolean; message?: string } | null
        error: unknown
      }

      if (res.error) {
        throw new Error(String(res.error))
      }

      if (!res.data?.ok) {
        throw new Error(res.data?.message ?? "Failed to sync templates")
      }

      return {
        ok: true,
        message: res.data.message ?? "Sync job enqueued.",
      }
    },
  },

  // templates: migrated to Eden (@/modules/whatsapp/templates/api/templates.hooks.ts)

  messages: {
    list: (params?: {
      conversationId?: string
      direction?: string
      messageType?: string
    }) =>
      serverFetch<{ ok: boolean; messages: WhatsAppMessage[] }>(
        "/api/whatsapp/messages",
        {
          params,
        }
      ),
    get: (id: string) =>
      serverFetch<{ ok: boolean; message: WhatsAppMessage }>(
        `/api/whatsapp/messages/${id}`
      ),
    create: (input: any) =>
      serverFetch<{ ok: boolean; message: WhatsAppMessage }>(
        "/api/whatsapp/messages",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    update: (id: string, input: any) =>
      serverFetch<{ ok: boolean; message: WhatsAppMessage }>(
        `/api/whatsapp/messages/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        }
      ),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/messages/${id}`, {
        method: "DELETE",
      }),
    send: (input: {
      phoneNumber: string
      message: string
      deviceId?: string
    }) =>
      serverFetch<{ ok: boolean; messageId: string; status: string }>(
        "/api/whatsapp/messages/send",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    sendInteractive: (input: {
      phoneNumber: string
      deviceId?: string
      interactive: unknown
    }) =>
      serverFetch<{ ok: boolean; messageId: string; status: string }>(
        "/api/whatsapp/messages/send-interactive",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
  },

  conversations: {
    list: (params?: { contactPhone?: string; status?: string }) =>
      serverFetch<{ ok: boolean; conversations: any[] }>(
        "/api/whatsapp/conversations",
        {
          params,
        }
      ),
    get: (id: string) =>
      serverFetch<{ ok: boolean; conversation: any }>(
        `/api/whatsapp/conversations/${id}`
      ),
    create: (input: {
      contactPhone: string
      whatsappDeviceId?: string | null
    }) =>
      serverFetch<{ ok: boolean; conversation: any }>(
        "/api/whatsapp/conversations",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/conversations/${id}`, {
        method: "DELETE",
      }),
  },

  contacts: {
    list: (params?: {
      contactGroupId?: string
      status?: string
      phoneNumber?: string
    }) =>
      serverFetch<{ ok: boolean; contacts: WhatsAppContact[] }>(
        "/api/whatsapp/contacts",
        {
          params,
        }
      ),
    get: (id: string) =>
      serverFetch<{ ok: boolean; contact: WhatsAppContact }>(
        `/api/whatsapp/contacts/${id}`
      ),
    create: (input: any) =>
      serverFetch<{ ok: boolean; contact: WhatsAppContact }>(
        "/api/whatsapp/contacts",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    update: (id: string, input: any) =>
      serverFetch<{ ok: boolean; contact: WhatsAppContact }>(
        `/api/whatsapp/contacts/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        }
      ),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/contacts/${id}`, {
        method: "DELETE",
      }),
  },

  media: {
    list: (params?: { deviceId?: string }) =>
      serverFetch<{ ok: boolean; media: any[] }>("/api/whatsapp/media", {
        params,
      }),
    get: (id: string) =>
      serverFetch<{ ok: boolean; media: any }>(`/api/whatsapp/media/${id}`),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/media/${id}`, {
        method: "DELETE",
      }),
    upload: async (file: File, deviceId: string) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("deviceId", deviceId)
      const res = await fetch("/api/whatsapp/media", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Upload failed with status ${res.status}`)
      }
      return res.json() as Promise<{ ok: boolean; media: any }>
    },
    downloadUrl: (id: string) => `/api/whatsapp/media/${id}/download`,
  },

  usage: {
    overview: () =>
      serverFetch<{
        ok: boolean
        month: any[]
        today: any[]
        cost: {
          totalAmount: number
          totalEntries: number
          byCategory: { category: string; count: number; totalCost: number }[]
        }
        devices: {
          deviceId: string | null
          phoneNumber: string | null
          messageInboxCount: number
          messageOutboxCount: number
          sessionCount: number
          messageFailedCount: number
        }[]
      }>("/api/whatsapp/usage/overview"),

    daily: (params?: { from?: string; to?: string; deviceId?: string }) =>
      serverFetch<{ ok: boolean; counts: any[] }>("/api/whatsapp/usage/daily", {
        params,
      }),

    monthly: (params?: { year?: number; month?: number; deviceId?: string }) =>
      serverFetch<{ ok: boolean; counts: any[] }>(
        "/api/whatsapp/usage/monthly",
        { params }
      ),

    cost: (params: { period: string }) =>
      serverFetch<{
        ok: boolean
        totalAmount: number
        totalEntries: number
        byCategory: {
          category: string
          count: number
          totalCost: number
        }[]
      }>("/api/whatsapp/usage/cost", { params }),

    costBreakdown: (params?: { period?: string }) =>
      serverFetch<{
        ok: boolean
        period: string
        totalCost: number
        projectedCost: number
        forecast: {
          daysElapsed: number
          daysRemaining: number
          currentCost: number
          projectedMonthlyCost: number
        }
        byDevice: {
          deviceId: string
          phoneNumber: string | null
          totalCost: number
          byCategory: { category: string; count: number; totalCost: number }[]
          messageCount: number
          quotaBase: number
          quotaUsed: number
          quotaPercent: number
        }[]
        balance: number | null
        currency: string
      }>("/api/whatsapp/usage/cost-breakdown", { params }),
  },

  catalogs: {
    list: () =>
      serverFetch<{ ok: boolean; data: any[] }>("/api/whatsapp/catalogs"),

    get: (id: string) =>
      serverFetch<{ ok: boolean; data: any }>(`/api/whatsapp/catalogs/${id}`),

    create: (input: { name: string; metaCatalogId: string; deviceId?: string }) =>
      serverFetch<{ ok: boolean; data: any }>("/api/whatsapp/catalogs", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    update: (id: string, input: { name?: string; metaCatalogId?: string; deviceId?: string | null }) =>
      serverFetch<{ ok: boolean; data: any }>(`/api/whatsapp/catalogs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/catalogs/${id}`, {
        method: "DELETE",
      }),

    sync: (id: string) =>
      serverFetch<{ ok: boolean; data: { synced: number } }>(
        `/api/whatsapp/catalogs/${id}/sync`,
        { method: "POST" }
      ),

    listProducts: (catalogId: string) =>
      serverFetch<{ ok: boolean; data: any[] }>(
        `/api/whatsapp/catalogs/${catalogId}/products`
      ),

    sendMessage: (input: {
      to: string
      catalogId: string
      type: string
      productRetailerId?: string
      body?: string
      header?: string
      footer?: string
      sections?: { title: string; productItems: string[] }[]
      thumbnailProductRetailerId?: string
    }) =>
      serverFetch<{ ok: boolean; data: { providerMessageId: string } }>(
        "/api/whatsapp/catalogs/send",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
  },

  analytics: {
    sync: (input: {
      deviceId: string
      startDate: string
      endDate: string
      granularity?: string
    }) =>
      serverFetch<{
        ok: boolean
        syncedCount: number
        discrepancies: any[]
      }>("/api/whatsapp/analytics/sync", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    report: (params: {
      deviceId: string
      startDate: string
      endDate: string
    }) =>
      serverFetch<{
        ok: boolean
        from: string
        to: string
        deviceId: string
        comparisons: any[]
        summary: {
          totalMeta: number
          totalLocal: number
          totalDelta: number
          rowsWithDiscrepancy: number
        }
      }>("/api/whatsapp/analytics/report", { params }),

    costReconciliation: (params: {
      deviceId?: string
      startDate: string
      endDate: string
    }) =>
      serverFetch<{
        ok: boolean
        rows: any[]
        totalMetaCost: number
        totalLocalCost: number
        totalDelta: number
      }>("/api/whatsapp/analytics/cost-reconciliation", { params }),
  },

  webhooks: {
    stats: (params?: { deviceId?: string }) =>
      serverFetch<{
        ok: boolean
        data: {
          periodStart: string
          periodEnd: string
          totalEvents: number
          failedEvents: number
          deadLetters: number
          failureRate: number
        }
      }>("/api/whatsapp/webhooks/dead-letter/stats", { params }),
  },
}
