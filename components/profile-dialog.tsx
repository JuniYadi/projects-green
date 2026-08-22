"use client"

import { useState, type FormEvent } from "react"
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
  const [name, setName] = useState(user.name ?? "")
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
        profilePictureUrl: avatarUrl.trim() || undefined,
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

  const initials = user.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

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
              Manage your personal account profile and view connected sign-in
              methods.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <Avatar className="h-14 w-14 rounded-xl">
              <AvatarImage src={avatarUrl || user.avatarUrl || undefined} />
              <AvatarFallback className="rounded-xl text-base">
                {initials}
              </AvatarFallback>
            </Avatar>
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
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>

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
              <label
                htmlFor="profile-avatar"
                className="text-xs font-medium text-muted-foreground"
              >
                Avatar URL (Optional)
              </label>
              <Input
                id="profile-avatar"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
