/**
 * Template Detail — Interactive detail view component
 *
 * Shows template metadata, structured specification tester,
 * live preview (WhatsApp Bubble & Ready-to-use JSON), and developer code modal.
 */

"use client"

import * as React from "react"
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
  Code,
  Check,
  ChatsCircle,
  FileCode,
} from "@phosphor-icons/react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  WhatsAppTemplatePreview,
  resolveTemplatePreviewValues,
  type TemplatePreviewValues,
} from "./template-preview"
import { TemplateSpecTester } from "./template-spec-tester"
import {
  TemplateCodeSnippetDialog,
  generateTemplatePayload,
} from "./template-code-snippet-dialog"
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
  const routeParams = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(routeParams?.lang)

  // State for active language selection and variable overrides
  const defaultLang = template?.languages?.[0]?.lang ?? ""
  const [selectedLang, setSelectedLang] = React.useState<string>(defaultLang)
  const [variableOverrides, setVariableOverrides] =
    React.useState<TemplatePreviewValues>({})
  const [codeModalOpen, setCodeModalOpen] = React.useState(false)
  const [copiedJson, setCopiedJson] = React.useState(false)
  const [previewTab, setPreviewTab] = React.useState<"bubble" | "json">(
    "bubble"
  )

  const activeLangCode = selectedLang || defaultLang
  const currentLanguage =
    template?.languages.find((l) => l.lang === activeLangCode) ||
    template?.languages[0]

  const resolvedDefaultValues = React.useMemo(() => {
    return currentLanguage ? resolveTemplatePreviewValues(currentLanguage) : {}
  }, [currentLanguage])

  const variableValues = React.useMemo(
    () => ({
      ...resolvedDefaultValues,
      ...variableOverrides,
    }),
    [resolvedDefaultValues, variableOverrides]
  )

  const handleLanguageChange = (lang: string) => {
    setSelectedLang(lang)
    setVariableOverrides({})
  }

  const handleVariableChange = (index: number, val: string) => {
    setVariableOverrides((prev) => ({
      ...prev,
      [index]: val,
    }))
  }
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

  const activePayload = currentLanguage
    ? generateTemplatePayload(template, currentLanguage, variableValues)
    : null

  const activeJsonString = activePayload
    ? JSON.stringify(activePayload, null, 2)
    : ""

  const handleCopyJson = () => {
    if (!activeJsonString) return
    void navigator.clipboard.writeText(activeJsonString)
    setCopiedJson(true)
    toast.success("Ready-to-use JSON payload copied!")
    setTimeout(() => setCopiedJson(false), 2000)
  }

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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{template.slug}</span>
            <span>•</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {template.category ?? "UTILITY"}
            </Badge>
            <span>•</span>
            <span>Created {formatDate(template.createdAt)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isApproved && (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() =>
                router.push(
                  localizePathname({
                    pathname: `/console/whatsapp/messages?template=${template.id}`,
                    locale,
                  })
                )
              }
            >
              <PaperPlaneTilt weight="bold" className="mr-1.5 size-4" />
              Send Test Message
            </Button>
          )}

          {currentLanguage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCodeModalOpen(true)}
              className="gap-1.5"
            >
              <Code weight="bold" className="size-4 text-primary" />
              Get Code Snippet
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(
                localizePathname({
                  pathname: `/console/whatsapp/templates/new?duplicate=${template.id}`,
                  locale,
                })
              )
            }
          >
            <Copy weight="bold" className="mr-1.5 size-4" />
            Duplicate
          </Button>

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

      {/* Main Content Layout: Left Spec/Tester + Right Live Preview Tabs */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Spec Breakdown & Variable Tester (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Template Specification & Variable Tester
              </CardTitle>
              <CardDescription>
                Detailed component breakdown. Type sample variables below to
                test formatting and generate real-time JSON payload.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateSpecTester
                languages={template.languages}
                selectedLang={selectedLang}
                onSelectLang={handleLanguageChange}
                variableValues={variableValues}
                onVariableChange={handleVariableChange}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live WhatsApp Bubble & Ready-to-Use JSON (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Live Preview</CardTitle>
                  <CardDescription>
                    Real-time visual output and API payload
                  </CardDescription>
                </div>

                <Tabs
                  value={previewTab}
                  onValueChange={(v) => setPreviewTab(v as "bubble" | "json")}
                >
                  <TabsList className="h-8">
                    <TabsTrigger
                      value="bubble"
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <ChatsCircle className="size-3.5" />
                      Bubble
                    </TabsTrigger>
                    <TabsTrigger
                      value="json"
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <FileCode className="size-3.5" />
                      JSON
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {currentLanguage ? (
                previewTab === "bubble" ? (
                  <div className="space-y-3">
                    <WhatsAppTemplatePreview
                      language={currentLanguage}
                      values={variableValues}
                    />
                    <p className="text-center text-[11px] text-muted-foreground">
                      💡 Recipient view rendered with your tested variables.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Ready-to-use API Payload:
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyJson}
                        className="h-7 gap-1 text-[11px]"
                      >
                        {copiedJson ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            Copy JSON
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="relative rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed dark:bg-black/50">
                      <pre className="max-h-[380px] overflow-auto whitespace-pre">
                        <code>{activeJsonString}</code>
                      </pre>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  No language variant available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Code Snippet Modal */}
      {currentLanguage && (
        <TemplateCodeSnippetDialog
          open={codeModalOpen}
          onOpenChange={setCodeModalOpen}
          template={template}
          selectedLanguage={currentLanguage}
          variableValues={variableValues}
        />
      )}
    </div>
  )
}
