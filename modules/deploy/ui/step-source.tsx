import { useState, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { DEPLOY_TEMPLATES } from "@/modules/deploy/deploy.constants"
import type {
  Branch,
  DeploySourceType,
  DeployTemplateId,
  Owner,
  Repository,
  ResourcePlanId,
} from "@/modules/deploy/deploy.types"
import {
  GithubLogo,
  GitBranch,
  Folder,
  MagnifyingGlass,
  Lock,
  Globe,
  Check,
  Cpu,
  HardDrive,
  FileCode,
  ArrowRight,
  SquaresFour,
  List,
  CaretLeft,
  CaretRight,
  RocketLaunchIcon,
} from "@/components/ui/phosphor-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResourcePlanSelector } from "@/modules/deploy/ui/resource-plan-selector"
import { computeHourlyCost } from "@/modules/deploy/deploy-pricing"
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
  onSourceTypeChange: (type: DeploySourceType) => void
  onTemplateSelect: (templateId: DeployTemplateId) => void
  onOwnerSearchChange: (value: string) => void
  onRepositorySearchChange: (value: string) => void
  onOwnerSelect: (value: string) => void
  onRepositorySelect: (value: string) => void
  onBranchSelect: (value: string) => void
  onRootDirectoryChange: (value: string) => void
  onAppNameChange: (value: string) => void
  onTemplateResourcePlanChange: (value: ResourcePlanId) => void
  onDeployWithDefaults: () => void
  onConnectGithub: () => void
  onCancel: () => void
  onNext: () => void
  canProceed: boolean
  isDetecting: boolean
  detectionError: string | null
}

// Beautiful Custom SVG Logos for templates
const TemplateIcon = ({
  id,
  size = "md",
}: {
  id: DeployTemplateId
  size?: "sm" | "md"
}) => {
  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-8 w-8"
  switch (id) {
    case "wordpress":
      return (
        <SiWordpress className={cn("shrink-0 text-[#21759b]", sizeClasses)} />
      )
    case "ghost":
      return (
        <SiGhost
          className={cn("shrink-0 text-[#000000] dark:text-white", sizeClasses)}
        />
      )
    case "strapi":
      return <SiStrapi className={cn("shrink-0 text-[#4945ff]", sizeClasses)} />
    case "directus":
      return (
        <SiDirectus className={cn("shrink-0 text-[#64f5cb]", sizeClasses)} />
      )
    case "payload":
      return (
        <SiPayloadcms
          className={cn("shrink-0 text-[#000000] dark:text-white", sizeClasses)}
        />
      )
    case "pocketbase":
      return (
        <SiPocketbase className={cn("shrink-0 text-[#b8dcfc]", sizeClasses)} />
      )
    case "umami":
      return <SiUmami className={cn("shrink-0 text-[#2970ff]", sizeClasses)} />
    case "plausible":
      return (
        <SiPlausibleanalytics
          className={cn("shrink-0 text-[#ee5137]", sizeClasses)}
        />
      )
    case "n8n":
      return <SiN8N className={cn("shrink-0 text-[#ff6d5a]", sizeClasses)} />
    case "openclaw":
      return <SiDocker className={cn("shrink-0 text-[#2496ed]", sizeClasses)} />
    default:
      return <FileCode className={cn("shrink-0 text-[#6366f1]", sizeClasses)} />
  }
}

const CATEGORIES = ["All", "CMS", "Analytics", "Automation", "Developer Tools"]

const getTemplateCategory = (id: DeployTemplateId): string => {
  switch (id) {
    case "wordpress":
    case "ghost":
    case "strapi":
    case "directus":
    case "payload":
    case "pocketbase":
      return "CMS"
    case "umami":
    case "plausible":
      return "Analytics"
    case "n8n":
      return "Automation"
    case "openclaw":
    default:
      return "Developer Tools"
  }
}

export function StepSource({
  sourceType,
  templateId,
  githubConnectionStatus,
  isConnectingGithub,
  githubReconnectRequired = false,
  ownerOptionsLoading,
  ownerOptionsError,
  repositoryOptionsLoading,
  repositoryOptionsError,
  owners,
  repositories,
  branches,
  selectedOwnerId,
  selectedRepositoryId,
  selectedBranchName,
  rootDirectory,
  appName,
  templateResourcePlanId,
  onSourceTypeChange,
  onTemplateSelect,
  onOwnerSelect,
  onRepositorySelect,
  onBranchSelect,
  onRootDirectoryChange,
  onAppNameChange,
  onTemplateResourcePlanChange,
  onDeployWithDefaults,
  onConnectGithub,
  onCancel,
  onNext,
  canProceed,
  isDetecting,
  detectionError,
}: StepSourceProps) {
  const [repoFilter, setRepoFilter] = useState("")
  const [templateFilter, setTemplateFilter] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6

  const filteredTemplates = useMemo(() => {
    const res = DEPLOY_TEMPLATES.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(templateFilter.toLowerCase()) ||
        template.description
          .toLowerCase()
          .includes(templateFilter.toLowerCase())
      const matchesCategory =
        selectedCategory === "All" ||
        getTemplateCategory(template.id) === selectedCategory
      return matchesSearch && matchesCategory
    })
    return res
  }, [templateFilter, selectedCategory])

  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredTemplates, currentPage])

  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE)

  const filteredRepositories = useMemo(() => {
    return repositories.filter((repo) =>
      repo.name.toLowerCase().includes(repoFilter.toLowerCase())
    )
  }, [repositories, repoFilter])

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null
    return DEPLOY_TEMPLATES.find((t) => t.id === templateId) ?? null
  }, [templateId])

  const packageHourlyCost = useMemo(() => {
    if (!selectedTemplate) return 0
    return computeHourlyCost({
      resourcePlanId: templateResourcePlanId,
      cpu: selectedTemplate.defaultCpu,
      memory: selectedTemplate.defaultMemory,
    })
  }, [selectedTemplate, templateResourcePlanId])

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Deploy Source</CardTitle>
        <CardDescription>
          Choose a pre-configured template to deploy instantly, or connect your
          GitHub account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs
          value={sourceType}
          onValueChange={(value) =>
            onSourceTypeChange(value as DeploySourceType)
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-lg bg-muted/50 p-1">
            <TabsTrigger
              value="github"
              className="rounded-md py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <GithubLogo className="mr-2 h-4 w-4" />
              GitHub Repository
            </TabsTrigger>
            <TabsTrigger
              value="template"
              className="rounded-md py-2.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <FileCode className="mr-2 h-4 w-4" />
              Instant Templates
            </TabsTrigger>
          </TabsList>

          {/* GitHub Tab Content */}
          <TabsContent
            value="github"
            className="space-y-6 pt-4 focus-visible:outline-none"
          >
            {/* GitHub Connection Info */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-foreground p-2 text-background">
                    <GithubLogo className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">
                      GitHub Integration
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {githubReconnectRequired
                        ? "GitHub access expired or was revoked. Reconnect to continue."
                        : githubConnectionStatus === "connected"
                          ? "Successfully connected to your GitHub account."
                          : "Connect your GitHub account to access your repositories."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {githubConnectionStatus === "connected" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Connected
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-border font-medium shadow-sm"
                      disabled={isConnectingGithub}
                      onClick={onConnectGithub}
                    >
                      {isConnectingGithub
                        ? "Redirecting..."
                        : githubReconnectRequired
                          ? "Reconnect GitHub"
                          : githubConnectionStatus === "connected"
                            ? "Add Account"
                            : "Connect GitHub"}
                    </Button>
                    {githubConnectionStatus === "connected" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-2"
                        onClick={() => onOwnerSelect(selectedOwnerId)}
                        title="Refresh list"
                      >
                        <ArrowRight className="h-4 w-4 rotate-[-90deg]" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {githubConnectionStatus === "error" && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  GitHub connection failed. Please try connecting again.
                </div>
              )}

              {githubReconnectRequired && (
                <div
                  role="alert"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  GitHub access expired or was revoked. Reconnect GitHub to
                  continue listing repositories.
                </div>
              )}
            </div>

            {githubConnectionStatus === "connected" && (
              <div className="grid gap-6">
                {/* 1. Account & Repository Selection Row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      GitHub account
                    </label>
                    {ownerOptionsLoading ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Loading installations...
                      </div>
                    ) : ownerOptionsError ? (
                      <p className="text-xs text-destructive">
                        {ownerOptionsError}
                      </p>
                    ) : owners.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No accounts found. Install the GitHub App first.
                      </p>
                    ) : (
                      <div>
                        <Select
                          value={selectedOwnerId}
                          onValueChange={onOwnerSelect}
                          disabled={owners.length === 1}
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="Select an account" />
                          </SelectTrigger>
                          <SelectContent>
                            {owners.map((owner) => (
                              <SelectItem
                                key={owner.id}
                                value={owner.id}
                                className="text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-bold text-muted-foreground uppercase">
                                    {owner.name.charAt(0)}
                                  </div>
                                  {owner.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {owners.length === 1 && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Only one GitHub account connected.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Repository Search */}
                  {selectedOwnerId && (
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Search Repository
                      </label>
                      <div className="relative">
                        <MagnifyingGlass className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter repositories..."
                          value={repoFilter}
                          onChange={(e) => setRepoFilter(e.target.value)}
                          className="h-9 pl-9 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Repository List */}
                {selectedOwnerId && (
                  <div className="space-y-2.5">
                    {repositoryOptionsLoading ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-4 text-xs text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Loading repositories...
                      </div>
                    ) : repositoryOptionsError ? (
                      <p className="text-xs text-destructive">
                        {repositoryOptionsError}
                      </p>
                    ) : filteredRepositories.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">
                        {repoFilter
                          ? "No repositories match your filter."
                          : "No repositories found for this account."}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                        <div className="max-h-[240px] divide-y divide-border overflow-y-auto">
                          {filteredRepositories.map((repo) => {
                            const isSelected = selectedRepositoryId === repo.id
                            return (
                              <button
                                key={repo.id}
                                type="button"
                                onClick={() => onRepositorySelect(repo.id)}
                                className={cn(
                                  "flex w-full items-center justify-between p-3 text-left text-xs transition-all hover:bg-muted/40",
                                  isSelected && "bg-primary/5 font-medium"
                                )}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <Folder
                                    className={cn(
                                      "h-4.5 w-4.5 shrink-0",
                                      isSelected
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                    )}
                                  />
                                  <span className="truncate font-semibold text-foreground">
                                    {repo.name}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {repo.isPrivate ? (
                                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">
                                      <Lock className="h-3 w-3" />
                                      Private
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700">
                                      <Globe className="h-3 w-3" />
                                      Public
                                    </span>
                                  )}
                                  {repo.defaultBranch && (
                                    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      <GitBranch className="h-3 w-3" />
                                      {repo.defaultBranch}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <Check className="ml-1 h-4 w-4 shrink-0 text-primary" />
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* — Framework Detection — */}
                {selectedRepositoryId && isDetecting && (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Detecting framework from repository...
                  </div>
                )}
                {selectedRepositoryId && detectionError && (
                  <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    {detectionError}
                  </div>
                )}

                {/* 3. Branch & Root Directory Config */}
                {selectedRepositoryId && (
                  <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          <GitBranch className="h-3.5 w-3.5" />
                          Deployment Branch
                        </label>
                      </div>
                      {branches.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No branches found.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {branches.map((branch) => {
                            const isSelected =
                              selectedBranchName === branch.name
                            return (
                              <button
                                key={branch.id}
                                type="button"
                                onClick={() => onBranchSelect(branch.name)}
                                className={cn(
                                  "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium shadow-sm transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                    : "border-border bg-background text-foreground hover:bg-muted/50"
                                )}
                              >
                                <GitBranch className="h-3 w-3 opacity-70" />
                                {branch.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        <Folder className="h-3.5 w-3.5" />
                        Root Directory
                      </label>
                      <div className="relative">
                        <Folder className="absolute top-2.5 left-3 h-4.5 w-4.5 text-muted-foreground" />
                        <Input
                          aria-label="Root directory"
                          value={rootDirectory}
                          onChange={(event) =>
                            onRootDirectoryChange(event.target.value)
                          }
                          placeholder="/"
                          className="h-9 border-border pl-9 text-xs"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Where your application build files are located. Use root
                        (/) by default.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Templates Tab Content */}
          <TabsContent
            value="template"
            className="space-y-4 pt-4 focus-visible:outline-none"
          >
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Select Instant Template
              </label>
              <div className="relative w-full max-w-xs">
                <MagnifyingGlass className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  onChange={(e) => {
                    setTemplateFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>

            {/* Toolbar: Category Filters and View Toggle */}
            <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center">
              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((category) => {
                  const isCatSelected = selectedCategory === category
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-sm transition-all",
                        isCatSelected
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "border border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      {category}
                    </button>
                  )
                })}
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "cursor-pointer rounded-lg border p-1.5 transition-all",
                    viewMode === "grid"
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                  )}
                  title="Grid View"
                >
                  <SquaresFour className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "cursor-pointer rounded-lg border p-1.5 transition-all",
                    viewMode === "list"
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                  )}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                No templates match your search.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[380px] scrollbar-thin overflow-y-auto pr-1.5">
                  {viewMode === "grid" ? (
                    <div className="grid gap-2.5 pb-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {paginatedTemplates.map((template) => {
                        const isSelected = templateId === template.id
                        const cpuDisplay = `${(template.defaultCpu / 1000).toFixed(1)} vCPU`
                        const memDisplay =
                          template.defaultMemory >= 1024
                            ? `${(template.defaultMemory / 1024).toFixed(0)} GB`
                            : `${template.defaultMemory} MB`
                        const stackText = template.build.useDockerfile
                          ? "Docker"
                          : `${template.build.language} (${template.build.framework})`

                        return (
                          <button
                            key={template.id}
                            type="button"
                            className={cn(
                              "group relative flex cursor-pointer flex-col items-center justify-between rounded-xl border bg-background p-2.5 text-center shadow-sm transition-all duration-300 hover:shadow-md",
                              isSelected
                                ? "scale-[1.02] border-primary bg-primary/[0.02] ring-2 ring-primary/20"
                                : "border-border hover:border-border/80 hover:bg-muted/[0.05]"
                            )}
                            onClick={() => onTemplateSelect(template.id)}
                          >
                            {/* Top Section */}
                            <div className="flex w-full flex-col items-center space-y-2">
                              <div className="relative flex w-full justify-center">
                                <div className="rounded-lg border border-border bg-muted/40 p-1.5 transition-colors group-hover:bg-background">
                                  <TemplateIcon id={template.id} size="sm" />
                                </div>
                                {isSelected && (
                                  <span className="absolute -top-1 -right-1 z-20 rounded-full bg-emerald-500 p-0.5 text-white shadow-sm">
                                    <Check className="h-2.5 w-2.5" />
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col items-center">
                                <h4 className="line-clamp-1 text-[12px] font-bold text-foreground transition-colors group-hover:text-primary">
                                  {template.name}
                                </h4>
                                <span className="mt-0.5 inline-flex rounded bg-muted/60 px-1 py-0 text-[7px] font-bold tracking-tighter text-muted-foreground uppercase">
                                  {stackText}
                                </span>
                                <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                                  {template.description}
                                </p>
                              </div>
                            </div>

                            {/* Specs Section - Vertical Stack */}
                            <div className="mt-2.5 w-full border-t border-border/80 pt-2">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Cpu className="h-2.5 w-2.5 shrink-0 text-muted-foreground/75" />
                                  <span className="text-[9px] font-medium text-foreground">
                                    {cpuDisplay}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <HardDrive className="h-2.5 w-2.5 shrink-0 text-muted-foreground/75" />
                                  <span className="text-[9px] font-medium text-foreground">
                                    {memDisplay}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pb-2">
                      {paginatedTemplates.map((template) => {
                        const isSelected = templateId === template.id
                        const cpuDisplay = `${(template.defaultCpu / 1000).toFixed(1)} vCPU`
                        const memDisplay =
                          template.defaultMemory >= 1024
                            ? `${(template.defaultMemory / 1024).toFixed(0)} GB`
                            : `${template.defaultMemory} MB`
                        const stackText = template.build.useDockerfile
                          ? "Docker"
                          : `${template.build.language} (${template.build.framework})`

                        return (
                          <button
                            key={template.id}
                            type="button"
                            className={cn(
                              "group flex cursor-pointer items-center justify-between rounded-xl border bg-background p-3 text-left shadow-sm transition-all duration-200 hover:shadow-md",
                              isSelected
                                ? "border-primary bg-primary/[0.02] ring-1 ring-primary/20"
                                : "border-border hover:border-border/80 hover:bg-muted/[0.05]"
                            )}
                            onClick={() => onTemplateSelect(template.id)}
                          >
                            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3">
                              {/* Icon */}
                              <div className="shrink-0 rounded-xl border border-border bg-muted/40 p-2 transition-colors group-hover:bg-background">
                                <TemplateIcon id={template.id} size="sm" />
                              </div>
                              {/* Title & Description */}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                                    {template.name}
                                  </h4>
                                  <span className="inline-flex rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                                    {stackText}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 max-w-[450px] truncate text-xs text-muted-foreground">
                                  {template.description}
                                </p>
                              </div>
                            </div>

                            {/* Specs and selection indicator */}
                            <div className="flex shrink-0 items-center gap-4">
                              <div className="hidden items-center gap-3 border-r border-border/80 py-1 pr-4 text-xs text-muted-foreground sm:flex">
                                <div className="flex items-center gap-1">
                                  <Cpu className="h-3.5 w-3.5 text-muted-foreground/75" />
                                  <span className="text-[11px] font-medium text-foreground">
                                    {cpuDisplay}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground/75" />
                                  <span className="text-[11px] font-medium text-foreground">
                                    {memDisplay}
                                  </span>
                                </div>
                              </div>

                              {isSelected ? (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-600">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                                  Select
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-4">
                    <div className="text-[11px] font-medium text-muted-foreground">
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                      </span>
                      -
                      <span className="font-semibold text-foreground">
                        {Math.min(
                          filteredTemplates.length,
                          currentPage * ITEMS_PER_PAGE
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-foreground">
                        {filteredTemplates.length}
                      </span>{" "}
                      templates
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        className="flex h-8 items-center gap-1 border-border px-2.5 text-xs font-medium shadow-sm"
                      >
                        <CaretLeft className="h-3.5 w-3.5" />
                        Previous
                      </Button>
                      <div className="px-2 text-xs font-semibold text-muted-foreground">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        className="flex h-8 items-center gap-1 border-border px-2.5 text-xs font-medium shadow-sm"
                      >
                        Next
                        <CaretRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Template Configuration */}
            {sourceType === "template" && (
              <div className="border-t border-border pt-4">
                {!templateId ? (
                  <div className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">
                    Select a template above to see package details.
                  </div>
                ) : selectedTemplate ? (
                  <div className="grid gap-6">
                    {/* Package Details Panel */}
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <h4 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Package Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                        <div>
                          <span className="block text-muted-foreground">
                            Compute
                          </span>
                          <span className="font-semibold">
                            {(selectedTemplate.defaultCpu / 1000).toFixed(1)}{" "}
                            vCPU /{" "}
                            {selectedTemplate.defaultMemory >= 1024
                              ? `${(selectedTemplate.defaultMemory / 1024).toFixed(0)} GB`
                              : `${selectedTemplate.defaultMemory} MB`}
                          </span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground">
                            Runtime
                          </span>
                          <span className="font-semibold">
                            {selectedTemplate.build.useDockerfile
                              ? "Docker"
                              : `${selectedTemplate.build.language}${selectedTemplate.build.framework ? ` / ${selectedTemplate.build.framework}` : ""}`}
                          </span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground">
                            Default Port
                          </span>
                          <span className="font-semibold">
                            {selectedTemplate.build.defaultPort ?? "—"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground">
                            Estimated Cost
                          </span>
                          <span className="font-semibold">
                            ${packageHourlyCost.toFixed(4)}/hr
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* App Name */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        App Name
                      </label>
                      <Input
                        value={appName}
                        onChange={(e) => onAppNameChange(e.target.value)}
                        placeholder="my-app-name"
                        className="h-9 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Enter a name for your application. It will be used to
                        generate the URL.
                      </p>
                    </div>

                    {/* Resource Plan */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Resource Plan
                      </label>
                      <ResourcePlanSelector
                        selectedPlanId={templateResourcePlanId}
                        hourlyCost={packageHourlyCost}
                        onChange={onTemplateResourcePlanChange}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/10 p-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-9 border-border px-4 text-xs font-semibold shadow-sm"
        >
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {sourceType === "template" && templateId && appName.trim() && (
            <Button
              type="button"
              variant="default"
              onClick={onDeployWithDefaults}
              className="flex h-9 items-center gap-1 px-4 text-xs font-semibold shadow-sm"
            >
              <RocketLaunchIcon className="h-3.5 w-3.5" />
              Deploy with defaults
            </Button>
          )}
          <Button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            className="flex h-9 items-center gap-1 bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Next Step
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
