"use client"

import { useState } from "react"
import { FolderOpen, GitFork, ArrowRight } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type MonorepoProject = {
  path: string
  name?: string
  framework?: string
  description?: string
}

export type MonorepoDisambiguationCardProps = {
  projects?: MonorepoProject[]
  onSelectProject: (subpath: string, framework?: string) => void
  lang?: string
  className?: string
}

const DEFAULT_PROJECTS: MonorepoProject[] = [
  {
    path: "apps/web",
    name: "apps/web",
    framework: "Next.js 15.4",
    description: "Frontend",
  },
  {
    path: "services/api",
    name: "services/api",
    framework: "Go Gin",
    description: "REST Backend",
  },
]

export function MonorepoDisambiguationCard({
  projects = DEFAULT_PROJECTS,
  onSelectProject,
  lang = "en",
  className,
}: MonorepoDisambiguationCardProps) {
  const isId = lang === "id"
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent
  const [customPath, setCustomPath] = useState("")

  const handleApplyCustom = () => {
    const trimmed = customPath.trim()
    if (!trimmed) return
    onSelectProject(trimmed)
  }

  const projectList = projects.length > 0 ? projects : DEFAULT_PROJECTS

  return (
    <div
      data-testid="monorepo-disambiguation-card"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <GitFork className="h-5 w-5 shrink-0 text-primary" weight="bold" />
        <h2 className="text-xs font-bold tracking-wider text-foreground uppercase sm:text-sm">
          {agentMessages.monorepoDetectedHeader}
        </h2>
      </div>

      {/* Explanatory Copy */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:text-sm">
        <p>{agentMessages.monorepoExplanation}</p>
        <p>{agentMessages.monorepoWhichApp}</p>
      </div>

      {/* Pilih Target Direktori Chips */}
      <div className="flex flex-col gap-2 pt-1">
        <span className="text-xs font-semibold text-foreground">
          {agentMessages.selectTargetDirectory}
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {projectList.map((proj, idx) => {
            const label = proj.framework
              ? `${proj.path} (${proj.framework}${
                  proj.description ? ` · ${proj.description}` : ""
                })`
              : proj.path
            return (
              <Button
                key={proj.path}
                type="button"
                variant="outline"
                data-testid={`monorepo-chip-${idx}`}
                onClick={() => onSelectProject(proj.path, proj.framework)}
                className="h-9 gap-2 border-border bg-background px-3 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-muted"
              >
                <FolderOpen className="h-4 w-4 text-primary" weight="bold" />
                <span>
                  {idx + 1}. {label}
                </span>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Custom Root Directory Input */}
      <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
        <label
          htmlFor="custom-root-input"
          className="text-xs font-medium text-muted-foreground"
        >
          {agentMessages.orCustomRoot}
        </label>
        <div className="flex max-w-md items-center gap-2">
          <Input
            id="custom-root-input"
            data-testid="monorepo-custom-input"
            type="text"
            placeholder={agentMessages.customRootPlaceholder}
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleApplyCustom()
              }
            }}
            className="h-9 font-mono text-xs"
          />
          <Button
            type="button"
            data-testid="monorepo-apply-btn"
            onClick={handleApplyCustom}
            disabled={!customPath.trim()}
            className="h-9 shrink-0 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <span>{isId ? "Terapkan" : "Apply"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
