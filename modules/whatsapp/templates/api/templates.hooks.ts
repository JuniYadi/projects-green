/**
 * WhatsApp Templates — React Hooks (Eden)
 *
 * Reusable data-fetching hooks that use eden for type-safe API calls,
 * with loading/error state management.
 */

"use client"

import * as React from "react"

import { eden } from "@/lib/eden"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"

export type TemplateFormInput = {
  slug: string
  name: string
  description?: string
  whatsappDeviceId?: string
  languages: Array<{
    lang: string
    headerType?: string
    headerUrl?: string
    headerText?: string
    body?: string
    parameters?: unknown[]
    footer?: string
    buttons?: unknown[]
  }>
}

type TemplateFilters = {
  organizationId?: string
  whatsappDeviceId?: string
  syncStatus?: string
  sort?: string
}

type TemplatesListResponse = {
  ok: boolean
  templates: WhatsAppTemplate[]
  data: WhatsAppTemplate[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export function useTemplates(filters?: TemplateFilters) {
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const orgId = filters?.organizationId
  const deviceId = filters?.whatsappDeviceId
  const syncStatus = filters?.syncStatus
  const sort = filters?.sort

  React.useEffect(() => {
    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const query: Record<string, string> = {}
        if (orgId) query.organizationId = orgId
        if (deviceId) query.whatsappDeviceId = deviceId
        if (syncStatus) query.syncStatus = syncStatus
        if (sort) query.sort = sort
        const { data, error: edenError } =
          await eden.api.whatsapp.templates.get({
            $query: query,
          })
        if (cancelled) return
        if (edenError)
          throw new Error(edenError.message ?? "Failed to load templates.")
        const result = data as unknown as TemplatesListResponse
        setTemplates(result?.templates ?? [])
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load templates."
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, deviceId, syncStatus, sort])

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query: Record<string, string> = {}
      if (orgId) query.organizationId = orgId
      if (deviceId) query.whatsappDeviceId = deviceId
      if (syncStatus) query.syncStatus = syncStatus
      if (sort) query.sort = sort
      const { data, error: edenError } =
        await eden.api.whatsapp.templates.get({
          $query: query,
        })
      if (edenError)
        throw new Error(edenError.message ?? "Failed to load templates.")
      const result = data as unknown as TemplatesListResponse
      setTemplates(result?.templates ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.")
    } finally {
      setLoading(false)
    }
  }, [orgId, deviceId, syncStatus, sort])

  return { templates, loading, error, reload }
}



export function useTemplate(id: string) {
  const [template, setTemplate] = React.useState<WhatsAppTemplate | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: edenError } =
          await eden.api.whatsapp.templates[id].get()
        if (cancelled) return
        if (edenError)
          throw new Error(edenError.message ?? "Failed to load template.")
        const result = data as unknown as {
          ok: boolean
          template: WhatsAppTemplate
        }
        setTemplate(result?.template ?? null)
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load template."
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: edenError } =
        await eden.api.whatsapp.templates[id].get()
      if (edenError)
        throw new Error(edenError.message ?? "Failed to load template.")
      const result = data as unknown as {
        ok: boolean
        template: WhatsAppTemplate
      }
      setTemplate(result?.template ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load template.")
    } finally {
      setLoading(false)
    }
  }, [id])

  return { template, loading, error, reload }
}

export function useCreateTemplate() {
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const create = React.useCallback(async (input: TemplateFormInput) => {
    setCreating(true)
    setError(null)

    try {
      const { data, error: edenError } =
        await eden.api.whatsapp.templates.post(input)
      if (edenError)
        throw new Error(edenError.message ?? "Failed to create template.")
      const result = data as unknown as {
        ok: boolean
        template: WhatsAppTemplate
      }
      return result.template
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create template."
      setError(message)
      throw err
    } finally {
      setCreating(false)
    }
  }, [])

  return { create, creating, error }
}

export function useUpdateTemplate() {
  const [updating, setUpdating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const update = React.useCallback(
    async (id: string, input: Partial<TemplateFormInput>) => {
      setUpdating(true)
      setError(null)

      try {
        const { data, error: edenError } =
          await eden.api.whatsapp.templates[id].patch(input)
        if (edenError)
          throw new Error(edenError.message ?? "Failed to update template.")
        const result = data as unknown as {
          ok: boolean
          template: WhatsAppTemplate
        }
        return result.template
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update template."
        setError(message)
        throw err
      } finally {
        setUpdating(false)
      }
    },
    []
  )

  return { update, updating, error }
}

export function useDeleteTemplate() {
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const remove = React.useCallback(async (id: string) => {
    setDeleting(true)
    setError(null)

    try {
      const { error: edenError } =
        await eden.api.whatsapp.templates[id].delete()
      if (edenError)
        throw new Error(edenError.message ?? "Failed to delete template.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete template."
      setError(message)
      throw err
    } finally {
      setDeleting(false)
    }
  }, [])

  return { remove, deleting, error }
}

export function useSyncTemplate() {
  const [syncing, setSyncing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const sync = React.useCallback(async (id: string) => {
    setSyncing(true)
    setError(null)

    try {
      const { data, error: edenError } =
        await eden.api.whatsapp.templates[id].sync.post()
      if (edenError)
        throw new Error(edenError.message ?? "Failed to sync template.")
      return data as unknown as { ok: boolean; message: string }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sync template."
      setError(message)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [])

  return { sync, syncing, error }
}
