"use client"

import React, { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Sparkle,
  ArrowRight,
  ShieldCheck,
  Spinner,
  X,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

export interface TemplateUpdateBannerProps {
  stack: StackSummaryDTO
  locale?: string
  onUpdated?: () => void
}

export function TemplateUpdateBanner({
  stack,
  locale = "en",
  onUpdated,
}: TemplateUpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isUpgrading, startUpgradeTransition] = useTransition()

  const update = stack.templateUpdate
  if (!update || !update.hasUpdate || dismissed) {
    return null
  }

  const isIndo = locale === "id"

  const handleUpgrade = () => {
    startUpgradeTransition(async () => {
      try {
        const res = await fetch(
          `/api/deploy/apps/${stack.slug}/upgrade-template`,
          {
            method: "POST",
          }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.message || "Failed to upgrade template")
        }

        toast.success(
          isIndo
            ? "Template berhasil diperbarui! Sinkronisasi GitOps dimulai."
            : "Template upgraded successfully! GitOps rollout initiated."
        )
        setConfirmOpen(false)
        onUpdated?.()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upgrade failed"
        toast.error(message)
      }
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkle className="size-4" weight="fill" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {isIndo
                  ? "Pembaruan Template Tersedia"
                  : "Template Update Available"}
              </span>
              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  v{update.installedVersion}
                </Badge>
                <ArrowRight className="size-3 text-muted-foreground" />
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 font-mono text-[11px] text-primary"
                >
                  v{update.latestVersion}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isIndo
                ? "Versi baru dari katalog template siap di-apply. Domain kustom, scaling CPU/RAM, dan variabel lingkungan Anda tetap aman."
                : "A newer setup is available from the template catalog. Custom domains, scaling, and environment variables are preserved."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          <Button
            type="button"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="gap-1.5 bg-primary text-xs text-primary-foreground"
          >
            <Sparkle className="size-3.5" />
            {isIndo
              ? `Update ke v${update.latestVersion}`
              : `Update to v${update.latestVersion}`}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="size-8 text-muted-foreground hover:text-foreground"
            title={isIndo ? "Tutup notifikasi" : "Dismiss"}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Upgrade Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-primary" />
              {isIndo
                ? `Update ${stack.name} ke Template v${update.latestVersion}?`
                : `Update ${stack.name} to Template v${update.latestVersion}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-xs text-muted-foreground">
                <p>
                  {isIndo
                    ? "Konfigurasi dasar aplikasi akan diselaraskan dengan versi template terbaru."
                    : "Your application will be upgraded to match the latest template release."}
                </p>

                <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-semibold text-foreground">
                    {isIndo ? "Aturan Safe Merge:" : "Safe Merge Protections:"}
                  </p>
                  <ul className="list-inside list-disc space-y-1.5">
                    <li>
                      <span className="font-medium text-foreground">
                        {isIndo
                          ? "Domain & Scaling aman:"
                          : "Custom sizing preserved:"}
                      </span>{" "}
                      {isIndo
                        ? "CPU, RAM, dan domain kustom tidak berubah."
                        : "CPU, RAM, and custom domains remain untouched."}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        {isIndo
                          ? "Nilai Env aman:"
                          : "Existing envs preserved:"}
                      </span>{" "}
                      {isIndo
                        ? "Variabel lingkungan kustom Anda tidak akan ditimpa."
                        : "Your custom environment variables will not be overwritten."}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        {isIndo ? "Arsitektur baru:" : "Architecture updated:"}
                      </span>{" "}
                      {isIndo
                        ? "Port, controller workload, dan default baru diterapkan."
                        : "Workload controller, ports, and new defaults are applied."}
                    </li>
                    <li>
                      <span className="font-medium text-primary">
                        {isIndo ? "Deploy rolling:" : "Rolling rollout:"}
                      </span>{" "}
                      {isIndo
                        ? "Cluster Kubernetes akan menjalankan rolling update melalui ArgoCD."
                        : "Kubernetes will execute a rolling sync via ArgoCD."}
                    </li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpgrading}>
              {isIndo ? "Batal" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleUpgrade()
              }}
              disabled={isUpgrading}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              {isUpgrading && <Spinner className="size-3.5 animate-spin" />}
              {isUpgrading
                ? isIndo
                  ? "Memperbarui..."
                  : "Upgrading..."
                : isIndo
                  ? "Konfirmasi & Update"
                  : "Confirm & Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
