"use client"

import * as React from "react"

export function CodeBlockCopyEnhancer() {
  React.useEffect(() => {
    const preBlocks = document.querySelectorAll<HTMLElement>("article pre")

    preBlocks.forEach((pre) => {
      // Don't add button if it's a mermaid diagram container
      if (
        pre.classList.contains("mermaid") ||
        pre.closest(".mermaid-container")
      ) {
        return
      }
      if (pre.querySelector(".code-copy-btn")) return

      pre.style.position = "relative"

      const button = document.createElement("button")
      button.type = "button"
      button.className =
        "code-copy-btn absolute right-3 top-3 flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-muted hover:text-foreground"
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
          <path d="M216,40H88A16,16,0,0,0,72,56V72H56A16,16,0,0,0,40,88V216a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V200h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM184,216H56V88H184V216Zm32-32H200V88a16,16,0,0,0-16-16H88V56H216V184Z"></path>
        </svg>
        <span>Copy</span>
      `

      button.onclick = (e) => {
        e.stopPropagation()
        const codeElement = pre.querySelector("code") || pre
        const textToCopy =
          codeElement.innerText || codeElement.textContent || ""

        navigator.clipboard.writeText(textToCopy).then(() => {
          button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="text-emerald-500" viewBox="0 0 256 256">
              <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path>
            </svg>
            <span class="text-emerald-600 dark:text-emerald-400">Copied!</span>
          `
          setTimeout(() => {
            button.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                <path d="M216,40H88A16,16,0,0,0,72,56V72H56A16,16,0,0,0,40,88V216a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V200h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM184,216H56V88H184V216Zm32-32H200V88a16,16,0,0,0-16-16H88V56H216V184Z"></path>
              </svg>
              <span>Copy</span>
            `
          }, 2000)
        })
      }

      pre.appendChild(button)
    })
  }, [])

  return null
}
