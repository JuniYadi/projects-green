"use client"

import { useState } from "react"
import {
  Robot,
  WhatsappLogo,
  Globe,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react"
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
  description: string
  systemPrompt: string
  dailyUserLimit: number
  enableProfanityFilter: boolean
  channelsCount: number
  isActive: boolean
}

export default function AiAgentsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([
    {
      id: "agent_1",
      name: "Asisten CS & Penjualan Toko",
      description:
        "Melayani tanya jawab katalog produk, panduan retur, dan jam operasional di WhatsApp.",
      systemPrompt:
        "Anda adalah Customer Service resmi toko. Jawab pertanyaan pelanggan dengan sopan, ramah, dan ringkas berdasarkan dokumen knowledge base.",
      dailyUserLimit: 20,
      enableProfanityFilter: true,
      channelsCount: 2, // 2 nomor WhatsApp terhubung
      isActive: true,
    },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [dailyLimit, setDailyLimit] = useState(20)
  const [profanityFilter, setProfanityFilter] = useState(true)

  const handleSave = () => {
    if (!name.trim()) return

    const newAgent: AgentProfile = {
      id: `agent_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || "Profil bot toko kustom",
      systemPrompt:
        systemPrompt.trim() || "Jawab pertanyaan pelanggan secara sopan.",
      dailyUserLimit: dailyLimit,
      enableProfanityFilter: profanityFilter,
      channelsCount: 0,
      isActive: true,
    }

    setAgents((prev) => [...prev, newAgent])
    setIsOpen(false)
    setName("")
    setDescription("")
    setSystemPrompt("")
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Master Agent Profiles
          </h1>
          <p className="text-sm text-muted-foreground">
            Konfigurasi otak AI, persona percakapan, dan batas pesan pelanggan
            sebelum dipasang ke nomor WhatsApp atau Web LiveChat.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 text-black hover:bg-amber-600">
              <Plus size={16} weight="bold" />
              <span>Buat Agent Profile Baru</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Buat Master Agent Profile</DialogTitle>
              <DialogDescription>
                1 Profil Agent dapat dipasang ke banyak nomor WhatsApp sekaligus
                tanpa perlu setting ulang.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama Profil Bot</Label>
                <Input
                  placeholder="Misal: CS Penjualan Toko Utama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input
                  placeholder="Misal: Melayani chat WhatsApp dan LiveChat"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>System Prompt (Instruksi & Persona)</Label>
                <Textarea
                  rows={4}
                  placeholder="Tulis instruksi persona, aturan toko, atau batasan gaya bicara bot..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batas Pesan / Pelanggan / Hari</Label>
                  <Input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) =>
                      setDailyLimit(parseInt(e.target.value, 10) || 20)
                    }
                  />
                </div>
                <div className="flex flex-col justify-end space-y-2 pb-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Filter Kata Kasar</Label>
                    <Switch
                      checked={profanityFilter}
                      onCheckedChange={setProfanityFilter}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={!name.trim()}>
                Simpan Profil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a) => (
          <Card key={a.id} className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">
                      {a.name}
                    </CardTitle>
                    {a.isActive && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 text-[10px] text-emerald-500"
                      >
                        Aktif
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {a.description}
                  </CardDescription>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Robot size={20} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="line-clamp-2 rounded-lg border border-border/50 bg-muted/50 p-3 text-xs text-muted-foreground italic">
                &ldquo;{a.systemPrompt}&rdquo;
              </div>

              <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <WhatsappLogo size={15} className="text-emerald-500" />
                  <Globe size={15} className="text-sky-500" />
                  <span>{a.channelsCount} Saluran Terhubung</span>
                </div>
                <div className="flex items-center gap-1 font-medium text-emerald-500">
                  <ShieldCheck size={14} />
                  <span>Maks {a.dailyUserLimit} chat/hari</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
