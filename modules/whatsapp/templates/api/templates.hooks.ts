/**
 * WhatsApp Templates — React Hooks
 *
 * Reusable data-fetching hooks that wrap whatsappClient with loading/error
 * state management, following the same pattern used across the app.
 */

"use client"

import * as React from "react"

import { whatsappClient } from "@/lib/api/whatsapp-client"
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

export function useTemplates() {
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await whatsappClient.templates.list()
      setTemplates(result.templates)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load templates.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  return { templates, loading, error, reload: load }
}

export function useTemplate(id: string) {
  const [template, setTemplate] = React.useState<WhatsAppTemplate | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await whatsappClient.templates.get(id)
      setTemplate(result.template)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load template.",
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  return { template, loading, error, reload: load }
}

export function useCreateTemplate() {
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const create = React.useCallback(
    async (input: TemplateFormInput) => {
      setCreating(true)
      setError(null)

      try {
        const result = await whatsappClient.templates.create(input)
        return result.template
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create template."
        setError(message)
        throw err
      } finally {
        setCreating(false)
      }
    },
    [],
  )

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
        const result = await whatsappClient.templates.update(id, input)
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
    [],
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
      await whatsappClient.templates.delete(id)
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
      const result = await whatsappClient.templates.sync(id)
      return result
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
