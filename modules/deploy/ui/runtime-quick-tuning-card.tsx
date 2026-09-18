"use client"

import React, { useMemo } from "react"
import { usePathname } from "next/navigation"
import {
  SlidersHorizontal,
  UploadSimple,
  Cpu,
  GearSix,
  CheckCircle,
} from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { normalizeFrameworkId } from "@/modules/framework-detection/platform-runtime-contract"

const UPLOAD_PRESETS = ["32M", "64M", "100M", "256M", "512M"]
const MEMORY_PRESETS = ["128M", "256M", "512M", "1024M"]

export type RuntimeQuickTuningCardProps = {
  framework?: string | null
  envVars: Array<{ key: string; value: string }>
  onApplyEnvVar?: (key: string, value: string) => void
  onApplyBatch?: (updates: Record<string, string>) => void
  readOnly?: boolean
  className?: string
}

export function RuntimeQuickTuningCard({
  framework,
  envVars,
  onApplyEnvVar,
  onApplyBatch,
  readOnly = false,
  className,
}: RuntimeQuickTuningCardProps) {
  const pathname = usePathname()
  const locale = resolveLocaleOrDefault(pathname)
  const messages = getMessages(locale).console.deploy.runtimeQuickTuning

  const roleOptions = useMemo(
    () => [
      {
        role: "app",
        label: messages.roleWebApp,
        desc: messages.roleWebAppDesc,
      },
      {
        role: "worker",
        label: messages.roleWorker,
        desc: messages.roleWorkerDesc,
      },
      {
        role: "horizon",
        label: messages.roleHorizon,
        desc: messages.roleHorizonDesc,
      },
      {
        role: "scheduler",
        label: messages.roleScheduler,
        desc: messages.roleSchedulerDesc,
      },
    ],
    [messages]
  )

  const normalizedFramework = normalizeFrameworkId(framework)

  const envMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of envVars) {
      map.set(item.key, item.value)
    }
    return map
  }, [envVars])

  const uploadValue = envMap.get("PHP_UPLOAD_MAX_FILESIZE") || "64M"
  const memoryValue = envMap.get("PHP_MEMORY_LIMIT") || "256M"
  const roleValue = envMap.get("CONTAINER_ROLE") || "app"
  const portValue = envMap.get("PORT") || "8080"
  const nodeEnvValue =
    envMap.get(normalizedFramework === "bun" ? "BUN_ENV" : "NODE_ENV") ||
    "production"

  const uploadIndex = Math.max(0, UPLOAD_PRESETS.indexOf(uploadValue))
  const memoryIndex = Math.max(0, MEMORY_PRESETS.indexOf(memoryValue))

  const handleApply = (key: string, value: string) => {
    if (readOnly) return
    onApplyEnvVar?.(key, value)
  }

  const handleUploadChange = (val: string) => {
    if (readOnly) return
    if (onApplyBatch) {
      onApplyBatch({
        PHP_UPLOAD_MAX_FILESIZE: val,
        PHP_POST_MAX_SIZE: val,
      })
    } else {
      handleApply("PHP_UPLOAD_MAX_FILESIZE", val)
      handleApply("PHP_POST_MAX_SIZE", val)
    }
  }

  const isLaravel = normalizedFramework === "laravel"

  return (
    <Card
      size="sm"
      className={cn(
        "border-border bg-card shadow-sm transition-all",
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-foreground">
              {messages.title}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono">
            {normalizedFramework.toUpperCase()}
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          {messages.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 text-xs">
        {isLaravel ? (
          <>
            {/* Max Upload Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <UploadSimple className="size-3.5 text-muted-foreground" />
                  {messages.maxUploadSize}
                </Label>
                <span className="font-mono text-xs font-semibold text-primary">
                  {uploadValue}
                </span>
              </div>
              <div className="px-1">
                <Slider
                  min={0}
                  max={UPLOAD_PRESETS.length - 1}
                  step={1}
                  value={[uploadIndex]}
                  disabled={readOnly}
                  onValueChange={(vals) => {
                    const next = UPLOAD_PRESETS[vals[0] ?? 0]
                    if (next) handleUploadChange(next)
                  }}
                  aria-label={messages.maxUploadSize}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {UPLOAD_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={uploadValue === preset ? "default" : "outline"}
                    size="xs"
                    disabled={readOnly}
                    aria-label={messages.uploadPresetAria.replace("{preset}", preset)}
                    onClick={() => handleUploadChange(preset)}
                    className="h-6 px-2 text-[11px]"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* PHP Memory Limit */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Cpu className="size-3.5 text-muted-foreground" />
                  {messages.memoryLimit}
                </Label>
                <span className="font-mono text-xs font-semibold text-primary">
                  {memoryValue}
                </span>
              </div>
              <div className="px-1">
                <Slider
                  min={0}
                  max={MEMORY_PRESETS.length - 1}
                  step={1}
                  value={[memoryIndex]}
                  disabled={readOnly}
                  onValueChange={(vals) => {
                    const next = MEMORY_PRESETS[vals[0] ?? 0]
                    if (next) handleApply("PHP_MEMORY_LIMIT", next)
                  }}
                  aria-label={messages.memoryLimit}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {MEMORY_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={memoryValue === preset ? "default" : "outline"}
                    size="xs"
                    disabled={readOnly}
                    aria-label={messages.memoryPresetAria.replace("{preset}", preset)}
                    onClick={() => handleApply("PHP_MEMORY_LIMIT", preset)}
                    className="h-6 px-2 text-[11px]"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Container Role */}
            <div className="space-y-2 pt-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <GearSix className="size-3.5 text-muted-foreground" />
                {messages.workloadRole}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {roleOptions.map((item) => {
                  const isSelected = roleValue === item.role
                  return (
                    <button
                      key={item.role}
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleApply("CONTAINER_ROLE", item.role)}
                      className={cn(
                        "flex flex-col items-start rounded-md border p-2 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {item.label}
                        </span>
                        {isSelected && (
                          <CheckCircle className="size-3 text-primary" weight="fill" />
                        )}
                      </div>
                      <span className="mt-1 text-[10px] text-muted-foreground">
                        {item.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          /* Non-Laravel runtimes (Next.js, Bun, Node, etc.) */
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-3 space-y-1">
              <Label className="text-xs font-medium text-foreground">
                {messages.containerPort}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {messages.portDesc}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {portValue}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {messages.portDefaultNotice}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-3 space-y-1">
              <Label className="text-xs font-medium text-foreground">
                {messages.environmentMode.replace(
                  "{envKey}",
                  normalizedFramework === "bun" ? "BUN_ENV" : "NODE_ENV"
                )}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {messages.envModeDesc}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {nodeEnvValue}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
