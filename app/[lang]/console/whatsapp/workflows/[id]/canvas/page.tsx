"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import {
  Sparkle,
  FloppyDisk,
  Play,
  ArrowLeft,
  Trash,
  WhatsappLogo,
  PaperPlaneRight,
  Question,
  ChatCircleText,
  Brain,
  GitBranch,
  Globe,
  SlidersHorizontal,
  ArrowsClockwise,
  DownloadSimple,
  UploadSimple,
  Star,
} from "@phosphor-icons/react"
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
  SheetDescription,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
} from "@/modules/whatsapp/workflow/workflow.schema"
import { WorkflowDefinitionSchema } from "@/modules/whatsapp/workflow/workflow.schema"
import { WorkflowNodeComponent } from "./workflow-node"

const initialNodesSample: WorkflowNode[] = [
  {
    id: "node_start",
    type: "send_message",
    name: "Pesan Pembuka",
    position: { x: 250, y: 50 },
    config: {
      text: "Halo! Selamat datang di layanan WhatsApp resmi kami. Ada yang bisa kami bantu hari ini?",
    },
  },
  {
    id: "node_ask_name",
    type: "prompt_input",
    name: "Tanya Nama Pelanggan",
    position: { x: 250, y: 220 },
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
    position: { x: 250, y: 400 },
    config: {
      prompt:
        "Sapa pengguna dengan nama {{variables.customer_name}} lalu tanyakan kategori kendala atau produk yang diminati.",
      captureVariable: "ai_recommendation",
    },
  },
]

const initialEdgesSample: WorkflowEdge[] = [
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
]

export default function WhatsappWorkflowCanvasPage() {
  const params = useParams()
  const router = useRouter()
  const lang = (params?.lang as string) || "en"
  const workflowId = params?.id as string

  // Top level state
  const [workflowMeta, setWorkflowMeta] = useState(() => ({
    id: workflowId === "new" ? "wf_new" : workflowId,
    name: "Alur Bot WhatsApp Baru",
    description: "Alur otomatis customer service, kuis & penjualan cerdas",
    isActive: true,
    isDefault: false,
    trigger: {
      id: "trig_1",
      type: "keyword_match",
      keywords: ["halo", "menu", "bantuan", "info"],
    },
  }))
  const [devices, setDevices] = useState<
    { id: string; name: string; phoneNumber: string }[]
  >([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [, setLoadingInitial] = useState(true)

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // AI Copilot
  const [copilotPrompt, setCopilotPrompt] = useState("")
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)

  // Simulator
  const [isSimOpen, setIsSimOpen] = useState(false)
  const [simMessages, setSimMessages] = useState<
    { sender: "bot" | "user"; text: string }[]
  >([])
  const [simInput, setSimInput] = useState("")

  const nodeTypes = useMemo(() => ({ custom: WorkflowNodeComponent }), [])

  // Helper convert schema node to xyflow node
  const toXyFlowNode = useCallback(
    (node: WorkflowNode, index: number): Node => ({
      id: node.id,
      type: "custom",
      position: node.position || { x: 250, y: index * 180 + 50 },
      data: {
        id: node.id,
        name: node.name,
        type: node.type,
        config: node.config || {},
      },
    }),
    []
  )

  // Helper convert schema edge to xyflow edge
  const toXyFlowEdge = useCallback(
    (edge: WorkflowEdge): Edge => ({
      id: edge.id,
      source: edge.sourceNodeId,
      sourceHandle: edge.sourcePort || "default",
      target: edge.targetNodeId,
      type: "smoothstep",
      animated: true,
      label:
        edge.sourcePort === "true"
          ? "TRUE"
          : edge.sourcePort === "false"
            ? "FALSE"
            : undefined,
      style: {
        stroke:
          edge.sourcePort === "true"
            ? "#10b981"
            : edge.sourcePort === "false"
              ? "#f43f5e"
              : "#0284c7",
        strokeWidth: 2,
      },
    }),
    []
  )

  // 1. Load Devices & Existing Workflow data
  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoadingInitial(true)
      try {
        // Fetch devices
        const devRes = await eden.api.whatsapp.devices.get()
        if (
          devRes.data &&
          "devices" in devRes.data &&
          Array.isArray(devRes.data.devices)
        ) {
          if (mounted) {
            const devList = devRes.data.devices.map((d) => ({
              id: d.id,
              name: d.name || `WhatsApp (${d.phoneNumber})`,
              phoneNumber: d.phoneNumber,
            }))
            setDevices(devList)
            setSelectedDeviceId(
              (prev) => prev || (devList.length > 0 ? devList[0].id : "")
            )
          }
        }

        // If existing workflow, fetch from GET /api/whatsapp/workflows/:id
        if (workflowId && workflowId !== "new") {
          try {
            const wfRes = await eden.api.whatsapp.workflows[workflowId].get()
            if (wfRes.data && "data" in wfRes.data && wfRes.data.data) {
              const wf = wfRes.data.data as WorkflowDefinition & {
                deviceId?: string
              }
              if (mounted) {
                setWorkflowMeta({
                  id: wf.id,
                  name: wf.name || "Alur WhatsApp",
                  description: wf.description || "",
                  isActive: wf.isActive ?? true,
                  isDefault: wf.isDefault ?? false,
                  trigger: wf.trigger || {
                    id: "trig_1",
                    type: "keyword_match",
                    keywords: [],
                  },
                })
                if (wf.deviceId) {
                  setSelectedDeviceId(wf.deviceId)
                }
                if (Array.isArray(wf.nodes) && wf.nodes.length > 0) {
                  setNodes(wf.nodes.map(toXyFlowNode))
                  if (Array.isArray(wf.edges)) {
                    setEdges(wf.edges.map(toXyFlowEdge))
                  }
                  return
                }
              }
            }
          } catch (e) {
            console.warn(
              "[workflow] failed to load specific workflow, using defaults:",
              e
            )
          }
        }

        // Default initial nodes
        if (mounted) {
          setNodes(initialNodesSample.map(toXyFlowNode))
          setEdges(initialEdgesSample.map(toXyFlowEdge))
        }
      } catch (err) {
        console.error("Error loading workflow canvas:", err)
      } finally {
        if (mounted) setLoadingInitial(false)
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [workflowId, toXyFlowNode, toXyFlowEdge, setNodes, setEdges])

  // Connection Handler
  const onConnect = useCallback(
    (params: Connection) => {
      const isTrue = params.sourceHandle === "true"
      const isFalse = params.sourceHandle === "false"

      const newEdge: Edge = {
        ...params,
        id: `e_${params.source}_${params.sourceHandle || "def"}_${params.target}`,
        type: "smoothstep",
        animated: true,
        label: isTrue ? "TRUE" : isFalse ? "FALSE" : undefined,
        style: {
          stroke: isTrue ? "#10b981" : isFalse ? "#f43f5e" : "#0284c7",
          strokeWidth: 2,
        },
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  // Node selection for Drawer Inspector
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return nodes.find((n) => n.id === selectedNodeId) || null
  }, [nodes, selectedNodeId])

  // Add Node from Palette
  const handleAddNode = useCallback(
    (type: WorkflowNodeType) => {
      const count = nodes.length + 1
      const id = `node_${Date.now().toString(36)}`

      let defaultName = "Langkah Baru"
      let defaultConfig: Record<string, unknown> = {}

      if (type === "send_message") {
        defaultName = `Kirim Pesan #${count}`
        defaultConfig = { text: "Tulis pesan WhatsApp di sini..." }
      } else if (type === "prompt_input") {
        defaultName = `Tanya Input #${count}`
        defaultConfig = {
          question: "Apa kebutuhan Anda?",
          captureVariable: `var_${count}`,
          validation: { type: "text" },
        }
      } else if (type === "ai_generate") {
        defaultName = `AI Generator #${count}`
        defaultConfig = {
          prompt: "Jawab pertanyaan pengguna secara sopan dan informatif.",
          captureVariable: `ai_output_${count}`,
        }
      } else if (type === "condition") {
        defaultName = `Percabangan / If-Else #${count}`
        defaultConfig = {
          leftOperand: "{{variables.customer_input}}",
          operator: "equals",
          rightOperand: "1",
        }
      } else if (type === "http_request") {
        defaultName = `HTTP Webhook #${count}`
        defaultConfig = {
          method: "GET",
          url: "https://api.example.com/data",
          captureVariable: `http_res_${count}`,
        }
      } else if (type === "send_interactive") {
        defaultName = `Tombol Pilihan #${count}`
        defaultConfig = {
          bodyText: "Silakan pilih salah satu opsi di bawah ini:",
          buttons: [
            { id: "btn_1", title: "Layanan Pelanggan" },
            { id: "btn_2", title: "Cek Status Pesanan" },
          ],
        }
      }

      // Position nicely below the last node or staggered
      const lastNode = nodes[nodes.length - 1]
      const position = lastNode
        ? { x: lastNode.position.x, y: lastNode.position.y + 190 }
        : { x: 250, y: 100 }

      const newNode: Node = {
        id,
        type: "custom",
        position,
        data: {
          id,
          name: defaultName,
          type,
          config: defaultConfig,
        },
      }

      setNodes((nds) => [...nds, newNode])
      setSelectedNodeId(id)
      toast.success(`Node '${defaultName}' ditambahkan ke canvas`)
    },
    [nodes, setNodes]
  )

  // Update selected node config in state
  const handleUpdateSelectedNode = useCallback(
    (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      if (!selectedNodeId) return
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNodeId) {
            const currentData = n.data as unknown as WorkflowNode
            return {
              ...n,
              data: {
                ...currentData,
                config: updater(currentData.config || {}),
              },
            }
          }
          return n
        })
      )
    },
    [selectedNodeId, setNodes]
  )

  const handleUpdateSelectedNodeName = useCallback(
    (name: string) => {
      if (!selectedNodeId) return
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === selectedNodeId) {
            const currentData = n.data as unknown as WorkflowNode
            return {
              ...n,
              data: {
                ...currentData,
                name,
              },
            }
          }
          return n
        })
      )
    },
    [selectedNodeId, setNodes]
  )

  // Delete node
  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      )
    )
    setSelectedNodeId(null)
    toast.info("Node dihapus dari alur")
  }, [selectedNodeId, setNodes, setEdges])

  // AI Copilot Generator
  const handleGenerateAi = async () => {
    if (!copilotPrompt.trim()) {
      toast.error("Tuliskan deskripsi bot alur yang diinginkan.")
      return
    }
    setIsGeneratingAi(true)
    try {
      const res = await eden.api.console.ai.workflows.generate.post({
        prompt: copilotPrompt,
      })
      if (res.data?.ok && "workflow" in res.data && res.data.workflow) {
        const wf = res.data.workflow
        setWorkflowMeta((prev) => ({
          ...prev,
          name: wf.name || prev.name,
          description: wf.description || prev.description,
          trigger: wf.trigger || prev.trigger,
        }))

        // Transform generated nodes & edges
        if (Array.isArray(wf.nodes)) {
          const generatedNodes = (wf.nodes as WorkflowNode[]).map(
            (n, idx: number) => ({
              id: n.id,
              type: "custom",
              position: { x: 250, y: idx * 190 + 50 },
              data: {
                id: n.id,
                name: n.name,
                type: n.type,
                config: n.config || {},
              },
            })
          )
          setNodes(generatedNodes)

          if (Array.isArray(wf.edges) && wf.edges.length > 0) {
            setEdges((wf.edges as WorkflowEdge[]).map(toXyFlowEdge))
          } else {
            // Build default linear edges if none
            const autoEdges: Edge[] = []
            for (let i = 0; i < generatedNodes.length - 1; i++) {
              autoEdges.push({
                id: `e_${generatedNodes[i].id}_${generatedNodes[i + 1].id}`,
                source: generatedNodes[i].id,
                sourceHandle: "default",
                target: generatedNodes[i + 1].id,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#0284c7", strokeWidth: 2 },
              })
            }
            setEdges(autoEdges)
          }
        }
        toast.success("Workflow berhasil di-generate dengan AI Copilot!")
      } else {
        toast.error("Gagal generate alur: respons AI tidak valid.")
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Koneksi gagal"
      toast.error(`Error AI Copilot: ${errorMsg}`)
    } finally {
      setIsGeneratingAi(false)
    }
  }

  // Save Workflow
  const handleSave = async () => {
    if (!selectedDeviceId) {
      toast.error("Pilih Perangkat WhatsApp tujuan sebelum menyimpan.")
      return
    }

    setSaving(true)
    try {
      // Reconstruct clean WorkflowDefinition for backend
      const exportNodes: WorkflowNode[] = nodes.map((n) => {
        const d = n.data as unknown as WorkflowNode
        return {
          id: n.id,
          name: d.name || "Langkah Alur",
          type: d.type || "send_message",
          config: d.config || {},
          position: {
            x: Math.round(n.position.x),
            y: Math.round(n.position.y),
          },
        }
      })

      const exportEdges: WorkflowEdge[] = edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        sourcePort: (e.sourceHandle as string) || "default",
        targetNodeId: e.target,
      }))

      const payload: WorkflowDefinition = {
        id: workflowMeta.id,
        organizationId: "org_current",
        name: workflowMeta.name,
        description: workflowMeta.description,
        isActive: workflowMeta.isActive,
        isDefault: workflowMeta.isDefault,
        trigger: workflowMeta.trigger as WorkflowDefinition["trigger"],
        nodes: exportNodes,
        edges: exportEdges,
        version: 1,
      }
      const res = await eden.api.whatsapp.workflows.save.post({
        deviceId: selectedDeviceId,
        workflow: payload,
      })

      if (res.data && "ok" in res.data && res.data.ok) {
        toast.success("Alur Bot WhatsApp berhasil disimpan & aktif!")
        router.push(`/${lang}/console/whatsapp/workflows`)
      } else {
        const err =
          res.data && "error" in res.data ? res.data.error : "Unknown error"
        toast.error(`Gagal simpan: ${err}`)
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Koneksi gagal"
      toast.error(`Gagal menyimpan alur: ${errorMsg}`)
    } finally {
      setSaving(false)
    }
  }
  // Export JSON functionality
  const handleExportJson = () => {
    try {
      const exportNodes: WorkflowNode[] = nodes.map((n) => {
        const d = n.data as unknown as WorkflowNode
        return {
          id: n.id,
          name: d.name || "Langkah Alur",
          type: d.type || "send_message",
          config: d.config || {},
          position: {
            x: Math.round(n.position.x),
            y: Math.round(n.position.y),
          },
        }
      })

      const exportEdges: WorkflowEdge[] = edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        sourcePort: (e.sourceHandle as string) || "default",
        targetNodeId: e.target,
      }))

      const exportData: WorkflowDefinition = {
        id: workflowMeta.id,
        organizationId: "org_current",
        name: workflowMeta.name,
        description: workflowMeta.description,
        isActive: workflowMeta.isActive,
        isDefault: workflowMeta.isDefault,
        trigger: workflowMeta.trigger as WorkflowDefinition["trigger"],
        nodes: exportNodes,
        edges: exportEdges,
        version: 1,
      }

      const jsonStr = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonStr], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const sanitizedName =
        workflowMeta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "workflow"
      a.download = `${sanitizedName}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Workflow berhasil di-export ke JSON!")
    } catch (e: unknown) {
      toast.error(
        `Gagal export JSON: ${e instanceof Error ? e.message : "Error"}`
      )
    }
  }

  // Import JSON functionality
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)
        const validated = WorkflowDefinitionSchema.safeParse(parsed)

        if (!validated.success) {
          toast.error(
            `Format JSON tidak valid: ${validated.error.issues[0]?.message || "Schema error"}`
          )
          return
        }

        const data = validated.data
        setWorkflowMeta((prev) => ({
          ...prev,
          name: data.name || prev.name,
          description: data.description || prev.description,
          isActive: data.isActive ?? prev.isActive,
          isDefault: data.isDefault ?? prev.isDefault,
          trigger: data.trigger || prev.trigger,
        }))

        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes.map(toXyFlowNode))
        }
        if (Array.isArray(data.edges)) {
          setEdges(data.edges.map(toXyFlowEdge))
        }

        toast.success(`Workflow "${data.name}" berhasil di-import!`)
      } catch (err: unknown) {
        toast.error(
          `Gagal membaca file JSON: ${err instanceof Error ? err.message : "Invalid JSON"}`
        )
      } finally {
        e.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  // Simulator test
  const handleStartSim = () => {
    setIsSimOpen(true)
    if (nodes.length > 0) {
      const first = nodes[0].data as unknown as WorkflowNode
      const startText =
        (first?.config?.text as string) ||
        (first?.config?.question as string) ||
        `Halo! Alur '${workflowMeta.name}' dimulai.`
      setSimMessages([{ sender: "bot", text: startText }])
    } else {
      setSimMessages([{ sender: "bot", text: "Alur masih kosong." }])
    }
  }

  const handleSendSimMessage = () => {
    if (!simInput.trim()) return
    const userText = simInput.trim()
    setSimMessages((prev) => [...prev, { sender: "user", text: userText }])
    setSimInput("")

    setTimeout(() => {
      setSimMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `[Bot Respon Otomatis]: Input '${userText}' diterima dan variabel berhasil disimpan.`,
        },
      ])
    }, 600)
  }

  const selectedNodeData = selectedNode?.data as unknown as
    | WorkflowNode
    | undefined

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-1 flex-col gap-4 p-6 pt-0">
      {/* Top Bar Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href={`/${lang}/console/whatsapp/workflows`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <Input
                value={workflowMeta.name}
                onChange={(e) =>
                  setWorkflowMeta((prev) => ({ ...prev, name: e.target.value }))
                }
                className="h-8 w-64 text-base font-bold tracking-tight md:w-80"
                placeholder="Nama Alur Bot"
              />
              <Badge
                variant="outline"
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
              >
                Visual Graph
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Drag node untuk menyusun posisi, hubungkan titik port untuk
              branching alur (True/False/Default).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Device Selector */}
          <div className="w-56">
            <Select
              value={selectedDeviceId}
              onValueChange={setSelectedDeviceId}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Pilih No. WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <WhatsappLogo className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{d.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Default Workflow Toggle */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 text-xs">
            <Star
              className={`h-3.5 w-3.5 ${workflowMeta.isDefault ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
              weight={workflowMeta.isDefault ? "fill" : "regular"}
            />
            <span className="text-xs font-medium">Default</span>
            <Switch
              checked={workflowMeta.isDefault}
              onCheckedChange={(checked) =>
                setWorkflowMeta((prev) => ({ ...prev, isDefault: checked }))
              }
              className="scale-75 data-[state=checked]:bg-amber-500"
            />
          </div>

          {/* Export JSON Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <DownloadSimple className="h-3.5 w-3.5" />
            Export JSON
          </Button>

          {/* Import JSON Button */}
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
            <UploadSimple className="h-3.5 w-3.5" />
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSim}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <Play className="h-3.5 w-3.5 text-primary" weight="fill" />
            Simulasi Test
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <FloppyDisk className="h-3.5 w-3.5" />
            {saving ? "Menyimpan..." : "Simpan & Terapkan"}
          </Button>
        </div>
      </div>

      {/* AI Copilot Prompt Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-sm backdrop-blur">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkle className="h-4 w-4" weight="fill" />
        </div>
        <Input
          value={copilotPrompt}
          onChange={(e) => setCopilotPrompt(e.target.value)}
          placeholder="AI Copilot: contoh 'Buat alur tanya kendala teknis lalu jika urgent hubungkan ke admin CS'..."
          className="h-8 border-none bg-transparent text-xs shadow-none focus-visible:ring-0"
          onKeyDown={(e) => e.key === "Enter" && handleGenerateAi()}
        />
        <Button
          size="sm"
          onClick={handleGenerateAi}
          disabled={isGeneratingAi}
          className="h-8 shrink-0 gap-1 text-xs"
        >
          {isGeneratingAi ? (
            <ArrowsClockwise className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkle className="h-3.5 w-3.5" weight="fill" />
          )}
          <span>{isGeneratingAi ? "Generating..." : "Generate AI"}</span>
        </Button>
      </div>

      {/* Canvas Area with Left Palette Toolbar */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-inner">
        {/* Node Palette Bar (Floating Left) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 rounded-xl border border-border/80 bg-card/90 p-2 shadow-lg backdrop-blur">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Tambah Node
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("send_message")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-sky-500/50 hover:bg-sky-500/10"
          >
            <ChatCircleText className="h-4 w-4 text-sky-400" weight="duotone" />
            <span>Kirim Pesan</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("prompt_input")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-emerald-500/50 hover:bg-emerald-500/10"
          >
            <Question className="h-4 w-4 text-emerald-400" weight="duotone" />
            <span>Tanya Input</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("condition")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-amber-500/50 hover:bg-amber-500/10"
          >
            <GitBranch className="h-4 w-4 text-amber-400" weight="duotone" />
            <span>If-Else Cabang</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("send_interactive")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-indigo-500/50 hover:bg-indigo-500/10"
          >
            <SlidersHorizontal
              className="h-4 w-4 text-indigo-400"
              weight="duotone"
            />
            <span>Tombol Pilihan</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("ai_generate")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-purple-500/50 hover:bg-purple-500/10"
          >
            <Brain className="h-4 w-4 text-purple-400" weight="duotone" />
            <span>AI Response</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("http_request")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-pink-500/50 hover:bg-pink-500/10"
          >
            <Globe className="h-4 w-4 text-pink-400" weight="duotone" />
            <span>HTTP Webhook</span>
          </Button>
        </div>

        {/* React Flow Interactive Graph */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
          minZoom={0.2}
          maxZoom={1.5}
          className="bg-zinc-950"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#3f3f46"
          />
          <Controls className="!border-border !bg-card !fill-foreground" />
          <MiniMap
            nodeColor="#3b82f6"
            maskColor="rgba(0, 0, 0, 0.7)"
            className="!overflow-hidden !rounded-lg !border-border !bg-card"
          />
        </ReactFlow>
      </div>

      {/* Redesigned Node Configuration Drawer (Fix Spacing, Padding, and Complete Forms) */}
      <Sheet
        open={Boolean(selectedNode)}
        onOpenChange={(open) => !open && setSelectedNodeId(null)}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col border-l border-border bg-card p-0 text-card-foreground shadow-2xl sm:max-w-xl"
        >
          {/* Drawer Header */}
          <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <SheetTitle className="text-lg font-bold">
                  Konfigurasi Node
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Sesuaikan parameter, teks, dan variabel untuk langkah ini.
                </SheetDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {selectedNodeData?.type || ""}
              </Badge>
            </div>
          </SheetHeader>

          {/* Scrollable Form Body with Generous Padding */}
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {selectedNodeData && (
              <>
                {/* Node Title */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Nama Label Langkah
                  </Label>
                  <Input
                    value={selectedNodeData.name || ""}
                    onChange={(e) =>
                      handleUpdateSelectedNodeName(e.target.value)
                    }
                    placeholder="Nama langkah alur"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Form fields by Type */}
                {selectedNodeData.type === "send_message" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Teks Pesan WhatsApp
                      </Label>
                      <Textarea
                        rows={4}
                        value={(selectedNodeData.config?.text as string) || ""}
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            text: e.target.value,
                          }))
                        }
                        placeholder="Halo, terima kasih sudah menghubungi kami..."
                        className="text-sm leading-relaxed"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Mendukung variabel: {"{{variables.customer_name}}"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Media URL (Opsional)
                      </Label>
                      <Input
                        value={
                          (selectedNodeData.config?.mediaUrl as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            mediaUrl: e.target.value,
                          }))
                        }
                        placeholder="https://example.com/image.jpg"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "prompt_input" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Pertanyaan ke Pengguna
                      </Label>
                      <Textarea
                        rows={3}
                        value={
                          (selectedNodeData.config?.question as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            question: e.target.value,
                          }))
                        }
                        placeholder="Berapa nomor pesanan Anda?"
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Simpan Jawaban ke Variabel
                      </Label>
                      <Input
                        value={
                          (selectedNodeData.config
                            ?.captureVariable as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            captureVariable: e.target.value,
                          }))
                        }
                        placeholder="order_id"
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "condition" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                      💡 Hubungkan titik <strong>TRUE (Hijau)</strong> untuk
                      kondisi terpenuhi, dan <strong>FALSE (Merah)</strong>{" "}
                      untuk alternatif.
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Variabel / Nilai Kiri
                      </Label>
                      <Input
                        value={
                          (selectedNodeData.config?.leftOperand as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            leftOperand: e.target.value,
                          }))
                        }
                        placeholder="{{variables.category}}"
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Operator</Label>
                      <Select
                        value={
                          (selectedNodeData.config?.operator as string) ||
                          "equals"
                        }
                        onValueChange={(val) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            operator: val,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Pilih Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">
                            Sama Dengan (equals)
                          </SelectItem>
                          <SelectItem value="not_equals">
                            Tidak Sama (not_equals)
                          </SelectItem>
                          <SelectItem value="contains">
                            Mengandung Kata (contains)
                          </SelectItem>
                          <SelectItem value="greater_than">
                            Lebih Besar (&gt;)
                          </SelectItem>
                          <SelectItem value="less_than">
                            Lebih Kecil (&lt;)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Nilai Pembanding (Kanan)
                      </Label>
                      <Input
                        value={
                          (selectedNodeData.config?.rightOperand as string) ||
                          ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            rightOperand: e.target.value,
                          }))
                        }
                        placeholder="Contoh: 1 / ya / bantuan"
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "send_interactive" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Teks Pesan Menu
                      </Label>
                      <Textarea
                        rows={3}
                        value={
                          (selectedNodeData.config?.bodyText as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            bodyText: e.target.value,
                          }))
                        }
                        placeholder="Silakan pilih layanan di bawah:"
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Tombol Pilihan (Maks. 3)
                      </Label>
                      {(
                        (selectedNodeData.config?.buttons as Array<{
                          id: string
                          title: string
                        }>) || []
                      ).map((btn, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <Input
                            value={btn.title}
                            onChange={(e) => {
                              const newTitle = e.target.value
                              handleUpdateSelectedNode((cfg) => {
                                const curr =
                                  (cfg.buttons as Array<{
                                    id: string
                                    title: string
                                  }>) || []
                                const updated = [...curr]
                                updated[bIdx] = {
                                  ...updated[bIdx],
                                  title: newTitle,
                                }
                                return { ...cfg, buttons: updated }
                              })
                            }}
                            className="h-8 text-xs"
                            placeholder={`Tombol ${bIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "ai_generate" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        System Prompt / Instruksi AI
                      </Label>
                      <Textarea
                        rows={5}
                        value={
                          (selectedNodeData.config?.prompt as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            prompt: e.target.value,
                          }))
                        }
                        placeholder="Instruksi spesifik cara menjawab WhatsApp pelanggan..."
                        className="font-mono text-sm leading-relaxed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Simpan Hasil AI ke Variabel
                      </Label>
                      <Input
                        value={
                          (selectedNodeData.config
                            ?.captureVariable as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            captureVariable: e.target.value,
                          }))
                        }
                        placeholder="ai_result"
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "http_request" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        HTTP Method
                      </Label>
                      <Select
                        value={
                          (selectedNodeData.config?.method as string) || "GET"
                        }
                        onValueChange={(val) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            method: val,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Endpoint URL
                      </Label>
                      <Input
                        value={(selectedNodeData.config?.url as string) || ""}
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            url: e.target.value,
                          }))
                        }
                        placeholder="https://api.domain.com/webhook"
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Simpan Response Body ke Variabel
                      </Label>
                      <Input
                        value={
                          (selectedNodeData.config
                            ?.captureVariable as string) || ""
                        }
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            captureVariable: e.target.value,
                          }))
                        }
                        placeholder="api_response"
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/20 p-6">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelectedNode}
              className="h-9 gap-1.5 text-xs"
            >
              <Trash className="h-4 w-4" />
              Hapus Node
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setSelectedNodeId(null)}
              className="h-9 px-5 text-xs"
            >
              Selesai Edit
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Simulator Sheet */}
      <Sheet open={isSimOpen} onOpenChange={setIsSimOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-l border-zinc-800 bg-zinc-950 p-6 text-white sm:max-w-md"
        >
          <SheetHeader className="border-b border-zinc-800 pb-4">
            <SheetTitle className="flex items-center gap-2 text-base text-white">
              <WhatsappLogo
                className="h-5 w-5 text-emerald-500"
                weight="fill"
              />
              Simulator WhatsApp Bot
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {simMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                    msg.sender === "user"
                      ? "rounded-br-none bg-emerald-600 text-white"
                      : "rounded-bl-none border border-zinc-700 bg-zinc-800 text-zinc-100"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-800 pt-4">
            <Input
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendSimMessage()}
              placeholder="Ketik balasan pesan..."
              className="h-9 border-zinc-700 bg-zinc-900 text-xs text-white"
            />
            <Button
              size="icon"
              onClick={handleSendSimMessage}
              className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700"
            >
              <PaperPlaneRight className="h-4 w-4" weight="fill" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
