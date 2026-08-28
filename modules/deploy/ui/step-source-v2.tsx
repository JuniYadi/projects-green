"use client"
import { useState, useMemo, type ReactNode } from "react"
import { enMessages } from "@/lib/i18n/messages/en"
import type { DeployWizardMessages } from "@/lib/i18n/messages/types"
import { ArrowRight, FileCode, Folder, GithubLogo } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { generateAppName } from "@/modules/deploy/deploy-wizard.logic"
import { DEPLOY_TEMPLATES } from "@/modules/deploy/deploy.constants"
import type {
  Branch,
  DeploySourceType,
  DeployTemplateId,
  Owner,
  Repository,
  ResourcePlanId,
} from "@/modules/deploy/deploy.types"
import type { RecentDeploySourceDTO } from "@/modules/deploy/recent-sources.dto"
import {
  SiDocker,
  SiGhost,
  SiN8N,
  SiPayloadcms,
  SiPlausibleanalytics,
  SiPocketbase,
  SiStrapi,
  SiUmami,
  SiWordpress,
  SiDirectus,
} from "react-icons/si"

export type StepSourceProps = {
  sourceType: DeploySourceType
  messages?: DeployWizardMessages
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
  recentSources?: RecentDeploySourceDTO[]
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

const TEMPLATE_ICONS: Record<DeployTemplateId, ReactNode> = {
  wordpress: <SiWordpress className="h-5 w-5 shrink-0 text-[#21759b]" />,
  ghost: <SiGhost className="h-5 w-5 shrink-0 text-foreground" />,
  strapi: <SiStrapi className="h-5 w-5 shrink-0 text-[#4945ff]" />,
  directus: <SiDirectus className="h-5 w-5 shrink-0 text-[#64f5cb]" />,
  payload: <SiPayloadcms className="h-5 w-5 shrink-0 text-foreground" />,
  pocketbase: <SiPocketbase className="h-5 w-5 shrink-0 text-[#b8dcfc]" />,
  umami: <SiUmami className="h-5 w-5 shrink-0 text-[#2970ff]" />,
  plausible: (
    <SiPlausibleanalytics className="h-5 w-5 shrink-0 text-[#ee5137]" />
  ),
  n8n: <SiN8N className="h-5 w-5 shrink-0 text-[#ff6d5a]" />,
  openclaw: <SiDocker className="h-5 w-5 shrink-0 text-[#2496ed]" />,
}

const RESOURCE_PLANS: ResourcePlanId[] = ["starter", "pro", "payg"]

const publicRepositoryName = (value: string) => {
  try {
    const url = new URL(value)
    const segments = url.pathname.split("/").filter(Boolean)
    return segments.at(-1) || "my-public-app"
  } catch {
    return "my-public-app"
  }
}

const isSupportedPublicUrl = (value: string) => {
  if (!/^https:\/\//i.test(value.trim())) return false

  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()
    return (
      url.protocol === "https:" &&
      (hostname === "github.com" || hostname === "gitlab.com")
    )
  } catch {
    return false
  }
}

export function StepSourceV2({
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
  publicSourceUrl,
  publicSourceRef,
  recentSources = [],
  onSourceTypeChange,
  onTemplateSelect,
  onRepositorySearchChange,
  onOwnerSelect,
  onRepositorySelect,
  onBranchSelect,
  onRootDirectoryChange,
  onAppNameChange,
  onTemplateResourcePlanChange,
  onPublicSourceUrlChange,
  onPublicSourceRefChange,
  onConnectGithub,
  onCancel,
  onNext,
  canProceed,
  isDetecting,
  detectionError,
  messages: providedMessages,
}: StepSourceProps) {
  const messages = providedMessages ?? enMessages.console.app.deployWizard
  const [query, setQuery] = useState(publicSourceUrl ?? "")
  const normalizedQuery = query.trim().toLowerCase()

  const filteredRepositories = useMemo(
    () =>
      repositories.filter((repository) =>
        repository.name.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery, repositories]
  )

  const filteredTemplates = useMemo(
    () =>
      DEPLOY_TEMPLATES.filter(
        (template) =>
          template.name.toLowerCase().includes(normalizedQuery) ||
          template.description.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery]
  )

  const filteredRecentSources = useMemo(
    () =>
      recentSources.filter((source) =>
        source.label.toLowerCase().includes(normalizedQuery)
      ),
    [normalizedQuery, recentSources]
  )

  const selectedRepository = repositories.find(
    (repository) => repository.id === selectedRepositoryId
  )
  const selectedTemplate = templateId
    ? DEPLOY_TEMPLATES.find((template) => template.id === templateId)
    : undefined

  const selectPublicSource = (
    url: string,
    ref = "main",
    root = "/",
    label?: string
  ) => {
    onSourceTypeChange("public")
    onPublicSourceUrlChange?.(url)
    onPublicSourceRefChange?.(ref || "main")
    onRootDirectoryChange(root || "/")
    onAppNameChange(label || generateAppName(publicRepositoryName(url)))
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    onRepositorySearchChange(value)

    const trimmed = value.trim()
    if (!isSupportedPublicUrl(trimmed)) return

    selectPublicSource(trimmed)
  }

  const selectRepository = (repository: Repository) => {
    onSourceTypeChange("github")
    if (repository.ownerId !== selectedOwnerId)
      onOwnerSelect(repository.ownerId)
    onRepositorySelect(repository.id)
    setQuery(repository.name)
  }

  const selectRecentSource = (source: RecentDeploySourceDTO) => {
    setQuery(source.label)
    if (source.sourceType === "github") {
      onSourceTypeChange("github")
      if (source.ownerId !== selectedOwnerId) onOwnerSelect(source.ownerId)
      onRepositorySelect(source.repositoryId)
      onBranchSelect(source.branchName)
      onRootDirectoryChange(source.rootDirectory || "/")
      return
    }

    if (source.sourceType === "template") {
      onSourceTypeChange("template")
      onTemplateSelect(source.templateId)
      return
    }

    selectPublicSource(
      source.publicSourceUrl,
      source.publicSourceRef || "main",
      source.rootDirectory || "/",
      source.label
    )
  }

  const hasResults =
    filteredRecentSources.length > 0 ||
    filteredRepositories.length > 0 ||
    filteredTemplates.length > 0

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          {messages.source.heading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {messages.source.description}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="deploy-source-input" className="sr-only">
          {messages.source.listLabel}
        </label>
        <Input
          id="deploy-source-input"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder={messages.source.placeholder}
          autoComplete="off"
          className="h-12 text-base"
        />
      </div>

      <div
        role="listbox"
        aria-label={messages.source.listLabel}
        className="max-h-[27rem] space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-3"
      >
        {filteredRecentSources.length > 0 && (
          <div className="space-y-1">
            <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {messages.source.recent}
            </p>
            {filteredRecentSources.map((source) => (
              <SourceOption
                key={`recent-${source.sourceType}-${source.label}`}
                icon={<ClockIcon />}
                label={source.label}
                detail={
                  source.sourceType === "public"
                    ? source.publicSourceUrl
                    : source.sourceType
                }
                selected={false}
                selectedLabel={messages.source.selected}
                onClick={() => selectRecentSource(source)}
              />
            ))}
          </div>
        )}

        {filteredRepositories.length > 0 && (
          <div className="space-y-1">
            <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {messages.source.connectedRepositories}
            </p>
            {filteredRepositories.map((repository) => (
              <SourceOption
                key={`repository-${repository.id}`}
                selectedLabel={messages.source.selected}
                icon={
                  <Folder className="h-5 w-5 shrink-0 text-muted-foreground" />
                }
                label={repository.name}
                detail={
                  repository.isPrivate
                    ? messages.source.privateRepository
                    : messages.source.publicRepository
                }
                selected={
                  sourceType === "github" &&
                  selectedRepositoryId === repository.id
                }
                onClick={() => selectRepository(repository)}
              />
            ))}
          </div>
        )}

        {filteredTemplates.length > 0 && (
          <div className="space-y-1">
            <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {messages.source.templates}
            </p>
            {filteredTemplates.map((template) => (
              <SourceOption
                key={`template-${template.id}`}
                selectedLabel={messages.source.selected}
                icon={
                  TEMPLATE_ICONS[template.id] ?? (
                    <FileCode className="h-5 w-5 shrink-0" />
                  )
                }
                label={template.name}
                detail={`${template.description} · ${template.defaultCpu}m CPU · ${template.defaultMemory}MB memory`}
                selected={
                  sourceType === "template" && templateId === template.id
                }
                onClick={() => {
                  setQuery(template.name)
                  onSourceTypeChange("template")
                  onTemplateSelect(template.id)
                }}
              />
            ))}
          </div>
        )}

        {!hasResults && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {messages.source.noMatches}
          </p>
        )}
      </div>

      {githubConnectionStatus !== "connected" && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          {githubReconnectRequired && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {messages.source.githubAccessExpired}
            </p>
          )}
          {githubConnectionStatus === "error" && (
            <p className="text-xs text-destructive">
              {messages.source.connectionFailed}
            </p>
          )}
          <Button
            type="button"
            onClick={onConnectGithub}
            disabled={isConnectingGithub}
            size="sm"
          >
            <GithubLogo className="mr-2 h-4 w-4" />
            {isConnectingGithub
              ? messages.source.redirecting
              : githubReconnectRequired
                ? messages.source.reconnectGithub
                : messages.source.connectGithub}
          </Button>
        </div>
      )}

      {githubConnectionStatus === "connected" && ownerOptionsLoading && (
        <p className="text-xs text-muted-foreground">
          {messages.source.loadingAccounts}
        </p>
      )}
      {ownerOptionsError && (
        <p className="text-xs text-destructive">{ownerOptionsError}</p>
      )}
      {repositoryOptionsLoading && (
        <p className="text-xs text-muted-foreground">
          {messages.source.loadingRepositories}
        </p>
      )}
      {repositoryOptionsError && (
        <p className="text-xs text-destructive">{repositoryOptionsError}</p>
      )}
      {detectionError && (
        <p className="text-xs text-destructive">{detectionError}</p>
      )}

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          >
            {messages.source.advanced}
            <span aria-hidden="true">⌄</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 rounded-lg border border-border p-4">
          {sourceType === "github" && (
            <>
              <div className="space-y-1">
                <label
                  htmlFor="deploy-owner"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {messages.source.account}
                </label>
                <select
                  id="deploy-owner"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={selectedOwnerId}
                  onChange={(event) => onOwnerSelect(event.target.value)}
                  disabled={owners.length === 1}
                >
                  {owners.length === 0 && (
                    <option value="">{messages.source.noAccounts}</option>
                  )}
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="deploy-repository-search"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {messages.source.repositorySearch}
                </label>
                <Input
                  id="deploy-repository-search"
                  value={repositorySearch}
                  onChange={(event) =>
                    onRepositorySearchChange(event.target.value)
                  }
                  placeholder={messages.source.searchRepositories}
                  className="h-9 text-sm"
                />
              </div>
              {selectedRepository && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="deploy-branch"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {messages.source.branch}
                    </label>
                    <select
                      id="deploy-branch"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={selectedBranchName}
                      onChange={(event) => onBranchSelect(event.target.value)}
                    >
                      {branches.length === 0 && (
                        <option value="">{messages.source.noBranches}</option>
                      )}
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SourceDetails
                    messages={messages.source}
                    rootDirectory={rootDirectory}
                    appName={appName}
                    onRootDirectoryChange={onRootDirectoryChange}
                    onAppNameChange={onAppNameChange}
                  />
                </div>
              )}
            </>
          )}

          {sourceType === "public" && (
            <SourceDetails
              messages={messages.source}
              publicSourceRef={publicSourceRef || "main"}
              rootDirectory={rootDirectory || "/"}
              appName={appName}
              onPublicSourceRefChange={onPublicSourceRefChange}
              onRootDirectoryChange={onRootDirectoryChange}
              onAppNameChange={onAppNameChange}
            />
          )}

          {sourceType === "template" && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {messages.source.resourcePlan}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {RESOURCE_PLANS.map((plan) => (
                    <Button
                      key={plan}
                      type="button"
                      size="sm"
                      variant={
                        templateResourcePlanId === plan
                          ? "secondary"
                          : "outline"
                      }
                      onClick={() => onTemplateResourcePlanChange(plan)}
                    >
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="template-app-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {messages.source.appName}
                </label>
                <Input
                  id="template-app-name"
                  value={appName}
                  onChange={(event) => onAppNameChange(event.target.value)}
                  placeholder="my-app"
                  className="h-9 text-sm"
                />
              </div>
              {selectedTemplate && (
                <p className="text-xs text-muted-foreground">
                  {messages.source.defaults
                    .replace("{cpu}", String(selectedTemplate.defaultCpu))
                    .replace(
                      "{memory}",
                      String(selectedTemplate.defaultMemory)
                    )}
                </p>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {messages.source.cancel}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!canProceed || isDetecting}
          size="lg"
        >
          {isDetecting ? messages.source.checkingSource : messages.source.next}
          {!isDetecting && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

function SourceOption({
  icon,
  label,
  detail,
  selected,
  selectedLabel,
  onClick,
}: {
  icon: ReactNode
  label: string
  detail: string
  selected: boolean
  selectedLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-transparent hover:border-border hover:bg-muted/50"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
      {selected && <span className="text-xs font-medium">{selectedLabel}</span>}
    </button>
  )
}

function SourceDetails({
  messages,
  publicSourceRef,
  rootDirectory,
  appName,
  onPublicSourceRefChange,
  onRootDirectoryChange,
  onAppNameChange,
}: {
  messages: DeployWizardMessages["source"]
  publicSourceRef?: string
  rootDirectory: string
  appName: string
  onPublicSourceRefChange?: (value: string) => void
  onRootDirectoryChange: (value: string) => void
  onAppNameChange: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      {onPublicSourceRefChange && (
        <div className="space-y-1">
          <label
            htmlFor="public-source-ref"
            className="text-xs font-medium text-muted-foreground"
          >
            {messages.publicBranchOrRef}
          </label>
          <Input
            id="public-source-ref"
            value={publicSourceRef ?? "main"}
            onChange={(event) => onPublicSourceRefChange(event.target.value)}
            placeholder="main"
            className="h-9 text-sm"
          />
        </div>
      )}
      <div className="space-y-1">
        <label
          htmlFor="source-root-directory"
          className="text-xs font-medium text-muted-foreground"
        >
          {messages.rootDirectory}
        </label>
        <Input
          id="source-root-directory"
          value={rootDirectory}
          onChange={(event) => onRootDirectoryChange(event.target.value)}
          placeholder="/"
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="source-app-name"
          className="text-xs font-medium text-muted-foreground"
        >
          {messages.appName}
        </label>
        <Input
          id="source-app-name"
          value={appName}
          onChange={(event) => onAppNameChange(event.target.value)}
          placeholder="my-app"
          className="h-9 text-sm"
        />
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
    >
      ↺
    </span>
  )
}
