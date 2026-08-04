"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DEPLOY_TEMPLATES } from "@/modules/deploy/deploy.constants"
import type {
  DeploySourceType,
  DeployTemplateId,
  Owner,
  Repository,
  Branch,
  ResourcePlanId,
} from "@/modules/deploy/deploy.types"
import {
  Folder,
  SquaresFour,
  GithubLogo,
  ArrowRight,
  MagnifyingGlass,
  Check,
  FileCode,
  List,
  Globe,
} from "@/components/ui/phosphor-icons"
import {
  SiN8N,
  SiDocker,
  SiWordpress,
  SiGhost,
  SiStrapi,
  SiDirectus,
  SiPayloadcms,
  SiPocketbase,
  SiUmami,
  SiPlausibleanalytics,
} from "react-icons/si"

export type StepSourceProps = {
  sourceType: DeploySourceType
  templateId?: DeployTemplateId
  githubConnectionStatus: "idle" | "connected" | "error"
  isConnectingGithub: boolean
  githubReconnectRequired?: boolean
  ownerOptionsLoading: boolean
  ownerOptionsError: string | null
  repositoryOptionsLoading: boolean
  repositoryOptionsError: string | null
  ownerSearch: string
  repositorySearch: string
  owners: Owner[]
  repositories: Repository[]
  branches: Branch[]
  selectedOwnerId: string
  selectedRepositoryId: string
  selectedBranchName: string
  rootDirectory: string
  appName: string
  templateResourcePlanId: ResourcePlanId
  publicSourceUrl?: string
  publicSourceRef?: string
  onSourceTypeChange: (type: DeploySourceType) => void
  onTemplateSelect: (templateId: DeployTemplateId) => void
  onOwnerSearchChange: (query: string) => void
  onRepositorySearchChange: (query: string) => void
  onOwnerSelect: (ownerId: string) => void
  onRepositorySelect: (repositoryId: string) => void
  onBranchSelect: (branchName: string) => void
  onRootDirectoryChange: (rootDirectory: string) => void
  onAppNameChange: (appName: string) => void
  onTemplateResourcePlanChange: (resourcePlanId: ResourcePlanId) => void
  onPublicSourceUrlChange?: (url: string) => void
  onPublicSourceRefChange?: (ref: string) => void
  onConnectGithub: () => void
  onCancel: () => void
  onNext: () => void
  canProceed: boolean
  isDetecting: boolean
  detectionError: string | null
}

const TMPL_ICON: Record<DeployTemplateId, React.ReactNode> = {
  wordpress: <SiWordpress className="h-6 w-6 shrink-0 text-[#21759b]" />,
  ghost: (
    <SiGhost className="h-6 w-6 shrink-0 text-[#000000] dark:text-white" />
  ),
  strapi: <SiStrapi className="h-6 w-6 shrink-0 text-[#4945ff]" />,
  directus: <SiDirectus className="h-6 w-6 shrink-0 text-[#64f5cb]" />,
  payload: (
    <SiPayloadcms className="h-6 w-6 shrink-0 text-[#000000] dark:text-white" />
  ),
  pocketbase: <SiPocketbase className="h-6 w-6 shrink-0 text-[#b8dcfc]" />,
  umami: <SiUmami className="h-6 w-6 shrink-0 text-[#2970ff]" />,
  plausible: (
    <SiPlausibleanalytics className="h-6 w-6 shrink-0 text-[#ee5137]" />
  ),
  n8n: <SiN8N className="h-6 w-6 shrink-0 text-[#ff6d5a]" />,
  openclaw: <SiDocker className="h-6 w-6 shrink-0 text-[#2496ed]" />,
}
const CATEGORIES = ["All", "CMS", "Analytics", "Automation", "Developer Tools"]

const getTemplateCategory = (id: DeployTemplateId): string => {
  return (
    DEPLOY_TEMPLATES.find((template) => template.id === id)?.category ??
    "Developer Tools"
  )
}

export function StepSourceV2(props: StepSourceProps) {
  const {
    sourceType,
    templateId,
    onSourceTypeChange,
    githubConnectionStatus,
    isConnectingGithub,
    githubReconnectRequired = false,
    ownerOptionsLoading,
    ownerOptionsError,
    repositoryOptionsLoading,
    repositoryOptionsError,
    repositorySearch,
    owners,
    repositories,
    branches,
    selectedOwnerId,
    selectedRepositoryId,
    selectedBranchName,
    rootDirectory,
    appName,
    onTemplateSelect,
    onRepositorySearchChange,
    onOwnerSelect,
    onRepositorySelect,
    onBranchSelect,
    onRootDirectoryChange,
    onAppNameChange,
    onTemplateResourcePlanChange,
    templateResourcePlanId,
    publicSourceUrl,
    publicSourceRef,
    onPublicSourceUrlChange,
    onPublicSourceRefChange,
    onConnectGithub,
    onNext,
    canProceed,
  } = props

  const [templateFilter, setTemplateFilter] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6
  const selCard =
    sourceType === "github"
      ? "github"
      : sourceType === "template" || templateId
        ? "template"
        : sourceType === "public"
          ? "public"
          : null

  const filteredRepos = useMemo(
    () =>
      repositories.filter((r) =>
        r.name.toLowerCase().includes(repositorySearch.toLowerCase())
      ),
    [repositories, repositorySearch]
  )

  const selTemplate = useMemo(
    () =>
      templateId
        ? (DEPLOY_TEMPLATES.find((t) => t.id === templateId) ?? null)
        : null,
    [templateId]
  )
  const filteredTemplates = useMemo(() => {
    const query = templateFilter.trim().toLowerCase()
    return DEPLOY_TEMPLATES.filter((template) => {
      const matchesQuery =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query)
      const matchesCategory =
        selectedCategory === "All" ||
        getTemplateCategory(template.id) === selectedCategory
      return matchesQuery && matchesCategory
    })
  }, [selectedCategory, templateFilter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE)
  )
  const visibleTemplates = filteredTemplates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const setCategory = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const setTemplateSearch = (query: string) => {
    setTemplateFilter(query)
    setCurrentPage(1)
  }

  const selRepo = useMemo(
    () =>
      selectedRepositoryId
        ? (repositories.find((r) => r.id === selectedRepositoryId) ?? null)
        : null,
    [repositories, selectedRepositoryId]
  )

  const selBranch = useMemo(
    () =>
      selectedBranchName
        ? (branches.find((b) => b.name === selectedBranchName) ?? null)
        : null,
    [branches, selectedBranchName]
  )

  const cardCls = (sel: boolean) =>
    cn(
      "flex flex-col rounded-xl border-2 bg-card transition-all",
      sel ? "border-primary shadow-md" : "border-border"
    )

  const badgeCls = (sel: boolean) =>
    cn(
      "rounded-lg p-2.5",
      sel
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground"
    )

  const checkCls = (sel: boolean) =>
    sel ? "rounded-full bg-primary/10 p-1 text-primary" : ""

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">What would you like to publish?</h2>
        <p className="text-sm text-muted-foreground">
          Choose a starting point. We&apos;ll guide you through the rest.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className={cardCls(selCard === "template")}>
          <button
            type="button"
            aria-pressed={selCard === "template"}
            onClick={() => onSourceTypeChange("template")}
            className="flex w-full items-start gap-3 p-5 text-left"
          >
            <div className={badgeCls(selCard === "template")}>
              <SquaresFour className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">
                Start with a ready-made site
              </h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                Choose a template for WordPress, n8n, Ghost, and more.
              </p>
              <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Easiest way to start
              </span>
            </div>
            <div className={checkCls(selCard === "template")}>
              {selCard === "template" && <Check className="h-3.5 w-3.5" />}
            </div>
          </button>

          {selCard === "template" && (
            <div className="space-y-3 px-5 pb-5">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label="Search templates"
                    placeholder="Search templates..."
                    value={templateFilter}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    className="h-9 flex-1 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <span className="sr-only">Template view</span>
                    <Button
                      type="button"
                      size="icon"
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      aria-label="Grid view"
                      aria-pressed={viewMode === "grid"}
                      onClick={() => setViewMode("grid")}
                    >
                      <SquaresFour className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      aria-label="List view"
                      aria-pressed={viewMode === "list"}
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={
                        selectedCategory === category ? "secondary" : "ghost"
                      }
                      aria-pressed={selectedCategory === category}
                      onClick={() => setCategory(category)}
                      className="h-7 px-2 text-[11px]"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
              <div
                className={cn(
                  "gap-2",
                  viewMode === "grid" ? "grid grid-cols-2" : "flex flex-col"
                )}
              >
                {visibleTemplates.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                    No templates match your search or category.
                  </div>
                ) : (
                  visibleTemplates.map((tmpl) => (
                    <button
                      type="button"
                      key={tmpl.id}
                      onClick={() => onTemplateSelect(tmpl.id)}
                      aria-pressed={templateId === tmpl.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all",
                        viewMode === "grid" && "flex-col text-center",
                        templateId === tmpl.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      {TMPL_ICON[tmpl.id] ?? (
                        <FileCode className="h-6 w-6 shrink-0 text-[#6366f1]" />
                      )}
                      <span className="min-w-0">
                        <span className="block leading-tight font-medium">
                          {tmpl.name}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {tmpl.description}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {filteredTemplates.length} template
                  {filteredTemplates.length === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => page - 1)}
                    className="h-7 px-2"
                  >
                    Previous
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => page + 1)}
                    className="h-7 px-2"
                  >
                    Next
                  </Button>
                </div>
              </div>

              {selTemplate && (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Resource Plan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["starter", "pro", "payg"] as ResourcePlanId[]).map(
                      (pid) => (
                        <button
                          key={pid}
                          onClick={() => onTemplateResourcePlanChange(pid)}
                          className={cn(
                            "rounded-lg border py-2 text-center text-xs font-medium transition-all",
                            templateResourcePlanId === pid
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {pid.charAt(0).toUpperCase() + pid.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="App name"
                      value={appName}
                      onChange={(e) => onAppNameChange(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className={cardCls(selCard === "github")}>
          <button
            type="button"
            aria-pressed={selCard === "github"}
            onClick={() => onSourceTypeChange("github")}
            className="flex w-full items-start gap-3 p-5 text-left"
          >
            <div className={badgeCls(selCard === "github")}>
              <Folder className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Use a GitHub project</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                Choose code from your GitHub account.
              </p>
            </div>
            <div className={checkCls(selCard === "github")}>
              {selCard === "github" && <Check className="h-3.5 w-3.5" />}
            </div>
          </button>

          {selCard === "github" && (
            <div className="space-y-3 px-5 pb-5">
              {githubConnectionStatus !== "connected" ? (
                <div className="space-y-2">
                  {githubReconnectRequired && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                      GitHub access expired. Reconnect to continue.
                    </div>
                  )}
                  {githubConnectionStatus === "error" && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
                      Connection failed. Please try again.
                    </div>
                  )}
                  <Button
                    onClick={onConnectGithub}
                    disabled={isConnectingGithub}
                    className="w-full"
                    size="sm"
                  >
                    <GithubLogo className="mr-2 h-4 w-4" />
                    {isConnectingGithub
                      ? "Redirecting..."
                      : githubReconnectRequired
                        ? "Reconnect GitHub"
                        : "Connect GitHub"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      GitHub account
                    </label>
                    {ownerOptionsLoading ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Loading...
                      </div>
                    ) : ownerOptionsError ? (
                      <p className="text-xs text-destructive">
                        {ownerOptionsError}
                      </p>
                    ) : (
                      <select
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={selectedOwnerId}
                        onChange={(e) => onOwnerSelect(e.target.value)}
                        disabled={owners.length === 1}
                      >
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Project
                    </label>
                    <div className="relative">
                      <MagnifyingGlass className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search repositories..."
                        value={repositorySearch}
                        onChange={(e) =>
                          onRepositorySearchChange(e.target.value)
                        }
                        className="h-9 pl-9 text-sm"
                      />
                    </div>
                  </div>

                  {repositoryOptionsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : repositoryOptionsError ? (
                    <p className="text-xs text-destructive">
                      {repositoryOptionsError}
                    </p>
                  ) : filteredRepos.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">
                      {repositorySearch
                        ? "No repositories match your search."
                        : "No repositories found."}
                    </p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-1">
                      {filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => onRepositorySelect(repo.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            selectedRepositoryId === repo.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{repo.name}</span>
                          {repo.isPrivate && (
                            <span className="shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground">
                              Private
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {selRepo && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Version to publish
                      </label>
                      <select
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={selectedBranchName}
                        onChange={(e) => onBranchSelect(e.target.value)}
                      >
                        {branches.length === 0 && (
                          <option value="">No branches</option>
                        )}
                        {branches.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selBranch && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Project folder
                        </label>
                        <Input
                          placeholder="/"
                          value={rootDirectory}
                          onChange={(e) =>
                            onRootDirectoryChange(e.target.value)
                          }
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Site name
                        </label>
                        <Input
                          placeholder="my-awesome-app"
                          value={appName}
                          onChange={(e) => onAppNameChange(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cardCls(selCard === "public")}>
          <button
            type="button"
            aria-pressed={selCard === "public"}
            onClick={() => onSourceTypeChange("public")}
            className="flex w-full items-start gap-3 p-5 text-left"
          >
            <div className={badgeCls(selCard === "public")}>
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Use a public Git link</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                Paste a link to a public Git repository.
              </p>
            </div>
            <div className={checkCls(selCard === "public")}>
              {selCard === "public" && <Check className="h-3.5 w-3.5" />}
            </div>
          </button>

          {selCard === "public" && (
            <div className="space-y-3 px-5 pb-5">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                Only publish code you trust. Public repositories can contain
                code you did not write.
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Public Git link
                </label>
                <Input
                  placeholder="https://github.com/org/repo"
                  value={publicSourceUrl ?? ""}
                  onChange={(e) => onPublicSourceUrlChange?.(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Version to publish (optional)
                </label>
                <Input
                  placeholder="main"
                  value={publicSourceRef ?? ""}
                  onChange={(e) => onPublicSourceRefChange?.(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Site name
                </label>
                <Input
                  placeholder="my-public-app"
                  value={appName}
                  onChange={(e) => onAppNameChange(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Project folder
                </label>
                <Input
                  placeholder="/"
                  value={rootDirectory}
                  onChange={(e) => onRootDirectoryChange(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {!canProceed && (
          <p className="text-xs text-muted-foreground">
            Choose a template, project, or public Git link to continue.
          </p>
        )}
        <Button onClick={onNext} disabled={!canProceed} size="lg">
          {canProceed ? "Continue to setup" : "Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
