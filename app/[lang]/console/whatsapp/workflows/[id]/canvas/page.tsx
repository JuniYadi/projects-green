"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Sparkle,
  FloppyDisk,
  Play,
  ArrowLeft,
  Plus,
  Trash,
  WhatsappLogo,
  PaperPlaneRight,
  Lightning,
  TreeStructure,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from "@/modules/whatsapp/workflow/workflow.schema"

export default function WhatsappWorkflowCanvasPage() {
  const params = useParams()
  const router = useRouter()
  const lang = (params?.lang as string) || "en"
  const workflowId = params?.id as string

  // State
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(() => ({
    id: workflowId === "new" ? `wf_new` : workflowId,
    organizationId: "",
    name: "Alur Bot WhatsApp Baru",
    description: "Alur otomatis customer service & penjualan",
    isActive: true,
    trigger: {
      id: "trig_1",
      type: "keyword_match",
      keywords: ["halo", "menu", "bantuan"],
    },
    nodes: [
      {
        id: "node_start",
        type: "send_message",
        name: "Pesan Pembuka",
        config: {
          text: "Halo! Selamat datang di layanan WhatsApp kami. Ada yang bisa kami bantu?",
        },
      },
      {
        id: "node_ask_name",
        type: "prompt_input",
        name: "Tanya Nama Pelanggan",
        config: {
          question: "Sebelum lanjut, boleh tahu dengan siapa kami berbicara?",
          captureVariable: "nama_pelanggan",
          validation: { type: "text" },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        sourceNodeId: "node_start",
        sourcePort: "default",
        targetNodeId: "node_ask_name",
      },
    ],
    version: 1,
  }))
  const [devices, setDevices] = useState<
    { id: string; name: string; phoneNumber: string }[]
  >([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)

  // AI Copilot state
  const [copilotPrompt, setCopilotPrompt] = useState("")
  const [generating, setGenerating] = useState(false)

  // Live Simulator state
  const [isSimOpen, setIsSimOpen] = useState(false)
  const [simChat, setSimChat] = useState<
    { role: "user" | "bot"; text: string }[]
  >([])
  const [simInput, setSimInput] = useState("")

  const loadDevices = useCallback(async () => {
    try {
      const res = await eden.api.console.whatsapp.devices.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        const devList = res.data.data.map(
          (d: { id: string; name: string; phoneNumber: string }) => ({
            id: d.id,
            name: d.name,
            phoneNumber: d.phoneNumber,
          })
        )
        setDevices(devList)
        if (devList.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devList[0].id)
        }
      }
    } catch (err) {
      console.warn("[canvas] load devices error:", err)
    }
  }, [selectedDeviceId])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDevices()
  }, [loadDevices])
  // AI Copilot Generator
  const handleGenerateCanvas = async () => {
    if (!copilotPrompt.trim()) return
    setGenerating(true)
    try {
      const res = await eden.api.console.ai.workflows.generate.post({
        prompt: copilotPrompt,
      })
      const data = res.data as {
        ok: boolean
        workflow?: {
          name: string
          description?: string
          nodes: WorkflowNode[]
        }
        summary?: string
        error?: string
      }

      if (data.ok && data.workflow) {
        const newNodes: WorkflowNode[] = data.workflow.nodes
        const newEdges: WorkflowEdge[] = []
        for (let i = 0; i < newNodes.length - 1; i++) {
          newEdges.push({
            id: `edge_${Date.now()}_${i}`,
            sourceNodeId: newNodes[i].id,
            sourcePort: "default",
            targetNodeId: newNodes[i + 1].id,
          })
        }

        setWorkflow((prev) => ({
          ...prev,
          name: data.workflow?.name || prev.name,
          description: data.workflow?.description || prev.description,
          nodes: newNodes,
          edges: newEdges,
        }))
        toast.success(
          "AI Copilot berhasil merancang dan menyusun alur di canvas!"
        )
      } else {
        toast.error(data.error || "Gagal membuat alur dengan AI Copilot.")
      }
    } catch (err) {
      console.error("[canvas] generate error:", err)
      toast.error("Terjadi kesalahan saat memproses prompt AI.")
    } finally {
      setGenerating(false)
    }
  }

  // Save workflow to device
  const handleSaveWorkflow = async () => {
    if (!selectedDeviceId) {
      toast.error("Pilih nomor WhatsApp device terlebih dahulu.")
      return
    }

    setSaving(true)
    try {
      // @ts-expect-error eden route
      const res = await eden.api.console.whatsapp.workflows.save.post({
        deviceId: selectedDeviceId,
        workflow,
      })

      if (res.data && res.data.ok) {
        toast.success(
          "Alur canvas berhasil disimpan & diaktifkan di WhatsApp device!"
        )
        router.push(`/${lang}/console/whatsapp/workflows`)
      } else {
        toast.error(res.data?.error || "Gagal menyimpan workflow.")
      }
    } catch (err) {
      console.error("[canvas] save error:", err)
      toast.error("Terjadi kesalahan saat menyimpan alur canvas.")
    } finally {
      setSaving(false)
    }
  }

  // Simulator test
  const handleStartSim = () => {
    setIsSimOpen(true)
    if (workflow.nodes.length > 0) {
      const first = workflow.nodes[0]
      const text =
        (first.config.text as string) ||
        (first.config.question as string) ||
        (first.config.bodyText as string) ||
        "Halo! Alur dimulai."
      setSimChat([{ role: "bot", text }])
    }
  }

  const handleSimReply = () => {
    if (!simInput.trim()) return
    const msg = simInput.trim()
    const updated = [...simChat, { role: "user" as const, text: msg }]
    const userCount = updated.filter((m) => m.role === "user").length

    if (workflow.nodes.length > userCount) {
      const nextNode = workflow.nodes[userCount]
      const reply =
        (nextNode.config.text as string) ||
        (nextNode.config.question as string) ||
        (nextNode.config.bodyText as string) ||
        "Pesan selanjutnya"
      updated.push({
        role: "bot",
        text: reply.replace(/\{\{variables\.\w+\}\}/g, msg),
      })
    } else {
      updated.push({
        role: "bot",
        text: `Terima kasih! Pesan Anda "${msg}" telah diproses sampai akhir alur.`,
      })
    }

    setSimChat(updated)
    setSimInput("")
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 pt-0">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link href={`/${lang}/console/whatsapp/workflows`}>
              <ArrowLeft size={16} />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Input
                value={workflow.name}
                onChange={(e) =>
                  setWorkflow({ ...workflow, name: e.target.value })
                }
                className="h-8 w-64 text-base font-semibold md:w-80"
              />
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-xs text-emerald-600"
              >
                Visual Canvas
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {workflow.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52">
            <Select
              value={selectedDeviceId}
              onValueChange={setSelectedDeviceId}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pilih WhatsApp Device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name} ({d.phoneNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartSim}
            className="h-8 gap-1.5 text-xs"
          >
            <Play size={14} weight="fill" className="text-emerald-500" />
            <span>Tes Simulator</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSaveWorkflow}
            className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
          >
            <FloppyDisk size={14} weight="bold" />
            <span>{saving ? "Menyimpan..." : "Simpan & Aktifkan"}</span>
          </Button>
        </div>
      </div>

      {/* AI Copilot Prompt Bar */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Sparkle size={16} weight="fill" />
            <span>AI Copilot Canvas:</span>
          </div>
          <Input
            placeholder="Contoh: Rancang bot tanya nama, keluhan, lalu kirimkan solusi panduan teknis..."
            value={copilotPrompt}
            onChange={(e) => setCopilotPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerateCanvas()}
            className="h-8 bg-background text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={generating || !copilotPrompt.trim()}
            onClick={handleGenerateCanvas}
            className="h-8 shrink-0 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
          >
            <Lightning size={14} weight="fill" />
            <span>{generating ? "Merancang..." : "Generate di Canvas ✨"}</span>
          </Button>
        </div>
      </div>

      {/* Interactive Visual Canvas Area */}
      <div className="relative min-h-[520px] flex-1 overflow-auto rounded-xl border border-border bg-zinc-950/90 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] p-6">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <TreeStructure size={16} />
            <span>Alur Node ({workflow.nodes.length} Steps)</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-zinc-700 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                const newNode: WorkflowNode = {
                  id: `node_${Date.now()}`,
                  type: "send_message",
                  name: "Pesan Baru",
                  config: { text: "Tuliskan pesan Anda di sini." },
                }
                setWorkflow((prev) => ({
                  ...prev,
                  nodes: [...prev.nodes, newNode],
                  edges: [
                    ...prev.edges,
                    {
                      id: `edge_${Date.now()}`,
                      sourceNodeId:
                        prev.nodes[prev.nodes.length - 1]?.id || newNode.id,
                      sourcePort: "default",
                      targetNodeId: newNode.id,
                    },
                  ],
                }))
              }}
            >
              <Plus size={12} />
              <span>Tambah Node Pesan</span>
            </Button>
          </div>
        </div>

        {/* Visual Node Flow Layout */}
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Trigger Node */}
          <div className="w-80 rounded-lg border border-emerald-500/40 bg-zinc-900 p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
                ⚡ Trigger Inbound
              </span>
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-[9px] text-emerald-400"
              >
                Keyword Match
              </Badge>
            </div>
            <p className="text-xs font-medium text-zinc-200">
              Kata Kunci:{" "}
              {workflow.trigger.keywords?.join(", ") || "Semua Pesan"}
            </p>
          </div>

          {/* Connectors & Nodes */}
          {workflow.nodes.map((node, index) => (
            <div key={node.id} className="flex flex-col items-center gap-3">
              {/* Connector Edge Arrow */}
              <div className="flex flex-col items-center">
                <div className="h-6 w-0.5 bg-emerald-500/50" />
                <div className="h-2 w-2 rotate-45 border-r-2 border-b-2 border-emerald-500" />
              </div>

              {/* Node Card Box */}
              <div
                onClick={() => setSelectedNode(node)}
                className="hover:bg-zinc-850 w-80 cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-md transition hover:border-emerald-500/60"
              >
                <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-zinc-100">
                      {node.name}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-zinc-800 text-[9px] text-zinc-400"
                  >
                    {node.type}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-zinc-400">
                  {(node.config.question as string) ||
                    (node.config.text as string) ||
                    (node.config.bodyText as string) ||
                    "Konfigurasi node"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Node Config Drawer */}
      <Sheet
        open={!!selectedNode}
        onOpenChange={(open) => !open && setSelectedNode(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold">
              Edit Node: {selectedNode?.name}
            </SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Langkah</Label>
                <Input
                  value={selectedNode.name}
                  onChange={(e) => {
                    const newName = e.target.value
                    setSelectedNode({ ...selectedNode, name: newName })
                    setWorkflow((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) =>
                        n.id === selectedNode.id ? { ...n, name: newName } : n
                      ),
                    }))
                  }}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Teks Pesan / Pertanyaan</Label>
                <Textarea
                  rows={4}
                  value={
                    (selectedNode.config.question as string) ||
                    (selectedNode.config.text as string) ||
                    (selectedNode.config.bodyText as string) ||
                    ""
                  }
                  onChange={(e) => {
                    const newText = e.target.value
                    const key =
                      selectedNode.type === "prompt_input" ? "question" : "text"
                    const newConfig = { ...selectedNode.config, [key]: newText }
                    setSelectedNode({ ...selectedNode, config: newConfig })
                    setWorkflow((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, config: newConfig }
                          : n
                      ),
                    }))
                  }}
                  className="text-xs"
                />
              </div>

              {selectedNode.type === "prompt_input" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama Variabel yang Disimpan</Label>
                  <Input
                    value={
                      (selectedNode.config.captureVariable as string) || ""
                    }
                    onChange={(e) => {
                      const newVar = e.target.value
                      const newConfig = {
                        ...selectedNode.config,
                        captureVariable: newVar,
                      }
                      setSelectedNode({ ...selectedNode, config: newConfig })
                      setWorkflow((prev) => ({
                        ...prev,
                        nodes: prev.nodes.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, config: newConfig }
                            : n
                        ),
                      }))
                    }}
                    className="h-8 text-xs"
                    placeholder="misal: nama_pelanggan"
                  />
                </div>
              )}

              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-4 h-8 w-full gap-1.5 text-xs"
                onClick={() => {
                  setWorkflow((prev) => ({
                    ...prev,
                    nodes: prev.nodes.filter((n) => n.id !== selectedNode.id),
                    edges: prev.edges.filter(
                      (e) =>
                        e.sourceNodeId !== selectedNode.id &&
                        e.targetNodeId !== selectedNode.id
                    ),
                  }))
                  setSelectedNode(null)
                  toast.success("Node berhasil dihapus.")
                }}
              >
                <Trash size={14} />
                <span>Hapus Node</span>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Live WhatsApp Chat Simulator Drawer */}
      <Sheet open={isSimOpen} onOpenChange={setIsSimOpen}>
        <SheetContent className="flex flex-col justify-between bg-zinc-950 text-white sm:max-w-md">
          <div>
            <SheetHeader className="border-b border-zinc-800 pb-3">
              <SheetTitle className="flex items-center gap-2 text-base text-white">
                <WhatsappLogo
                  size={20}
                  className="text-emerald-500"
                  weight="fill"
                />
                <span>Simulator WhatsApp Live</span>
              </SheetTitle>
            </SheetHeader>

            <div className="max-h-[70vh] flex-1 space-y-2 overflow-y-auto py-4">
              {simChat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t border-zinc-800 pt-3">
            <Input
              placeholder="Ketik balasan untuk tes alur..."
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSimReply()}
              className="h-8 border-zinc-700 bg-zinc-900 text-xs text-white"
            />
            <Button
              size="sm"
              type="button"
              onClick={handleSimReply}
              className="h-8 w-8 shrink-0 bg-emerald-600 p-0 hover:bg-emerald-700"
            >
              <PaperPlaneRight size={14} />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
