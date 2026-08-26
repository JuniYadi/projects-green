"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

export function CodeBlockCopyEnhancer() {
  const pathname = usePathname()

  React.useEffect(() => {
    const handleCopyClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        ".code-copy-btn"
      )
      if (!target) return

      e.stopPropagation()
      const wrapper = target.closest(".code-window-wrapper")
      const codeEl =
        wrapper?.querySelector("code") || wrapper?.querySelector("pre")
      const textToCopy = codeEl?.innerText || codeEl?.textContent || ""

      navigator.clipboard.writeText(textToCopy).then(() => {
        target.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" class="text-emerald-400" viewBox="0 0 256 256">
            <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path>
          </svg>
        `
        target.classList.add("border-emerald-500/40", "bg-emerald-500/10")
        setTimeout(() => {
          target.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256">
              <path d="M216,40H88A16,16,0,0,0,72,56V72H56A16,16,0,0,0,40,88V216a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V200h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM184,216H56V88H184V216Zm32-32H200V88a16,16,0,0,0-16-16H88V56H216V184Z"></path>
            </svg>
          `
          target.classList.remove("border-emerald-500/40", "bg-emerald-500/10")
        }, 2000)
      })
    }

    document.addEventListener("click", handleCopyClick)
    return () => document.removeEventListener("click", handleCopyClick)
  }, [pathname])

  return null
}
