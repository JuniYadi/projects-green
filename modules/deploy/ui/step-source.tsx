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
} from "@phosphor-icons/react"

export type StepSourceProps = {
  sourceType: DeploySourceType
  templateId?: DeployTemplateId
  githubConnectionStatus: "idle" | "connected" | "error"
  isConnectingGithub: boolean
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
  onSourceTypeChange: (type: DeploySourceType) => void
  onTemplateSelect: (templateId: DeployTemplateId) => void
  onOwnerSearchChange: (value: string) => void
  onRepositorySearchChange: (value: string) => void
  onOwnerSelect: (value: string) => void
  onRepositorySelect: (value: string) => void
  onBranchSelect: (value: string) => void
  onRootDirectoryChange: (value: string) => void
  onConnectGithub: () => void
  onCancel: () => void
  onNext: () => void
  canProceed: boolean
}

// Beautiful Custom SVG Logos for templates
const TemplateIcon = ({ id }: { id: DeployTemplateId }) => {
  if (id === "wordpress") {
    return (
      <svg
        className="h-10 w-10 text-[#21759b]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18.25c-1.39 0-2.69-.36-3.83-1L12.35 7.82l4.02 11c-1.25.89-2.77 1.43-4.37 1.43zm-7.61-4.7L9 5.86c.33-.89.17-1.42-.45-1.58L7.33 4.1h-.1c.32-.48.74-.9 1.23-1.22l.53.53c.69.69.62 1.41.22 2.37l-3.32 8.78c-1-.28-1.51-1-1.52-2.02zm12.31 4c-.16-.54-.31-1.07-.42-1.61-.41-1.92-1.45-6.73-1.45-6.73 0-.17.17-.17.33-.17h1.49c.16 0 .33.08.33.25l.83 5.43c.12-.4.49-1.57.49-1.57s.67-2 1-3.66c.09-.43.19-.89.19-.89 0-.25.17-.41.41-.41h1.16c.34 0 .5.25.42.5-.23 1.25-2.08 7.9-2.78 10.37h-.01zm-3.08-8.52L10.3 19A8.25 8.25 0 013.75 12c0-.52.05-1 .14-1.47l3.63 9.75 6.1-16.38z" />
      </svg>
    )
  }
  if (id === "n8n") {
    return (
      <svg
        className="h-10 w-10 text-[#ff6d5a]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm-1 14.5a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5zm0-4.5A1.5 1.5 0 119.5 10.5 1.5 1.5 0 0111 12zm5 4.5a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5zm0-4.5a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5zM12.5 8a1.5 1.5 0 11-1.5-1.5A1.5 1.5 0 0112.5 8z" />
      </svg>
    )
  }
  // OpenClaw
  return (
    <svg
      className="h-10 w-10 text-[#6366f1]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v8" />
      <path d="M9 11l3 3 3-3" />
    </svg>
  )
}

export function StepSource({
  sourceType,
  templateId,
  githubConnectionStatus,
  isConnectingGithub,
  ownerOptionsLoading,
  ownerOptionsError,
  repositoryOptionsLoading,
  repositoryOptionsError,
  ownerSearch: _ownerSearch,
  repositorySearch: _repositorySearch,
  owners,
  repositories,
  branches,
  selectedOwnerId,
  selectedRepositoryId,
  selectedBranchName,
  rootDirectory,
  onSourceTypeChange,
  onTemplateSelect,
  onOwnerSearchChange: _onOwnerSearchChange,
  onRepositorySearchChange: _onRepositorySearchChange,
  onOwnerSelect,
  onRepositorySelect,
  onBranchSelect,
  onRootDirectoryChange,
  onConnectGithub,
  onCancel,
  onNext,
  canProceed,
}: StepSourceProps) {
  const [repoFilter, setRepoFilter] = useState("")

  const filteredRepositories = useMemo(() => {
    return repositories.filter((repo) =>
      repo.name.toLowerCase().includes(repoFilter.toLowerCase())
    )
  }, [repositories, repoFilter])

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
          onValueChange={(value) => onSourceTypeChange(value as DeploySourceType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 rounded-lg">
            <TabsTrigger
              value="github"
              className="py-2.5 text-sm font-medium transition-all rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <GithubLogo className="w-4 h-4 mr-2" />
              GitHub Repository
            </TabsTrigger>
            <TabsTrigger
              value="template"
              className="py-2.5 text-sm font-medium transition-all rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <FileCode className="w-4 h-4 mr-2" />
              Instant Templates
            </TabsTrigger>
          </TabsList>

          {/* GitHub Tab Content */}
          <TabsContent value="github" className="space-y-6 pt-4 focus-visible:outline-none">
            {/* GitHub Connection Info */}
            <div className="rounded-xl border border-border p-4 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-foreground text-background">
                    <GithubLogo className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">GitHub Integration</h4>
                    <p className="text-xs text-muted-foreground">
                      {githubConnectionStatus === "connected"
                        ? "Successfully connected to your GitHub account."
                        : "Connect your GitHub account to access your repositories."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {githubConnectionStatus === "connected" && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shadow-sm font-medium border-border"
                    disabled={isConnectingGithub}
                    onClick={onConnectGithub}
                  >
                    {isConnectingGithub
                      ? "Redirecting..."
                      : githubConnectionStatus === "connected"
                        ? "Reconnect GitHub"
                        : "Connect GitHub"}
                  </Button>
                </div>
              </div>

              {githubConnectionStatus === "error" && (
                <div className="mt-3 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  GitHub connection failed. Please try connecting again.
                </div>
              )}
            </div>

            {githubConnectionStatus === "connected" && (
              <div className="grid gap-6">
                {/* 1. Owner Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Select Account / Organization
                  </label>
                  {ownerOptionsLoading ? (
                    <div className="flex gap-2 items-center text-xs text-muted-foreground py-2">
                      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      Loading installations...
                    </div>
                  ) : ownerOptionsError ? (
                    <p className="text-xs text-destructive">{ownerOptionsError}</p>
                  ) : owners.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No accounts found. Please make sure the GitHub App is installed.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {owners.map((owner) => {
                        const isSelected = selectedOwnerId === owner.id
                        return (
                          <button
                            key={owner.id}
                            type="button"
                            onClick={() => onOwnerSelect(owner.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all shadow-sm",
                              isSelected
                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                : "border-border bg-background hover:bg-muted/50 text-foreground"
                            )}
                          >
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground border border-border">
                              {owner.name.charAt(0)}
                            </div>
                            {owner.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Repository Selection */}
                {selectedOwnerId && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Select Repository
                      </label>
                      <div className="relative w-full max-w-xs">
                        <MagnifyingGlass className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter repositories..."
                          value={repoFilter}
                          onChange={(e) => setRepoFilter(e.target.value)}
                          className="pl-9 h-9 text-xs"
                        />
                      </div>
                    </div>

                    {repositoryOptionsLoading ? (
                      <div className="flex gap-2 items-center text-xs text-muted-foreground py-4 justify-center border border-dashed rounded-xl">
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Loading repositories...
                      </div>
                    ) : repositoryOptionsError ? (
                      <p className="text-xs text-destructive">{repositoryOptionsError}</p>
                    ) : filteredRepositories.length === 0 ? (
                      <div className="text-center py-6 border border-dashed rounded-xl text-xs text-muted-foreground">
                        {repoFilter ? "No repositories match your filter." : "No repositories found for this account."}
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl bg-background overflow-hidden shadow-sm">
                        <div className="max-h-[240px] overflow-y-auto divide-y divide-border">
                          {filteredRepositories.map((repo) => {
                            const isSelected = selectedRepositoryId === repo.id
                            return (
                              <button
                                key={repo.id}
                                type="button"
                                onClick={() => onRepositorySelect(repo.id)}
                                className={cn(
                                  "w-full flex items-center justify-between p-3 text-left transition-all text-xs hover:bg-muted/40",
                                  isSelected && "bg-primary/5 font-medium"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Folder className={cn("w-4.5 h-4.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                                  <span className="truncate font-semibold text-foreground">
                                    {repo.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {repo.isPrivate ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px]">
                                      <Lock className="w-3 h-3" />
                                      Private
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px]">
                                      <Globe className="w-3 h-3" />
                                      Public
                                    </span>
                                  )}
                                  {repo.defaultBranch && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px]">
                                      <GitBranch className="w-3 h-3" />
                                      {repo.defaultBranch}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-primary shrink-0 ml-1" />
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

                {/* 3. Branch & Root Directory Config */}
                {selectedRepositoryId && (
                  <div className="grid gap-6 sm:grid-cols-2 border-t border-border pt-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <GitBranch className="w-3.5 h-3.5" />
                          Deployment Branch
                        </label>
                      </div>
                      {branches.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No branches found.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {branches.map((branch) => {
                            const isSelected = selectedBranchName === branch.name
                            return (
                              <button
                                key={branch.id}
                                type="button"
                                onClick={() => onBranchSelect(branch.name)}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all shadow-sm flex items-center gap-1",
                                  isSelected
                                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                    : "border-border bg-background hover:bg-muted/50 text-foreground"
                                )}
                              >
                                <GitBranch className="w-3 h-3 opacity-70" />
                                {branch.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Folder className="w-3.5 h-3.5" />
                        Root Directory
                      </label>
                      <div className="relative">
                        <Folder className="absolute left-3 top-2.5 w-4.5 h-4.5 text-muted-foreground" />
                        <Input
                          aria-label="Root directory"
                          value={rootDirectory}
                          onChange={(event) => onRootDirectoryChange(event.target.value)}
                          placeholder="/"
                          className="pl-9 text-xs h-9 border-border"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Where your application build files are located. Use root (/) by default.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Templates Tab Content */}
          <TabsContent value="template" className="pt-4 focus-visible:outline-none">
            <div className="grid gap-5 sm:grid-cols-3">
              {DEPLOY_TEMPLATES.map((template) => {
                const isSelected = templateId === template.id
                const cpuDisplay = `${(template.defaultCpu / 1000).toFixed(1)} vCPU`
                const memDisplay = template.defaultMemory >= 1024 
                  ? `${(template.defaultMemory / 1024).toFixed(0)} GB` 
                  : `${template.defaultMemory} MB`
                const stackText = template.build.useDockerfile ? "Docker" : `${template.build.language} (${template.build.framework})`

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      "group flex flex-col justify-between items-start text-left rounded-xl border p-5 transition-all duration-300 relative bg-background shadow-sm hover:shadow-md",
                      isSelected
                        ? "border-primary bg-primary/[0.02] ring-2 ring-primary/20 scale-[1.02]"
                        : "border-border hover:border-border/80 hover:bg-muted/[0.05]"
                    )}
                    onClick={() => onTemplateSelect(template.id)}
                  >
                    {/* Top Section */}
                    <div className="w-full space-y-3">
                      <div className="flex justify-between items-start w-full">
                        <div className="p-2 rounded-xl bg-muted/40 border border-border group-hover:bg-background transition-colors">
                          <TemplateIcon id={template.id} />
                        </div>
                        {isSelected && (
                          <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                          {template.name}
                        </h4>
                        <span className="inline-flex text-[9px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded mt-1">
                          {stackText}
                        </span>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    {/* Specs Section */}
                    <div className="w-full mt-5 border-t border-border/80 pt-4 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                        Min Requirements
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Cpu className="w-3.5 h-3.5 shrink-0 text-muted-foreground/75" />
                          <span className="font-medium text-foreground text-[11px]">{cpuDisplay}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <HardDrive className="w-3.5 h-3.5 shrink-0 text-muted-foreground/75" />
                          <span className="font-medium text-foreground text-[11px]">{memDisplay}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <div className="flex items-center justify-between border-t border-border p-4 bg-muted/10 rounded-b-xl">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-border shadow-sm text-xs font-semibold px-4 h-9"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="shadow-sm text-xs font-semibold px-4 h-9 flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Next Step
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  )
}
