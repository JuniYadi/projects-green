"use client"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CheckCircleIcon,
  WarningIcon,
  ClockIcon,
  ArchiveBoxIcon,
} from "@/components/ui/phosphor-icons"
import type { ProductPublishState } from "@/components/billing/admin/catalog/catalog-editor.types"

export function CatalogPublishTab({
  publishState,
  onChange,
  hasUnsavedChanges,
}: Readonly<{
  publishState: ProductPublishState
  onChange: (state: ProductPublishState) => void
  hasUnsavedChanges: boolean
}>) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingCatalogPublishTab

  const publishStateConfig: Record<
    ProductPublishState,
    {
      label: string
      icon: React.ReactNode
      description: string
    }
  > = {
    draft: {
      label: t.stateDraftLabel,
      icon: <ClockIcon className="h-5 w-5 text-amber-500" />,
      description: t.stateDraftDescription,
    },
    published: {
      label: t.statePublishedLabel,
      icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />,
      description: t.statePublishedDescription,
    },
    archived: {
      label: t.stateArchivedLabel,
      icon: <ArchiveBoxIcon className="h-5 w-5 text-gray-500" />,
      description: t.stateArchivedDescription,
    },
  }

  const config = publishStateConfig[publishState]
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.publishStatusTitle}</CardTitle>
          <CardDescription>{t.publishStatusDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <p className="font-medium">{config.label}</p>
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={publishState === "draft" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange("draft")}
            >
              {t.stateDraftLabel}
            </Button>
            <Button
              variant={publishState === "published" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange("published")}
            >
              {t.statePublishedLabel}
            </Button>
            <Button
              variant={publishState === "archived" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange("archived")}
            >
              {t.stateArchivedLabel}
            </Button>
          </div>

          {publishState === "published" && hasUnsavedChanges && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <WarningIcon className="h-4 w-4" />
              {t.unsavedChangesWarning}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.validationSummaryTitle}</CardTitle>
          <CardDescription>{t.validationSummaryDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm">{t.checkBasicsConfigured}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm">{t.checkPricingConfigured}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm">{t.checkAddonsValidated}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
