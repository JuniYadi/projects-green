"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowRight,
  CheckCircle,
  ChatCircleDots,
  Flask,
  GitFork,
  PaintBrush,
  Plus,
  Robot,
  Sparkle,
  Star,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { WORKFLOW_TEMPLATES } from "@/modules/whatsapp/workflow/workflow-templates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type WorkflowListItem = {
  id: string
  name: string
  description?: string
  isActive: boolean
  isDefault?: boolean
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
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const locale = resolveLocaleOrDefault(lang)
  const t = getMessages(locale).console.whatsappWorkflows
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
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <Button
          asChild
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Link href={`/${lang}/console/whatsapp/workflows/new/canvas`}>
            <Plus size={16} weight="bold" />
            <span>{t.createNewButton}</span>
          </Link>
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          {t.loadingList}
        </div>
      ) : workflows.length === 0 ? (
        <div className="space-y-6">
          <Card className="overflow-hidden border-border">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">
                    {t.emptyState.title}
                  </h2>
                  <CardDescription className="max-w-2xl text-sm">
                    {t.emptyState.description}
                  </CardDescription>
                </div>
                <Button
                  asChild
                  className="shrink-0 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  size="sm"
                >
                  <Link href={`/${lang}/console/whatsapp/workflows/new/canvas`}>
                    <Sparkle size={14} weight="fill" />
                    <span>{t.emptyState.createCta}</span>
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: t.emptyState.step1Title,
                    description: t.emptyState.step1Desc,
                    icon: ChatCircleDots,
                  },
                  {
                    title: t.emptyState.step2Title,
                    description: t.emptyState.step2Desc,
                    icon: PaintBrush,
                  },
                  {
                    title: t.emptyState.step3Title,
                    description: t.emptyState.step3Desc,
                    icon: Flask,
                  },
                ].map((step, index) => {
                  const Icon = step.icon
                  return (
                    <div
                      className="relative rounded-xl border border-border bg-card p-4"
                      key={step.title}
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-600">
                          {index + 1}
                        </span>
                        <Icon
                          aria-hidden="true"
                          className="text-muted-foreground"
                          size={20}
                          weight="duotone"
                        />
                      </div>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="workflow-templates-heading">
            <h2
              className="mb-3 text-base font-semibold"
              id="workflow-templates-heading"
            >
              {t.templates.heading}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {WORKFLOW_TEMPLATES.map((template) => {
                const title =
                  t.templates[template.titleKey as keyof typeof t.templates]
                const description =
                  t.templates[template.descKey as keyof typeof t.templates]
                const href =
                  `/${lang}/console/whatsapp/workflows/new/canvas` +
                  `?template=${template.id}`

                return (
                  <Card
                    className="flex flex-col border-border"
                    key={template.id}
                  >
                    <CardHeader className="pb-3">
                      <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Robot size={19} weight="duotone" />
                      </div>
                      <CardTitle className="text-sm">{title}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed">
                        {description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto pt-0">
                      <Button
                        asChild
                        className="w-full justify-between text-xs"
                        size="sm"
                        variant="outline"
                      >
                        <Link
                          href={href}
                          aria-label={`${t.templates.useTemplate}: ${title}`}
                        >
                          <span>{t.templates.useTemplate}</span>
                          <ArrowRight size={14} />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        </div>
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
                      {wf.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {wf.isDefault && (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        <Star size={12} weight="fill" /> {t.card.defaultBadge}
                      </Badge>
                    )}
                    {wf.isActive ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-emerald-500/10 text-[10px] text-emerald-600"
                      >
                        <CheckCircle size={12} weight="fill" />{" "}
                        {t.card.activeBadge}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] text-muted-foreground"
                      >
                        <XCircle size={12} /> {t.card.inactiveBadge}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <GitFork size={14} />
                    <span>
                      {t.card.nodesCount.replace(
                        "{count}",
                        String(wf.nodes?.length || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Robot size={14} />
                    <span>
                      {t.card.triggerPrefix}
                      {wf.trigger?.type}
                    </span>
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
                      <span>{t.card.openCanvas}</span>
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
