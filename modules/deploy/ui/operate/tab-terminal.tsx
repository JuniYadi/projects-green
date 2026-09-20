"use client"

import dynamic from "next/dynamic"
import { Spinner } from "@phosphor-icons/react"

// xterm touches `window` at import time, so keep it off the server render.
const StackTerminal = dynamic(
  () =>
    import("@/modules/deploy/ui/stack-terminal").then((m) => m.StackTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] w-full flex-col items-center justify-center rounded-xl border border-zinc-800 bg-[#09090b] text-zinc-400">
        <Spinner size={24} className="animate-spin text-emerald-500" />
        <p className="mt-2 font-mono text-xs">Loading terminal session...</p>
      </div>
    ),
  }
)

export type TabTerminalProps = {
  stackId: string
  locale: string
  onPopOut?: () => void
  isActive?: boolean
  fillHeight?: boolean
  onMinimize?: () => void
  onClose?: () => void
}

export function TabTerminal({
  stackId,
  locale,
  onPopOut,
  isActive = true,
  fillHeight = false,
  onMinimize,
  onClose,
}: TabTerminalProps) {
  const isId = locale.startsWith("id")

  return (
    <div
      className={`w-full min-w-0 ${
        fillHeight ? "flex h-full flex-col" : "space-y-3"
      }`}
    >
      {!fillHeight && (
        <p className="text-xs text-muted-foreground">
          {isId
            ? "Shell langsung di dalam container aplikasi kamu. Sesi tetap aktif saat beralih tab atau dapat dibuka di jendela terpisah."
            : "A shell inside your application container. Sessions stay active while switching tabs or can be opened in a separate window."}
        </p>
      )}
      <StackTerminal
        stackId={stackId}
        locale={locale}
        onPopOut={onPopOut}
        isActive={isActive}
        fillHeight={fillHeight}
        onMinimize={onMinimize}
        onClose={onClose}
        {...(process.env.NEXT_PUBLIC_TERMINAL_WS_HOST
          ? { wsBaseUrl: process.env.NEXT_PUBLIC_TERMINAL_WS_HOST }
          : {})}
      />
    </div>
  )
}
