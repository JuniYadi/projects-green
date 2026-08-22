"use client"

import * as React from "react"
import {
  HardDrive,
  FileCheck,
  Clock,
  Trash2,
  Search,
  ExternalLink,
  Eye,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type {
  StorageFileDTO,
  StorageMetricsDTO,
} from "@/modules/storage/storage.dto"

export function StorageAuditView() {
  const [metrics, setMetrics] = React.useState<StorageMetricsDTO | null>(null)
  const [files, setFiles] = React.useState<StorageFileDTO[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  // Preview & Delete modals state
  const [previewFile, setPreviewFile] = React.useState<StorageFileDTO | null>(
    null
  )
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<StorageFileDTO | null>(
    null
  )
  const [deleting, setDeleting] = React.useState(false)

  const reloadData = React.useCallback(() => {
    fetch("/api/portal/storage/metrics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMetrics(data)
      })
      .catch(() => {})

    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("pageSize", "15")
    if (search.trim()) params.set("search", search.trim())
    if (statusFilter !== "ALL") params.set("status", statusFilter)

    fetch(`/api/portal/storage/files?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setFiles(data.items || [])
          setTotal(data.total || 0)
        }
      })
      .catch(() => {
        toast.error("Failed to load storage files")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [page, search, statusFilter])

  React.useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const [mRes, fRes] = await Promise.all([
          fetch("/api/portal/storage/metrics"),
          fetch(
            `/api/portal/storage/files?page=${page}&pageSize=15${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`
          ),
        ])
        if (!ignore) {
          if (mRes.ok) {
            const mData = await mRes.json()
            setMetrics(mData)
          }
          if (fRes.ok) {
            const fData = await fRes.json()
            setFiles(fData.items || [])
            setTotal(fData.total || 0)
          }
        }
      } catch {
        // Ignore
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [page, search, statusFilter])

  const handleOpenPreview = async (file: StorageFileDTO) => {
    setPreviewFile(file)
    setPreviewUrl(null)
    setPreviewLoading(true)

    try {
      const res = await fetch(`/api/portal/storage/files/${file.id}/view-url`)
      if (res.ok) {
        const data = await res.json()
        setPreviewUrl(data.viewUrl)
      } else {
        toast.error("Could not generate preview view URL")
      }
    } catch {
      toast.error("Failed to request preview URL")
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleForceDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/portal/storage/files/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`File ${deleteTarget.originalFilename} deleted from S3`)
        setDeleteTarget(null)
        reloadData()
      } else {
        toast.error("Failed to force delete file")
      }
    } catch {
      toast.error("Error during delete execution")
    } finally {
      setDeleting(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-600">
            Active
          </Badge>
        )
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 text-amber-600"
          >
            Pending
          </Badge>
        )
      case "DELETED":
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            Deleted
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* ── Top Metrics Cards ────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Storage Used
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(metrics?.totalBytes || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Files</CardTitle>
            <FileCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.activeFiles || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Confirmed and stored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Uploads
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.pendingFiles || 0}
            </div>
            <p className="text-xs text-muted-foreground">Expires in 15 mins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Swept / Deleted
            </CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.deletedFiles || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Cleaned by background worker
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Storage File Audit
              </CardTitle>
              <CardDescription>
                Live ledger of presigned uploads, tenant isolation paths, and
                object sizes.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search file, ID, or key..."
                  className="h-9 pl-8 text-xs"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className="flex items-center gap-1 rounded-md border bg-muted/20 p-1">
                {["ALL", "ACTIVE", "PENDING", "DELETED"].map((st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setStatusFilter(st)
                      setPage(1)
                    }}
                  >
                    {st === "ALL"
                      ? "All"
                      : st.charAt(0) + st.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename & ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Size & MIME</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    No storage records found matching filters.
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="max-w-[200px] truncate font-sans font-medium text-foreground">
                        {file.originalFilename}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {file.id}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {file.organizationId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {file.purpose}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{formatBytes(file.sizeBytes)}</div>
                      <span className="text-[10px] text-muted-foreground">
                        {file.mimeType}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(file.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(file.createdAt).toLocaleDateString()}{" "}
                      {new Date(file.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {file.status !== "DELETED" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenPreview(file)}
                            title="Preview file"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(file)}
                            title="Force Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <div>
              Showing {files.length} of {total} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page * 15 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Preview Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={Boolean(previewFile)}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="truncate">
              {previewFile?.originalFilename}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Storage Key: {previewFile?.storageKey}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[250px] items-center justify-center rounded-lg border bg-muted/20 p-4">
            {previewLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              previewFile?.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewFile.originalFilename}
                  className="max-h-[350px] rounded object-contain"
                />
              ) : previewFile?.mimeType.startsWith("video/") ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-[350px] w-full rounded"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <ExternalLink className="h-10 w-10 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Non-visual document ({previewFile?.mimeType})
                  </span>
                  <Button size="sm" asChild>
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      Open Document
                    </a>
                  </Button>
                </div>
              )
            ) : (
              <span className="text-xs text-destructive">
                Preview unavailable
              </span>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewFile(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Force Delete Dialog ────────────────────────────────────── */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Force Delete S3 Object
            </DialogTitle>
            <DialogDescription>
              This action will permanently delete the physical S3 object and
              mark the database record as deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 rounded bg-muted/40 p-3 py-2 font-mono text-xs">
            <div>
              <strong>File:</strong> {deleteTarget?.originalFilename}
            </div>
            <div>
              <strong>ID:</strong> {deleteTarget?.id}
            </div>
            <div>
              <strong>Org:</strong> {deleteTarget?.organizationId}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={handleForceDelete}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
