"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  UiDocErrorResponse,
  UiDocSuccessResponse,
} from "@/modules/docs/docs.types"

type FormState = {
  path: string
  title: string
  purpose: string
  howToText: string
  notesText: string
}

const initialState: FormState = {
  path: "/console",
  title: "",
  purpose: "",
  howToText: "",
  notesText: "",
}

export function DocumentationForm() {
  const [form, setForm] = useState<FormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  const normalizedHowTo = useMemo(
    () =>
      form.howToText
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [form.howToText]
  )

  const normalizedNotes = useMemo(
    () =>
      form.notesText
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [form.notesText]
  )

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitMessage(null)
    setSubmitError(null)

    if (!form.path.trim() || !form.title.trim() || !form.purpose.trim()) {
      setSubmitError("Path, title, and purpose are required.")
      return
    }

    if (!normalizedHowTo.length) {
      setSubmitError("Provide at least one how-to step.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: form.path,
          title: form.title,
          purpose: form.purpose,
          howTo: normalizedHowTo,
          notes: normalizedNotes.length ? normalizedNotes : undefined,
        }),
      })

      const payload = (await response
        .json()
        .catch(() => null)) as UiDocSuccessResponse | UiDocErrorResponse | null

      if (!response.ok || !payload || payload.ok !== true) {
        const payloadMessage =
          payload && payload.ok === false ? payload.message : null

        setSubmitError(
          payloadMessage ??
            "Failed to save documentation. Please review the form and retry."
        )
        return
      }

      setSubmitMessage("Documentation saved.")
      setSavedPath(payload.path)
    } catch {
      setSubmitError("Network error while saving documentation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="doc-path">
          Path
        </label>
        <Input
          id="doc-path"
          value={form.path}
          onChange={(event) =>
            setForm((current) => ({ ...current, path: event.target.value }))
          }
          placeholder="/console"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="doc-title">
          Title
        </label>
        <Input
          id="doc-title"
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
          placeholder="Console Overview"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="doc-purpose">
          Purpose
        </label>
        <textarea
          id="doc-purpose"
          value={form.purpose}
          onChange={(event) =>
            setForm((current) => ({ ...current, purpose: event.target.value }))
          }
          placeholder="Describe the purpose of this page."
          className="min-h-24 w-full rounded-none border border-input bg-transparent px-3 py-2 text-sm outline-hidden focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="doc-howto">
          How To (one step per line)
        </label>
        <textarea
          id="doc-howto"
          value={form.howToText}
          onChange={(event) =>
            setForm((current) => ({ ...current, howToText: event.target.value }))
          }
          placeholder={"Open console\nCheck summary cards\nOpen documentation panel"}
          className="min-h-32 w-full rounded-none border border-input bg-transparent px-3 py-2 text-sm outline-hidden focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="doc-notes">
          Notes (optional, one item per line)
        </label>
        <textarea
          id="doc-notes"
          value={form.notesText}
          onChange={(event) =>
            setForm((current) => ({ ...current, notesText: event.target.value }))
          }
          placeholder={"Only console is covered in v1\nMore pages can be added later"}
          className="min-h-24 w-full rounded-none border border-input bg-transparent px-3 py-2 text-sm outline-hidden focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        />
      </div>

      {submitMessage ? (
        <p className="text-sm text-emerald-600">
          {submitMessage}
          {savedPath ? ` Check /api/docs?path=${savedPath}` : null}
        </p>
      ) : null}

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Documentation"}
      </Button>
    </form>
  )
}
