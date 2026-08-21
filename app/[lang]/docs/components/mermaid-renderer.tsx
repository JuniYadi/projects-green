"use client"

import * as React from "react"
import Script from "next/script"
import { useTheme } from "next-themes"
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void
      run: (options?: {
        nodes?: HTMLElement[] | NodeListOf<HTMLElement>
      }) => Promise<void>
    }
  }
}

export function MermaidRenderer() {
  const { resolvedTheme } = useTheme()
  const [modalSvg, setModalSvg] = React.useState<string | null>(null)
  const [modalScale, setModalScale] = React.useState(1.25)

  const attachToolbars = React.useCallback(() => {
    const containers =
      document.querySelectorAll<HTMLElement>(".mermaid-container")
    containers.forEach((container) => {
      // Check if toolbar already injected
      if (container.querySelector(".mermaid-toolbar")) return

      const toolbar = document.createElement("div")
      toolbar.className =
        "mermaid-toolbar absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md opacity-90 transition-opacity hover:opacity-100 z-10"

      let currentScale = 1.0

      const updateScale = (delta: number) => {
        currentScale = Math.min(Math.max(currentScale + delta, 0.6), 2.5)
        const svg = container.querySelector<SVGElement>("svg")
        if (svg) {
          svg.style.transform = `scale(${currentScale})`
          svg.style.transformOrigin = "center top"
          svg.style.transition = "transform 0.15s ease-out"
        }
      }

      // Zoom in button
      const zoomInBtn = document.createElement("button")
      zoomInBtn.type = "button"
      zoomInBtn.title = "Zoom In"
      zoomInBtn.className =
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      zoomInBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Zm112,0a8,8,0,0,1-8,8H120v24a8,8,0,0,1-16,0V120H80a8,8,0,0,1,0-16h24V80a8,8,0,0,1,16,0v24h24A8,8,0,0,1,152,112Z"></path></svg>'
      zoomInBtn.onclick = (e) => {
        e.stopPropagation()
        updateScale(0.2)
      }

      // Zoom out button
      const zoomOutBtn = document.createElement("button")
      zoomOutBtn.type = "button"
      zoomOutBtn.title = "Zoom Out"
      zoomOutBtn.className =
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      zoomOutBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Zm112,0a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h64A8,8,0,0,1,152,112Z"></path></svg>'
      zoomOutBtn.onclick = (e) => {
        e.stopPropagation()
        updateScale(-0.2)
      }

      // Reset button
      const resetBtn = document.createElement("button")
      resetBtn.type = "button"
      resetBtn.title = "Reset Zoom"
      resetBtn.className =
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      resetBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.6A79.66,79.66,0,0,0,128,208a80,80,0,1,0-80-80V136h16a8,8,0,0,1,5.66,13.66l-24,24a8,8,0,0,1-11.32,0l-24-24A8,8,0,0,1,16,136H32V128a96,96,0,1,1,192,0Z"></path></svg>'
      resetBtn.onclick = (e) => {
        e.stopPropagation()
        currentScale = 1.0
        const svg = container.querySelector<SVGElement>("svg")
        if (svg) {
          svg.style.transform = "scale(1)"
          svg.style.transformOrigin = "center top"
        }
      }

      // Fullscreen Modal Expand button
      const expandBtn = document.createElement("button")
      expandBtn.type = "button"
      expandBtn.title = "Expand Diagram Modal"
      expandBtn.className =
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      expandBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48V88a8,8,0,0,1-16,0V67.31l-42.34,42.35a8,8,0,0,1-11.32-11.32L188.69,56H168a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM109.66,146.34,67.31,188.69V168a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8h48a8,8,0,0,0,0-16H86.63l42.35-42.34a8,8,0,0,0-11.32-11.32Z"></path></svg>'
      expandBtn.onclick = (e) => {
        e.stopPropagation()
        const svg = container.querySelector<SVGElement>("svg")
        if (svg) {
          setModalSvg(svg.outerHTML)
          setModalScale(1.3)
        }
      }

      toolbar.appendChild(zoomInBtn)
      toolbar.appendChild(zoomOutBtn)
      toolbar.appendChild(resetBtn)
      toolbar.appendChild(expandBtn)

      container.style.position = "relative"
      container.appendChild(toolbar)
    })
  }, [])

  const runMermaid = React.useCallback(async () => {
    if (typeof window === "undefined" || !window.mermaid) return

    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === "dark" ? "dark" : "default",
        securityLevel: "loose",
        fontFamily: "inherit",
        fontSize: 15,
        flowchart: {
          curve: "basis",
          nodeSpacing: 50,
          rankSpacing: 50,
          useMaxWidth: false,
        },
      })

      const elements = document.querySelectorAll<HTMLElement>("pre.mermaid")
      if (elements.length === 0) return

      const targets: HTMLElement[] = []
      elements.forEach((el) => {
        if (!el.getAttribute("data-mermaid-src")) {
          el.setAttribute("data-mermaid-src", el.textContent || "")
          targets.push(el)
        } else if (!el.getAttribute("data-processed")) {
          targets.push(el)
        }
      })

      if (targets.length > 0) {
        await window.mermaid.run({ nodes: targets })
      }

      // Ensure SVG is responsive, legible and nicely scaled in the canvas
      document
        .querySelectorAll<SVGElement>(".mermaid-container svg")
        .forEach((svg) => {
          svg.style.width = "auto"
          svg.style.maxWidth = "100%"
          svg.style.height = "auto"
          svg.style.minHeight = "200px"
          svg.style.display = "block"
          svg.style.margin = "0 auto"
        })

      attachToolbars()
    } catch (err) {
      console.warn("[Mermaid] Render error:", err)
    }
  }, [resolvedTheme, attachToolbars])

  React.useEffect(() => {
    runMermaid()
    const interval = setInterval(() => {
      if (window.mermaid) {
        runMermaid()
      }
    }, 300)

    const timeout = setTimeout(() => clearInterval(interval), 3000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [runMermaid])

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          runMermaid()
        }}
      />

      {/* Fullscreen Interactive Diagram Modal */}
      <Dialog
        open={!!modalSvg}
        onOpenChange={(open) => !open && setModalSvg(null)}
      >
        <DialogContent className="flex h-[80vh] w-[80vw] max-w-[85vw] flex-col gap-4 p-6 sm:max-w-[80vw]">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold">
              Diagram Viewer
            </DialogTitle>
            <div className="mr-6 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModalScale((s) => Math.min(s + 0.2, 3.0))}
                title="Zoom In"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground transition-colors hover:bg-muted"
              >
                <MagnifyingGlassPlus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setModalScale((s) => Math.max(s - 0.2, 0.6))}
                title="Zoom Out"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground transition-colors hover:bg-muted"
              >
                <MagnifyingGlassMinus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setModalScale(1.2)}
                title="Reset Scale"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground transition-colors hover:bg-muted"
              >
                <ArrowCounterClockwise size={16} />
              </button>
            </div>
          </DialogHeader>

          <div className="flex h-full flex-1 items-center justify-center overflow-auto rounded-xl border border-border/40 bg-muted/10 p-6">
            {modalSvg && (
              <div
                style={{
                  transform: `scale(${modalScale})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
                className="flex min-h-[400px] w-full items-center justify-center [&_svg]:h-auto [&_svg]:max-w-none"
                dangerouslySetInnerHTML={{ __html: modalSvg }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
