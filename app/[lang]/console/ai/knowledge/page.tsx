"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  FileText,
  UploadSimple,
  CheckCircle,
  Clock,
  Trash,
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
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("General")
  const [contentMarkdown, setContentMarkdown] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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
    let cancelled = false
    void (async () => {
      try {
        const res = await eden.api.console.ai.knowledge.get()
        if (
          !cancelled &&
          res.data &&
          res.data.ok &&
          Array.isArray(res.data.data)
        ) {
          setDocs(res.data.data as KnowledgeDoc[])
        }
      } catch (err) {
        console.warn("[ai-knowledge] initial load error:", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const totalPagesUsed = docs.reduce((sum, d) => sum + (d.pageCount || 1), 0)
  const maxQuota = 100 // Starter tier default

  const handleUpload = async () => {
    if (!title.trim()) return

    setIsUploading(true)
    startTransition(async () => {
      try {
        const res = await eden.api.console.ai.knowledge.upload.post({
          title: title.trim(),
          category: category.trim(),
          purpose: "Tenant Knowledge Document",
          sourceType: "MANUAL",
          contentMarkdown: contentMarkdown.trim() || undefined,
        })

        if (res.data && res.data.ok) {
          await loadDocs()
          setIsOpen(false)
          setTitle("")
          setContentMarkdown("")
        }
      } catch (err) {
        console.error("[ai-knowledge] upload error:", err)
      } finally {
        setIsUploading(false)
      }
    })
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Knowledge Base & Dokumen Toko
          </h1>
          <p className="text-sm text-muted-foreground">
            Unggah PDF katalog, tabel harga, dan SOP. Dokumen diproses otomatis
            oleh parser AnyDoc ke vektor pgvector.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 text-black hover:bg-amber-600">
              <UploadSimple size={16} weight="bold" />
              <span>Unggah Dokumen PDF/DOCX</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Unggah Dokumen Knowledge Base</DialogTitle>
              <DialogDescription>
                Parser AnyDoc akan mengekstrak tabel harga dan hierarki dokumen
                secara terstruktur untuk bot WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Judul Dokumen / Nama File</Label>
                <Input
                  placeholder="Misal: Brosur_Promo_Agustus_2026.pdf"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  placeholder="Pricelist / SOP / FAQ"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Konten Markdown / Teks (Opsional)</Label>
                <Textarea
                  placeholder="Ketik atau tempel teks/markdown dokumen..."
                  rows={4}
                  value={contentMarkdown}
                  onChange={(e) => setContentMarkdown(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || !title.trim() || isPending}
              >
                {isUploading ? "Mengunggah..." : "Mulai Parsing Dokumen"}
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
              Kapasitas Storage Halaman PDF
            </CardTitle>
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {totalPagesUsed} / {maxQuota} Halaman Digunakan (
              {Math.round((totalPagesUsed / maxQuota) * 100)}%)
            </span>
          </div>
          <CardDescription className="text-xs">
            Paket Starter gratis 100 Halaman PDF. Tambah kuota kapasitas Rp
            50.000 / 1.000 halaman jika membutuhkan lebih.
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
          Daftar Dokumen Aktif ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed p-8 text-center">
            <FileText size={32} className="mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada dokumen diunggah</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klik tombol di atas untuk mengunggah dokumen knowledge base toko
              Anda.
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
                      <span>{doc.pageCount || 1} Halaman</span>
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
                      Siap Digunakan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                      <Clock size={15} className="animate-spin" />
                      Memproses di Worker...
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
