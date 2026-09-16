"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  FileText,
  UploadSimple,
  CheckCircle,
  Clock,
  Trash,
  PencilSimple,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  StorageDropzone,
  type UploadedStorageResult,
} from "@/modules/storage/ui/storage-dropzone"

export type KnowledgeDoc = {
  id: string
  title: string
  purpose?: string
  pageCount: number
  status: "READY" | "PROCESSING" | "QUEUED" | "FAILED"
  category: string
  sourceType?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

export default function AiKnowledgePage() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages = getMessagesForMaybeLocale(lang).console.ai.knowledge
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("General")
  const [contentMarkdown, setContentMarkdown] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"upload" | "manual">("upload")
  const [uploadedFile, setUploadedFile] =
    useState<UploadedStorageResult | null>(null)

  const loadDocs = useCallback(async () => {
    try {
      const res = await eden.api.console.ai.knowledge.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        setDocs(res.data.data as KnowledgeDoc[])
      }
    } catch (err) {
      console.warn("[ai-knowledge] load error:", err)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocs()
  }, [loadDocs])
  const totalPagesUsed = docs.reduce((sum, d) => sum + (d.pageCount || 1), 0)
  const maxQuota = 100 // Starter tier default

  const handleUpload = async () => {
    const docTitle =
      title.trim() ||
      (uploadedFile ? uploadedFile.filename.replace(/\.[^/.]+$/, "") : "")
    if (!docTitle) return

    const isFileTab = activeTab === "upload" && uploadedFile
    const ext = uploadedFile?.filename.split(".").pop()?.toUpperCase()
    const sourceType = isFileTab ? (ext === "DOCX" ? "DOCX" : "PDF") : "MANUAL"

    setIsUploading(true)
    setSaving(true)
    try {
      const res = await eden.api.console.ai.knowledge.upload.post({
        title: docTitle,
        category: category.trim() || "General",
        purpose: "Tenant Knowledge Document",
        sourceType,
        sourceUrl: uploadedFile?.url || undefined,
        contentMarkdown: contentMarkdown.trim() || undefined,
      })

      if (res.data && res.data.ok) {
        await loadDocs()
        setIsOpen(false)
        setTitle("")
        setContentMarkdown("")
        setUploadedFile(null)
        setActiveTab("upload")
      }
    } catch (err) {
      console.error("[ai-knowledge] upload error:", err)
    } finally {
      setIsUploading(false)
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await eden.api.console.ai.knowledge[id].delete()
      if (res.data && res.data.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id))
      }
    } catch (err) {
      console.error("[ai-knowledge] delete error:", err)
    }
  }

  const isFormValid =
    activeTab === "upload"
      ? Boolean(uploadedFile || title.trim())
      : Boolean(title.trim() && contentMarkdown.trim())

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.heading}
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.description}
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 text-black hover:bg-amber-600">
              <UploadSimple size={16} weight="bold" />
              <span>{messages.uploadButton}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{messages.dialogTitle}</DialogTitle>
              <DialogDescription>
                {messages.dialogDescription}
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "upload" | "manual")}
              className="w-full pt-1"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="gap-1.5 text-xs">
                  <UploadSimple size={14} weight="bold" />
                  <span>{messages.tabUpload}</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5 text-xs">
                  <PencilSimple size={14} weight="bold" />
                  <span>{messages.tabManual}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {messages.fileLabel}
                  </Label>
                  <StorageDropzone
                    accept=".pdf,.docx,application/pdf"
                    maxSizeBytes={10 * 1024 * 1024}
                    purpose="knowledge"
                    mediaType="DOCUMENT"
                    label={messages.dropzoneLabel}
                    description={messages.dropzoneDescription}
                    value={uploadedFile?.url}
                    onUploadSuccess={(result) => {
                      setUploadedFile(result)
                      if (!title.trim()) {
                        setTitle(result.filename.replace(/\.[^/.]+$/, ""))
                      }
                    }}
                    onClear={() => {
                      setUploadedFile(null)
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{messages.titleLabel}</Label>
                    <Input
                      placeholder={messages.titlePlaceholderUpload}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{messages.categoryLabel}</Label>
                    <Input
                      placeholder={messages.categoryPlaceholder}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{messages.titleLabel}</Label>
                    <Input
                      placeholder={messages.titlePlaceholderManual}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{messages.categoryLabel}</Label>
                    <Input
                      placeholder={messages.categoryPlaceholder}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      {messages.contentLabel}
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {messages.contentHint}
                    </span>
                  </div>
                  <Textarea
                    placeholder={`# Panduan & FAQ Toko\n\n## Jam Operasional\n- Senin - Sabtu: 08.00 - 17.00 WIB\n\n## Daftar Produk & Harga\n1. Madu Murni (500ml) - Rp 120.000\n2. Habbatussauda (100 kapsul) - Rp 85.000`}
                    rows={10}
                    className="min-h-[220px] font-mono text-xs leading-relaxed"
                    value={contentMarkdown}
                    onChange={(e) => setContentMarkdown(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                {messages.cancel}
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || saving || !isFormValid}
              >
                {isUploading
                  ? messages.processingDocument
                  : messages.startParsingDocument}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Storage Quota Meter Card */}
      <Card className="border-border bg-muted/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {messages.quotaTitle}
            </CardTitle>
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {totalPagesUsed} / {maxQuota} {messages.pagesUsedLabel} (
              {Math.round((totalPagesUsed / maxQuota) * 100)}%)
            </span>
          </div>
          <CardDescription className="text-xs">
            {messages.quotaDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded-full border border-border/50 bg-muted">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, (totalPagesUsed / maxQuota) * 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
          {messages.activeDocsLabel} ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed p-8 text-center">
            <FileText size={32} className="mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">{messages.emptyTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.emptyHint}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {docs.map((doc) => (
              <Card
                key={doc.id}
                className="flex items-center justify-between border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">{doc.title}</h3>
                    <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {doc.category}
                      </Badge>
                      <span>•</span>
                      <span>
                        {doc.pageCount || 1} {messages.pagesSuffix}
                      </span>
                      {doc.createdAt && (
                        <>
                          <span>•</span>
                          <span>
                            {new Date(doc.createdAt).toLocaleDateString(
                              "id-ID"
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {doc.status === "READY" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <CheckCircle size={15} />
                      {messages.statusReady}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                      <Clock size={15} className="animate-spin" />
                      {messages.statusProcessing}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
