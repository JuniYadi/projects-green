"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ManualBuildSettings } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  onSave: (settings: ManualBuildSettings) => Promise<void>
  initialValues?: Partial<ManualBuildSettings>
  isSaving?: boolean
}
const languages = ["Node.js", "Python", "Go", "PHP", "Ruby"]
const frameworks = [
  "Next.js",
  "React",
  "Express",
  "Django",
  "FastAPI",
  "Gin",
  "Laravel",
  "Rails",
]

export function ManualSettingsDialog({
  open,
  onClose,
  onSave,
  initialValues = {},
  isSaving,
}: Props) {
  const [values, setValues] = useState<ManualBuildSettings>({
    language: "",
    framework: "",
    runtimeVersion: "",
    packageManager: "",
    buildCommand: "",
    startCommand: "",
    port: 3000,
    useDockerfile: false,
    dockerfilePath: null,
    ...initialValues,
  })
  const set = (
    key: keyof ManualBuildSettings,
    value: string | number | boolean | null
  ) => setValues((v) => ({ ...v, [key]: value }))
  const valid =
    values.language &&
    values.framework &&
    values.runtimeVersion &&
    values.buildCommand &&
    values.startCommand &&
    values.port
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Build settings</DialogTitle>
          <DialogDescription>
            Tell us how to build and run this app.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              ["language", languages],
              ["framework", frameworks],
            ].map(([key, options]) => (
              <div className="grid gap-2" key={key as string}>
                <Label>{key === "language" ? "Language" : "Framework"}</Label>
                <Select
                  value={values[key as "language" | "framework"]}
                  onValueChange={(v) =>
                    set(key as keyof ManualBuildSettings, v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options as string[]).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {(
            [
              ["runtimeVersion", "Runtime version"],
              ["packageManager", "Package manager"],
              ["buildCommand", "Build command"],
              ["startCommand", "Start command"],
            ] as const
          ).map(([key, label]) => (
            <div className="grid gap-2" key={key}>
              <Label>
                {label}
                {key !== "packageManager" && " *"}
              </Label>
              <Input
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
          <div className="grid gap-2">
            <Label>Port *</Label>
            <Input
              type="number"
              value={values.port}
              onChange={(e) => set("port", Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.useDockerfile}
              onChange={(e) => set("useDockerfile", e.target.checked)}
            />
            Use a Dockerfile
          </label>
          {values.useDockerfile && (
            <div className="grid gap-2">
              <Label>Dockerfile path</Label>
              <Input
                value={values.dockerfilePath ?? ""}
                onChange={(e) => set("dockerfilePath", e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(isSaving) || !valid}
            onClick={() => onSave(values)}
          >
            {isSaving ? "Saving…" : "Save and re-check"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
