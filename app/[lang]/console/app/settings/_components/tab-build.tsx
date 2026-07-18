"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function TabBuild() {
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile")
  const [engineVersion, setEngineVersion] = useState("latest")
  const [buildCommand, setBuildCommand] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // ponytail: build settings API not yet implemented
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
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
            htmlFor="dockerfile-path"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Dockerfile Path
          </label>
          <Input
            id="dockerfile-path"
            value={dockerfilePath}
            onChange={(e) => setDockerfilePath(e.target.value)}
            placeholder="Dockerfile"
          />
          <p className="text-xs text-muted-foreground">
            Path to the Dockerfile relative to the repository root.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="engine-version"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Engine Version
          </label>
          <Input
            id="engine-version"
            value={engineVersion}
            onChange={(e) => setEngineVersion(e.target.value)}
            placeholder="latest"
          />
          <p className="text-xs text-muted-foreground">
            Container engine version to use for builds.
          </p>
        </div>

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

        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  )
}
