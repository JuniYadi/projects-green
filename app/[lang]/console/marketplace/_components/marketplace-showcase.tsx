"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Lightning,
  MagnifyingGlass,
  Plus,
  RocketLaunchIcon,
} from "@/components/ui/phosphor-icons"
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

  // Featured hero templates: n8n, hermes, 9router, umami, wordpress
  const featuredTemplates = useMemo(() => {
    const featuredSlugs = ["n8n", "hermes", "9router", "umami", "wordpress"]
    return officialTemplates.filter(
      (tmpl) => tmpl.isFeatured || featuredSlugs.includes(tmpl.slug)
    )
  }, [officialTemplates])

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
              <Link href={`/${locale}/console/marketplace/my-templates`}>
                My Workspace Templates
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
          <Link href={`/${locale}/console/marketplace/builder`}>
            <Plus className="size-4" />
            <span>Create Custom Template</span>
          </Link>
        </Button>
      </div>

      {activeTab === "marketplace" && (
        <>
          {/* Hero Banner featuring official templates */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-6 md:p-8">
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <Lightning className="size-3.5 text-primary" />
                <span>Production-Ready Cloud Stacks</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                App Hosting Marketplace
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Deploy open-source applications, AI agent workspaces, workflow
                automations, and privacy-first analytics with 1-click cloud
                provisioning.
              </p>
            </div>

            {/* Featured quick badges */}
            <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Featured:
              </span>
              {featuredTemplates.slice(0, 5).map((featured) => (
                <button
                  key={featured.slug}
                  onClick={() => handleDeploy(featured)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted"
                >
                  <RocketLaunchIcon className="size-3 text-muted-foreground" />
                  <span>{featured.name}</span>
                </button>
              ))}
            </div>

            {/* Decorative background blur glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full bg-primary/5 blur-3xl" />
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-4">
            {/* Real-time search */}
            <div className="relative max-w-md">
              <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates by name, category, or stack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category Filter Tabs/Chips */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              {MARKETPLACE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat
                return (
                  <Button
                    key={cat}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className="h-8 rounded-full text-xs font-medium"
                  >
                    {cat.replace("_", " ")}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Template Grid */}
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
