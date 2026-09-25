"use client"

import { useState } from "react"
import { createClientSessionCrypto } from "@/modules/secrets/ui/client-crypto"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TemplateAccessCard({
  stack,
  locale,
}: {
  stack: StackSummaryDTO
  locale: string
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const id = locale.startsWith("id")
  const access = stack.access
  const domain = stack.customDomain || stack.subdomain
  const appUrl = domain ? `https://${domain}${access?.loginPath ?? ""}` : null
  const fields = access?.fields ?? []
  const ready = fields.every((field) =>
    stack.accessReadyKeys?.includes(field.key)
  )

  async function reveal(fieldId: string) {
    const field = fields.find((item) => item.id === fieldId)
    if (!field || !stack.accessReadyKeys?.includes(field.key)) return
    if (revealed[fieldId]) {
      setRevealed((current) => {
        const next = { ...current }
        delete next[fieldId]
        return next
      })
      return
    }
    setLoading(true)
    setError("")
    try {
      const crypto = await createClientSessionCrypto()
      const response = await fetch(`/api/stacks/${stack.id}/secrets/reveal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          environment: stack.slug.endsWith("-staging")
            ? "staging"
            : stack.slug.endsWith("-dev")
              ? "dev"
              : "prod",
          key: field.key,
          clientPublicKey: crypto.publicKeyJwk,
        }),
      })
      if (!response.ok) throw new Error("Reveal failed")
      const payload = await response.json()
      if (!payload?.ok || !payload.data?.envelope)
        throw new Error("Reveal failed")
      const value = await crypto.decrypt(payload.data.envelope)
      if (!value) throw new Error("Empty secret")
      setRevealed((current) => ({ ...current, [fieldId]: value }))
    } catch {
      setError(
        id
          ? "Password tidak dapat ditampilkan. Periksa izin dan konfigurasi secret."
          : "Cannot show the password. Check your permissions and secret configuration."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {access?.title ??
            (id ? "Mulai menggunakan aplikasi" : "Get started with your app")}
        </CardTitle>
        {domain && <p className="text-sm text-muted-foreground">{domain}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {access && (!ready || !appUrl) && (
          <p className="text-sm text-muted-foreground" role="status">
            {id
              ? "Akses belum siap: alamat web atau kredensial belum tersedia."
              : "Access not ready: app address or credentials are not available."}
          </p>
        )}
        {access && (
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            {access.steps.map((step, index) => (
              <li key={index} className="pl-1">
                <span>{step.text}</span>
                {step.action?.type === "reveal-field" &&
                  (() => {
                    const fieldId = step.action.fieldId
                    const field = fields.find((item) => item.id === fieldId)
                    if (!field) return null
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">
                          {field.label}:
                        </span>
                        <span className="font-mono">
                          {revealed[field.id] ?? "••••••••"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!ready || loading}
                          onClick={() => void reveal(field.id)}
                        >
                          {revealed[field.id]
                            ? id
                              ? "Sembunyikan"
                              : "Hide"
                            : id
                              ? "Lihat"
                              : "Reveal"}
                        </Button>
                        {revealed[field.id] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                revealed[field.id]
                              )
                            }
                          >
                            {id ? "Salin" : "Copy"}
                          </Button>
                        )}
                      </div>
                    )
                  })()}
              </li>
            ))}
          </ol>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {access && fields.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {id
              ? "Ini kredensial awal. Jika sudah diubah di aplikasi, gunakan yang terbaru."
              : "These are initial credentials. If changed in the app, use the new ones."}
          </p>
        )}
        {appUrl ? (
          <Button asChild size="sm">
            <a href={appUrl} target="_blank" rel="noopener noreferrer">
              {id ? "Buka aplikasi" : "Open app"}
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {id
              ? "Alamat web belum tersedia."
              : "App address is not available yet."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
