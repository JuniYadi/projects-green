"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, TerminalWindow, X } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { TabTerminal } from "@/modules/deploy/ui/operate/tab-terminal"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"

export default function PlatformTerminalStandalonePage() {
  const params = useParams<{ lang?: string; slug?: string }>()
  const router = useRouter()
  const locale = resolveLocaleOrDefault(params?.lang)
  const slug = params?.slug ?? ""
  const isId = locale.startsWith("id")

  const [stack, setStack] = useState<StackSummaryDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    const loadStack = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: payload } = await eden.api.deploy.apps[slug].get()
        if (!payload || !payload.ok || !payload.data) {
          throw new Error(payload?.message ?? "Unable to load platform app.")
        }
        if (!cancelled) {
          setStack(payload.data.stack)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load platform app."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadStack()
    return () => {
      cancelled = true
    }
  }, [slug])

  const appConsoleUrl = `/${locale}/console/app/platform/${slug}?tab=terminal`

  const handleCloseWindow = () => {
    if (typeof window !== "undefined" && window.opener) {
      window.close()
    } else {
      router.push(appConsoleUrl)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex h-screen w-screen flex-col items-center justify-center bg-[#09090b] text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <p className="font-mono text-xs">
            {isId ? "Menyiapkan terminal..." : "Preparing terminal..."}
          </p>
        </div>
      </div>
    )
  }

  if (error || !stack) {
    return (
      <div className="fixed inset-0 flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#09090b] p-6 text-zinc-400">
        <p className="text-sm text-rose-400">{error ?? "App not found"}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(appConsoleUrl)}
          className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <ArrowLeft size={14} className="mr-1.5" />
          {isId ? "Kembali ke Console" : "Back to Console"}
        </Button>
      </div>
    )
  }

  const tone = STATUS_TONE[stack.status] ?? STATUS_TONE.idle
  const statusLabel = DEPLOY_STATUS_LABELS[stack.status] ?? stack.status

  return (
    <div className="fixed inset-0 flex h-screen w-screen flex-col overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Standalone Proxmox VNC-style Minimal Top Bar */}
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800/90 bg-zinc-950 px-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Link
            href={appConsoleUrl}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            title={isId ? "Kembali ke Console" : "Back to Console"}
          >
            <ArrowLeft size={13} />
            <span className="text-[11px]">{isId ? "Konsol" : "Console"}</span>
          </Link>
          <div className="h-3.5 w-px bg-zinc-800" />
          <TerminalWindow size={15} className="text-emerald-400" />
          <span className="font-semibold text-zinc-200">{stack.name}</span>
          <span className="font-mono text-[11px] text-zinc-500">
            ({stack.slug})
          </span>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCloseWindow}
            className="h-6 gap-1 px-2 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title={isId ? "Tutup jendela" : "Close window"}
          >
            <X size={13} />
            <span>{isId ? "Tutup" : "Close"}</span>
          </Button>
        </div>
      </header>

      {/* Main Terminal Viewport (100% focused, borderless, seamless) */}
      <main className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-[#09090b]">
        <TabTerminal
          stackId={stack.id}
          locale={locale}
          fillHeight={true}
          isActive={true}
        />
      </main>
    </div>
  )
}
