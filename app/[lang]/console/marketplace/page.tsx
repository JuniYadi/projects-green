"use client"

import React, { useState } from "react"
import { useParams } from "next/navigation"
import { MarketplaceShowcase } from "./_components/marketplace-showcase"
import { DynamicLaunchDrawer } from "./_components/dynamic-launch-drawer"
import type { MarketplaceTemplateItem } from "./_components/template-card"

export default function ConsoleMarketplacePage() {
  const params = useParams()
  const lang = (params?.lang as string) || "en"
  const [selectedTemplate, setSelectedTemplate] =
    useState<MarketplaceTemplateItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleDeploy = (template: MarketplaceTemplateItem) => {
    setSelectedTemplate(template)
    setIsDrawerOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <MarketplaceShowcase onDeploy={handleDeploy} locale={lang} />
      <DynamicLaunchDrawer
        template={selectedTemplate}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onDeploy={async (_submission) => {
          // Launch completed callback
          setIsDrawerOpen(false)
        }}
      />
    </div>
  )
}
