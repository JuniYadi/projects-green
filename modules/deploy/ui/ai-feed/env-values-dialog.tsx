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
import type { PlanEnvRequirement } from "./ai-deploy.types"

type Props = {
  open: boolean
  onClose: () => void
  onSave: (values: { key: string; value: string }[]) => Promise<void>
  envRequirements: PlanEnvRequirement[]
  isSaving?: boolean
}
export function EnvValuesDialog({
  open,
  onClose,
  onSave,
  envRequirements,
  isSaving,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const missing = envRequirements.some(
    (e) => e.required && e.kind !== "generated" && !values[e.key]?.trim()
  )
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Environment values</DialogTitle>
          <DialogDescription>
            Provide values required by this plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {envRequirements.map((env) => (
            <div className="grid gap-1" key={env.key}>
              <Label className="font-semibold">
                {env.key}
                {env.required && " *"}
              </Label>
              {env.kind === "generated" ? (
                <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Generated automatically
                </p>
              ) : (
                <Input
                  type={env.kind === "secret" ? "password" : "text"}
                  value={values[env.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [env.key]: e.target.value }))
                  }
                />
              )}
              <p className="text-xs text-muted-foreground">{env.description}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(isSaving) || missing}
            onClick={() =>
              onSave(
                envRequirements
                  .filter((e) => e.kind !== "generated")
                  .map((e) => ({ key: e.key, value: values[e.key] ?? "" }))
              )
            }
          >
            {isSaving ? "Saving…" : "Save values"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
