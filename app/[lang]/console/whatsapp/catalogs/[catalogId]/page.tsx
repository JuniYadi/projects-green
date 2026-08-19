"use client"

import { ShoppingBagOpen } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function CatalogDetailPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold">Catalog</h1>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          WhatsApp Catalogs &amp; Commerce integration is not available yet.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBagOpen className="size-6" weight="duotone" />
            </div>
            <div>
              <CardTitle>Catalog details are coming soon</CardTitle>
              <CardDescription className="mt-1">
                Product syncing and Commerce Manager tools will be available
                here.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <Badge className="mb-4">Coming soon</Badge>
          <h2 className="text-xl font-semibold tracking-tight">
            We’re building the shopping experience
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Catalogs will let you sync products from Facebook Commerce Manager
            and share them with customers in WhatsApp. Check back in an upcoming
            release.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
