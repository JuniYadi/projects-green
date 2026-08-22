"use client"

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from "react"
import { useRouter } from "next/navigation"
import { eden } from "@/lib/eden"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DeviceMobileIcon,
  LaptopIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react"
import type { AppSidebarUser } from "@/components/app-sidebar"

type UserSession = {
  id: string
  status: string
  authMethod: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
}

type UserIdentity = {
  type: string
  provider: string
  idpId?: string
}

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
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  const loadUserDetails = useCallback(async () => {
    setIsLoadingDetails(true)
    try {
      const res = await eden.api.auth["user-details"].get()
      if (res.data?.ok) {
        if (res.data.sessions) {
          setSessions(res.data.sessions as UserSession[])
        }
        if (res.data.identities) {
          setIdentities(res.data.identities as UserIdentity[])
        }
      }
    } catch {
      // non-fatal
    } finally {
      setIsLoadingDetails(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadUserDetails()
    }
  }, [open, loadUserDetails])

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await eden.api.auth.sessions[sessionId].revoke.post()
      if (res.data?.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      }
    } catch {
      setError("Failed to revoke session.")
    }
  }
  const handleAvatarFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const localUrl = URL.createObjectURL(file)
    setAvatarPreview(localUrl)
    setIsUploading(true)
    setError(null)

    try {
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

      // eslint-disable-next-line no-restricted-globals
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image to storage.")
      }

      await eden.api.storage.s3.confirm.post({
        fileId: presignData.fileId,
        sizeBytes: file.size,
      })

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="size-5 text-primary" />
            Account & Profile
          </DialogTitle>
          <DialogDescription>
            Manage your profile, connected login accounts, and active device
            sessions.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="sessions">
              Active Sessions ({sessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar Banner */}
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

              {/* Form Details */}
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

              {/* Connected Accounts */}
              <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <ShieldCheckIcon className="size-4 text-emerald-500" />
                  Connected Identities
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {(() => {
                    const normalizeProvider = (raw: string) => {
                      const clean = raw.trim().toLowerCase()
                      if (clean.includes("google")) return "Google OAuth"
                      if (clean.includes("github")) return "GitHub OAuth"
                      if (clean.includes("apple")) return "Apple OAuth"
                      if (clean.includes("magic") || clean.includes("email"))
                        return "Magic Link (Email Code)"
                      if (clean.includes("password")) return "Password"
                      return raw.replace(/OAuth$/i, " OAuth").trim()
                    }

                    const allProviders = new Set<string>()
                    if (
                      authMethodLabel &&
                      authMethodLabel !== "N/A" &&
                      authMethodLabel !== "Tidak tersedia"
                    ) {
                      allProviders.add(normalizeProvider(authMethodLabel))
                    }
                    identities.forEach((id) => {
                      if (id.provider) {
                        allProviders.add(normalizeProvider(id.provider))
                      }
                    })

                    if (allProviders.size === 0) {
                      return (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          Magic Link (Email Code)
                        </Badge>
                      )
                    }

                    return Array.from(allProviders).map((provider, index) => (
                      <Badge
                        key={provider}
                        variant={index === 0 ? "secondary" : "outline"}
                        className="gap-1 text-xs"
                      >
                        {provider}
                      </Badge>
                    ))
                  })()}
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

              <DialogFooter className="gap-2 pt-2">
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
          </TabsContent>

          <TabsContent value="sessions" className="space-y-3 pt-2">
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground">
                Current Active Sessions
              </h4>
              <p className="text-xs text-muted-foreground">
                These are the devices and browsers currently signed in to your
                account.
              </p>
            </div>

            {isLoadingDetails ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No other active sessions found.
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {sessions.map((session, idx) => {
                  const isCurrent = idx === 0
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                          {session.userAgent?.includes("Mobile") ? (
                            <DeviceMobileIcon className="size-4" />
                          ) : (
                            <LaptopIcon className="size-4" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {session.authMethod || "Web Session"}
                            </span>
                            {isCurrent ? (
                              <Badge
                                variant="success"
                                className="h-4 px-1.5 text-[9px]"
                              >
                                Current Device
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Started:{" "}
                            {new Date(session.createdAt).toLocaleDateString()} •
                            Expires:{" "}
                            {new Date(session.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {!isCurrent ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevokeSession(session.id)}
                          title="Revoke session"
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
