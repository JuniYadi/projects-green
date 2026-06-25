"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react"
import QRCode from "qrcode"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { generatePairingToken, getPairingStatus } from "@/lib/vpn-mobile-client"

type PairingPhase =
  | { phase: "idle" }
  | { phase: "generating" }
  | {
      phase: "ready"
      pairingToken: string
      qrDataUrl: string
      expiresAt: string
    }
  | { phase: "claimed" }
  | { phase: "expired" }
  | { phase: "error"; message: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscriptionId: string
  subscriptionName?: string
  onPaired?: () => void
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function VpnPairingQrModal({
  open,
  onOpenChange,
  subscriptionId,
  subscriptionName,
  onPaired,
}: Props) {
  const [state, setState] = useState<PairingPhase>({ phase: "idle" })
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [countdown, setCountdown] = useState(300)

  const generate = useCallback(async () => {
    startTransition(() => setState({ phase: "generating" }))
    try {
      const result = await generatePairingToken(subscriptionId)
      // Render the pairing token as a scannable QR code data URL.
      const qrDataUrl = await QRCode.toDataURL(result.qrPayload, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: "M",
      })
      startTransition(() => {
        setState({
          phase: "ready",
          pairingToken: result.pairingToken,
          qrDataUrl,
          expiresAt: result.expiresAt,
        })
        setCountdown(300)
      })
    } catch (error) {
      startTransition(() => {
        setState({
          phase: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate pairing code.",
        })
      })
    }
  }, [subscriptionId])

  // Poll pairing status when ready.
  useEffect(() => {
    if (state.phase !== "ready") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    pollingRef.current = setInterval(async () => {
      try {
        const status = await getPairingStatus(state.pairingToken)
        if (status.status === "claimed") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
          }
          startTransition(() => setState({ phase: "claimed" }))
          onPaired?.()
        }
      } catch {
        // Ignore polling errors — retry on next interval.
      }
    }, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [state, onPaired])

  // Countdown timer.
  useEffect(() => {
    if (state.phase !== "ready") {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      return
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
          }
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          startTransition(() => setState({ phase: "expired" }))
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [state.phase])

  // Generate token on open.
  useEffect(() => {
    if (open) {
      generate()
    } else {
      setState({ phase: "idle" })
      setCountdown(300)
    }
  }, [open, generate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pair a mobile device</DialogTitle>
          <DialogDescription>
            {subscriptionName
              ? `Scan this code with the mobile app to pair a device to ${subscriptionName}.`
              : "Scan this code with the mobile app to pair a device."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {state.phase === "generating" && (
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-48 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          )}

          {(state.phase === "ready" || state.phase === "expired") && (
            <>
              <div className="flex items-center justify-center rounded-lg border bg-white p-4">
                {state.phase === "ready" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, cannot use next/image
                  <img
                    src={state.qrDataUrl}
                    alt="Scan with mobile app to pair device"
                    width={256}
                    height={256}
                    className="rounded-md"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">
                      Code expired
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center">
                {state.phase === "ready" && (
                  <>
                    <p className="text-sm font-medium">
                      {formatCountdown(countdown)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scan with the mobile app before this expires
                    </p>
                  </>
                )}
                {state.phase === "expired" && (
                  <p className="text-sm text-muted-foreground">
                    This code has expired.
                  </p>
                )}
              </div>
            </>
          )}

          {state.phase === "claimed" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-lg font-semibold text-green-600">
                Device paired successfully
              </p>
              <p className="text-sm text-muted-foreground">
                VPN profiles are now available on the paired device.
              </p>
            </div>
          )}

          {state.phase === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </div>

        {(state.phase === "expired" || state.phase === "error") && (
          <div className="flex justify-center">
            <Button onClick={generate}>Regenerate</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
