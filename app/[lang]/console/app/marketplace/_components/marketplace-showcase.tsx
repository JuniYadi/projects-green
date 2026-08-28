"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MagnifyingGlass, Plus } from "@/components/ui/phosphor-icons"
import { TemplateCard, type MarketplaceTemplateItem } from "./template-card"
import { OFFICIAL_APP_TEMPLATES } from "@/modules/deploy/app-template.seed"

export const MARKETPLACE_CATEGORIES = [
  "ALL",
  "AI",
  "AUTOMATION",
  "CMS",
  "DATABASE",
  "DEVELOPER_TOOLS",
  "ANALYTICS",
  "UTILITIES",
] as const

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number]

export interface MarketplaceShowcaseProps {
  onDeploy?: (template: MarketplaceTemplateItem) => void
  locale?: string
}

export function MarketplaceShowcase({
  onDeploy,
  locale = "en",
}: MarketplaceShowcaseProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<MarketplaceCategory>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"marketplace" | "workspace">(
    "marketplace"
  )

  const officialTemplates: MarketplaceTemplateItem[] = useMemo(() => {
    return OFFICIAL_APP_TEMPLATES.map((tmpl) => ({
      id: tmpl.slug,
      slug: tmpl.slug,
      name: tmpl.name,
      tagline: tmpl.tagline,
      description: tmpl.description,
      iconUrl: tmpl.iconUrl,
      category: tmpl.category,
      isOfficial: tmpl.isOfficial,
      isFeatured: tmpl.isFeatured,
      installCount: tmpl.installCount,
      blueprint: tmpl.blueprint,
    }))
  }, [])

  const filteredTemplates = useMemo(() => {
    return officialTemplates.filter((tmpl) => {
      const matchesCategory =
        selectedCategory === "ALL" || tmpl.category === selectedCategory

      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        tmpl.name.toLowerCase().includes(query) ||
        tmpl.tagline.toLowerCase().includes(query) ||
        tmpl.category.toLowerCase().includes(query) ||
        tmpl.slug.toLowerCase().includes(query)

      return matchesCategory && matchesSearch
    })
  }, [officialTemplates, selectedCategory, searchQuery])

  const handleDeploy = (template: MarketplaceTemplateItem) => {
    if (onDeploy) {
      onDeploy(template)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(val as "marketplace" | "workspace")
          }
          className="w-fit"
        >
          <TabsList>
            <TabsTrigger value="marketplace">Marketplace Hub</TabsTrigger>
            <TabsTrigger value="workspace" asChild>
              <Link href={`/${locale}/console/app/marketplace/my-templates`}>
                My Workspace Templates
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
          <Link href={`/${locale}/console/app/marketplace/builder`}>
            <Plus className="size-4" />
            <span>Create Custom Template</span>
          </Link>
        </Button>
      </div>

      {activeTab === "marketplace" && (
        <>
          {/* Compact Header & Toolbar */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  App Marketplace
                </h1>
                <p className="text-xs text-muted-foreground">
                  1-Click deploy open-source apps, AI agents, automations, and
                  databases.
                </p>
              </div>

              {/* Real-time search */}
              <div className="relative w-full sm:w-72">
                <MagnifyingGlass className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search apps by name or stack…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1 overflow-x-auto pt-1">
              {MARKETPLACE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat
                return (
                  <Button
                    key={cat}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className="h-7 rounded-lg px-2.5 text-xs font-medium"
                  >
                    {cat.replace("_", " ")}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Template Grid: 4-5 columns high density */}
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.slug}
                  template={template}
                  onDeploy={handleDeploy}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No templates found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your search criteria or category filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("ALL")
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
