"use client"

import * as React from "react"

interface OnThisPageProps {
  toc: Array<{ id: string; text: string }>
}

export function OnThisPage({ toc }: OnThisPageProps) {
  const [activeId, setActiveId] = React.useState<string>("")

  React.useEffect(() => {
    if (toc.length === 0) return

    const handleScroll = () => {
      const headingElements = toc
        .map((item) => document.getElementById(item.id))
        .filter((el): el is HTMLElement => el !== null)

      const scrollPosition = window.scrollY + 140

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const el = headingElements[i]
        if (el.offsetTop <= scrollPosition) {
          setActiveId(toc[i].id)
          return
        }
      }

      if (
        headingElements.length > 0 &&
        window.scrollY < headingElements[0].offsetTop - 140
      ) {
        setActiveId("")
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [toc])

  if (toc.length === 0) return null

  return (
    <nav className="space-y-1.5 text-xs">
      {toc.map((heading) => {
        const isActive = activeId === heading.id
        return (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`block rounded-md px-2.5 py-1.5 leading-relaxed transition-colors ${
              isActive
                ? "bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {heading.text}
          </a>
        )
      })}
    </nav>
  )
}
