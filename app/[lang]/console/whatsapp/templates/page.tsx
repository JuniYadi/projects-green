"use client"

import * as React from "react"
import { Lightning, ArrowsClockwise, CheckCircle, Clock, XCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TemplateItem = {
  id: string
  name: string
  slug: string
  syncStatus: string
  metaStatus: string | null
}

function TemplateStatusBadge({ status }: { status: string }) {
  const config = {
    NOT_SYNCED: {
      label: "Not Synced",
      icon: Clock,
      className: "text-gray-500 bg-gray-50 dark:bg-gray-900/20",
    },
    SYNCING: {
      label: "Syncing",
      icon: ArrowsClockwise,
      className: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
    SYNCED: {
      label: "Synced",
      icon: CheckCircle,
      className: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
    FAILED: {
      label: "Failed",
      icon: XCircle,
      className: "text-red-600 bg-red-50 dark:bg-red-900/20",
    },
  }

  const { label, icon: Icon, className } = config[status as keyof typeof config] || config.NOT_SYNCED

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon weight="fill" className="size-3.5" />
      {label}
    </span>
  )
}

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = React.useState<TemplateItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)

  return (
    <div className="space-y-6 p-6">
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
          <Button
            onClick={() => setSyncing(true)}
            disabled={syncing}
            variant="outline"
          >
            <ArrowsClockwise
              className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
            />
            Sync Templates
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">Total Templates</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {templates.filter((t) => t.syncStatus === "SYNCED").length}
              </p>
              <p className="text-xs text-muted-foreground">Synced</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {templates.filter((t) => t.syncStatus === "NOT_SYNCED").length}
              </p>
              <p className="text-xs text-muted-foreground">Pending Sync</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Lightning className="mb-3 size-10 text-muted-foreground" weight="fill" />
              <p className="text-sm text-muted-foreground">
                No templates configured yet
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setSyncing(true)}
              >
                Sync from Meta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-900/20">
                      <Lightning className="size-5 text-yellow-600" weight="fill" />
                    </div>
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {template.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <TemplateStatusBadge status={template.syncStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}