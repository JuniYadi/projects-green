"use client"

import * as React from "react"
import Link from "next/link"
import { MagnifyingGlass, ArrowRight, FileText, X } from "@phosphor-icons/react"
import type { SearchableDoc } from "./docs-search"

interface NavbarSearchProps {
  lang: string
  documents: SearchableDoc[]
}

export function NavbarSearch({ lang, documents }: NavbarSearchProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
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
        setIsOpen(true)
      } else if (e.key === "Escape") {
        setIsOpen(false)
        setQuery("")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const closeSearch = () => {
    setIsOpen(false)
    setQuery("")
  }

  return (
    <>
      {/* Trigger Button on Navbar */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-muted/80 hover:text-foreground"
      >
        <MagnifyingGlass
          size={15}
          className="text-emerald-500 transition-transform group-hover:scale-110"
        />
        <span className="hidden sm:inline">Search docs...</span>
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground/80 sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {/* Animated Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 sm:p-6 sm:pt-28">
          {/* Backdrop */}
          <div
            className="fixed inset-0 animate-in bg-black/60 backdrop-blur-md transition-opacity duration-200 fade-in-0"
            onClick={closeSearch}
          />

          {/* Search Box with Wide Animation */}
          <div className="relative z-50 w-full max-w-2xl animate-in overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl shadow-black/50 backdrop-blur-2xl transition-all duration-200 fade-in-0 zoom-in-95">
            <div className="flex items-center border-b border-border/60 px-4">
              <MagnifyingGlass
                size={20}
                className="shrink-0 text-emerald-500"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across all guides, APIs, and features..."
                className="h-14 w-full bg-transparent px-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim() === "" ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Type to search across documentation or press{" "}
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    ESC
                  </kbd>{" "}
                  to close.
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No documents found matching &ldquo;
                  <span className="font-semibold text-foreground">{query}</span>
                  &rdquo;
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((doc) => {
                    const docSlug = doc.path.replace(/^\//, "")
                    return (
                      <Link
                        key={doc.path}
                        href={`/${lang}/docs/${docSlug}`}
                        onClick={closeSearch}
                        className="group flex items-center justify-between gap-3 rounded-xl p-3.5 transition-colors hover:bg-emerald-500/10"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText
                              size={16}
                              className="shrink-0 text-emerald-500"
                            />
                            <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-emerald-500">
                              {doc.title}
                            </span>
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {doc.category}
                            </span>
                          </div>
                          <p className="line-clamp-1 pl-6 text-xs text-muted-foreground">
                            {doc.purpose}
                          </p>
                        </div>
                        <ArrowRight
                          size={14}
                          className="shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-1 group-hover:text-emerald-500"
                        />
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
