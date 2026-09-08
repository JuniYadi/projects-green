"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import {
  TerminalWindow,
  ArrowsClockwise,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

export type StackTerminalProps = {
  stackId: string
  podName: string
  containerName?: string
  wsBaseUrl?: string
}

export function StackTerminal({
  stackId,
  podName,
  containerName,
  wsBaseUrl,
}: StackTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const connect = () => {
    if (!containerRef.current) return

    setStatus("connecting")
    setErrorMessage(null)

    // Dispose prior instances if reconnecting
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: "#09090b",
        foreground: "#f4f4f5",
        cursor: "#22c55e",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#ec4899",
        cyan: "#06b6d4",
        white: "#f4f4f5",
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Determine WebSocket base URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = wsBaseUrl || window.location.host
    const query = new URLSearchParams()
    query.set("pod", podName)
    if (containerName) {
      query.set("container", containerName)
    }

    const wsUrl = `${protocol}//${host}/ws/deploy/stacks/${encodeURIComponent(stackId)}/terminal?${query.toString()}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus("connected")
      term.focus()
      // Send initial dimensions
      ws.send(
        JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })
      )
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "stdout" && typeof msg.data === "string") {
          term.write(msg.data)
        } else if (msg.type === "error" && typeof msg.error === "string") {
          term.writeln(`\r\n\x1b[31m[error] ${msg.error}\x1b[0m`)
          setErrorMessage(msg.error)
        } else if (msg.type === "status" && msg.status === "disconnected") {
          setStatus("disconnected")
          term.writeln("\r\n\x1b[33m[session disconnected]\x1b[0m")
        }
      } catch {
        // Raw text stream fallback
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      setStatus("disconnected")
      term.writeln("\r\n\x1b[90mSession ended\x1b[0m")
    }

    ws.onerror = () => {
      setStatus("error")
      setErrorMessage("Failed to connect to terminal session")
      term.writeln("\r\n\x1b[31m[WebSocket connection error]\x1b[0m")
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stdin", data }))
      }
    })

    const handleResize = () => {
      if (
        fitAddonRef.current &&
        termRef.current &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        fitAddonRef.current.fit()
        wsRef.current.send(
          JSON.stringify({
            type: "resize",
            cols: termRef.current.cols,
            rows: termRef.current.rows,
          })
        )
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }

  useEffect(() => {
    const cleanup = connect()
    return () => {
      if (typeof cleanup === "function") cleanup()
      wsRef.current?.close()
      termRef.current?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackId, podName, containerName])
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-[#09090b]">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 font-mono text-muted-foreground">
          <TerminalWindow size={16} className="text-primary" />
          <span className="font-semibold text-foreground">{podName}</span>
          {containerName && (
            <span className="text-muted-foreground">({containerName})</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "connected"
                  ? "animate-pulse bg-emerald-500"
                  : status === "connecting"
                    ? "animate-pulse bg-amber-500"
                    : "bg-rose-500"
              }`}
            />
            <span className="text-[11px] text-muted-foreground capitalize">
              {status === "connected" ? "Live (sh)" : status}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={connect}
            disabled={status === "connecting"}
            className="h-7 gap-1 px-2 text-xs"
          >
            <ArrowsClockwise size={14} />
            Reconnect
          </Button>
        </div>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-500">
          <WarningCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Terminal Canvas Container */}
      <div
        ref={containerRef}
        className="min-h-[420px] w-full flex-1 p-3 font-mono text-sm focus:outline-none"
      />
    </div>
  )
}
