"use client"

import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { WarningCircle } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import type { ClusterTelemetrySummary } from "@/modules/deploy/telemetry.types"

// xterm touches `window` at import time, so keep it off the server render.
const StackTerminal = dynamic(
  () =>
    import("@/modules/deploy/ui/stack-terminal").then((m) => m.StackTerminal),
  { ssr: false }
)

export type TabTerminalProps = {
  stackId: string
  slug: string
  locale: string
}

export function TabTerminal({ stackId, slug, locale }: TabTerminalProps) {
  const isId = locale.startsWith("id")

  const { data, isLoading, isError } = useQuery<ClusterTelemetrySummary>({
    queryKey: ["deploy", "app-health", slug],
    queryFn: async () => {
      const { data: payload } = await eden.api.deploy.telemetry.get({
        $query: { range: "1h", appSlug: slug },
      })
      if (!payload || !payload.ok || !payload.data) {
        throw new Error(payload?.message ?? "Unable to load pods")
      }
      return payload.data
    },
  })

  const pod = data?.pods?.[0]

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        {isId ? "Mencari pod aktif…" : "Looking for an active pod…"}
      </p>
    )
  }

  if (isError || !pod) {
    return (
      <div
        className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
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
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isId
          ? "Shell langsung di dalam container aplikasi kamu. Sesi berakhir saat tab ditutup."
          : "A shell inside your application container. The session ends when you leave this tab."}
      </p>
      <StackTerminal
        stackId={stackId}
        podName={pod.pod}
        {...(process.env.NEXT_PUBLIC_TERMINAL_WS_HOST
          ? { wsBaseUrl: process.env.NEXT_PUBLIC_TERMINAL_WS_HOST }
          : {})}
      />
    </div>
  )
}
