/**
 * Template Detail — Reusable detail view component
 *
 * Shows template metadata, language variants, and action buttons.
 */

"use client"

import {
  WarningCircle,
  ArrowsClockwise,
  Lightning,
  PaperPlaneTilt,
  Copy,
  Info,
  CheckCircle,
  Clock,
  XCircle,
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TemplateLanguageBadge,
  WhatsAppTemplatePreview,
} from "./template-preview"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"
type TemplateDetailProps = {
  template: WhatsAppTemplate | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSync?: () => void
  syncing?: boolean
}

export function TemplateDetailView({
  template,
  loading,
  error,
  onRetry,
  onEdit: _onEdit,
  onDelete,
  onSync,
  syncing,
}: TemplateDetailProps) {
  const router = useRouter()
  // ── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <WarningCircle className="mb-3 size-10 text-destructive" />
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
        <Button variant="outline" onClick={onRetry}>
          <ArrowsClockwise className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lightning
          className="mb-3 size-10 text-muted-foreground"
          weight="fill"
        />
        <p className="text-sm text-muted-foreground">Template not found.</p>
      </div>
    )
  }

  // ── Format date helper ────────────────────────────────────────────────

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date))

  // ── Main render ──────────────────────────────────────────────────────

  const isApproved = template.metaStatus === "APPROVED"
  const isRejected =
    template.metaStatus === "REJECTED" ||
    template.languages.some(
      (l) => l.metaStatus === "REJECTED" || l.rejectReason
    )

  // Map Rejection Reasons to human explanations & fix recommendations
  const getHumanRejectionGuidance = (reason?: string | null) => {
    switch (reason) {
      case "INCORRECT_CATEGORY":
        return {
          title: "Kategori Template Tidak Sesuai",
          explanation:
            "Meta mendeteksi pesan ini berisi kode OTP/verifikasi atau promosi yang tidak sesuai dengan kategori yang dipilih.",
          fix: "Ubah kategori menjadi AUTHENTICATION (jika OTP) atau MARKETING (jika pesan promo) lalu submit ulang.",
        }
      case "TAG_CONTENT_MISMATCH":
        return {
          title: "Format Parameter {{1}} Tidak Valid",
          explanation:
            "Parameter placeholder melanggar kebijakan Meta (misalnya ditaruh di awal/akhir baris tanpa teks pembuka/penutup).",
          fix: "Pastikan semua variabel {{1}}, {{2}} diapit oleh teks kalimat yang jelas.",
        }
      case "PROMOTIONAL_CONTENT":
        return {
          title: "Terdeteksi Konten Promosi pada Kategori Utility",
          explanation:
            "Template Utility/Notification tidak boleh mengandung diskon, promo, atau ajakan belanja.",
          fix: "Ganti kategori template menjadi MARKETING atau hapus kata-kata promosi dari isi pesan.",
        }
      case "INVALID_FORMAT":
      default:
        return {
          title: "Format Template Ditolak oleh Meta",
          explanation:
            "Template melanggar panduan format Meta WhatsApp (e.g. ejaan tidak baku, URL shortener terlarang, atau karakter spesial).",
          fix: "Buat duplikat template, perbaiki teks pesan, dan pastikan tidak menggunakan URL shortener seperti bit.ly.",
        }
    }
  }

  const firstRejectedLang = template.languages.find((l) => l.rejectReason)
  const rejectionGuidance = getHumanRejectionGuidance(
    firstRejectedLang?.rejectReason
  )

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {template.name}
            </h1>
            {isApproved ? (
              <Badge className="flex items-center gap-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-600">
                <CheckCircle weight="fill" className="size-3.5" />
                Approved
              </Badge>
            ) : isRejected ? (
              <Badge className="flex items-center gap-1 border-destructive/30 bg-destructive/15 text-destructive">
                <XCircle weight="fill" className="size-3.5" />
                Rejected
              </Badge>
            ) : (
              <Badge className="flex items-center gap-1 border-amber-500/30 bg-amber-500/15 text-amber-600">
                <Clock weight="fill" className="size-3.5" />
                In Review
              </Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {template.slug}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isApproved && (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() =>
                router.push(
                  `/en/console/whatsapp/messages?template=${template.id}`
                )
              }
            >
              <PaperPlaneTilt weight="bold" className="mr-1.5 size-4" />
              Send Test Message
            </Button>
          )}

          {isRejected && (
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                router.push(
                  `/en/console/whatsapp/templates/new?duplicate=${template.id}`
                )
              }
            >
              <Copy weight="bold" className="mr-1.5 size-4" />
              Duplicate & Fix
            </Button>
          )}

          {onSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing}
            >
              <ArrowsClockwise
                className={`mr-1 size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync"}
            </Button>
          )}

          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Human Guidance Banner for Rejected State */}
      {isRejected && (
        <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-full bg-destructive/15 p-2 text-destructive">
              <Info weight="fill" className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">
                {rejectionGuidance.title} (
                {firstRejectedLang?.rejectReason || "REJECTED"})
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">
                {rejectionGuidance.explanation}
              </p>
              <p className="pt-1 text-xs text-muted-foreground">
                💡 <strong>Solusi:</strong> {rejectionGuidance.fix}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid Content */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Clean Template Info (2 columns span on large screens) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Template Summary</CardTitle>
            <CardDescription>Key configuration & assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3.5">
              <InfoRow
                label="WhatsApp Status"
                value={
                  <span className="text-xs font-semibold">
                    {isApproved
                      ? "Approved by Meta"
                      : isRejected
                        ? "Rejected"
                        : "In Review"}
                  </span>
                }
              />
              <InfoRow
                label="Category"
                value={
                  <Badge variant="outline" className="font-mono text-xs">
                    {template.category ?? "UTILITY"}
                  </Badge>
                }
              />
              <InfoRow
                label="Assigned Device"
                value={
                  template.whatsappDeviceId ? (
                    <span className="text-xs font-medium">Assigned</span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      All Devices
                    </Badge>
                  )
                }
              />
              <InfoRow
                label="Total Languages"
                value={`${template.languages.length} Variant(s)`}
              />
              <InfoRow label="Created" value={formatDate(template.createdAt)} />
              <InfoRow
                label="Last Updated"
                value={formatDate(template.updatedAt)}
              />
            </dl>
          </CardContent>
        </Card>

        {/* Right: Realistic WhatsApp Preview (3 columns span) */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Message Preview</CardTitle>
            <CardDescription>
              Realistic preview of what your recipients see in WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {template.languages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No language variants available.
              </p>
            ) : (
              <div className="space-y-4">
                {template.languages.map((lang) => (
                  <div key={lang.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <TemplateLanguageBadge lang={lang.lang} />
                      {lang.rejectReason && (
                        <span className="text-[11px] font-semibold text-destructive">
                          Reason: {lang.rejectReason}
                        </span>
                      )}
                    </div>
                    <WhatsAppTemplatePreview language={lang} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | number | React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-xs text-foreground">{value}</dd>
    </div>
  )
}
