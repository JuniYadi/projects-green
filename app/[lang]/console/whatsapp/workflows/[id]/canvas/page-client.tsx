"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
  X,
  MapTrifold,
  Lightning,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowTrigger,
} from "@/modules/whatsapp/workflow/workflow.schema"
import { WorkflowDefinitionSchema } from "@/modules/whatsapp/workflow/workflow.schema"
import {
  createSimulatorSession,
  stepSimulatorSession,
} from "@/modules/whatsapp/workflow/workflow-simulator"
import type {
  SimulatorMessage,
  SimulatorSession,
} from "@/modules/whatsapp/workflow/workflow-simulator"
import { WORKFLOW_TEMPLATES } from "@/modules/whatsapp/workflow/workflow-templates"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { WorkflowNodeComponent } from "./workflow-node"
import { DeletableEdge } from "./deletable-edge"
export default function WhatsappWorkflowCanvasPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = (params?.lang as string) || "en"
  const workflowId = params?.id as string
  const locale = resolveLocaleOrDefault(lang)
  const t = getMessages(locale).console.whatsappWorkflows

  const initialNodesSample = useMemo<WorkflowNode[]>(
    () => [
      {
        id: "node_ask_need",
        type: "prompt_input",
        name: "1. Tanya Kebutuhan Bisnis",
        position: { x: 250, y: 50 },
        config: {
          question:
            "Halo! Selamat datang di Konsultan AI PFNApp.\n\nBoleh tahu produk, paket, atau kendala apa yang sedang Anda cari?",
          captureVariable: "customer_need",
          validation: { type: "text" },
        },
      },
      {
        id: "node_http_catalog",
        type: "http_request",
        name: "2. Tarik Data Live (HTTP API)",
        position: { x: 250, y: 240 },
        config: {
          url: "https://pfnapp.my.id/api/demo/whatsapp/pricing",
          method: "GET",
          forwardContext: true,
          timeoutMs: 5000,
        },
      },
      {
        id: "node_ai_sales",
        type: "ai_generate",
        name: "3. AI Sales Decision & Reply",
        position: { x: 250, y: 440 },
        config: {
          prompt:
            "Pertanyaan/Kebutuhan Customer: {{variables.customer_need}}\n\nData Katalog Resmi dari API:\n{{steps.node_http_catalog.body}}\n\nTugas Anda:\n1. Analisis kebutuhan customer.\n2. Putuskan paket yang paling tepat dari data katalog di atas.\n3. Berikan jawaban rekomendasi ramah, cantumkan harga paket, dan ajak untuk mencoba.",
          systemPrompt:
            "Anda adalah AI Sales & Solutions Consultant cerdas dan ramah dari PFNApp.",
          captureVariable: "ai_sales_closing",
          sendReply: true,
        },
      },
    ],
    []
  )

  const initialEdgesSample = useMemo<WorkflowEdge[]>(
    () => [
      {
        id: "edge_1_to_2",
        sourceNodeId: "node_ask_need",
        sourcePort: "default",
        targetNodeId: "node_http_catalog",
      },
      {
        id: "edge_2_to_3",
        sourceNodeId: "node_http_catalog",
        sourcePort: "success",
        targetNodeId: "node_ai_sales",
      },
    ],
    []
  )
  // Top level state
  const [workflowMeta, setWorkflowMeta] = useState<{
    id: string
    name: string
    description: string
    isActive: boolean
    isDefault: boolean
    trigger: WorkflowTrigger
  }>(() => ({
    id: workflowId === "new" ? "wf_new" : workflowId,
    name: "",
    description: "",
    isActive: true,
    isDefault: false,
    trigger: {
      id: "trig_1",
      type: "keyword_match",
      keywords: ["help", "info", "menu"],
    },
  }))
  // Trigger Dialog State
  const [isTriggerDialogOpen, setIsTriggerDialogOpen] = useState(false)
  const [triggerDraftType, setTriggerDraftType] = useState<
    "whatsapp_inbound" | "keyword_match"
  >("keyword_match")
  const [triggerKeywordsInput, setTriggerKeywordsInput] = useState("")

  // AI Copilot State
  const [copilotPrompt, setCopilotPrompt] = useState("")
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [showCopilot, setShowCopilot] = useState(false)
  const [showMiniMap, setShowMiniMap] = useState(false)
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  // Simulator
  const [isSimOpen, setIsSimOpen] = useState(false)
  const [simSession, setSimSession] = useState<SimulatorSession | null>(null)
  const [simInput, setSimInput] = useState("")
  const [devices, setDevices] = useState<
    { id: string; name: string; phoneNumber: string }[]
  >([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [, setLoadingInitial] = useState(true)
  const nodeTypes = useMemo(() => ({ custom: WorkflowNodeComponent }), [])
  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), [])
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const edgeCounterRef = React.useRef(0)

  // Delete node by ID (for card trash icon or keyboard)
  const handleDeleteNodeById = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      )
      setSelectedNodeId((currentSelected) =>
        currentSelected === nodeId ? null : currentSelected
      )
      toast.info(t.inspector.deleteNodeButton)
    },
    [setNodes, setEdges, t]
  )

  // Delete edge by ID (middle X button)
  const handleDeleteEdgeById = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
      toast.info(t.inspector.deleteNodeButton || "Edge deleted")
    },
    [setEdges, t]
  )

  // Delete edges callback (keyboard / selection)
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const deletedIds = new Set(deletedEdges.map((e) => e.id))
      setEdges((eds) => eds.filter((e) => !deletedIds.has(e.id)))
      toast.info(t.inspector.deleteNodeButton || "Edge deleted")
    },
    [setEdges, t]
  )
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
        onDelete: handleDeleteNodeById,
      },
    }),
    [handleDeleteNodeById]
  )
  // Helper convert schema edge to xyflow edge with deletable type and callback
  const toXyFlowEdge = useCallback(
    (edge: WorkflowEdge): Edge => {
      const isTrue = edge.sourcePort === "true"
      const isFalse = edge.sourcePort === "false"
      const edgeLabel = isTrue ? "TRUE" : isFalse ? "FALSE" : undefined

      return {
        id: edge.id,
        source: edge.sourceNodeId,
        sourceHandle: edge.sourcePort || "default",
        target: edge.targetNodeId,
        type: "deletable",
        animated: true,
        label: edgeLabel,
        data: {
          onDelete: handleDeleteEdgeById,
          label: edgeLabel,
        },
        style: {
          stroke: isTrue ? "#10b981" : isFalse ? "#f43f5e" : "#0284c7",
          strokeWidth: 2,
        },
      }
    },
    [handleDeleteEdgeById]
  )
  const currentWorkflow = useMemo<WorkflowDefinition>(
    () => ({
      id: workflowMeta.id,
      organizationId: "org_current",
      name: workflowMeta.name,
      description: workflowMeta.description,
      isActive: workflowMeta.isActive,
      isDefault: workflowMeta.isDefault,
      trigger: workflowMeta.trigger,
      nodes: nodes.map((node) => {
        const data = node.data as unknown as WorkflowNode
        return {
          id: node.id,
          name: data.name || t.canvas.nodes.sendMessage,
          type: data.type || "send_message",
          config: data.config || {},
          position: {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
          },
        }
      }),
      edges: edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        sourcePort: edge.sourceHandle || "default",
        targetNodeId: edge.target,
      })),
      version: 1,
    }),
    [edges, nodes, t.canvas.nodes.sendMessage, workflowMeta]
  )

  const templateId = searchParams?.get("template")

  // 1. Load Devices & Existing Workflow data
  useEffect(() => {
    let mounted = true

    async function loadData() {
      if (hasLoadedData) return
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
            const devList = (
              devRes.data.devices as Array<{
                id: string
                name?: string
                phoneNumber: string
              }>
            ).map((d) => ({
              id: d.id,
              name: d.name || d.phoneNumber,
              phoneNumber: d.phoneNumber,
            }))
            setDevices(devList)
            setSelectedDeviceId(
              (prev) => prev || (devList.length > 0 ? devList[0].id : "")
            )
          }
        }

        const template = templateId
          ? WORKFLOW_TEMPLATES.find((item) => item.id === templateId)
          : undefined
        if (workflowId === "new" && template) {
          if (mounted) {
            const workflow = template.workflow
            setWorkflowMeta({
              id: "wf_new",
              name: workflow.name,
              description: workflow.description || "",
              isActive: workflow.isActive,
              isDefault: workflow.isDefault,
              trigger: workflow.trigger,
            })
            setNodes(workflow.nodes.map(toXyFlowNode))
            setEdges(workflow.edges.map(toXyFlowEdge))
          }
          return
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
                  name: wf.name || t.canvas.namePlaceholder,
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
        if (mounted) {
          setLoadingInitial(false)
          setHasLoadedData(true)
        }
      }
    }
    loadData()
    return () => {
      mounted = false
    }
  }, [
    hasLoadedData,
    initialNodesSample,
    initialEdgesSample,
    templateId,
    toXyFlowNode,
    toXyFlowEdge,
    workflowId,
    setNodes,
    setEdges,
    t.canvas.namePlaceholder,
  ])

  // Connection Handler (creates deletable custom edge with middle X button)
  const onConnect = useCallback(
    (params: Connection) => {
      const isTrue = params.sourceHandle === "true"
      const isFalse = params.sourceHandle === "false"
      const edgeLabel = isTrue ? "TRUE" : isFalse ? "FALSE" : undefined
      edgeCounterRef.current += 1
      const edgeId = `e_${params.source}_${params.sourceHandle || "def"}_${params.target}_${edgeCounterRef.current}_${Date.now()}`

      const newEdge: Edge = {
        ...params,
        id: edgeId,
        type: "deletable",
        animated: true,
        label: edgeLabel,
        data: {
          onDelete: handleDeleteEdgeById,
          label: edgeLabel,
        },
        style: {
          stroke: isTrue ? "#10b981" : isFalse ? "#f43f5e" : "#0284c7",
          strokeWidth: 2,
        },
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges, handleDeleteEdgeById]
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

      let defaultName = t.canvas.addNodeHeader
      let defaultConfig: Record<string, unknown> = {}

      if (type === "send_message") {
        defaultName = `${t.canvas.nodes.sendMessage} #${count}`
        defaultConfig = { text: t.inspector.messageTextPlaceholder }
      } else if (type === "prompt_input") {
        defaultName = `${t.canvas.nodes.promptInput} #${count}`
        defaultConfig = {
          question: t.inspector.questionPlaceholder,
          captureVariable: `var_${count}`,
          validation: { type: "text" },
        }
      } else if (type === "ai_generate") {
        defaultName = `${t.canvas.nodes.aiGenerate} #${count}`
        defaultConfig = {
          prompt: t.inspector.aiPromptPlaceholder,
          captureVariable: `ai_output_${count}`,
        }
      } else if (type === "condition") {
        defaultName = `${t.canvas.nodes.condition} #${count}`
        defaultConfig = {
          leftOperand: "{{variables.customer_input}}",
          operator: "equals",
          rightOperand: "1",
        }
      } else if (type === "http_request") {
        defaultName = `${t.canvas.nodes.httpRequest} #${count}`
        defaultConfig = {
          method: "GET",
          url: "https://api.example.com/data",
          captureVariable: `http_res_${count}`,
        }
      } else if (type === "send_interactive") {
        defaultName = `${t.canvas.nodes.interactiveButtons} #${count}`
        defaultConfig = {
          bodyText: t.inspector.interactiveTextLabel,
          buttons: [
            { id: "btn_1", title: t.canvas.nodes.sendMessage },
            { id: "btn_2", title: t.canvas.nodes.promptInput },
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
          onDelete: handleDeleteNodeById,
        },
      }

      setNodes((nds) => [...nds, newNode])
      setSelectedNodeId(id)
    },
    [nodes, setNodes, t, handleDeleteNodeById]
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
  }, [selectedNodeId, setNodes, setEdges])

  // AI Copilot Generator
  const handleGenerateAi = async () => {
    if (!copilotPrompt.trim()) {
      toast.error(t.canvas.copilotPlaceholder)
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
                onDelete: handleDeleteNodeById,
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
        toast.success(t.canvas.generateAi)
      } else {
        toast.error(t.canvas.generating)
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : t.canvas.generating
      toast.error(`${t.canvas.generating}: ${errorMsg}`)
    } finally {
      setIsGeneratingAi(false)
    }
  }

  // Save Workflow
  const handleSave = async () => {
    if (!selectedDeviceId) {
      toast.error(t.canvas.selectDevicePlaceholder)
      return
    }

    setSaving(true)
    try {
      // Reconstruct clean WorkflowDefinition for backend
      const exportNodes: WorkflowNode[] = nodes.map((n) => {
        const d = n.data as unknown as WorkflowNode
        return {
          id: n.id,
          name: d.name || t.canvas.addNodeHeader,
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
        toast.success(t.canvas.saveAndDeploy)
        router.push(`/${lang}/console/whatsapp/workflows`)
      } else {
        const err =
          res.data && "error" in res.data ? res.data.error : t.canvas.saving
        toast.error(`${t.canvas.saving}: ${err}`)
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : t.canvas.saving
      toast.error(`${t.canvas.saving}: ${errorMsg}`)
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
          name: d.name || t.canvas.addNodeHeader,
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
      toast.success(t.canvas.exportJson)
    } catch (e: unknown) {
      toast.error(
        `${t.canvas.exportJson}: ${e instanceof Error ? e.message : t.canvas.exportJson}`
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
            `${t.canvas.importJson}: ${validated.error.issues[0]?.message || t.canvas.importJson}`
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

        toast.success(t.canvas.importJson)
      } catch (err: unknown) {
        toast.error(
          `${t.canvas.importJson}: ${err instanceof Error ? err.message : t.canvas.importJson}`
        )
      } finally {
        e.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  // Simulator test
  const createInitialSimSession = useCallback(() => {
    const session = createSimulatorSession(currentWorkflow)
    return stepSimulatorSession(session, currentWorkflow)
  }, [currentWorkflow])

  const handleStartSim = () => {
    setSimSession(createInitialSimSession())
    setSimInput("")
    setIsSimOpen(true)
  }

  const handleResetSim = () => {
    setSimSession(createInitialSimSession())
    setSimInput("")
  }

  const handleSendSimMessage = () => {
    const userText = simInput.trim()
    if (!userText) return

    setSimSession((previous) => {
      const session = previous || createInitialSimSession()
      return stepSimulatorSession(session, currentWorkflow, userText)
    })
    setSimInput("")
  }

  const formatSimulatorMessage = (message: SimulatorMessage) => {
    if (message.sender !== "system") return message.text

    if (message.text.startsWith("Saved: ")) {
      return t.simulator.variableCapturedToast.replace(
        "{name}",
        message.text.slice("Saved: ".length)
      )
    }

    const branch = message.text.match(/=> (TRUE|FALSE)$/)?.[1]
    if (branch) {
      return t.simulator.branchTaken.replace("{branch}", branch)
    }

    return message.text
  }

  const selectedNodeData = selectedNode?.data as unknown as
    WorkflowNode | undefined

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-1 flex-col gap-3 p-6 pt-0">
      {/* Ultra-Clean Minimal Canvas Header */}
      <header className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card/70 px-3.5 py-2 shadow-sm backdrop-blur-md dark:border-border/60 dark:bg-card/50">
        {/* Left Section: Back & Seamless Flexible Title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          >
            <Link href={`/${lang}/console/whatsapp/workflows`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex min-w-0 flex-1 items-center">
            <Input
              value={workflowMeta.name}
              onChange={(e) =>
                setWorkflowMeta((prev) => ({ ...prev, name: e.target.value }))
              }
              className="h-8 w-full max-w-2xl border-transparent bg-transparent px-2 text-sm font-semibold tracking-tight transition-all hover:border-border/70 focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/20"
              placeholder={t.canvas.namePlaceholder}
              aria-label={t.canvas.namePlaceholder}
            />
          </div>
        </div>

        {/* Right Section: Status Badge, Test, Save & Settings */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Status Badge Anchored in Right Action Toolbar */}
          <Badge
            variant="outline"
            className={`h-7 shrink-0 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors ${
              workflowMeta.isActive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "border-border/70 bg-muted/50 text-muted-foreground dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                workflowMeta.isActive
                  ? "animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] dark:bg-emerald-400"
                  : "bg-muted-foreground dark:bg-zinc-400"
              }`}
            />
            <span>{workflowMeta.isActive ? "Live" : "Draft"}</span>
          </Badge>

          {/* Test Simulator */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartSim}
            className="h-8 gap-1.5 border-border/70 text-xs font-medium text-foreground hover:bg-muted/80"
          >
            <Play className="h-3.5 w-3.5 text-primary" weight="fill" />
            <span>{t.canvas.simulateTest}</span>
          </Button>

          {/* Save & Deploy Primary CTA */}
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-8 gap-1.5 bg-emerald-600 px-3 text-xs font-medium text-white shadow-xs hover:bg-emerald-700"
          >
            <FloppyDisk className="h-3.5 w-3.5" />
            <span>{saving ? t.canvas.saving : t.canvas.saveAndDeploy}</span>
          </Button>

          {/* Options / Settings Dropdown Button with explicit label for accessibility & discovery */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-border/70 px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                aria-label="More options"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1.5">
              {/* AI Copilot Toggle in Menu */}
              <DropdownMenuItem
                onClick={() => setShowCopilot((prev) => !prev)}
                className="cursor-pointer gap-2 py-2 text-xs font-medium"
              >
                <Sparkle
                  className={`h-4 w-4 ${showCopilot ? "fill-primary text-primary" : "text-primary"}`}
                  weight={showCopilot ? "fill" : "regular"}
                />
                <div className="flex flex-col">
                  <span>AI Assistant / Copilot</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    Generate or improve steps
                  </span>
                </div>
              </DropdownMenuItem>

              {/* Trigger Settings Trigger */}
              <DropdownMenuItem
                onClick={() => {
                  const currentType =
                    workflowMeta.trigger.type === "whatsapp_inbound" ||
                    workflowMeta.isDefault
                      ? "whatsapp_inbound"
                      : "keyword_match"
                  setTriggerDraftType(currentType)
                  setTriggerKeywordsInput(
                    Array.isArray(workflowMeta.trigger.keywords)
                      ? workflowMeta.trigger.keywords.join(", ")
                      : ""
                  )
                  setIsTriggerDialogOpen(true)
                }}
                className="cursor-pointer gap-2 py-2 text-xs font-medium"
              >
                <Lightning className="h-4 w-4 text-amber-500" weight="fill" />
                <div className="flex flex-col truncate">
                  <span>Trigger Settings</span>
                  <span className="truncate text-[10px] font-normal text-muted-foreground">
                    {workflowMeta.trigger.type === "whatsapp_inbound" ||
                    workflowMeta.isDefault
                      ? t.canvas.triggerSettings.allInbound
                      : `${workflowMeta.trigger.keywords?.length || 0} keywords active`}
                  </span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Device Selector in Menu */}
              <div className="px-2 py-1.5">
                <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  WhatsApp Device
                </Label>
                <div className="mt-1.5">
                  <Select
                    value={selectedDeviceId}
                    onValueChange={setSelectedDeviceId}
                  >
                    <SelectTrigger className="h-7 border-border/60 text-xs">
                      <SelectValue
                        placeholder={t.canvas.selectDevicePlaceholder}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <WhatsappLogo className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            <span className="truncate">{d.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Default Workflow Switch */}
              <div className="flex items-center justify-between px-2 py-1.5 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <Star
                    className={`h-3.5 w-3.5 ${workflowMeta.isDefault ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                    weight={workflowMeta.isDefault ? "fill" : "regular"}
                  />
                  <span>{t.canvas.defaultToggle}</span>
                </div>
                <Switch
                  checked={workflowMeta.isDefault}
                  onCheckedChange={(checked) =>
                    setWorkflowMeta((prev) => ({ ...prev, isDefault: checked }))
                  }
                  className="scale-75 data-[state=checked]:bg-amber-500"
                />
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setShowMiniMap((prev) => !prev)}
                className="cursor-pointer gap-2 text-xs"
              >
                <MapTrifold className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{showMiniMap ? "Hide MiniMap" : "Show MiniMap"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportJson}
                className="cursor-pointer gap-2 text-xs"
              >
                <DownloadSimple className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.canvas.exportJson}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="cursor-pointer gap-2 text-xs"
              >
                <label className="flex w-full cursor-pointer items-center gap-2">
                  <UploadSimple className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t.canvas.importJson}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Canvas Area with Floating Toolbars */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-inner">
        {/* AI Copilot Collapsible Floating Bar */}
        {showCopilot && (
          <div className="absolute top-4 left-1/2 z-20 flex w-full max-w-lg -translate-x-1/2 animate-in items-center gap-2 rounded-xl border border-primary/30 bg-card/95 p-2 shadow-xl backdrop-blur duration-200 fade-in slide-in-from-top-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkle className="h-3.5 w-3.5" weight="fill" />
            </div>
            <Input
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              placeholder={t.canvas.copilotPlaceholder}
              className="h-7 border-none bg-transparent text-xs shadow-none focus-visible:ring-0"
              onKeyDown={(e) => e.key === "Enter" && handleGenerateAi()}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleGenerateAi}
              disabled={isGeneratingAi}
              className="h-7 shrink-0 gap-1 px-2.5 text-[11px]"
            >
              {isGeneratingAi ? (
                <ArrowsClockwise className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkle className="h-3 w-3" weight="fill" />
              )}
              <span>
                {isGeneratingAi ? t.canvas.generating : t.canvas.generateAi}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCopilot(false)}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Node Palette Bar (Floating Left) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 rounded-xl border border-border/80 bg-card/90 p-1.5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t.canvas.addNodeHeader}
            </span>
            <button
              type="button"
              onClick={() => setShowCopilot((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                showCopilot
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
              title="Generate with AI Copilot"
            >
              <Sparkle className="h-3 w-3" weight="fill" />
              <span>AI Assist</span>
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("send_message")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-sky-500/50 hover:bg-sky-500/10"
          >
            <ChatCircleText className="h-4 w-4 text-sky-400" weight="duotone" />
            <span>{t.canvas.nodes.sendMessage}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("prompt_input")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-emerald-500/50 hover:bg-emerald-500/10"
          >
            <Question className="h-4 w-4 text-emerald-400" weight="duotone" />
            <span>{t.canvas.nodes.promptInput}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("condition")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-amber-500/50 hover:bg-amber-500/10"
          >
            <GitBranch className="h-4 w-4 text-amber-400" weight="duotone" />
            <span>{t.canvas.nodes.condition}</span>
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
            <span>{t.canvas.nodes.interactiveButtons}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("ai_generate")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-purple-500/50 hover:bg-purple-500/10"
          >
            <Brain className="h-4 w-4 text-purple-400" weight="duotone" />
            <span>{t.canvas.nodes.aiGenerate}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddNode("http_request")}
            className="h-8 justify-start gap-2 border-border/60 text-xs hover:border-pink-500/50 hover:bg-pink-500/10"
          >
            <Globe className="h-4 w-4 text-pink-400" weight="duotone" />
            <span>{t.canvas.nodes.httpRequest}</span>
          </Button>
        </div>

        {/* React Flow Interactive Graph */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode={["Meta", "Ctrl"]}
          fitView
          fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
          className="bg-zinc-50 transition-colors dark:bg-[#08090a]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.8}
            color="#71717a"
            className="opacity-60 dark:opacity-100 dark:[--xy-background-pattern-color:#a1a1aa]"
          />
          <Controls className="!border-border/80 !bg-card/90 !fill-foreground shadow-md backdrop-blur" />
          {showMiniMap && (
            <MiniMap
              nodeColor="#10b981"
              maskColor="rgba(0, 0, 0, 0.45)"
              className="!overflow-hidden !rounded-md !border !border-border/40 !bg-card/80 !shadow-sm backdrop-blur"
              style={{ width: 90, height: 55 }}
            />
          )}
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
                  {t.inspector.drawerTitle}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {t.inspector.drawerSubtitle}
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
                    {t.inspector.stepNameLabel}
                  </Label>
                  <Input
                    value={selectedNodeData.name || ""}
                    onChange={(e) =>
                      handleUpdateSelectedNodeName(e.target.value)
                    }
                    placeholder={t.inspector.stepNamePlaceholder}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Form fields by Type */}
                {selectedNodeData.type === "send_message" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.messageTextLabel}
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
                        placeholder={t.inspector.messageTextPlaceholder}
                        className="text-sm leading-relaxed"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t.inspector.variableHint}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.mediaUrlLabel}
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
                        placeholder={t.inspector.mediaUrlPlaceholder}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "prompt_input" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.questionLabel}
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
                        placeholder={t.inspector.questionPlaceholder}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.variableNameLabel}
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
                        placeholder={t.inspector.variableNamePlaceholder}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "condition" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                      {t.inspector.conditionHint}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.leftOperandLabel}
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
                        placeholder={t.inspector.leftOperandLabel}
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.operatorLabel}
                      </Label>
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
                          <SelectValue
                            placeholder={t.inspector.operatorLabel}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">
                            {t.inspector.operators.equals}
                          </SelectItem>
                          <SelectItem value="not_equals">
                            {t.inspector.operators.notEquals}
                          </SelectItem>
                          <SelectItem value="contains">
                            {t.inspector.operators.contains}
                          </SelectItem>
                          <SelectItem value="greater_than">
                            {t.inspector.operators.greaterThan}
                          </SelectItem>
                          <SelectItem value="less_than">
                            {t.inspector.operators.lessThan}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.rightOperandLabel}
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
                        placeholder={t.inspector.rightOperandLabel}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "send_interactive" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.interactiveTextLabel}
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
                        placeholder={t.inspector.interactiveTextLabel}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.buttonsHeader}
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
                            placeholder={t.inspector.buttonPlaceholder}
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
                        {t.inspector.aiPromptLabel}
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
                        placeholder={t.inspector.aiPromptPlaceholder}
                        className="font-mono text-sm leading-relaxed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.aiVariableLabel}
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
                        placeholder={t.inspector.variableNamePlaceholder}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedNodeData.type === "http_request" && (
                  <div className="space-y-4 rounded-lg border border-border/50 bg-background/50 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.httpMethodLabel}
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
                          <SelectItem value="GET">
                            GET (Fetch Live Data)
                          </SelectItem>
                          <SelectItem value="POST">
                            POST (Send & Process Context)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.httpUrlLabel}
                      </Label>
                      <Input
                        value={(selectedNodeData.config?.url as string) || ""}
                        onChange={(e) =>
                          handleUpdateSelectedNode((cfg) => ({
                            ...cfg,
                            url: e.target.value,
                          }))
                        }
                        placeholder={t.inspector.httpUrlLabel}
                        className="h-9 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t.inspector.httpVariableLabel}
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
                        placeholder={t.inspector.httpVariableLabel}
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
              {t.inspector.deleteNodeButton}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setSelectedNodeId(null)}
              className="h-9 px-5 text-xs"
            >
              {t.inspector.doneEditingButton}
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
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="flex items-center gap-2 text-base text-white">
                <WhatsappLogo
                  className="h-5 w-5 text-emerald-500"
                  weight="fill"
                />
                {t.simulator.title}
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetSim}
                aria-label={t.simulator.resetSession}
                className="h-8 gap-1.5 text-xs text-zinc-300 hover:text-white"
              >
                <ArrowsClockwise className="h-3.5 w-3.5" />
                {t.simulator.resetSession}
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {simSession?.history.length ? (
              simSession.history.map((message, index) => {
                const isSystem = message.sender === "system"
                const isUser = message.sender === "user"
                return (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`flex ${
                      isSystem
                        ? "justify-center"
                        : isUser
                          ? "justify-end"
                          : "justify-start"
                    }`}
                  >
                    <div
                      className={
                        isSystem
                          ? "rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400"
                          : `max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                              isUser
                                ? "rounded-br-none bg-emerald-600 text-white"
                                : "rounded-bl-none border border-zinc-700 bg-zinc-800 text-zinc-100"
                            }`
                      }
                    >
                      {!isSystem && (
                        <div className="mb-1 text-[10px] font-medium opacity-60">
                          {isUser
                            ? t.simulator.simulatedUser
                            : t.simulator.simulatedBot}
                        </div>
                      )}
                      {formatSimulatorMessage(message)}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-400">
                {t.simulator.emptyAlert}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-800 pt-4">
            <Input
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendSimMessage()}
              placeholder={t.simulator.inputPlaceholder}
              className="h-9 border-zinc-700 bg-zinc-900 text-xs text-white"
            />
            <Button
              size="icon"
              onClick={handleSendSimMessage}
              aria-label={t.simulator.sendTooltip}
              className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700"
            >
              <PaperPlaneRight className="h-4 w-4" weight="fill" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Trigger Settings Dialog Modal */}
      <Dialog open={isTriggerDialogOpen} onOpenChange={setIsTriggerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Lightning className="h-4 w-4 text-amber-500" weight="fill" />
              {t.canvas.triggerSettings.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t.canvas.triggerSettings.subtitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {t.canvas.triggerSettings.typeLabel}
              </Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setTriggerDraftType("whatsapp_inbound")}
                  className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                    triggerDraftType === "whatsapp_inbound"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-foreground"
                      : "border-border bg-card/50 text-muted-foreground hover:bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        triggerDraftType === "whatsapp_inbound"
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    {t.canvas.triggerSettings.allInbound}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t.canvas.triggerSettings.allInboundDesc}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTriggerDraftType("keyword_match")}
                  className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                    triggerDraftType === "keyword_match"
                      ? "border-amber-500/60 bg-amber-500/10 text-foreground"
                      : "border-border bg-card/50 text-muted-foreground hover:bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        triggerDraftType === "keyword_match"
                          ? "bg-amber-500"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    {t.canvas.triggerSettings.keywordMatch}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t.canvas.triggerSettings.keywordMatchDesc}
                  </p>
                </button>
              </div>
            </div>

            {triggerDraftType === "keyword_match" && (
              <div className="animate-in space-y-1.5 duration-200 fade-in">
                <Label
                  htmlFor="trigger-keywords-input"
                  className="text-xs font-semibold"
                >
                  {t.canvas.triggerSettings.keywordsLabel}
                </Label>
                <Input
                  id="trigger-keywords-input"
                  value={triggerKeywordsInput}
                  onChange={(e) => setTriggerKeywordsInput(e.target.value)}
                  placeholder={t.canvas.triggerSettings.keywordsPlaceholder}
                  className="h-8 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t.canvas.triggerSettings.keywordsHint}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTriggerDialogOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const parsedKeywords = triggerKeywordsInput
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean)

                setWorkflowMeta((prev) => ({
                  ...prev,
                  isDefault: triggerDraftType === "whatsapp_inbound",
                  trigger: {
                    ...prev.trigger,
                    type: triggerDraftType,
                    keywords:
                      triggerDraftType === "keyword_match"
                        ? parsedKeywords
                        : [],
                  },
                }))
                setIsTriggerDialogOpen(false)
                toast.success(t.canvas.triggerSettings.saveTrigger)
              }}
              className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            >
              {t.canvas.triggerSettings.saveTrigger}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
