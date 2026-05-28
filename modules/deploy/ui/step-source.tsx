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
  SquaresFour,
  List,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react"
import { SiN8N, SiDocker } from "react-icons/si"

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
const TemplateIcon = ({ id, size = "md" }: { id: DeployTemplateId; size?: "sm" | "md" }) => {
  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-10 w-10"
  switch (id) {
    case "wordpress":
      return (
        <div className={cn("relative flex items-center justify-center shrink-0", sizeClasses)}>
          <svg
            viewBox="0 0 24 24"
            className="h-full w-full relative z-10 shrink-0"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="12" fill="#21759b" />
            <path
              d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1(1.234-.1).585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12"
              fill="#ffffff"
            />
          </svg>
        </div>
      )
    case "n8n":
      return <SiN8N className={cn("text-[#ff6d5a] shrink-0", sizeClasses)} />
    case "openclaw":
      return <SiDocker className={cn("text-[#2496ed] shrink-0", sizeClasses)} />
    default:
      return <FileCode className={cn("text-[#6366f1] shrink-0", sizeClasses)} />
  }
}

const CATEGORIES = ["All", "Websites", "Automation", "Developer Tools"]

const getTemplateCategory = (id: DeployTemplateId): string => {
  switch (id) {
    case "wordpress":
      return "Websites"
    case "n8n":
      return "Automation"
    case "openclaw":
      return "Developer Tools"
    default:
      return "Developer Tools"
  }
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
  const [templateFilter, setTemplateFilter] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6

  const filteredTemplates = useMemo(() => {
    console.log("DEBUG: templateFilter =", JSON.stringify(templateFilter))
    const res = DEPLOY_TEMPLATES.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(templateFilter.toLowerCase()) ||
        template.description.toLowerCase().includes(templateFilter.toLowerCase())
      const matchesCategory =
        selectedCategory === "All" ||
        getTemplateCategory(template.id) === selectedCategory
      return matchesSearch && matchesCategory
    })
    console.log("DEBUG: filtered count =", res.length)
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
          <TabsContent value="template" className="space-y-4 pt-4 focus-visible:outline-none">
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Instant Template
              </label>
              <div className="relative w-full max-w-xs">
                <MagnifyingGlass className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  onChange={(e) => {
                    console.log("DEBUG: onChange called with:", JSON.stringify(e.target.value))
                    setTemplateFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            {/* Toolbar: Category Filters and View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
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
                        "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all shadow-sm cursor-pointer",
                        isCatSelected
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-border/50"
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
                    "p-1.5 rounded-lg border transition-all cursor-pointer",
                    viewMode === "grid"
                      ? "bg-primary/5 text-primary border-primary/30"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  )}
                  title="Grid View"
                >
                  <SquaresFour className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded-lg border transition-all cursor-pointer",
                    viewMode === "list"
                      ? "bg-primary/5 text-primary border-primary/30"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  )}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-xl text-xs text-muted-foreground">
                No templates match your search.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[380px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {viewMode === "grid" ? (
                    <div className="grid gap-3.5 sm:grid-cols-3 pb-2">
                      {paginatedTemplates.map((template) => {
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
                              "group flex flex-col justify-between items-start text-left rounded-xl border p-4 transition-all duration-300 relative bg-background shadow-sm hover:shadow-md cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary/[0.02] ring-2 ring-primary/20 scale-[1.02]"
                                : "border-border hover:border-border/80 hover:bg-muted/[0.05]"
                            )}
                            onClick={() => onTemplateSelect(template.id)}
                          >
                            {/* Top Section */}
                            <div className="w-full space-y-2.5">
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
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                  {template.description}
                                </p>
                              </div>
                            </div>

                            {/* Specs Section */}
                            <div className="w-full mt-4 border-t border-border/80 pt-3 space-y-1.5">
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
                  ) : (
                    <div className="flex flex-col gap-2 pb-2">
                      {paginatedTemplates.map((template) => {
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
                              "group flex items-center justify-between p-3 border rounded-xl bg-background shadow-sm hover:shadow-md transition-all duration-200 text-left cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary/[0.02] ring-1 ring-primary/20"
                                : "border-border hover:border-border/80 hover:bg-muted/[0.05]"
                            )}
                            onClick={() => onTemplateSelect(template.id)}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                              {/* Icon */}
                              <div className="p-2 rounded-xl bg-muted/40 border border-border group-hover:bg-background transition-colors shrink-0">
                                <TemplateIcon id={template.id} size="sm" />
                              </div>
                              {/* Title & Description */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                                    {template.name}
                                  </h4>
                                  <span className="inline-flex text-[9px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded">
                                    {stackText}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 truncate max-w-[450px]">
                                  {template.description}
                                </p>
                              </div>
                            </div>

                            {/* Specs and selection indicator */}
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground border-r border-border/80 pr-4 py-1">
                                <div className="flex items-center gap-1">
                                  <Cpu className="w-3.5 h-3.5 text-muted-foreground/75" />
                                  <span className="font-medium text-foreground text-[11px]">{cpuDisplay}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <HardDrive className="w-3.5 h-3.5 text-muted-foreground/75" />
                                  <span className="font-medium text-foreground text-[11px]">{memDisplay}</span>
                                </div>
                              </div>

                              {isSelected ? (
                                <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors">
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
                  <div className="flex items-center justify-between border-t border-border/60 pt-4 mt-2">
                    <div className="text-[11px] text-muted-foreground font-medium">
                      Showing <span className="font-semibold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>-
                      <span className="font-semibold text-foreground">{Math.min(filteredTemplates.length, currentPage * ITEMS_PER_PAGE)}</span> of{" "}
                      <span className="font-semibold text-foreground">{filteredTemplates.length}</span> templates
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="h-8 px-2.5 text-xs flex items-center gap-1 border-border font-medium shadow-sm"
                      >
                        <CaretLeft className="w-3.5 h-3.5" />
                        Previous
                      </Button>
                      <div className="text-xs font-semibold text-muted-foreground px-2">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className="h-8 px-2.5 text-xs flex items-center gap-1 border-border font-medium shadow-sm"
                      >
                        Next
                        <CaretRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
