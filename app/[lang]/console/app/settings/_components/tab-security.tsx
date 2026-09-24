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

export type SecuritySettings = {
  runAsUser: number | null
  runAsGroup: number | null
  fsGroup: number | null
  readOnlyRootFilesystem: boolean
  runAsNonRoot: boolean
}

export type TabSecurityProps = {
  security?: SecuritySettings | null
  onSave?: (data: SecuritySettings) => Promise<void>
}

export function TabSecurity({
  security: initialSecurity,
  onSave,
}: TabSecurityProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pConsoleSettingsTabSecurity

  const [runAsUser, setRunAsUser] = useState<string>(
    initialSecurity?.runAsUser != null ? String(initialSecurity.runAsUser) : ""
  )
  const [runAsGroup, setRunAsGroup] = useState<string>(
    initialSecurity?.runAsGroup != null
      ? String(initialSecurity.runAsGroup)
      : ""
  )
  const [fsGroup, setFsGroup] = useState<string>(
    initialSecurity?.fsGroup != null ? String(initialSecurity.fsGroup) : ""
  )
  const [readOnlyRootFilesystem, setReadOnlyRootFilesystem] = useState<boolean>(
    initialSecurity?.readOnlyRootFilesystem ?? false
  )
  const [runAsNonRoot, setRunAsNonRoot] = useState<boolean>(
    initialSecurity?.runAsNonRoot ?? true
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (onSave) {
        await onSave({
          runAsUser: runAsUser.trim() ? Number.parseInt(runAsUser, 10) : null,
          runAsGroup: runAsGroup.trim()
            ? Number.parseInt(runAsGroup, 10)
            : null,
          fsGroup: fsGroup.trim() ? Number.parseInt(fsGroup, 10) : null,
          readOnlyRootFilesystem,
          runAsNonRoot,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card size="sm" className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-foreground">
          {t?.title ?? "Security Context & Runtime Permissions"}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t?.description ??
            "Configure pod and container execution permissions, user/group IDs, and storage volume ownership."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-xs">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="runAsUser"
              className="text-xs font-semibold text-foreground"
            >
              {t?.runAsUserLabel ?? "Run As User (UID)"}
            </label>
            <Input
              id="runAsUser"
              type="number"
              value={runAsUser}
              onChange={(e) => setRunAsUser(e.target.value)}
              placeholder="e.g. 1000"
              className="h-8 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {t?.runAsUserHint ??
                "UID for container process execution (leave empty for image default)."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="runAsGroup"
              className="text-xs font-semibold text-foreground"
            >
              {t?.runAsGroupLabel ?? "Run As Group (GID)"}
            </label>
            <Input
              id="runAsGroup"
              type="number"
              value={runAsGroup}
              onChange={(e) => setRunAsGroup(e.target.value)}
              placeholder="e.g. 1000"
              className="h-8 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {t?.runAsGroupHint ??
                "GID for container process execution (leave empty for image default)."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="fsGroup"
              className="text-xs font-semibold text-foreground"
            >
              {t?.fsGroupLabel ?? "Storage FSGroup"}
            </label>
            <Input
              id="fsGroup"
              type="number"
              value={fsGroup}
              onChange={(e) => setFsGroup(e.target.value)}
              placeholder="e.g. 1000"
              className="h-8 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {t?.fsGroupHint ??
                "Volume ownership GID for mounted persistent disks."}
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-medium text-foreground">
                {t?.readOnlyRootLabel ?? "Read-Only Root Filesystem"}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t?.readOnlyRootHint ??
                  "Mount container root filesystem as read-only. Uncheck for runtimes like Hermes Agent or Python that need write access."}
              </p>
            </div>
            <Switch
              checked={readOnlyRootFilesystem}
              onCheckedChange={setReadOnlyRootFilesystem}
              aria-label={t?.readOnlyRootLabel ?? "Read-Only Root Filesystem"}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-medium text-foreground">
                {t?.runAsNonRootLabel ?? "Strict Non-Root Execution"}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t?.runAsNonRootHint ??
                  "Requires container to run as a non-root user. Disable only if your container image explicitly uses root user."}
              </p>
            </div>
            <Switch
              checked={runAsNonRoot}
              onCheckedChange={setRunAsNonRoot}
              aria-label={t?.runAsNonRootLabel ?? "Strict Non-Root Execution"}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs"
          >
            {saving
              ? (t?.saving ?? "Saving…")
              : (t?.save ?? "Save Security Settings")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
