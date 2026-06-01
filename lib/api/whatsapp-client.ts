import {
  type DeviceListItem,
  type DeviceDetail,
  createDeviceSchema,
  updateDeviceSchema,
} from "@/modules/whatsapp/devices/devices.schemas"
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
  options?: RequestInit & { params?: Record<string, string | number | boolean | undefined> }
): Promise<T> {
  const url = new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3300")
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
        window.location.href = `/${locale}/login/start?next=${encodeURIComponent(window.location.pathname)}`
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
      serverFetch<{ ok: boolean; devices: DeviceListItem[] }>("/api/whatsapp/devices"),
    get: (id: string) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(`/api/whatsapp/devices/${id}`),
    create: (input: z.infer<typeof createDeviceSchema>) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>("/api/whatsapp/devices", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: z.infer<typeof updateDeviceSchema>) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(`/api/whatsapp/devices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updateDeviceSchema.parse(input)),
      }),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/devices/${id}`, { method: "DELETE" }),
    verify: (id: string) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(`/api/whatsapp/devices/${id}/verify`, {
        method: "POST",
      }),
    reconnect: (id: string) =>
      serverFetch<{ ok: boolean; device: DeviceDetail }>(`/api/whatsapp/devices/${id}/reconnect`, {
        method: "POST",
      }),
  },

  templates: {
    list: () =>
      serverFetch<{ ok: boolean; templates: WhatsAppTemplate[] }>("/api/whatsapp/templates"),
    get: (id: string) =>
      serverFetch<{ ok: boolean; template: WhatsAppTemplate }>(`/api/whatsapp/templates/${id}`),
    create: (input: any) =>
      serverFetch<{ ok: boolean; template: WhatsAppTemplate }>("/api/whatsapp/templates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: any) =>
      serverFetch<{ ok: boolean; template: WhatsAppTemplate }>(`/api/whatsapp/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/templates/${id}`, { method: "DELETE" }),
    sync: (id: string) =>
      serverFetch<{ ok: boolean; message: string }>(`/api/whatsapp/templates/${id}/sync`, {
        method: "POST",
      }),
  },

  messages: {
    list: (params?: { conversationId?: string; direction?: string; messageType?: string }) =>
      serverFetch<{ ok: boolean; messages: WhatsAppMessage[] }>("/api/whatsapp/messages", {
        params,
      }),
    get: (id: string) =>
      serverFetch<{ ok: boolean; message: WhatsAppMessage }>(`/api/whatsapp/messages/${id}`),
    create: (input: any) =>
      serverFetch<{ ok: boolean; message: WhatsAppMessage }>("/api/whatsapp/messages", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: any) =>
      serverFetch<{ ok: boolean; message: WhatsAppMessage }>(`/api/whatsapp/messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/messages/${id}`, { method: "DELETE" }),
    send: (input: { phoneNumber: string; message: string; deviceId?: string }) =>
      serverFetch<{ ok: boolean; messageId: string; status: string }>("/api/whatsapp/messages/send", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },

  conversations: {
    list: (params?: { contactPhone?: string }) =>
      serverFetch<{ ok: boolean; conversations: any[] }>("/api/whatsapp/conversations", {
        params,
      }),
    get: (id: string) =>
      serverFetch<{ ok: boolean; conversation: any }>(`/api/whatsapp/conversations/${id}`),
    create: (input: { contactPhone: string; whatsappDeviceId?: string | null }) =>
      serverFetch<{ ok: boolean; conversation: any }>("/api/whatsapp/conversations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/conversations/${id}`, { method: "DELETE" }),
  },

  contacts: {
    list: (params?: { contactGroupId?: string; status?: string; phoneNumber?: string }) =>
      serverFetch<{ ok: boolean; contacts: WhatsAppContact[] }>("/api/whatsapp/contacts", {
        params,
      }),
    get: (id: string) =>
      serverFetch<{ ok: boolean; contact: WhatsAppContact }>(`/api/whatsapp/contacts/${id}`),
    create: (input: any) =>
      serverFetch<{ ok: boolean; contact: WhatsAppContact }>("/api/whatsapp/contacts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: any) =>
      serverFetch<{ ok: boolean; contact: WhatsAppContact }>(`/api/whatsapp/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      serverFetch<{ ok: boolean }>(`/api/whatsapp/contacts/${id}`, { method: "DELETE" }),
  },
}
