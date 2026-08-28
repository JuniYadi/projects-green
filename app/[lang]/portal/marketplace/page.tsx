"use client"

import React, { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, Clock, ShieldCheck } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { TemplateModerationTable } from "./_components/template-moderation-table"
import {
  TemplateInspectorDrawer,
  type AdminTemplateRecord,
} from "./_components/template-inspector-drawer"

export default function PortalMarketplaceModerationPage() {
  const [templates, setTemplates] = useState<AdminTemplateRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedTemplate, setSelectedTemplate] =
    useState<AdminTemplateRecord | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)

  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await (
          eden.api.admin as unknown as {
            templates: {
              get: () => Promise<{
                data?: AdminTemplateRecord[]
                error?: unknown
              }>
            }
          }
        ).templates.get()
        if (res.data && !isCancelled) {
          setTemplates(res.data)
        }
      } catch (err) {
        console.error("Failed to load templates for moderation:", err)
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [])

  const handleInspect = (template: AdminTemplateRecord) => {
    setSelectedTemplate(template)
    setIsInspectorOpen(true)
  }

  const handleApprove = async (id: string) => {
    try {
      const adminApi = (
        eden.api.admin as unknown as {
          templates: Record<
            string,
            { approve: { post: () => Promise<{ data?: AdminTemplateRecord }> } }
          >
        }
      ).templates[id]
      const res = await adminApi?.approve.post()
      if (res?.data) {
        const updated = res.data
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
        )
        if (selectedTemplate?.id === id) {
          setSelectedTemplate((prev) => (prev ? { ...prev, ...updated } : null))
        }
      }
    } catch (err) {
      console.error("Failed to approve template:", err)
    }
  }

  const handleReject = async (id: string, reviewNotes: string) => {
    try {
      const adminApi = (
        eden.api.admin as unknown as {
          templates: Record<
            string,
            {
              reject: {
                post: (b: {
                  reviewNotes: string
                }) => Promise<{ data?: AdminTemplateRecord }>
              }
            }
          >
        }
      ).templates[id]
      const res = await adminApi?.reject.post({ reviewNotes })
      if (res?.data) {
        const updated = res.data
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
        )
        if (selectedTemplate?.id === id) {
          setSelectedTemplate((prev) => (prev ? { ...prev, ...updated } : null))
        }
      }
    } catch (err) {
      console.error("Failed to reject template:", err)
    }
  }

  const handleToggleFeatured = async (id: string) => {
    try {
      const adminApi = (
        eden.api.admin as unknown as {
          templates: Record<
            string,
            {
              "toggle-featured": {
                post: () => Promise<{ data?: AdminTemplateRecord }>
              }
            }
          >
        }
      ).templates[id]
      const res = await adminApi?.["toggle-featured"].post()
      if (res?.data) {
        const updated = res.data
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
        )
        if (selectedTemplate?.id === id) {
          setSelectedTemplate((prev) => (prev ? { ...prev, ...updated } : null))
        }
      }
    } catch (err) {
      console.error("Failed to toggle featured status:", err)
    }
  }

  const safeTemplates = Array.isArray(templates) ? templates : []
  const pendingTemplates = safeTemplates.filter(
    (t) => t.visibility === "PENDING_REVIEW"
  )
  const liveTemplates = safeTemplates.filter(
    (t) => t.visibility === "PUBLIC" && !t.isOfficial
  )
  const officialTemplates = safeTemplates.filter((t) => t.isOfficial)
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Marketplace Moderation & Governance
        </h1>
        <p className="text-sm text-muted-foreground">
          Review community blueprints, verify security isolation parameters, and
          manage featured marketplace catalog applications.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3 md:inline-flex md:w-auto">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="size-4" />
            <span>Pending Review</span>
            {pendingTemplates.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                {pendingTemplates.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-2">
            <Globe className="size-4" />
            <span>Live Marketplace</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {liveTemplates.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="official" className="gap-2">
            <ShieldCheck className="size-4" />
            <span>Official Templates</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {officialTemplates.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Community Submissions Requiring Review</CardTitle>
              <CardDescription>
                Examine container images, exposed ports, non-root user
                execution, and requested managed databases prior to public
                listing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateModerationTable
                templates={pendingTemplates}
                isLoading={isLoading}
                onInspect={handleInspect}
                onApprove={handleApprove}
                onReject={handleReject}
                onToggleFeatured={handleToggleFeatured}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Community Catalog</CardTitle>
              <CardDescription>
                Public verified community templates currently installable across
                tenants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateModerationTable
                templates={liveTemplates}
                isLoading={isLoading}
                onInspect={handleInspect}
                onApprove={handleApprove}
                onReject={handleReject}
                onToggleFeatured={handleToggleFeatured}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="official" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>First-Party Official Stacks</CardTitle>
              <CardDescription>
                Platform-maintained blueprints built and guaranteed by the core
                engineering team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateModerationTable
                templates={officialTemplates}
                isLoading={isLoading}
                onInspect={handleInspect}
                onApprove={handleApprove}
                onReject={handleReject}
                onToggleFeatured={handleToggleFeatured}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TemplateInspectorDrawer
        template={selectedTemplate}
        open={isInspectorOpen}
        onOpenChange={setIsInspectorOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onToggleFeatured={handleToggleFeatured}
      />
    </div>
  )
}
