"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Key,
  LockKey,
  ShieldWarning,
  ClipboardText,
  Spinner,
  CheckCircle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type AuthRecoveryCardProps = {
  repoName: string
  onAuthorized: () => void
  onSubmitPat?: (token: string) => Promise<void> | void
  lang?: string
  className?: string
}

export function AuthRecoveryCard({
  repoName,
  onAuthorized,
  onSubmitPat,
  lang = "en",
  className,
}: AuthRecoveryCardProps) {
  const isId = lang === "id"
  const [showPatInput, setShowPatInput] = useState(false)
  const [patToken, setPatToken] = useState("")
  const [isSubmittingPat, setIsSubmittingPat] = useState(false)
  const [patError, setPatError] = useState<string | null>(null)
  const [isWaitingPopup, setIsWaitingPopup] = useState(false)

  // Listen to OAuth popup message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof window === "undefined") return
      if (event.origin !== window.location.origin) return

      const data = event.data as
        { type?: string; status?: string; ok?: boolean } | undefined
      if (
        data?.type === "github-install-complete" ||
        data?.type === "github-oauth-complete"
      ) {
        if (data.status === "connected" || data.ok === true) {
          setIsWaitingPopup(false)
          onAuthorized()
        } else {
          setIsWaitingPopup(false)
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [onAuthorized])

  const handleOpenPopup = useCallback(() => {
    if (typeof window === "undefined") return
    setIsWaitingPopup(true)

    const nonce =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now())
    const width = 640
    const height = 760
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      `/api/integrations/github/install/start?popup=1&popupNonce=${nonce}`,
      "github-install-popup",
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    )

    if (!popup) {
      setIsWaitingPopup(false)
    }
  }, [])

  const handleSubmitPat = useCallback(async () => {
    const token = patToken.trim()
    if (!token) {
      setPatError(
        isId
          ? "Token tidak boleh kosong"
          : "Personal Access Token cannot be empty"
      )
      return
    }

    setIsSubmittingPat(true)
    setPatError(null)

    try {
      if (onSubmitPat) {
        await onSubmitPat(token)
      }
      onAuthorized()
    } catch (err) {
      setPatError(
        err instanceof Error
          ? err.message
          : isId
            ? "Gagal memverifikasi token"
            : "Failed to verify token"
      )
    } finally {
      setIsSubmittingPat(false)
    }
  }, [isId, onAuthorized, onSubmitPat, patToken])

  return (
    <div
      data-testid="auth-recovery-card"
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border border-amber-500/30 bg-card p-5 shadow-xs transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <ShieldWarning
          className="h-5 w-5 shrink-0 text-amber-500"
          weight="bold"
        />
        <h2 className="text-xs font-bold tracking-wider text-foreground uppercase sm:text-sm">
          [!] AKSES REPOSITORY DIBUTUHKAN (PRIVATE REPOSITORY)
        </h2>
      </div>

      {/* Explanatory Copy */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:text-sm">
        <p>
          Repository{" "}
          <span className="font-mono font-semibold text-foreground">
            &apos;{repoName}&apos;
          </span>{" "}
          bersifat privat dan belum diotorisasi.
        </p>
        <p>
          Tanya membutuhkan izin baca kode untuk menganalisis stack dan
          menyiapkan blueprint.
        </p>
      </div>

      {/* Pilihan Solusi */}
      <div className="flex flex-col gap-2 pt-1">
        <span className="text-xs font-semibold text-foreground">
          Pilihan Solusi:
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary: GitHub App Popup */}
          <Button
            type="button"
            data-testid="auth-popup-btn"
            onClick={handleOpenPopup}
            disabled={isWaitingPopup}
            className="h-9 gap-2 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            {isWaitingPopup ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <Key className="h-4 w-4" weight="bold" />
            )}
            <span>[ 🔑 Otorisasi via GitHub App (Popup) ]</span>
          </Button>

          {/* Secondary: Personal Access Token Toggle */}
          <Button
            type="button"
            variant="outline"
            data-testid="auth-pat-toggle-btn"
            onClick={() => setShowPatInput((prev) => !prev)}
            className="h-9 gap-2 border-border bg-background text-xs font-medium text-foreground hover:bg-muted"
          >
            <ClipboardText className="h-4 w-4 text-muted-foreground" />
            <span>[ 📋 Gunakan Personal Access Token ]</span>
          </Button>
        </div>
      </div>

      {/* In-situ PAT Input Form */}
      {showPatInput && (
        <div
          data-testid="pat-input-container"
          className="mt-1 flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 p-3"
        >
          <div className="flex items-center gap-2">
            <LockKey className="h-4 w-4 text-muted-foreground" />
            <label
              htmlFor="pat-token-input"
              className="text-xs font-medium text-foreground"
            >
              Personal Access Token (classic / fine-grained with repo scope)
            </label>
          </div>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <Input
              id="pat-token-input"
              data-testid="pat-token-input"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              className="h-9 font-mono text-xs"
            />
            <Button
              type="button"
              data-testid="submit-pat-btn"
              onClick={() => void handleSubmitPat()}
              disabled={isSubmittingPat || !patToken.trim()}
              className="h-9 w-full shrink-0 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              {isSubmittingPat ? (
                <Spinner className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" weight="bold" />
              )}
              <span>{isId ? "Simpan Token" : "Save Token"}</span>
            </Button>
          </div>
          {patError && <p className="text-xs text-destructive">{patError}</p>}
        </div>
      )}

      {/* Footer Informational Note */}
      <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground sm:text-xs">
        Jendela popup akan tertutup otomatis setelah otorisasi selesai tanpa
        me-reload halaman.
      </div>
    </div>
  )
}
