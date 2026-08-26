"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { Ban, Check, Copy, KeyRound, RotateCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { WhatsappOrganizationApiKeySelfDTO } from "../organization-api-keys.dto"

type StateResponse = {
  ok: boolean
  data?: WhatsappOrganizationApiKeySelfDTO
  message?: string
}

type GeneratedResponse = {
  ok: boolean
  data?: {
    key: {
      fingerprint: string
      status: "ACTIVE" | "REVOKED"
    }
    secret: string
  }
  message?: string
}

type Action = "generate" | "rotate" | "revoke"

const endpoint = "/api/whatsapp/organization-api-keys/self"

const formatDate = (value: string | null) => {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const statusLabel: Record<WhatsappOrganizationApiKeySelfDTO["status"], string> =
  {
    ACTIVE: "Active",
    REVOKED: "Revoked",
    NOT_GENERATED: "Not generated",
  }

const statusVariant = (status: WhatsappOrganizationApiKeySelfDTO["status"]) => {
  if (status === "ACTIVE") return "success" as const
  if (status === "REVOKED") return "secondary" as const
  return "outline" as const
}

export function WhatsappOrganizationApiKeySelfService() {
  const [state, setState] =
    React.useState<WhatsappOrganizationApiKeySelfDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [authorized, setAuthorized] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [secret, setSecret] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [busy, setBusy] = React.useState<Action | null>(null)

  const loadState = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(endpoint)
      const body = (await response.json()) as StateResponse
      if (response.status === 401 || response.status === 403) {
        setAuthorized(false)
        setState(null)
        return
      }
      setAuthorized(true)
      if (!response.ok || !body.ok || !body.data) {
        throw new Error(body.message ?? "Failed to load your API key.")
      }
      setState(body.data)
    } catch (loadError) {
      setAuthorized(true)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load your API key."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadState()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadState])

  const runAction = async (action: Action) => {
    setBusy(action)
    setError(null)
    try {
      const response = await fetch(
        action === "generate" ? endpoint : `${endpoint}/${action}`,
        { method: "POST" }
      )
      const body = (await response.json()) as GeneratedResponse
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? "API-key action failed.")
      }
      if (body.data?.secret) {
        setSecret(body.data.secret)
        setCopied(false)
      }
      await loadState()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "API-key action failed."
      )
    } finally {
      setBusy(null)
    }
  }

  const copySecret = async () => {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    setCopied(true)
  }

  if (authorized === false) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>
            <WhatsAppText id="s181" />
          </CardTitle>
          <CardDescription>
            <WhatsAppText id="s182" />
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading || !state) {
    return (
      <p className="text-sm text-muted-foreground">
        <WhatsAppText id="s183" />
      </p>
    )
  }

  const canGenerate = state.status !== "ACTIVE"
  const canRotate = state.status === "ACTIVE"

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">
          <WhatsAppText id="s184" />
        </h1>
        <p className="text-sm text-muted-foreground">
          <WhatsAppText id="s185" />
        </p>
      </header>

      {secret && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base">
              <WhatsAppText id="s358" />
            </CardTitle>
            <CardDescription>
              <WhatsAppText id="s186" />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 rounded border bg-background px-3 py-2 text-sm break-all">
              {secret}
            </code>
            <Button type="button" variant="outline" onClick={copySecret}>
              {copied ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              <WhatsAppText id={copied ? "s359" : "s360"} />
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">
              <WhatsAppText id="s187" />
            </CardTitle>
            <CardDescription>
              <WhatsAppText id="s188" />
            </CardDescription>
          </div>
          <Badge variant={statusVariant(state.status)}>
            {statusLabel[state.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                <WhatsAppText id="s361" />
              </dt>
              <dd className="font-mono break-all">
                {state.fingerprint ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <WhatsAppText id="s362" />
              </dt>
              <dd>{state.generatedKeyCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <WhatsAppText id="s363" />
              </dt>
              <dd>{formatDate(state.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <WhatsAppText id="s364" />
              </dt>
              <dd>{formatDate(state.rotatedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <WhatsAppText id="s365" />
              </dt>
              <dd>{formatDate(state.revokedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <WhatsAppText id="s189" />
              </dt>
              <dd>{formatDate(state.lastUsedAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {canGenerate && (
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void runAction("generate")}
              >
                <KeyRound className="mr-2 size-4" />
                <WhatsAppText id="s190" />
              </Button>
            )}
            {canRotate && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                  >
                    <RotateCw className="mr-2 size-4" />
                    <WhatsAppText id="s191" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      <WhatsAppText id="s192" />
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      <WhatsAppText id="s193" />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      <WhatsAppText id="s15" />
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={() => void runAction("rotate")}>
                      <WhatsAppText id="s366" />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canRotate && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy !== null}
                  >
                    <Ban className="mr-2 size-4" />
                    <WhatsAppText id="s194" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      <WhatsAppText id="s195" />
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      <WhatsAppText id="s196" />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      <WhatsAppText id="s15" />
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={() => void runAction("revoke")}>
                      <WhatsAppText id="s367" />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
