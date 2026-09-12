"use client"

import dynamic from "next/dynamic"

// xterm touches `window` at import time, so keep it off the server render.
const StackTerminal = dynamic(
  () =>
    import("@/modules/deploy/ui/stack-terminal").then((m) => m.StackTerminal),
  { ssr: false }
)

export type TabTerminalProps = {
  stackId: string
  locale: string
}

export function TabTerminal({ stackId, locale }: TabTerminalProps) {
  const isId = locale.startsWith("id")

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isId
          ? "Shell langsung di dalam container aplikasi kamu. Sesi berakhir saat tab ditutup."
          : "A shell inside your application container. The session ends when you leave this tab."}
      </p>
      <StackTerminal
        stackId={stackId}
        locale={locale}
        {...(process.env.NEXT_PUBLIC_TERMINAL_WS_HOST
          ? { wsBaseUrl: process.env.NEXT_PUBLIC_TERMINAL_WS_HOST }
          : {})}
      />
    </div>
  )
}
