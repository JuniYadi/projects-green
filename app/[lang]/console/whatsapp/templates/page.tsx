"use client"

import { useParams, useRouter } from "next/navigation"
import { Plus, ArrowsClockwise } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useTemplates,
  useSyncTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateList } from "@/modules/whatsapp/templates/ui/template-list"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export default function ConsoleTemplatesPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const templatesBasePath = localizePathname({
    pathname: "/console/whatsapp/templates",
    locale,
  })
  const { templates, loading, error, reload } = useTemplates()
  const { sync, syncing } = useSyncTemplate()

  const handleSyncAll = async () => {
    const unsynced = templates.filter((t) => t.syncStatus === "NOT_SYNCED")

    if (unsynced.length === 0) {
      toast.info(messages.console.whatsapp.templates.allSynced)
      return
    }

    let synced = 0
    let failed = 0
    for (const template of unsynced) {
      try {
        await sync(template.id)
        synced++
      } catch {
        failed++
      }
    }

    if (synced > 0) {
      toast.success(
        messages.console.whatsapp.templates.syncedCount.replace(
          "{count}",
          String(synced)
        )
      )
      void reload()
    }

    if (failed > 0) {
      toast.error(
        messages.console.whatsapp.templates.syncFailed.replace(
          "{count}",
          String(failed)
        )
      )
    }
  }

  const syncedCount = templates.filter((t) => t.syncStatus === "SYNCED").length
  const notSyncedCount = templates.filter(
    (t) => t.syncStatus === "NOT_SYNCED"
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.console.whatsapp.templates.heading}
        </h1>
        <p className="text-muted-foreground">
          {messages.console.whatsapp.templates.description}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {messages.console.whatsapp.templates.cardTitle}
            </CardTitle>
            <CardDescription>
              {messages.console.whatsapp.templates.cardDescription}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void handleSyncAll()}
              disabled={syncing || loading}
              variant="outline"
            >
              <ArrowsClockwise
                className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing
                ? messages.console.whatsapp.templates.syncing
                : messages.console.whatsapp.templates.syncTemplates}
            </Button>
            <Button onClick={() => router.push(`${templatesBasePath}/new`)}>
              <Plus weight="bold" className="mr-2 size-4" />
              {messages.console.whatsapp.templates.createTemplate}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">
                {messages.console.whatsapp.templates.totalTemplates}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{syncedCount}</p>
              <p className="text-xs text-muted-foreground">
                {messages.console.whatsapp.templates.synced}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {notSyncedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {messages.console.whatsapp.templates.pendingSync}
              </p>
            </div>
          </div>

          <TemplateList
            templates={templates}
            loading={loading}
            error={error}
            onRetry={() => void reload()}
            onCreate={() => router.push(`${templatesBasePath}/new`)}
            onSelect={(id) => router.push(`${templatesBasePath}/${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
