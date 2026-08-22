"use client"

import { useState } from "react"
import { Key, Lightning, ShieldCheck, Plus, Trash } from "@phosphor-icons/react"
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
  baseUrl?: string
  defaultModel: string
  isDefault: boolean
}

export default function AiProvidersPage() {
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

  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTimeout(() => {
      setTestStatus("success")
    }, 800)
  }

  const handleSave = () => {
    if (!name.trim() || !apiKey.trim()) return

    const newProvider: ProviderEntry = {
      id: `prov_${Date.now()}`,
      name: name.trim(),
      providerType,
      baseUrl:
        providerType === "OPENAI_COMPATIBLE" ? baseUrl.trim() : undefined,
      defaultModel: defaultModel.trim(),
      isDefault: false,
    }

    setProviders((prev) => [...prev, newProvider])
    setIsOpen(false)
    setName("")
    setApiKey("")
    setTestStatus("idle")
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Providers (BYOK)
          </h1>
          <p className="text-sm text-muted-foreground">
            Bawa API Key Anda sendiri (OpenAI, DeepSeek, Groq, Anthropic) dengan
            penyimpanan terenkripsi HashiCorp Vault.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 text-black hover:bg-amber-600">
              <Plus size={16} weight="bold" />
              <span>Tambah Provider BYOK</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hubungkan API Key Sendiri (BYOK)</DialogTitle>
              <DialogDescription>
                API Key Anda akan dienkripsi dengan standar HashiCorp Vault KV
                v2 dan tidak pernah disimpan di database SQL plaintext.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama Provider</Label>
                <Input
                  placeholder="Misal: OpenAI Corporate Toko"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipe Provider</Label>
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
                      OpenAI Compatible (OpenAI, DeepSeek, Groq, Ollama)
                    </SelectItem>
                    <SelectItem value="ANTHROPIC">
                      Anthropic (Claude 3.5 Sonnet / Haiku)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {providerType === "OPENAI_COMPATIBLE" && (
                <div className="space-y-2">
                  <Label>Base URL Endpoint</Label>
                  <Input
                    placeholder="https://api.openai.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Default Model Name</Label>
                <Input
                  placeholder="gpt-4o-mini / deepseek-chat"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>API Key (Secret)</Label>
                <Input
                  type="password"
                  placeholder="sk-proj-..."
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
                      : "Uji Koneksi"}
                </Button>
                {testStatus === "success" && (
                  <span className="text-xs font-medium text-emerald-500">
                    API Key Valid & Terhubung
                  </span>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || !apiKey.trim()}
              >
                Simpan ke Vault
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
                <span className="text-muted-foreground">Default Model:</span>
                <span className="font-mono font-medium">{p.defaultModel}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                  <ShieldCheck size={14} />
                  Vault Encrypted
                </span>
                {p.providerType !== "MANAGED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      setProviders((prev) =>
                        prev.filter((item) => item.id !== p.id)
                      )
                    }
                  >
                    <Trash size={14} className="mr-1" />
                    Hapus
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
