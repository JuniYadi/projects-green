"use client"

import { useState } from "react"
import {
  DownloadIcon,
  UploadIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { exportAdminCatalog, importAdminCatalog } from "@/lib/billing-client"
import type {
  CatalogExportPayload,
  CatalogImportResult,
} from "@/modules/billing/catalog/catalog-migration.dto"

interface CatalogExportImportProps {
  catalogCode: string
  catalogTitle: string
  onImportSuccess: () => void
}

export function CatalogExportImport({
  catalogCode,
  catalogTitle,
  onImportSuccess,
}: CatalogExportImportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [parsedPayload, setParsedPayload] =
    useState<CatalogExportPayload | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<CatalogImportResult | null>(
    null
  )

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await exportAdminCatalog(catalogCode)
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(response.data, null, 2))
      const downloadAnchor = document.createElement("a")
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute(
        "download",
        `catalog-${catalogCode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
      )
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success(`Catalog ${catalogTitle} exported successfully`)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to export catalog"
      toast.error(msg)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setJsonText(text)
      validateJson(text)
    }
    reader.readAsText(file)
  }

  const validateJson = (text: string) => {
    setParseError(null)
    setParsedPayload(null)
    setDryRunResult(null)
    if (!text.trim()) return

    try {
      const parsed = JSON.parse(text)
      if (!parsed.catalogCode || !Array.isArray(parsed.products)) {
        setParseError(
          "Invalid catalog JSON format: missing catalogCode or products array."
        )
        return
      }
      setParsedPayload(parsed as CatalogExportPayload)
    } catch {
      setParseError("Malformed JSON. Please check file contents.")
    }
  }

  const handleDryRun = async () => {
    if (!parsedPayload) return
    setIsDryRunning(true)
    setDryRunResult(null)
    try {
      const res = await importAdminCatalog(catalogCode, parsedPayload, {
        dryRun: true,
        overrideCatalogCode: catalogCode,
      })
      setDryRunResult(res.data)
      toast.info("Dry-run preview generated.")
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Validation / Dry-run failed"
      toast.error(msg)
    } finally {
      setIsDryRunning(false)
    }
  }

  const handleApplyImport = async () => {
    if (!parsedPayload) return
    setIsApplying(true)
    try {
      const res = await importAdminCatalog(catalogCode, parsedPayload, {
        dryRun: false,
        overrideCatalogCode: catalogCode,
      })
      toast.success(
        `Catalog imported successfully! Created: ${res.data.summary.productsToCreate}, Updated: ${res.data.summary.productsToUpdate}`
      )
      setIsImportOpen(false)
      setJsonText("")
      setParsedPayload(null)
      setDryRunResult(null)
      onImportSuccess()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to import catalog"
      toast.error(msg)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
          aria-label="Export Catalog JSON"
        >
          {isExporting ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-2 h-4 w-4" />
          )}
          Export JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsImportOpen(true)}
          aria-label="Import Catalog JSON"
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          Import JSON
        </Button>
      </div>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Catalog Configuration</DialogTitle>
            <DialogDescription>
              Upload or paste a catalog export JSON to safely migrate
              configurations into{" "}
              <span className="font-semibold text-foreground">
                {catalogTitle}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label
                htmlFor="catalog-json-file"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Upload JSON File
              </label>
              <input
                id="catalog-json-file"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-secondary-foreground hover:file:cursor-pointer"
              />
            </div>

            <div>
              <label
                htmlFor="catalog-json-textarea"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Or Paste JSON Content
              </label>
              <textarea
                id="catalog-json-textarea"
                rows={5}
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs focus:ring-2 focus:ring-ring focus:outline-none"
                placeholder='{ "schemaVersion": "2026-08.1", "catalogCode": "WHATSAPP", ... }'
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value)
                  validateJson(e.target.value)
                }}
              />
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>JSON Error</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {parsedPayload && (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    Source: {parsedPayload.catalogCode} (
                    {parsedPayload.sourceEnv || "unknown env"})
                  </span>
                  <Badge variant="outline">
                    {parsedPayload.products.length} Products
                  </Badge>
                </div>
                {parsedPayload.catalogCode !== catalogCode && (
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    ⚠️ Notice: Source catalog code ({parsedPayload.catalogCode})
                    will be mapped to target ({catalogCode}).
                  </p>
                )}
                {!dryRunResult && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={handleDryRun}
                    disabled={isDryRunning}
                  >
                    {isDryRunning && (
                      <Loader2Icon className="mr-2 h-3.5 w-3.5 animate-spin" />
                    )}
                    Preview Changes (Dry Run)
                  </Button>
                )}
              </div>
            )}

            {dryRunResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    +{dryRunResult.summary.productsToCreate} New
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    ~{dryRunResult.summary.productsToUpdate} Updated
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    ={dryRunResult.summary.productsUnchanged} Unchanged
                  </Badge>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                  <div className="space-y-2">
                    {dryRunResult.diffs.products.map((p) => (
                      <div
                        key={p.code}
                        className="border-b border-border/50 pb-1.5 text-xs last:border-0"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span>
                            {p.name} ({p.code})
                          </span>
                          <span
                            className={
                              p.action === "create"
                                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                : p.action === "update"
                                  ? "font-semibold text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                            }
                          >
                            [{p.action.toUpperCase()}]
                          </span>
                        </div>
                        <ul className="mt-0.5 list-inside list-disc pl-1 text-muted-foreground">
                          {p.details.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyImport}
              disabled={!parsedPayload || isApplying || Boolean(parseError)}
              className="gap-1.5"
            >
              {isApplying ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2Icon className="h-4 w-4" />
              )}
              Apply Migration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
