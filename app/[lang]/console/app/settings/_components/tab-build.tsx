"use client"

import { useState } from "react"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type TabBuildProps = {
  buildCommand?: string
  rootDirectory?: string
  dockerfileDetected?: boolean
  framework?: string
  sourceType?: string | null
  templateName?: string | null
  templateId?: string | null
  onSave?: (data: {
    buildCommand: string
    rootDirectory: string
    dockerfileDetected: boolean
    framework: string
  }) => Promise<void>
}

export function TabBuild({
  buildCommand: initialBuildCommand = "",
  rootDirectory: initialRootDirectory = "/",
  dockerfileDetected: initialDockerfileDetected = false,
  framework: initialFramework = "",
  sourceType,
  templateName,
  templateId,
  onSave,
}: TabBuildProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [buildCommand, setBuildCommand] = useState(initialBuildCommand)
  const [rootDirectory, setRootDirectory] = useState(initialRootDirectory)
  const [dockerfileDetected, setDockerfileDetected] = useState(
    initialDockerfileDetected
  )
  const [framework, setFramework] = useState(initialFramework)
  const [saving, setSaving] = useState(false)

  const isTemplate =
    sourceType === "TEMPLATE" || Boolean(templateName) || Boolean(templateId)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (onSave) {
        await onSave({
          buildCommand,
          rootDirectory,
          dockerfileDetected,
          framework,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (isTemplate) {
    return (
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">
            {messages.pConsoleSettingsTabBuild.buildDeployTitle}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {
              messages.pConsoleSettingsTabBuild
                .prebuiltTemplateConfigDescription
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                📦 {templateName ?? "Prebuilt Template"}
              </span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                {messages.pConsoleSettingsTabBuild.managedContainerImageBadge}
              </span>
            </div>
            <p className="leading-normal text-muted-foreground">
              {messages.pConsoleSettingsTabBuild.prebuiltContainerDescription}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card size="sm" className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-foreground">
          {messages.pConsoleSettingsTabBuild.buildDeployTitle}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {messages.pConsoleSettingsTabBuild.buildDeployDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-xs">
        <div className="space-y-1.5">
          <label
            htmlFor="build-command"
            className="block text-xs font-semibold text-muted-foreground"
          >
            {messages.pConsoleSettingsTabBuild.buildCommandLabel}
          </label>
          <Input
            id="build-command"
            value={buildCommand}
            onChange={(e) => setBuildCommand(e.target.value)}
            placeholder={
              messages.pConsoleSettingsTabBuild.buildCommandPlaceholder
            }
            className="h-9 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {messages.pConsoleSettingsTabBuild.buildCommandHint}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="root-directory"
            className="block text-xs font-semibold text-muted-foreground"
          >
            {messages.pConsoleSettingsTabBuild.rootDirectoryLabel}
          </label>
          <Input
            id="root-directory"
            value={rootDirectory}
            onChange={(e) => setRootDirectory(e.target.value)}
            placeholder="/"
            className="h-9 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {messages.pConsoleSettingsTabBuild.rootDirectoryHint}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="framework-name"
            className="block text-xs font-semibold text-muted-foreground"
          >
            {messages.pConsoleSettingsTabBuild.frameworkLabel}
          </label>
          <Input
            id="framework-name"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            placeholder={messages.pConsoleSettingsTabBuild.frameworkPlaceholder}
            className="h-9 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {messages.pConsoleSettingsTabBuild.frameworkHint}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground">
              {messages.pConsoleSettingsTabBuild.dockerfileBuildLabel}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {messages.pConsoleSettingsTabBuild.dockerfileBuildHint}
            </p>
          </div>
          <Switch
            checked={dockerfileDetected}
            onCheckedChange={setDockerfileDetected}
            aria-label={
              messages.pConsoleSettingsTabBuild.dockerfileBuildToggleAriaLabel
            }
          />
        </div>

        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  )
}
