"use client"

import { useState, useRef, type FormEvent, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { eden } from "@/lib/eden"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CameraIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@phosphor-icons/react"
import type { AppSidebarUser } from "@/components/app-sidebar"

type ProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppSidebarUser
  authMethodLabel: string
}

export function ProfileDialog({
  open,
  onOpenChange,
  user,
  authMethodLabel,
}: ProfileDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user.name ?? "")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarUrl ?? null
  )
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl ?? "")
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleAvatarFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show immediate local preview
    const localUrl = URL.createObjectURL(file)
    setAvatarPreview(localUrl)
    try {
      // 1. Request presigned upload URL from S3 storage
      const presignRes = await eden.api.storage.s3.presign.post({
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        purpose: "avatar",
      })

      if (!presignRes.data?.uploadUrl) {
        setAvatarUrl(localUrl)
        setIsUploading(false)
        return
      }

      const presignData = presignRes.data

      // 2. Upload directly to S3 PUT URL
      // eslint-disable-next-line no-restricted-globals
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image to storage.")
      }

      // 3. Confirm S3 Upload
      await eden.api.storage.s3.confirm.post({
        fileId: presignData.fileId,
        sizeBytes: file.size,
      })

      // 4. Resolve view URL
      const viewRes = await eden.api.storage.s3["view-url"].get({
        $query: { fileId: presignData.fileId },
      })
      if (viewRes.data?.viewUrl) {
        setAvatarUrl(viewRes.data.viewUrl)
      }
    } catch (err) {
      console.warn(
        "[ProfileDialog] S3 upload error, keeping local preview:",
        err
      )
      setAvatarUrl(localUrl)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const nameParts = name.trim().split(/\s+/)
      const firstName = nameParts[0] || undefined
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined

      const res = await eden.api.auth.profile.patch({
        firstName,
        lastName,
        profilePictureUrl: avatarUrl?.trim() || undefined,
      })

      if (res.data?.ok) {
        setSuccess(true)
        setTimeout(() => {
          onOpenChange(false)
          router.refresh()
        }, 800)
      } else {
        setError(res.data?.message || "Failed to update profile.")
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const initials = (name || user.name || user.email || "U")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="size-5 text-primary" />
              Profile Settings
            </DialogTitle>
            <DialogDescription>
              Manage your personal name, profile picture, and view connected
              accounts.
            </DialogDescription>
          </DialogHeader>

          {/* Avatar Click-to-Upload Banner */}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="group relative">
              <Avatar className="h-16 w-16 rounded-2xl border-2 border-background shadow-sm">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="rounded-2xl text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-2xl bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                title="Click to change profile picture"
              >
                <CameraIcon className="size-5" />
                <span className="mt-0.5 text-[9px] font-medium">
                  {isUploading ? "..." : "Change"}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {name || user.email}
                </span>
                <Badge variant="success" className="gap-1 text-[10px]">
                  <CheckCircleIcon className="size-3" />
                  Verified
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the photo to upload a new profile picture.
              </p>
            </div>
          </div>

          {/* Profile Details Form */}
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label
                htmlFor="profile-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Full Name
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Juni Yadi"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Email Address
              </label>
              <Input
                value={user.email ?? ""}
                disabled
                className="cursor-not-allowed bg-muted/50 text-muted-foreground"
              />
            </div>
          </div>

          {/* Connected Methods Panel */}
          <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <ShieldCheckIcon className="size-4 text-emerald-500" />
              Connected Sign-In Methods
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Authentication Method</span>
              <Badge variant="outline" className="font-mono text-[11px]">
                {authMethodLabel}
              </Badge>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              Profile updated successfully.
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
