"use client"

import React, { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { MarketplaceShowcase } from "./_components/marketplace-showcase"
import { DynamicLaunchDrawer } from "./_components/dynamic-launch-drawer"
import type { MarketplaceTemplateItem } from "./_components/template-card"
export default function ConsoleMarketplacePage() {
  const params = useParams()
  const lang = (params?.lang as string) || "en"
  const currency = lang === "id" ? "IDR" : "USD"
  const [selectedTemplate, setSelectedTemplate] =
    useState<MarketplaceTemplateItem | null>(null)
  const router = useRouter()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
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
        isDeploying={isDeploying}
        currency={currency}
        onDeploy={async (submission) => {
          setIsDeploying(true)
          try {
            const envVarsArray = Object.entries(submission.envVars).map(
              ([key, value]) => ({
                key,
                value,
              })
            )

            const { data: payload } = await eden.api.deploy.submit.post({
              sourceType: "TEMPLATE",
              templateId: submission.templateId,
              name: submission.appName,
              subdomain: submission.subdomain.replace(/\.pfnapp\.com$/, ""),
              billingMode: "PAYG",
              resourcePlanId: submission.resourcePlanId ?? "small",
              cpu: submission.cpu,
              memory: submission.memory,
              envVars: envVarsArray,
            })

            if (!payload || !("ok" in payload) || !payload.ok) {
              const msg =
                payload && "message" in payload
                  ? String(payload.message)
                  : "Deploy failed"
              throw new Error(msg)
            }

            toast.success(`Deployment for ${submission.appName} started!`)
            setIsDrawerOpen(false)
            router.push(`/${lang}/console/app/deployments`)
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Deploy failed"
            )
          } finally {
            setIsDeploying(false)
          }
        }}
      />
    </div>
  )
}
