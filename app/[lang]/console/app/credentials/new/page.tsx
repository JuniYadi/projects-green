"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Spinner } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"
import type { AppCredentialType } from "@prisma/client"
import {
  credentialTypeRegistry,
  getCredentialTypeDef,
} from "@/modules/credentials/credential-type-registry"

const TYPE_OPTIONS = Object.keys(credentialTypeRegistry).map((key) => ({
  value: key as AppCredentialType,
  label: getCredentialTypeDef(key as AppCredentialType).label,
}))

// ─── Secrets field definitions per type ─────────────────────────────────────

type SecretField = { key: string; label: string; type?: string }

const SECRETS_FIELDS: Record<AppCredentialType, SecretField[]> = {
  GITHUB_TOKEN: [{ key: "token", label: "Personal Access Token" }],
  GITHUB_APP: [], // auto-generated, no user input
  CLOUDFLARE_API_TOKEN: [{ key: "token", label: "API Token" }],
  CLOUDFLARE_LEGACY_TOKEN: [
    { key: "apiKey", label: "Global API Key" },
    { key: "email", label: "Email", type: "email" },
  ],
}

export default function NewCredentialPage() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const backHref = localizePathname({
    pathname: "/console/app/credentials",
    locale,
  })

  const [type, setType] = useState<AppCredentialType | "">("")
  const [name, setName] = useState("")
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const typeDef = type ? getCredentialTypeDef(type as AppCredentialType) : null
  const metadataFields = typeDef?.metadataFields ?? []
  const secretFields = type ? SECRETS_FIELDS[type] : []

  const canSubmit =
    type !== "" &&
    name.trim() !== "" &&
    secretFields.every((f) => secrets[f.key]?.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !canSubmit) return

    setSubmitting(true)
    try {
      const { data: payload } = await eden.api.app.credentials.post({
        $fetch: {
          method: "POST",
          body: JSON.stringify({
            type,
            name: name.trim(),
            metadata,
            secrets,
          }),
          headers: { "Content-Type": "application/json" },
        },
      })
      if (payload?.ok) {
        toast.success("Credential created.")
        router.push(backHref)
      } else {
        toast.error("Failed to create credential.")
      }
    } catch {
      toast.error("Network error.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LifecyclePageShell
      title="Add Credential"
      description={`Add a new ${typeDef?.label ?? "credential"} to your application.`}
    >
      <div className="max-w-lg">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {/* Type selector */}
          <div className="space-y-2">
            <Label htmlFor="cred-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as AppCredentialType)
                setMetadata({})
                setSecrets({})
              }}
            >
              <SelectTrigger id="cred-type">
                <SelectValue placeholder="Select credential type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {typeDef && (
            <>
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="cred-name">Name</Label>
                <Input
                  id="cred-name"
                  placeholder="e.g. Production API Token"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Metadata fields */}
              {metadataFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`meta-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`meta-${field.key}`}
                    value={metadata[field.key] ?? ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}

              {/* Secret fields */}
              {secretFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`secret-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`secret-${field.key}`}
                    type={field.type ?? "password"}
                    value={secrets[field.key] ?? ""}
                    onChange={(e) =>
                      setSecrets((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              ))}

              {secretFields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This credential type is created automatically — no secrets to
                  enter.
                </p>
              )}

              {/* Submit */}
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting || !canSubmit}>
                  {submitting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create Credential"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(backHref)}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </LifecyclePageShell>
  )
}
