"use client"

import * as React from "react"
import { ArrowUp, Link as LinkIcon, Check } from "@phosphor-icons/react"

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

interface OnThisPageProps {
  toc: TocItem[]
  lang: string
}

export function OnThisPage({ toc, lang }: OnThisPageProps) {
  const [activeId, setActiveId] = React.useState<string>("")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (toc.length === 0) return

    const handleScroll = () => {
      const headingElements = toc
        .map((item) => document.getElementById(item.id))
        .filter((el): el is HTMLElement => el !== null)

      if (headingElements.length === 0) return

      const scrollPosition = window.scrollY + 140

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const el = headingElements[i]
        const top = el.getBoundingClientRect().top + window.scrollY
        if (top <= scrollPosition) {
          setActiveId(toc[i].id)
          return
        }
      }

      if (
        window.scrollY <
        headingElements[0].getBoundingClientRect().top + window.scrollY - 140
      ) {
        setActiveId("")
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    const timeout = setTimeout(handleScroll, 100)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      clearTimeout(timeout)
    }
  }, [toc])

  const scrollToHeading = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (target) {
      const headerOffset = 90
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
      window.history.pushState(null, "", `#${id}`)
      setActiveId(id)
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const copyPageLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (toc.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Nested TOC Tree */}
      <nav className="relative space-y-1 text-xs">
        {/* Left vertical subtle guide rail */}
        <div className="absolute top-1 bottom-1 left-1 w-px bg-border/50" />

        {toc.map((heading) => {
          const isActive = activeId === heading.id
          const isH3 = heading.level === 3

          return (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              onClick={(e) => scrollToHeading(e, heading.id)}
              className={`group relative block rounded-md py-1 transition-all ${
                isH3 ? "pl-5 text-[11px]" : "pl-3 text-xs"
              } ${
                isActive
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-normal text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Active node pip on the rail */}
              {isActive && (
                <span className="absolute top-1/2 left-[3px] size-1.5 -translate-y-1/2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              )}
              <span className="line-clamp-2 leading-relaxed">
                {heading.text}
              </span>
            </a>
          )
        })}
      </nav>

      {/* Utility Actions (Back to Top & Copy Link) */}
      <div className="space-y-1 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={scrollToTop}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowUp size={13} />
          <span>{lang === "id" ? "Kembali ke Atas" : "Back to top"}</span>
        </button>
        <button
          type="button"
          onClick={copyPageLink}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                {lang === "id" ? "Tautan Tersalin!" : "Link Copied!"}
              </span>
            </>
          ) : (
            <>
              <LinkIcon size={13} />
              <span>
                {lang === "id" ? "Salin Tautan Halaman" : "Copy page link"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
