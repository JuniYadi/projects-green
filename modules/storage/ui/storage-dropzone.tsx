"use client"

import * as React from "react"
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  Video,
} from "lucide-react"

export interface UploadProgressEvent {
  loaded: number
  total: number
  percent: number
}

export interface UploadedStorageResult {
  fileId: string
  storageKey: string
  url: string
  filename: string
  sizeBytes: number
  mimeType: string
}

export interface StorageDropzoneProps {
  accept?: string
  maxSizeBytes?: number
  purpose?: string
  value?: string | null // Current file preview or URL / fileId
  onUploadSuccess?: (result: UploadedStorageResult) => void
  onUploadError?: (error: string) => void
  onClear?: () => void
  label?: string
  description?: string
  mediaType?: "IMAGE" | "VIDEO" | "DOCUMENT"
}

export function StorageDropzone({
  accept = "image/png,image/jpeg,image/webp",
  maxSizeBytes = 5 * 1024 * 1024,
  purpose = "whatsapp",
  value,
  onUploadSuccess,
  onUploadError,
  onClear,
  label = "Upload file",
  description = "Drag & drop or click to upload",
  mediaType = "IMAGE",
}: StorageDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [status, setStatus] = React.useState<
    "idle" | "uploading" | "confirming" | "success" | "error"
  >("idle")
  const [progress, setProgress] = React.useState(0)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [currentFile, setCurrentFile] =
    React.useState<UploadedStorageResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File) => {
    if (file.size > maxSizeBytes) {
      const mb = Math.round(maxSizeBytes / (1024 * 1024))
      const err = `File size exceeds maximum allowed limit (${mb}MB)`
      setErrorMessage(err)
      setStatus("error")
      onUploadError?.(err)
      return
    }

    setStatus("uploading")
    setProgress(0)
    setErrorMessage(null)

    try {
      // 1. Request presigned upload URL
      const presignRes = await fetch("/api/storage/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          purpose,
        }),
      })

      if (!presignRes.ok) {
        const errJson = await presignRes.json().catch(() => ({}))
        throw new Error(errJson.error || "Failed to initialize upload session")
      }

      const presignData = await presignRes.json()

      // 2. Upload file directly to S3 via XHR to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", presignData.uploadUrl, true)
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream"
        )

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            setProgress(percent)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`S3 upload failed with status ${xhr.status}`))
          }
        }

        xhr.onerror = () => reject(new Error("Network error during S3 upload"))
        xhr.send(file)
      })

      // 3. Confirm upload
      setStatus("confirming")
      const confirmRes = await fetch("/api/storage/s3/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: presignData.fileId,
          sizeBytes: file.size,
        }),
      })

      if (!confirmRes.ok) {
        const errJson = await confirmRes.json().catch(() => ({}))
        throw new Error(errJson.error || "Failed to confirm upload")
      }

      const confirmData = await confirmRes.json()

      // 4. Get view URL
      const viewRes = await fetch(
        `/api/storage/s3/view-url?fileId=${presignData.fileId}`
      )
      const viewData = viewRes.ok ? await viewRes.json() : { viewUrl: "" }

      const result: UploadedStorageResult = {
        fileId: presignData.fileId,
        storageKey: presignData.storageKey,
        url: viewData.viewUrl || "",
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      }

      setCurrentFile(result)
      setStatus("success")
      onUploadSuccess?.(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg)
      setStatus("error")
      onUploadError?.(msg)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleClear = () => {
    setStatus("idle")
    setProgress(0)
    setCurrentFile(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    onClear?.()
  }

  const getMediaIcon = () => {
    if (mediaType === "IMAGE")
      return <ImageIcon className="h-8 w-8 text-muted-foreground" />
    if (mediaType === "VIDEO")
      return <Video className="h-8 w-8 text-muted-foreground" />
    return <FileText className="h-8 w-8 text-muted-foreground" />
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0])
          }
        }}
      />

      {status === "idle" && !value && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          {getMediaIcon()}
          <span className="mt-2 text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      )}

      {status === "uploading" && (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />{" "}
              Uploading to S3...
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "confirming" && (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-xs font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Verifying
          and confirming upload...
        </div>
      )}

      {(status === "success" || value) && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium">
                {currentFile?.filename || "Uploaded media file"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {currentFile?.sizeBytes
                  ? `${Math.round(currentFile.sizeBytes / 1024)} KB`
                  : "Ready"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="text-xs text-destructive">
              {errorMessage || "Upload failed"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
