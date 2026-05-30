"use client"

import { useRouter } from "next/navigation"
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
import { useTemplates, useSyncTemplate } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateList } from "@/modules/whatsapp/templates/ui/template-list"

export default function ConsoleTemplatesPage() {
  const router = useRouter()
  const { templates, loading, error, reload } = useTemplates()
  const { sync, syncing } = useSyncTemplate()

  const handleSyncAll = async () => {
    const unsynced = templates.filter(
      (t) => (t as any).syncStatus === "NOT_SYNCED" || t.id,
    )

    if (unsynced.length === 0) {
      toast.info("All templates are already synced.")
      return
    }

    let synced = 0
    for (const template of unsynced) {
      try {
        await sync(template.id)
        synced++
      } catch {
        // individual sync failure is handled by the hook
      }
    }

    if (synced > 0) {
      toast.success(`Synced ${synced} template${synced !== 1 ? "s" : ""}.`)
      void reload()
    }
  }

  const syncedCount = templates.filter(
    (t) => (t as any).syncStatus === "SYNCED",
  ).length
  const notSyncedCount = templates.filter(
    (t) => (t as any).syncStatus === "NOT_SYNCED",
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Manage your WhatsApp message templates for pre-approved communications.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Message Templates</CardTitle>
            <CardDescription>
              Manage your WhatsApp message templates
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
              {syncing ? "Syncing..." : "Sync Templates"}
            </Button>
            <Button onClick={() => router.push("./new")}>
              <Plus weight="bold" className="mr-2 size-4" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">Total Templates</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {syncedCount}
              </p>
              <p className="text-xs text-muted-foreground">Synced</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {notSyncedCount}
              </p>
              <p className="text-xs text-muted-foreground">Pending Sync</p>
            </div>
          </div>

          <TemplateList
            templates={templates}
            loading={loading}
            error={error}
            onRetry={() => void reload()}
            onCreate={() => router.push("./new")}
            onSelect={(id) => router.push(`./${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
