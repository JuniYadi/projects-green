"use client"

import * as React from "react"
import Link from "next/link"
import { MagnifyingGlass, ArrowRight, FileText } from "@phosphor-icons/react"

export interface SearchableDoc {
  path: string
  title: string
  purpose: string
  category: string
}

interface DocsSearchProps {
  lang: string
  documents: SearchableDoc[]
}

export function DocsSearch({ lang, documents }: DocsSearchProps) {
  const [query, setQuery] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.purpose.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q) ||
        doc.path.toLowerCase().includes(q)
    )
  }, [query, documents])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      } else if (e.key === "Escape") {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative flex items-center">
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute left-4 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search documentation, guides, API parameters... (⌘K)"
          className="h-12 w-full rounded-2xl border border-border/60 bg-card/80 pr-16 pl-11 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/70 focus:border-emerald-500/50 focus:bg-card focus:ring-4 focus:ring-emerald-500/10 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-3 hidden items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </div>

      {isOpen && query.trim() !== "" && (
        <div className="absolute top-14 z-50 w-full overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-border/40 px-4 py-2 text-[11px] font-medium text-muted-foreground">
            {filtered.length === 0
              ? "No matching guides found"
              : `Found ${filtered.length} matching document(s)`}
          </div>

          <div className="max-h-80 divide-y divide-border/40 overflow-y-auto p-1">
            {filtered.map((doc) => {
              const docSlug = doc.path.replace(/^\//, "")
              return (
                <Link
                  key={doc.path}
                  href={`/${lang}/docs/${docSlug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl p-3.5 transition-colors hover:bg-muted/60"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText
                        size={15}
                        className="shrink-0 text-emerald-500"
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {doc.title}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {doc.category}
                      </span>
                    </div>
                    <p className="line-clamp-1 pl-6 text-xs text-muted-foreground">
                      {doc.purpose}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-muted-foreground/60"
                  />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
