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

      if (headingElements.length === 0) return

      // Offset from top of viewport for trigger boundary
      const scrollPosition = window.scrollY + 160

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
        headingElements[0].getBoundingClientRect().top + window.scrollY - 160
      ) {
        setActiveId("")
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    // Initial check
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
      const headerOffset = 100
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

  if (toc.length === 0) return null

  return (
    <nav className="space-y-1 text-xs">
      {toc.map((heading) => {
        const isActive = activeId === heading.id
        return (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            onClick={(e) => scrollToHeading(e, heading.id)}
            className={`block rounded-lg px-2.5 py-1.5 leading-relaxed transition-all ${
              isActive
                ? "bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {heading.text}
          </a>
        )
      })}
    </nav>
  )
}
