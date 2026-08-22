"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Robot, WhatsappLogo, Plus, ShieldCheck } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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

export type AgentProfile = {
  id: string
  name: string
  description?: string | null
  systemPrompt?: string | null
  fallbackMessage?: string | null
  dailyUserLimit: number
  enableProfanityFilter: boolean
  channelsCount: number
  isActive: boolean
  channelBindings?: {
    id: string
    channel: string
    targetId: string
    targetName: string | null
  }[]
}

export default function AiAgentsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [dailyLimit, setDailyLimit] = useState(20)
  const [enableProfanity, setEnableProfanity] = useState(true)
  const [isPending, startTransition] = useTransition()

  const loadAgents = useCallback(async () => {
    try {
      const res = await eden.api.console.ai.agents.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        setAgents(res.data.data as AgentProfile[])
      }
    } catch (err) {
      console.warn("[ai-agents] load error:", err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await eden.api.console.ai.agents.get()
        if (
          !cancelled &&
          res.data &&
          res.data.ok &&
          Array.isArray(res.data.data)
        ) {
          setAgents(res.data.data as AgentProfile[])
        }
      } catch (err) {
        console.warn("[ai-agents] initial load error:", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = () => {
    if (!name.trim()) return

    startTransition(async () => {
      try {
        const res = await eden.api.console.ai.agents.post({
          name: name.trim(),
          description: description.trim() || undefined,
          systemPrompt: systemPrompt.trim() || undefined,
          dailyUserLimit: dailyLimit,
          enableProfanityFilter: enableProfanity,
        })

        if (res.data && res.data.ok) {
          await loadAgents()
          setIsOpen(false)
          setName("")
          setDescription("")
          setSystemPrompt("")
        }
      } catch (err) {
        console.error("[ai-agents] save error:", err)
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Agent Persona & Channels
          </h1>
          <p className="text-sm text-muted-foreground">
            Konfigurasi otak AI, system prompt, batasan anti-abuse, dan
            hubungkan agen ke nomor WhatsApp atau Web Chat.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 text-black hover:bg-amber-600">
              <Plus size={16} weight="bold" />
              <span>Buat Agen Baru</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Buat Profil Agen AI Baru</DialogTitle>
              <DialogDescription>
                Tentukan kepribadian, instruksi dasar, dan batasan keamanan
                untuk asisten AI toko Anda.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama Agen</Label>
                <Input
                  placeholder="Misal: Asisten CS & Penjualan Toko"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Deskripsi Singkat</Label>
                <Input
                  placeholder="Misal: Menangani chat masuk WhatsApp pelanggan"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>System Prompt (Instruksi Utama)</Label>
                <Textarea
                  rows={4}
                  placeholder="Misal: Anda adalah asisten resmi toko. Jawab dengan ramah dan ringkas..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batas Pertanyaan / User / Hari</Label>
                  <Input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="flex flex-col justify-end space-y-2 pb-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Filter Kata Kasar</Label>
                    <Switch
                      checked={enableProfanity}
                      onCheckedChange={setEnableProfanity}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={!name.trim() || isPending}>
                {isPending ? "Menyimpan..." : "Simpan Profil Agen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.length === 0 ? (
          <Card className="col-span-2 flex flex-col items-center justify-center border-dashed p-8 text-center">
            <Robot size={32} className="mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada agen AI dibuat</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klik tombol di atas untuk membuat agen AI pertama Anda.
            </p>
          </Card>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id} className="border-border">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">
                      {agent.name}
                    </CardTitle>
                    {agent.isActive && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-500"
                      >
                        Aktif
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {agent.description || "Tanpa deskripsi"}
                  </CardDescription>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Robot size={18} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <p className="line-clamp-2 font-mono">
                    &quot;{agent.systemPrompt || "Default system prompt"}&quot;
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Daily Limit:</span>
                    <span className="ml-1 font-mono font-medium">
                      {agent.dailyUserLimit} req/user
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <ShieldCheck size={14} />
                    <span>Guardrails Aktif</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <WhatsappLogo size={16} className="text-emerald-500" />
                    <span>{agent.channelsCount || 0} Channel Terhubung</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Kelola Binding
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
