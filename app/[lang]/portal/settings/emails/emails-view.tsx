"use client"

import { useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { EmailTemplateMeta } from "@/lib/email-templates"

// ponytail: preview uses iframe src (not srcDoc) — no client fetch, no lint issue
function previewUrl(id: string) {
  return `/api/email-templates/${id}/preview`
}

export function EmailsView() {
  const [templates, setTemplates] = useState<EmailTemplateMeta[]>([])
  const [selected, setSelected] = useState<EmailTemplateMeta | null>(null)
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    eden.api["email-templates"]
      .get()
      .then((r) => {
        const body = r.data as { ok: boolean; data: EmailTemplateMeta[] }
        if (body?.ok) {
          const list = body.data as EmailTemplateMeta[]
          setTemplates(list)
          if (list.length > 0) setSelected(list[0])
        }
      })
      .finally(() => setLoadingList(false))
  }, [])

  const categories = Array.from(new Set(templates.map((t) => t.category)))

  return (
    <div className="flex h-[calc(100vh-220px)] gap-6">
      {/* Left: template list */}
      <aside className="w-56 shrink-0 overflow-y-auto rounded-lg border bg-card">
        <div className="space-y-4 p-2">
          {loadingList
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))
            : categories.map((category) => (
                <div key={category}>
                  <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {category}
                  </p>
                  {templates
                    .filter((t) => t.category === category)
                    .map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setSelected(tpl)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          selected?.id === tpl.id &&
                            "bg-accent font-medium text-accent-foreground"
                        )}
                      >
                        {tpl.name}
                      </button>
                    ))}
                </div>
              ))}
        </div>
      </aside>

      {/* Right: metadata + preview */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {selected && (
          <div className="space-y-1 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">{selected.name}</span>
              <Badge variant="secondary">{selected.category}</Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              <span className="font-medium">Subject:</span> {selected.subject}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">From:</span> {selected.from}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-hidden rounded-lg border bg-white">
          {selected ? (
            <iframe
              key={selected.id}
              src={previewUrl(selected.id)}
              className="h-full w-full border-0"
              title={`Preview: ${selected.name}`}
              sandbox="allow-same-origin"
            />
          ) : (
            <Skeleton className="h-full w-full rounded-none" />
          )}
        </div>
      </div>
    </div>
  )
}
