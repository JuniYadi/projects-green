/**
 * Raw Payload Viewer — collapsible JSON viewer with copy-to-clipboard
 *
 * Displays a raw webhook payload as pretty-printed JSON inside a <details>
 * element with a copy button and horizontal scroll for long lines.
 */

"use client"

import { useCallback, useState } from "react"
import { CopySimple, CheckCircle } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawPayloadViewerProps = {
  payload: Record<string, unknown>
  defaultExpanded?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RawPayloadViewer({
  payload,
  defaultExpanded = false,
}: RawPayloadViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — silently fail
    }
  }, [payload])

  // Build a short preview (first 120 chars of stringified payload)
  const preview = JSON.stringify(payload).slice(0, 120)

  return (
    <details
      open={defaultExpanded}
      className="group rounded-md border bg-muted/30"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
        <span className="truncate font-mono">{preview}…</span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
          className="shrink-0"
          aria-label="Copy payload to clipboard"
        >
          {copied ? (
            <CheckCircle className="size-3.5 text-emerald-500" />
          ) : (
            <CopySimple className="size-3.5" />
          )}
        </Button>
      </summary>
      <div className="overflow-x-auto border-t">
        <pre
          className={cn(
            "p-3 text-xs leading-relaxed",
            "text-foreground/80",
            "min-w-0"
          )}
        >
          <code>{JSON.stringify(payload, null, 2)}</code>
        </pre>
      </div>
    </details>
  )
}
