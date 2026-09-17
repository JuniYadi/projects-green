"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Key, Lightning, ShieldCheck, Plus, Trash } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ProviderEntry = {
  id: string
  name: string
  providerType: "OPENAI_COMPATIBLE" | "ANTHROPIC" | "MANAGED"
  baseUrl?: string | null
  defaultModel: string
  isDefault: boolean
  isConfigured?: boolean
}

export default function AiProvidersPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [providers, setProviders] = useState<ProviderEntry[]>([
    {
      id: "prov_managed",
      name: "PFNApp Managed Intelligence (Default)",
      providerType: "MANAGED",
      defaultModel: "anthropic/claude-sonnet-4-5-20251120",
      isDefault: true,
    },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [providerType, setProviderType] = useState<
    "OPENAI_COMPATIBLE" | "ANTHROPIC"
  >("OPENAI_COMPATIBLE")
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1")
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini")
  const [apiKey, setApiKey] = useState("")
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle")
  const [testMessage, setTestMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const loadProviders = useCallback(async () => {
    try {
      const res = await eden.api.console.ai.providers.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        setProviders([
          {
            id: "prov_managed",
            name: "PFNApp Managed Intelligence (Default)",
            providerType: "MANAGED",
            defaultModel: "anthropic/claude-sonnet-4-5-20251120",
            isDefault: true,
          },
          ...(res.data.data as ProviderEntry[]),
        ])
      }
    } catch (err) {
      console.warn("[ai-providers] load error:", err)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProviders()
  }, [loadProviders])
  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTestMessage("")
    try {
      const res = await eden.api.console.ai.providers.test.post({
        providerType,
        baseUrl: providerType === "OPENAI_COMPATIBLE" ? baseUrl : undefined,
        defaultModel,
        apiKey,
      })
      if (res.data && res.data.ok) {
        setTestStatus("success")
        setTestMessage(res.data.reply || "Koneksi Berhasil")
      } else {
        setTestStatus("failed")
        setTestMessage(res.data?.message || "Gagal menghubungi model API")
      }
    } catch {
      setTestStatus("failed")
      setTestMessage("Terjadi kesalahan jaringan saat menguji provider")
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !apiKey.trim()) return

    setSaving(true)
    try {
      const res = await eden.api.console.ai.providers.post({
        name: name.trim(),
        providerType,
        baseUrl:
          providerType === "OPENAI_COMPATIBLE" ? baseUrl.trim() : undefined,
        defaultModel: defaultModel.trim(),
        apiKey: apiKey.trim(),
        isDefault: false,
      })
      if (res.data && res.data.ok) {
        await loadProviders()
        setIsOpen(false)
        setName("")
        setApiKey("")
        setTestStatus("idle")
        setTestMessage("")
      }
    } catch (err) {
      console.error("[ai-providers] save error:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await eden.api.console.ai.providers[id].delete()
      if (res.data && res.data.ok) {
        setProviders((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error("[ai-providers] delete error:", err)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.pConsoleAiProvidersPageClient.pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.pConsoleAiProvidersPageClient.pageDescription}
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 text-black hover:bg-amber-600">
              <Plus size={16} weight="bold" />
              <span>
                {messages.pConsoleAiProvidersPageClient.addProviderButton}
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {messages.pConsoleAiProvidersPageClient.dialogTitle}
              </DialogTitle>
              <DialogDescription>
                {messages.pConsoleAiProvidersPageClient.dialogDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>
                  {messages.pConsoleAiProvidersPageClient.providerNameLabel}
                </Label>
                <Input
                  placeholder={
                    messages.pConsoleAiProvidersPageClient
                      .providerNamePlaceholder
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {messages.pConsoleAiProvidersPageClient.providerTypeLabel}
                </Label>
                <Select
                  value={providerType}
                  onValueChange={(val: "OPENAI_COMPATIBLE" | "ANTHROPIC") => {
                    setProviderType(val)
                    if (val === "OPENAI_COMPATIBLE") {
                      setBaseUrl("https://api.openai.com/v1")
                      setDefaultModel("gpt-4o-mini")
                    } else {
                      setBaseUrl("")
                      setDefaultModel("claude-3-5-sonnet-latest")
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPENAI_COMPATIBLE">
                      {
                        messages.pConsoleAiProvidersPageClient
                          .providerTypeOpenAiCompatible
                      }
                    </SelectItem>
                    <SelectItem value="ANTHROPIC">
                      {
                        messages.pConsoleAiProvidersPageClient
                          .providerTypeAnthropic
                      }
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {providerType === "OPENAI_COMPATIBLE" && (
                <div className="space-y-2">
                  <Label>
                    {messages.pConsoleAiProvidersPageClient.baseUrlLabel}
                  </Label>
                  <Input
                    placeholder="https://api.openai.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {messages.pConsoleAiProvidersPageClient.defaultModelNameLabel}
                </Label>
                <Input
                  placeholder={
                    messages.pConsoleAiProvidersPageClient
                      .defaultModelPlaceholder
                  }
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {messages.pConsoleAiProvidersPageClient.apiKeyLabel}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    messages.pConsoleAiProvidersPageClient.apiKeyPlaceholder
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testStatus === "testing" || !apiKey}
                >
                  {testStatus === "testing"
                    ? "Menguji..."
                    : testStatus === "success"
                      ? "✓ Koneksi Berhasil"
                      : testStatus === "failed"
                        ? "Uji Ulang"
                        : "Uji Koneksi"}
                </Button>
                {testStatus === "success" && (
                  <span className="text-xs font-medium text-emerald-500">
                    {messages.pConsoleAiProvidersPageClient.apiKeyValidPrefix}
                    {testMessage}&quot;
                  </span>
                )}
                {testStatus === "failed" && (
                  <span className="text-xs font-medium text-destructive">
                    {testMessage || "Gagal"}
                  </span>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                {messages.pConsoleAiProvidersPageClient.cancelButton}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || !apiKey.trim() || saving}
              >
                {saving ? "Menyimpan..." : "Simpan ke Vault"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <Card key={p.id} className="border-border">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {p.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {p.providerType === "MANAGED"
                    ? "Infrastruktur PFNApp"
                    : p.baseUrl || "Anthropic API"}
                </CardDescription>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {p.providerType === "MANAGED" ? (
                  <Lightning size={18} />
                ) : (
                  <Key size={18} />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {messages.pConsoleAiProvidersPageClient.defaultModelCardLabel}
                </span>
                <span className="font-mono font-medium">{p.defaultModel}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                  <ShieldCheck size={14} />
                  {messages.pConsoleAiProvidersPageClient.vaultEncryptedBadge}
                </span>
                {p.providerType !== "MANAGED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash size={14} className="mr-1" />
                    {messages.pConsoleAiProvidersPageClient.deleteButton}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
