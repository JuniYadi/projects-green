"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Spinner } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { eden } from "@/lib/eden"
import type { AppCredentialType } from "@prisma/client"
import {
  credentialTypeRegistry,
  getCredentialTypeDef,
} from "@/modules/credentials/credential-type-registry"

const TYPE_OPTIONS = Object.keys(credentialTypeRegistry)
  .filter((key) => key !== "GITHUB_APP")
  .map((key) => ({
    value: key as AppCredentialType,
    label: getCredentialTypeDef(key as AppCredentialType).label,
  }))

type SecretField = { key: string; label: string; type?: string }

const SECRETS_FIELDS: Record<AppCredentialType, SecretField[]> = {
  GITHUB_TOKEN: [{ key: "token", label: "Personal Access Token" }],
  GITHUB_APP: [],
  CLOUDFLARE_API_TOKEN: [{ key: "token", label: "API Token" }],
  CLOUDFLARE_LEGACY_TOKEN: [
    { key: "apiKey", label: "Global API Key" },
    { key: "email", label: "Email", type: "email" },
  ],
}

export type AddCredentialDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  locale?: string
}

export function AddCredentialDialog({
  open,
  onOpenChange,
  onSuccess,
  locale: propLocale,
}: AddCredentialDialogProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(propLocale ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pConsoleAppCredentialsAddCredentialDialog
  const [type, setType] = useState<AppCredentialType | "">("")
  const [name, setName] = useState("")
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setType("")
    setName("")
    setMetadata({})
    setSecrets({})
    setSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

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
        toast.success(t.credentialCreated)
        handleOpenChange(false)
        onSuccess()
      } else {
        toast.error(t.createFailed)
      }
    } catch {
      toast.error(t.networkError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.addCredentialTitle}</DialogTitle>
          <DialogDescription>
            {typeDef
              ? `${t.dialogDescriptionPrefix} ${typeDef.label} ${t.dialogDescriptionSuffix}`
              : t.dialogDescriptionDefault}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cred-type">{t.typeLabel}</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as AppCredentialType)
                setMetadata({})
                setSecrets({})
              }}
            >
              <SelectTrigger id="cred-type" className="w-full">
                <SelectValue placeholder={t.selectTypePlaceholder} />
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

          {!typeDef && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t.selectTypeHint}
            </div>
          )}

          {typeDef && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cred-name">{t.nameLabel}</Label>
                <Input
                  id="cred-name"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

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
                  {t.noSecretsHint}
                </p>
              )}
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  {t.creating}
                </>
              ) : (
                t.createCredential
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
