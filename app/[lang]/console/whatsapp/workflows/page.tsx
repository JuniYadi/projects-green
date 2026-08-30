"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Robot,
  Plus,
  ArrowRight,
  WhatsappLogo,
  CheckCircle,
  XCircle,
  GitFork,
  Sparkle,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type WorkflowListItem = {
  id: string
  name: string
  description?: string
  isActive: boolean
  trigger: {
    type: string
    keywords?: string[]
  }
  nodes: unknown[]
  edges: unknown[]
  device?: {
    id: string
    name: string
    phoneNumber: string
  }
}

export default function WhatsappWorkflowsPage() {
  const params = useParams()
  const lang = (params?.lang as string) || "en"
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await eden.api.whatsapp.workflows.get()
      if (res.data && "data" in res.data && Array.isArray(res.data.data)) {
        setWorkflows(res.data.data as WorkflowListItem[])
      }
    } catch (err) {
      console.warn("[workflows] load error:", err)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkflows()
  }, [loadWorkflows])
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI &amp; Bot Workflows
          </h1>
          <p className="text-sm text-muted-foreground">
            Rancang dan kelola alur otomatis WhatsApp cerdas berbasis AI dan
            Visual Canvas.
          </p>
        </div>

        <Button
          asChild
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Link href={`/${lang}/console/whatsapp/workflows/new/canvas`}>
            <Plus size={16} weight="bold" />
            <span>Buat Alur Canvas Baru</span>
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          Memuat daftar alur bot WhatsApp...
        </div>
      ) : workflows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Robot size={28} weight="duotone" />
          </div>
          <CardTitle className="text-base font-semibold">
            Belum Ada Alur Bot Terhubung
          </CardTitle>
          <CardDescription className="mt-1 max-w-md text-xs">
            Gunakan bantuan AI Copilot atau Canvas Visual untuk membuat alur bot
            otomatis pertama Anda dan hubungkan langsung ke nomor WhatsApp
            bisnis Anda.
          </CardDescription>
          <Button
            asChild
            className="mt-4 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
          >
            <Link href={`/${lang}/console/whatsapp/workflows/new/canvas`}>
              <Sparkle size={14} weight="fill" />
              <span>Buka Visual Canvas &amp; AI Copilot</span>
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <Card
              key={wf.id}
              className="flex flex-col justify-between border-border"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                      {wf.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {wf.description || "Alur bot otomatis WhatsApp"}
                    </CardDescription>
                  </div>
                  {wf.isActive ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 bg-emerald-500/10 text-[10px] text-emerald-600"
                    >
                      <CheckCircle size={12} weight="fill" /> Aktif
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px] text-muted-foreground"
                    >
                      <XCircle size={12} /> Nonaktif
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <GitFork size={14} />
                    <span>{wf.nodes?.length || 0} Nodes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Robot size={14} />
                    <span>Trigger: {wf.trigger?.type || "Keyword"}</span>
                  </div>
                </div>

                {wf.device && (
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/50 p-2 text-xs">
                    <WhatsappLogo
                      size={16}
                      className="text-emerald-500"
                      weight="fill"
                    />
                    <span className="font-medium text-foreground">
                      {wf.device.name}
                    </span>
                    <span className="text-muted-foreground">
                      ({wf.device.phoneNumber})
                    </span>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs"
                  >
                    <Link
                      href={`/${lang}/console/whatsapp/workflows/${wf.id}/canvas`}
                    >
                      <span>Buka &amp; Edit di Canvas</span>
                      <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
