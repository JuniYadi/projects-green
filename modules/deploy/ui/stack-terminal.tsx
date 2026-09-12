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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ExecTargetSelection } from "@/modules/deploy/pod-exec.service"
import type { TerminalTargetDTO } from "@/modules/deploy/terminal-target.dto"

export type StackTerminalProps = {
  stackId: string
  locale: string
  wsBaseUrl?: string
}

// Pod and container names are DNS-1123 labels, so "/" never appears in them.
const toOptionValue = ({ pod, container }: ExecTargetSelection) =>
  `${pod}/${container}`

export function StackTerminal({
  stackId,
  locale,
  wsBaseUrl,
}: StackTerminalProps) {
  const isId = locale.startsWith("id")
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noRunningPod, setNoRunningPod] = useState(false)
  const [targets, setTargets] = useState<TerminalTargetDTO[]>([])
  const [selected, setSelected] = useState<ExecTargetSelection | null>(null)

  const sendResize = () => {
    const ws = wsRef.current
    const term = termRef.current
    if (!ws || !term || ws.readyState !== WebSocket.OPEN) return
    fitAddonRef.current?.fit()
    ws.send(
      JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })
    )
  }

  // Without a target the gateway picks the first ready replica.
  const connect = (target?: ExecTargetSelection) => {
    if (!containerRef.current) return

    setStatus("connecting")
    setErrorMessage(null)
    setNoRunningPod(false)

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
    if (target) {
      query.set("pod", target.pod)
      query.set("container", target.container)
    }
    const search = query.toString() ? `?${query.toString()}` : ""

    const wsUrl = `${protocol}//${host}/ws/deploy/stacks/${encodeURIComponent(stackId)}/terminal${search}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // A replaced socket still fires close events; ignore them so they do not
    // clobber the new session's state or write into a disposed terminal.
    const isCurrent = () => wsRef.current === ws

    ws.onmessage = (event) => {
      if (!isCurrent()) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "stdout" && typeof msg.data === "string") {
          term.write(msg.data)
        } else if (msg.type === "targets" && Array.isArray(msg.targets)) {
          setTargets(msg.targets)
          setSelected(msg.selected ?? null)
        } else if (msg.type === "error" && msg.code === "NO_RUNNING_POD") {
          setNoRunningPod(true)
        } else if (msg.type === "error" && typeof msg.error === "string") {
          term.writeln(`\r\n\x1b[31m[error] ${msg.error}\x1b[0m`)
          setErrorMessage(msg.error)
        } else if (msg.type === "status" && msg.status === "connected") {
          // The gateway only forwards resize once the kube exec stream is
          // open, so the initial size is sent here rather than on ws.onopen.
          setStatus("connected")
          term.focus()
          sendResize()
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
      if (!isCurrent()) return
      setStatus("disconnected")
      term.writeln("\r\n\x1b[90mSession ended\x1b[0m")
    }

    ws.onerror = () => {
      if (!isCurrent()) return
      setStatus("error")
      setErrorMessage(
        isId
          ? "Gagal terhubung ke sesi terminal"
          : "Failed to connect to terminal session"
      )
      term.writeln("\r\n\x1b[31m[WebSocket connection error]\x1b[0m")
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stdin", data }))
      }
    })
  }

  useEffect(() => {
    connect()
    window.addEventListener("resize", sendResize)
    return () => {
      window.removeEventListener("resize", sendResize)
      const ws = wsRef.current
      wsRef.current = null
      ws?.close()
      termRef.current?.dispose()
      termRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackId])

  const readyText = (ready: boolean) =>
    ready ? (isId ? "Siap" : "Ready") : isId ? "Belum siap" : "Not ready"

  const options = targets.flatMap((target) =>
    target.containers.map((container) => ({
      value: toOptionValue({ pod: target.pod, container }),
      label:
        target.containers.length > 1
          ? `${target.label} · ${container}`
          : target.label,
      ready: target.ready,
    }))
  )
  const selectedValue = selected ? toOptionValue(selected) : undefined
  const current = options.find((option) => option.value === selectedValue)

  const statusText = {
    connecting: isId ? "Menghubungkan" : "Connecting",
    connected: "Live (sh)",
    disconnected: isId ? "Terputus" : "Disconnected",
    error: isId ? "Gagal" : "Error",
  }[status]

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-[#09090b]">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TerminalWindow size={16} className="text-primary" />
          {options.length > 1 ? (
            <Select
              value={selectedValue}
              onValueChange={(value) => {
                const [pod, container] = value.split("/")
                const next = { pod, container }
                setSelected(next)
                connect(next)
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-7 text-xs"
                aria-label={isId ? "Pilih replica" : "Choose replica"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} · {readyText(option.ready)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : current ? (
            <span className="font-semibold text-foreground">
              {current.label} · {readyText(current.ready)}
            </span>
          ) : null}
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
            <span className="text-[11px] text-muted-foreground">
              {statusText}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => connect()}
            disabled={status === "connecting"}
            className="h-7 gap-1 px-2 text-xs"
          >
            <ArrowsClockwise size={14} />
            {isId ? "Hubungkan ulang" : "Reconnect"}
          </Button>
        </div>
      </div>

      {noRunningPod && (
        <div
          className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/5 p-4 text-sm"
          role="alert"
        >
          <WarningCircle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {isId ? "Tidak ada pod aktif" : "No active pod"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isId
                ? "Terminal butuh pod yang sedang jalan. Cek tab Log untuk melihat kenapa aplikasi belum aktif."
                : "A shell needs a running pod. Check the Logs tab to see why the app is not up."}
            </p>
          </div>
        </div>
      )}

      {/* Error alert banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-500">
          <WarningCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Terminal Canvas Container. Kept mounted (hidden) so Reconnect can
          reattach xterm once a pod comes up. */}
      <div
        ref={containerRef}
        className={`min-h-[420px] w-full flex-1 p-3 font-mono text-sm focus:outline-none ${noRunningPod ? "hidden" : ""}`}
      />
    </div>
  )
}
