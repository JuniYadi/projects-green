"use client"

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

const PUBLISH_STATE_CONFIG: Record<
  ProductPublishState,
  {
    label: string
    icon: React.ReactNode
    description: string
  }
> = {
  draft: {
    label: "Draft",
    icon: <ClockIcon className="h-5 w-5 text-amber-500" />,
    description: "This product is a draft and not visible to customers.",
  },
  published: {
    label: "Published",
    icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />,
    description: "This product is live and visible in the catalog.",
  },
  archived: {
    label: "Archived",
    icon: <ArchiveBoxIcon className="h-5 w-5 text-gray-500" />,
    description:
      "This product is archived and no longer available for new subscriptions.",
  },
}

export function CatalogPublishTab({
  publishState,
  onChange,
  hasUnsavedChanges,
}: Readonly<{
  publishState: ProductPublishState
  onChange: (state: ProductPublishState) => void
  hasUnsavedChanges: boolean
}>) {
  const config = PUBLISH_STATE_CONFIG[publishState]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publish status</CardTitle>
          <CardDescription>
            Control the visibility of this product in the catalog.
          </CardDescription>
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
              Draft
            </Button>
            <Button
              variant={publishState === "published" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange("published")}
            >
              Published
            </Button>
            <Button
              variant={publishState === "archived" ? "default" : "outline"}
              size="sm"
              onClick={() => onChange("archived")}
            >
              Archived
            </Button>
          </div>

          {publishState === "published" && hasUnsavedChanges && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <WarningIcon className="h-4 w-4" />
              You have unsaved changes. Save draft and publish again to update
              the live product.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation summary</CardTitle>
          <CardDescription>
            Checklist before publishing this product.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm">Product basics configured</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm">At least one plan with pricing</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm">Add-ons validated</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
