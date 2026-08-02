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
  Globe,
  SquaresFour,
  GithubLogo,
  ArrowRight,
  MagnifyingGlass,
  Check,
  RocketLaunchIcon,
  FileCode,
  List,
  CaretLeft,
  CaretRight,
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

const TEMPLATE_CATEGORIES = [
  "All",
  "CMS",
  "Analytics",
  "Automation",
  "Developer Tools",
] as const

const getTemplateCategory = (id: DeployTemplateId) => {
  return (
    DEPLOY_TEMPLATES.find((template) => template.id === id)?.category ??
    "Developer Tools"
  )
}

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
  onOwnerSearchChange: (query: string) => void
  onRepositorySearchChange: (query: string) => void
  onOwnerSelect: (ownerId: string) => void
  onRepositorySelect: (repositoryId: string) => void
  onBranchSelect: (branchName: string) => void
  onRootDirectoryChange: (rootDirectory: string) => void
  onAppNameChange: (appName: string) => void
  onTemplateResourcePlanChange: (resourcePlanId: ResourcePlanId) => void
  onDeployWithDefaults: () => void
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

export function StepSourceV2(props: StepSourceProps) {
  const {
    sourceType,
    templateId,
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
    templateResourcePlanId,
    onSourceTypeChange,
    onTemplateSelect,
    onRepositorySearchChange,
    onOwnerSelect,
    onRepositorySelect,
    onBranchSelect,
    onRootDirectoryChange,
    onAppNameChange,
    onTemplateResourcePlanChange,
    onConnectGithub,
    onNext,
    canProceed,
    detectionError,
  } = props

  const [urlInput, setUrlInput] = useState("")
  const [urlDetecting, setUrlDetecting] = useState(false)
  const [templateSearch, setTemplateSearch] = useState("")
  const [templateCategory, setTemplateCategory] =
    useState<(typeof TEMPLATE_CATEGORIES)[number]>("All")
  const [templateView, setTemplateView] = useState<"grid" | "list">("grid")
  const [templatePage, setTemplatePage] = useState(1)
  const templatesPerPage = 6

  const selCard =
    sourceType === "github" ? "github" : templateId ? "template" : null

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
    const query = templateSearch.trim().toLowerCase()
    return DEPLOY_TEMPLATES.filter((template) => {
      const matchesQuery =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query)
      const matchesCategory =
        templateCategory === "All" ||
        getTemplateCategory(template.id) === templateCategory
      return matchesQuery && matchesCategory
    })
  }, [templateCategory, templateSearch])

  const visibleTemplates = filteredTemplates.slice(
    (templatePage - 1) * templatesPerPage,
    templatePage * templatesPerPage
  )
  const templatePages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / templatesPerPage)
  )

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
      sel
        ? "border-primary shadow-md"
        : "cursor-pointer border-border hover:border-primary/50"
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
      <div className="grid gap-4 md:grid-cols-3">
        <div
          className={cardCls(selCard === "github")}
          onClick={() => onSourceTypeChange("github")}
        >
          <div className="flex items-start gap-3 p-5">
            <div className={badgeCls(selCard === "github")}>
              <Folder className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">My Repositories</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {githubConnectionStatus === "connected"
                  ? "Browse and deploy from your connected GitHub account."
                  : "Connect your GitHub account to access your repositories."}
              </p>
            </div>
            <div className={checkCls(selCard === "github")}>
              {selCard === "github" && <Check className="h-3.5 w-3.5" />}
            </div>
          </div>

          {selCard === "github" && (
            <div
              className="space-y-3 px-5 pb-5"
              onClick={(e) => e.stopPropagation()}
            >
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
                      Account
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
                      Repository
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
                        Branch
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
                          Root Directory
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
                          App Name
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

        <div className={cardCls(false)}>
          <div className="flex items-start gap-3 p-5">
            <div className={badgeCls(false)}>
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Public Repo URL</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                Deploy any public Git repository by entering its URL.
              </p>
            </div>
          </div>
          <div className="space-y-3 px-5 pb-5">
            <div className="flex gap-2">
              <Input
                placeholder="https://github.com/user/repo"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  if (e.target.value.trim()) {
                    setUrlDetecting(true)
                    setTimeout(() => setUrlDetecting(false), 1500)
                  }
                }}
                className="h-9 flex-1 text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => urlInput.trim() && onSourceTypeChange("github")}
                disabled={!urlInput.trim()}
              >
                Detect
              </Button>
            </div>
            {urlDetecting && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Detecting framework...
              </div>
            )}
            {detectionError && (
              <p className="text-xs text-destructive">{detectionError}</p>
            )}
          </div>
        </div>

        <div
          className={cardCls(selCard === "template")}
          onClick={() => onSourceTypeChange("template")}
        >
          <div className="flex items-start gap-3 p-5">
            <div className={badgeCls(selCard === "template")}>
              <SquaresFour className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">From Template</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                One-click deploy for WordPress, Ghost, n8n, and more.
              </p>
            </div>
            <div className={checkCls(selCard === "template")}>
              {selCard === "template" && <Check className="h-3.5 w-3.5" />}
            </div>
          </div>

          {selCard === "template" && (
            <div
              className="space-y-3 px-5 pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Search templates"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(event) => {
                    setTemplateSearch(event.target.value)
                    setTemplatePage(1)
                  }}
                  className="h-9 min-w-44 flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Toggle template view"
                  onClick={() =>
                    setTemplateView((view) =>
                      view === "grid" ? "list" : "grid"
                    )
                  }
                >
                  {templateView === "grid" ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <SquaresFour className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    variant={
                      templateCategory === category ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => {
                      setTemplateCategory(category)
                      setTemplatePage(1)
                    }}
                  >
                    {category}
                  </Button>
                ))}
              </div>
              <div
                className={cn(
                  "gap-2",
                  templateView === "grid" ? "grid grid-cols-2" : "flex flex-col"
                )}
              >
                {visibleTemplates.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
                    No templates match your search or category.
                  </div>
                ) : (
                  visibleTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => onTemplateSelect(tmpl.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all",
                        templateView === "grid" && "flex-col text-center",
                        templateId === tmpl.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      {TMPL_ICON[tmpl.id] ?? (
                        <FileCode className="h-6 w-6 shrink-0 text-[#6366f1]" />
                      )}
                      <span className="leading-tight font-medium">
                        {tmpl.name}
                      </span>
                      {templateView === "list" && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {getTemplateCategory(tmpl.id)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {filteredTemplates.length} templates · page {templatePage} of{" "}
                  {templatePages}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Previous template page"
                    disabled={templatePage <= 1}
                    onClick={() =>
                      setTemplatePage((page) => Math.max(1, page - 1))
                    }
                  >
                    <CaretLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Next template page"
                    disabled={templatePage >= templatePages}
                    onClick={() =>
                      setTemplatePage((page) =>
                        Math.min(templatePages, page + 1)
                      )
                    }
                  >
                    <CaretRight className="h-4 w-4" />
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
                    <Button
                      size="sm"
                      onClick={props.onDeployWithDefaults}
                      className="shrink-0"
                    >
                      <RocketLaunchIcon className="mr-1.5 h-3.5 w-3.5" />
                      Deploy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed} size="lg">
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
