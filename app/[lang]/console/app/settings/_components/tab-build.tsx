"use client"

import { useState } from "react"

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

export type TabBuildProps = {
  buildCommand?: string
  rootDirectory?: string
  dockerfileDetected?: boolean
  framework?: string
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
  onSave,
}: TabBuildProps) {
  const [buildCommand, setBuildCommand] = useState(initialBuildCommand)
  const [rootDirectory, setRootDirectory] = useState(initialRootDirectory)
  const [dockerfileDetected, setDockerfileDetected] = useState(
    initialDockerfileDetected
  )
  const [framework, setFramework] = useState(initialFramework)
  const [saving, setSaving] = useState(false)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Build & Deploy</CardTitle>
        <CardDescription>
          Configure how your application is built and deployed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="build-command"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Build Command
          </label>
          <Input
            id="build-command"
            value={buildCommand}
            onChange={(e) => setBuildCommand(e.target.value)}
            placeholder="npm run build"
          />
          <p className="text-xs text-muted-foreground">
            Custom build command. Leave empty to use auto-detected defaults.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="root-directory"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Root Directory
          </label>
          <Input
            id="root-directory"
            value={rootDirectory}
            onChange={(e) => setRootDirectory(e.target.value)}
            placeholder="/"
          />
          <p className="text-xs text-muted-foreground">
            The directory within your repository where source code lives.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="framework-name"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Framework
          </label>
          <Input
            id="framework-name"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            placeholder="e.g. Next.js, Laravel, Docker"
          />
          <p className="text-xs text-muted-foreground">
            Detected or configured runtime framework.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-foreground">
              Dockerfile Build
            </span>
            <p className="text-xs text-muted-foreground">
              Build container image directly using repository Dockerfile.
            </p>
          </div>
          <Switch
            checked={dockerfileDetected}
            onCheckedChange={setDockerfileDetected}
            aria-label="Toggle Dockerfile build"
          />
        </div>

        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  )
}
