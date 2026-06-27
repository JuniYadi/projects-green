"use client"

import * as React from "react"
import {
  Image,
  File,
  MusicNote,
  Video,
  Upload,
  Trash,
  Download,
  CheckCircle,
  Warning,
  XCircle,
  DotsThreeVertical,
  FilePdf,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"

type MediaRecord = {
  id: string
  metaMediaId: string
  mimeType: string
  fileSize: number
  sha256?: string | null
  downloadedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  expiryStatus: "green" | "yellow" | "red"
  deviceId: string
}

type ExpiryBadgeProps = {
  status: "green" | "yellow" | "red"
  expiresAt?: string | null
  messages: ReturnType<typeof getMessages>
}

function ExpiryBadge({ status, expiresAt, messages }: ExpiryBadgeProps) {
  const variant: Record<string, "success" | "warning" | "destructive"> = {
    green: "success",
    yellow: "warning",
    red: "destructive",
  }

  const icon: Record<string, React.ReactNode> = {
    green: <CheckCircle weight="fill" className="mr-1 size-3" />,
    yellow: <Warning weight="fill" className="mr-1 size-3" />,
    red: <XCircle weight="fill" className="mr-1 size-3" />,
  }

  return (
    <Badge variant={variant[status] ?? "secondary"}>
      {icon[status]}
      {expiresAt
        ? new Date(expiresAt).toLocaleDateString()
        : messages.console.whatsapp.media.notDownloaded}
    </Badge>
  )
}

function MimeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    // ponytail: decorative icon — not an <img>, no alt needed
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image className="size-5 text-blue-500" weight="fill" />
  if (mimeType.startsWith("video/"))
    return <Video className="size-5 text-purple-500" weight="fill" />
  if (mimeType.startsWith("audio/"))
    return <MusicNote className="size-5 text-green-500" weight="fill" />
  if (mimeType === "application/pdf")
    return <FilePdf className="size-5 text-red-500" weight="fill" />
  return <File className="size-5 text-muted-foreground" weight="fill" />
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export default function WhatsAppMediaPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const heading = messages.console.whatsapp.media?.heading ?? "Media Library"
  const description =
    messages.console.whatsapp.media?.description ?? "Manage uploaded and received media files."

  const [media, setMedia] = React.useState<MediaRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deleteDialog, setDeleteDialog] = React.useState<MediaRecord | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const loadMedia = React.useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await whatsappClient.media.list()
      setMedia(res.media)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load media."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMedia()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredMedia = React.useMemo(() => {
    if (!searchQuery.trim()) return media
    const q = searchQuery.trim().toLowerCase()
    return media.filter(
      (m) =>
        m.mimeType.toLowerCase().includes(q) ||
        m.metaMediaId.toLowerCase().includes(q)
    )
  }, [media, searchQuery])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ponytail: upload to first device — device picker if multiple
    const deviceId = media[0]?.deviceId
    if (!deviceId) {
      toast.error("No device found. Add a WhatsApp device first.")
      return
    }

    setUploading(true)
    try {
      await whatsappClient.media.upload(file, deviceId)
      toast.success("Media uploaded successfully.")
      void loadMedia()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed."
      )
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog) return
    setIsDeleting(true)
    try {
      await whatsappClient.media.delete(deleteDialog.id)
      toast.success("Media deleted.")
      setDeleteDialog(null)
      void loadMedia()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Delete failed."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{heading}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*,video/*,audio/*,application/pdf,text/plain"
              className="hidden"
              id="media-upload-input"
              onChange={(e) => void handleUpload(e)}
              disabled={uploading}
            />
            <Button
              asChild
              disabled={uploading}
            >
              <label htmlFor="media-upload-input" className="cursor-pointer">
                <Upload weight="bold" className="mr-2 size-4" />
                {uploading ? "Uploading..." : "Upload"}
              </label>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                placeholder="Search by type or media ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!isLoading && errorMessage && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle className="mb-3 size-10 text-destructive" weight="fill" />
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void loadMedia()}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !errorMessage && filteredMedia.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              {/* ponytail: decorative icon, not an <img>, no alt needed */}
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No media matches your search." : "No media yet."}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-3"
                  asChild
                >
                  <label htmlFor="media-upload-input" className="cursor-pointer">
                    <Upload className="mr-2 size-4" />
                    Upload your first file
                  </label>
                </Button>
              )}
            </div>
          )}

          {/* Media List */}
          {!isLoading && !errorMessage && filteredMedia.length > 0 && (
            <div className="space-y-3">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <MimeIcon mimeType={item.mimeType} />
                    </div>
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.metaMediaId.slice(0, 24)}...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.mimeType} &middot; {formatSize(item.fileSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ExpiryBadge
                      status={item.expiryStatus}
                      expiresAt={item.expiresAt}
                      messages={messages}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <span className="sr-only">Actions</span>
                          <DotsThreeVertical weight="bold" className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a
                            href={whatsappClient.media.downloadUrl(item.metaMediaId)}
                            download
                          >
                            <Download className="mr-2 size-4" />
                            Download
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteDialog(item)}
                        >
                          <Trash className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteDialog}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this media file? It will be removed
              from both Meta and local storage. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
