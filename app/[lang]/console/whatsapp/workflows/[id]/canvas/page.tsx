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
  Trash,
  WhatsappLogo,
  PaperPlaneRight,
  Lightning,
  TreeStructure,
  Question,
  ChatCircleText,
  Brain,
  GitBranch,
  Globe,
  SlidersHorizontal,
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
  WorkflowNodeType,
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
    description: "Alur otomatis customer service, kuis & penjualan cerdas",
    isActive: true,
    trigger: {
      id: "trig_1",
      type: "keyword_match",
      keywords: ["halo", "menu", "bantuan", "info"],
    },
    nodes: [
      {
        id: "node_start",
        type: "send_message",
        name: "Pesan Pembuka",
        config: {
          text: "Halo! Selamat datang di layanan WhatsApp resmi kami. Ada yang bisa kami bantu hari ini?",
        },
      },
      {
        id: "node_ask_name",
        type: "prompt_input",
        name: "Tanya Nama Pelanggan",
        config: {
          question: "Boleh kami tahu nama lengkap Anda?",
          captureVariable: "customer_name",
          validation: { type: "text" },
        },
      },
      {
        id: "node_ai_agent",
        type: "ai_generate",
        name: "AI Asisten Solusi",
        config: {
          prompt:
            "Sapa pengguna dengan nama {{variables.customer_name}} lalu tanyakan kategori kendala atau produk yang diminati.",
          captureVariable: "ai_recommendation",
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
      {
        id: "edge_2",
        sourceNodeId: "node_ask_name",
        sourcePort: "default",
        targetNodeId: "node_ai_agent",
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
  const [simVariables, setSimVariables] = useState<Record<string, string>>({})
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
          "AI Copilot berhasil menyusun seluruh node & edges di canvas!"
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

  // Add specific node type
  const handleAddNode = (type: WorkflowNodeType) => {
    const timestamp = Date.now()
    let newNode: WorkflowNode

    switch (type) {
      case "prompt_input":
        newNode = {
          id: `node_prompt_${timestamp}`,
          type: "prompt_input",
          name: "Tanya Jawaban User",
          config: {
            question: "Ketik jawaban atau pilihan Anda:",
            captureVariable: `input_${workflow.nodes.length + 1}`,
          },
        }
        break
      case "ai_generate":
        newNode = {
          id: `node_ai_${timestamp}`,
          type: "ai_generate",
          name: "Respon AI Cerdas",
          config: {
            prompt: "Analisis pesan pengguna dan berikan rekomendasi ringkas.",
            captureVariable: `ai_reply_${workflow.nodes.length + 1}`,
          },
        }
        break
      case "condition":
        newNode = {
          id: `node_cond_${timestamp}`,
          type: "condition",
          name: "Percabangan Logika",
          config: {
            leftOperand: `variables.input_${workflow.nodes.length}`,
            operator: "contains",
            rightOperand: "ya",
          },
        }
        break
      case "http_request":
        newNode = {
          id: `node_http_${timestamp}`,
          type: "http_request",
          name: "Integrasi API / Webhook",
          config: {
            url: "https://api.example.com/check",
            method: "POST",
            timeoutMs: 5000,
          },
        }
        break
      case "send_interactive":
        newNode = {
          id: `node_interactive_${timestamp}`,
          type: "send_interactive",
          name: "Tombol Pilihan Interaktif",
          config: {
            bodyText: "Silakan pilih salah satu opsi di bawah ini:",
            buttons: [
              { id: "btn_1", title: "Opsi 1" },
              { id: "btn_2", title: "Opsi 2" },
            ],
          },
        }
        break
      default:
        newNode = {
          id: `node_msg_${timestamp}`,
          type: "send_message",
          name: "Kirim Pesan WhatsApp",
          config: { text: "Tuliskan pesan Anda di sini." },
        }
    }

    setWorkflow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      edges: [
        ...prev.edges,
        {
          id: `edge_${timestamp}`,
          sourceNodeId: prev.nodes[prev.nodes.length - 1]?.id || newNode.id,
          sourcePort: "default",
          targetNodeId: newNode.id,
        },
      ],
    }))
    setSelectedNode(newNode)
    toast.success(`Node ${newNode.name} ditambahkan ke canvas.`)
  }

  // Simulator test
  const handleStartSim = () => {
    setIsSimOpen(true)
    setSimVariables({})
    if (workflow.nodes.length > 0) {
      const first = workflow.nodes[0]
      const text =
        (first.config.text as string) ||
        (first.config.question as string) ||
        (first.config.bodyText as string) ||
        (first.config.prompt as string) ||
        "Halo! Alur dimulai."
      setSimChat([{ role: "bot", text }])
    }
  }

  const handleSimReply = () => {
    if (!simInput.trim()) return
    const userMsg = simInput.trim()
    const updatedChat = [...simChat, { role: "user" as const, text: userMsg }]
    const userCount = updatedChat.filter((m) => m.role === "user").length
    const currentVars = { ...simVariables }

    // Check if previous node captures variable
    const prevNodeIndex = userCount - 1
    if (
      workflow.nodes.length > prevNodeIndex &&
      workflow.nodes[prevNodeIndex]?.config.captureVariable
    ) {
      const varName = workflow.nodes[prevNodeIndex].config
        .captureVariable as string
      currentVars[varName] = userMsg
      setSimVariables(currentVars)
    }

    if (workflow.nodes.length > userCount) {
      const nextNode = workflow.nodes[userCount]
      let reply =
        (nextNode.config.text as string) ||
        (nextNode.config.question as string) ||
        (nextNode.config.bodyText as string) ||
        (nextNode.config.prompt as string) ||
        "Pesan selanjutnya"

      // Replace template variables
      for (const [k, v] of Object.entries(currentVars)) {
        reply = reply.replaceAll(`{{variables.${k}}}`, v)
      }
      reply = reply.replace(/\{\{variables\.\w+\}\}/g, userMsg)

      updatedChat.push({ role: "bot", text: reply })
    } else {
      updatedChat.push({
        role: "bot",
        text: `Terima kasih! Pesan Anda "${userMsg}" telah diproses sampai akhir alur.`,
      })
    }

    setSimChat(updatedChat)
    setSimInput("")
  }

  // Node Type Badge & Icon Helper
  const getNodeMeta = (type: WorkflowNodeType) => {
    switch (type) {
      case "prompt_input":
        return {
          icon: <Question size={14} className="text-amber-400" />,
          color: "border-amber-500/40 text-amber-400",
        }
      case "ai_generate":
        return {
          icon: <Brain size={14} className="text-purple-400" />,
          color: "border-purple-500/40 text-purple-400",
        }
      case "condition":
        return {
          icon: <GitBranch size={14} className="text-blue-400" />,
          color: "border-blue-500/40 text-blue-400",
        }
      case "http_request":
        return {
          icon: <Globe size={14} className="text-rose-400" />,
          color: "border-rose-500/40 text-rose-400",
        }
      case "send_interactive":
        return {
          icon: <SlidersHorizontal size={14} className="text-cyan-400" />,
          color: "border-cyan-500/40 text-cyan-400",
        }
      default:
        return {
          icon: <ChatCircleText size={14} className="text-emerald-400" />,
          color: "border-emerald-500/40 text-emerald-400",
        }
    }
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
                Interactive Canvas
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
            placeholder="Contoh: Rancang bot tanya nama, keluhan, validasi percabangan lalu kirimkan solusi AI..."
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
      <div className="relative min-h-[540px] flex-1 overflow-auto rounded-xl border border-border bg-zinc-950/90 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] p-6">
        {/* Canvas Toolbar / Node Palette */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <TreeStructure size={16} />
            <span>
              Node Graph ({workflow.nodes.length} Nodes &amp;{" "}
              {workflow.edges.length} Edges)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => handleAddNode("send_message")}
            >
              <ChatCircleText size={12} className="text-emerald-400" />
              <span>+ Pesan</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => handleAddNode("prompt_input")}
            >
              <Question size={12} className="text-amber-400" />
              <span>+ Tanya Input</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => handleAddNode("ai_generate")}
            >
              <Brain size={12} className="text-purple-400" />
              <span>+ AI LLM</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => handleAddNode("condition")}
            >
              <GitBranch size={12} className="text-blue-400" />
              <span>+ Kondisi Branch</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800"
              onClick={() => handleAddNode("http_request")}
            >
              <Globe size={12} className="text-rose-400" />
              <span>+ API Webhook</span>
            </Button>
          </div>
        </div>

        {/* Visual Node Flow Layout */}
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Trigger Node */}
          <div className="w-88 rounded-lg border border-emerald-500/40 bg-zinc-900 p-3.5 shadow-lg">
            <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
                ⚡ Trigger Inbound Event
              </span>
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-[9px] text-emerald-400"
              >
                {workflow.trigger.type}
              </Badge>
            </div>
            <p className="text-xs font-medium text-zinc-200">
              Kata Kunci:{" "}
              {workflow.trigger.keywords?.join(", ") || "Semua Pesan Masuk"}
            </p>
          </div>

          {/* Connectors & Nodes */}
          {workflow.nodes.map((node, index) => {
            const meta = getNodeMeta(node.type)
            return (
              <div key={node.id} className="flex flex-col items-center gap-3">
                {/* Connector Edge Arrow */}
                <div className="flex flex-col items-center">
                  <div className="h-6 w-0.5 bg-emerald-500/50" />
                  <div className="h-2 w-2 rotate-45 border-r-2 border-b-2 border-emerald-500" />
                </div>

                {/* Node Card Box */}
                <div
                  onClick={() => setSelectedNode(node)}
                  className={`w-88 cursor-pointer rounded-lg border bg-zinc-900 p-3.5 shadow-md transition hover:border-emerald-500/60 ${
                    selectedNode?.id === node.id
                      ? "border-emerald-500 ring-1 ring-emerald-500"
                      : "border-zinc-800"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">
                        {index + 1}
                      </span>
                      {meta.icon}
                      <span className="text-xs font-semibold text-zinc-100">
                        {node.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${meta.color}`}
                    >
                      {node.type}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-xs text-zinc-400">
                    {(node.config.question as string) ||
                      (node.config.text as string) ||
                      (node.config.bodyText as string) ||
                      (node.config.prompt as string) ||
                      (node.config.url as string) ||
                      `Logika: ${String(node.config.leftOperand || "")} ${String(node.config.operator || "")} ${String(node.config.rightOperand || "")}`}
                  </p>
                </div>
              </div>
            )
          })}
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

              {/* Dynamic Field per node type */}
              {(selectedNode.type === "send_message" ||
                selectedNode.type === "prompt_input") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {selectedNode.type === "prompt_input"
                      ? "Teks Pertanyaan"
                      : "Teks Pesan"}
                  </Label>
                  <Textarea
                    rows={4}
                    value={
                      (selectedNode.config.question as string) ||
                      (selectedNode.config.text as string) ||
                      ""
                    }
                    onChange={(e) => {
                      const newText = e.target.value
                      const key =
                        selectedNode.type === "prompt_input"
                          ? "question"
                          : "text"
                      const newConfig = {
                        ...selectedNode.config,
                        [key]: newText,
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
                    className="text-xs"
                  />
                </div>
              )}

              {selectedNode.type === "ai_generate" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Prompt AI Task</Label>
                  <Textarea
                    rows={4}
                    value={(selectedNode.config.prompt as string) || ""}
                    onChange={(e) => {
                      const newConfig = {
                        ...selectedNode.config,
                        prompt: e.target.value,
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
                    className="text-xs"
                  />
                </div>
              )}

              {selectedNode.type === "condition" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Variabel Target (Left Operand)
                    </Label>
                    <Input
                      value={(selectedNode.config.leftOperand as string) || ""}
                      onChange={(e) => {
                        const newConfig = {
                          ...selectedNode.config,
                          leftOperand: e.target.value,
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
                      placeholder="misal: variables.customer_name"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Nilai Pembanding (Right Operand)
                    </Label>
                    <Input
                      value={(selectedNode.config.rightOperand as string) || ""}
                      onChange={(e) => {
                        const newConfig = {
                          ...selectedNode.config,
                          rightOperand: e.target.value,
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
                      placeholder="misal: ya"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === "http_request" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Webhook / Endpoint URL</Label>
                  <Input
                    value={(selectedNode.config.url as string) || ""}
                    onChange={(e) => {
                      const newConfig = {
                        ...selectedNode.config,
                        url: e.target.value,
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
                    placeholder="https://api.domain.com/webhook"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              {/* Capture Variable Field */}
              {(selectedNode.type === "prompt_input" ||
                selectedNode.type === "ai_generate") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Simpan ke Nama Variabel</Label>
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
                    placeholder="misal: jawaban_user"
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
                  toast.success("Node berhasil dihapus dari canvas.")
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
