"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeSlash,
  Plus,
  Trash,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import type { EnvVar, GitBuildConfig, GitSourceConfig } from "./types"

type GitBuildStepProps = {
  source: GitSourceConfig
  initialConfig?: Partial<GitBuildConfig>
  inspectionData?: Record<string, unknown> | null
  onBack: () => void
  onNext: (config: GitBuildConfig) => void
}

export function GitBuildStep({
  source,
  initialConfig,
  inspectionData,
  onBack,
  onNext,
}: GitBuildStepProps) {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.deploy.gitDeploy.build
  // Extract detected framework details if available
  const detection = inspectionData?.detection as
    | {
        framework?: string
        version?: string
        primaryEngine?: string
        buildCommand?: string
        startCommand?: string
        port?: number
        confidence?: number
      }
    | undefined
  const detectedFramework =
    detection?.framework || initialConfig?.framework || "Node.js"
  const detectedVersion =
    detection?.version || initialConfig?.frameworkVersion || ""
  const detectedRuntime =
    detection?.primaryEngine || initialConfig?.runtime || "Node.js 20"
  const detectedConfidence =
    detection?.confidence !== undefined
      ? Math.round(detection.confidence * 100)
      : 95

  const [buildCommand, setBuildCommand] = useState(
    initialConfig?.buildCommand ?? detection?.buildCommand ?? "pnpm run build"
  )
  const [startCommand, setStartCommand] = useState(
    initialConfig?.startCommand ?? detection?.startCommand ?? "pnpm start"
  )
  const [outputDir, setOutputDir] = useState(
    initialConfig?.outputDir ?? ".next"
  )
  const [port, setPort] = useState(
    initialConfig?.port ?? detection?.port ?? 3000
  )
  const [useDockerfile, setUseDockerfile] = useState(
    initialConfig?.useDockerfile ?? false
  )
  const [dockerfilePath, setDockerfilePath] = useState(
    initialConfig?.dockerfilePath ?? "Dockerfile"
  )

  const detectedPackageManager =
    (detection as { packageManager?: string } | undefined)?.packageManager ||
    (buildCommand.includes("bun")
      ? "bun"
      : buildCommand.includes("pnpm")
        ? "pnpm"
        : buildCommand.includes("yarn")
          ? "yarn"
          : buildCommand.includes("npm")
            ? "npm"
            : buildCommand.includes("composer")
              ? "composer"
              : buildCommand.includes("go")
                ? "go"
                : "Auto-detected")

  // Environment variables
  const [envVars, setEnvVars] = useState<EnvVar[]>(
    initialConfig?.envVars ?? [
      { id: "1", key: "NODE_ENV", value: "production", isSecret: false },
    ]
  )
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, boolean>
  >({})

  const addEnvVar = () => {
    setEnvVars((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: "", value: "", isSecret: false },
    ])
  }

  const removeEnvVar = (id: string) => {
    setEnvVars((prev) => prev.filter((item) => item.id !== id))
  }

  const updateEnvVar = (
    id: string,
    field: "key" | "value" | "isSecret",
    val: string | boolean
  ) => {
    setEnvVars((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    )
  }

  const toggleSecretReveal = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleContinue = () => {
    onNext({
      framework: detectedFramework,
      frameworkVersion: detectedVersion,
      runtime: detectedRuntime,
      confidence: detectedConfidence,
      buildCommand,
      startCommand,
      outputDir,
      port: Number(port) || 3000,
      useDockerfile,
      dockerfilePath,
      envVars: envVars.filter((v) => v.key.trim().length > 0),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Repository Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-mono text-xs">
            {source.branch}
          </Badge>
          <span className="font-mono text-sm font-medium">{source.url}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          {messages.changeRepo}
        </Button>
      </div>

      {/* Framework Detection Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold">
              {messages.frameworkDetection}
            </h2>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-700"
          >
            {detectedConfidence}
            {messages.confidence}
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase">
              {messages.framework}
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {detectedFramework} {detectedVersion}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase">
              {messages.runtimeEngine}
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {detectedRuntime}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase">
              {messages.packageManager}
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {detectedPackageManager}
            </p>
          </div>
        </div>
      </div>

      {/* Build & Runtime Settings */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">{messages.settingsTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.settingsDesc}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              {messages.buildCommand}
            </label>
            <Input
              className="mt-1 font-mono text-sm"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder={messages.buildCommandPlaceholder}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              {messages.outputDirectory}
            </label>
            <Input
              className="mt-1 font-mono text-sm"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder={messages.outputDirectoryPlaceholder}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              {messages.startCommand}
            </label>
            <Input
              className="mt-1 font-mono text-sm"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              placeholder={messages.startCommandPlaceholder}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              {messages.appPort}
            </label>
            <Input
              className="mt-1 font-mono text-sm"
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="3000"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{messages.customDockerfile}</p>
              <p className="text-xs text-muted-foreground">
                {messages.customDockerfileDesc}
              </p>
            </div>
            <Switch
              checked={useDockerfile}
              onCheckedChange={setUseDockerfile}
            />
          </div>

          {useDockerfile && (
            <div className="mt-3 max-w-sm">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                {messages.dockerfilePath}
              </label>
              <Input
                className="mt-1 font-mono text-sm"
                value={dockerfilePath}
                onChange={(e) => setDockerfilePath(e.target.value)}
                placeholder="Dockerfile"
              />
            </div>
          )}
        </div>
      </div>

      {/* Environment Variables */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{messages.envVars}</h2>
            <p className="text-xs text-muted-foreground">
              {messages.envVarsDesc}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addEnvVar}>
            <Plus className="mr-1.5 h-4 w-4" />
            {messages.addVariable}
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {envVars.map((env) => (
            <div key={env.id} className="flex items-center gap-2">
              <Input
                className="w-1/3 font-mono text-xs"
                placeholder="KEY_NAME"
                value={env.key}
                onChange={(e) => updateEnvVar(env.id, "key", e.target.value)}
              />
              <div className="relative flex-1">
                <Input
                  className="pr-9 font-mono text-xs"
                  type={
                    env.isSecret && !revealedSecrets[env.id]
                      ? "password"
                      : "text"
                  }
                  placeholder={messages.envValuePlaceholder}
                  value={env.value}
                  onChange={(e) =>
                    updateEnvVar(env.id, "value", e.target.value)
                  }
                />
                {env.isSecret && (
                  <button
                    type="button"
                    onClick={() => toggleSecretReveal(env.id)}
                    className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
                  >
                    {revealedSecrets[env.id] ? (
                      <EyeSlash className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              <Button
                variant={env.isSecret ? "secondary" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => updateEnvVar(env.id, "isSecret", !env.isSecret)}
              >
                {env.isSecret ? "Secret" : "Plain"}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeEnvVar(env.id)}
              >
                <Trash className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Step Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {messages.backToSource}
        </Button>
        <Button onClick={handleContinue}>
          {messages.continueToSizing}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
