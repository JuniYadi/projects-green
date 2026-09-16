"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Robot,
  WhatsappLogo,
  Plus,
  ShieldCheck,
  Sparkle,
  ChatCircleDots,
  PaperPlaneRight,
  CheckCircle,
  Lightning,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

type GeneratedStep = {
  id: string
  name: string
  type: string
  detail: string
  captureVariable?: string
}

type DeviceItem = {
  id: string
  name: string
  phoneNumber: string
}

export default function AiAgentsPage() {
  const params = useParams<{ lang?: string }>()
  const router = useRouter()
  const lang = params?.lang || "id"
  const messages = getMessagesForMaybeLocale(lang).console.aiAgents

  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [dailyLimit, setDailyLimit] = useState(20)
  const [enableProfanity, setEnableProfanity] = useState(true)
  const [saving, setSaving] = useState(false)

  // AI Workflow Assistant Builder States
  const [assistantPrompt, setAssistantPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState("")
  const [workflowSummary, setWorkflowSummary] = useState("")
  const [workflowSteps, setWorkflowSteps] = useState<GeneratedStep[]>([])
  const [generatedWorkflowRaw, setGeneratedWorkflowRaw] = useState<
    unknown | null
  >(null)
  const [simulatedChat, setSimulatedChat] = useState<
    { role: "user" | "bot"; text: string }[]
  >([])
  const [simVariables, setSimVariables] = useState<Record<string, string>>({})
  const [testInput, setTestInput] = useState("")

  // Device Binding State
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [bindingModalOpen, setBindingModalOpen] = useState(false)
  const [selectedAgentForBinding, setSelectedAgentForBinding] =
    useState<AgentProfile | null>(null)
  const [bindingActionLoadingId, setBindingActionLoadingId] = useState<
    string | null
  >(null)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAgents()
  }, [loadAgents])

  const handleGenerateWorkflow = async (presetPrompt?: string) => {
    const promptToUse = presetPrompt || assistantPrompt
    if (!promptToUse.trim()) return
    setGenerating(true)
    setGenerationError("")
    try {
      const res = await eden.api.console.ai.workflows.generate.post({
        prompt: promptToUse,
      })
      const data = res.data as {
        ok: boolean
        workflow?: {
          name: string
          description?: string
          nodes: {
            id: string
            name: string
            type: string
            config: Record<string, unknown>
          }[]
        }
        summary?: string
        error?: string
      }
      if (data.ok && data.workflow) {
        setGenerationError("")
        setWorkflowSummary(
          data.summary || "Alur berhasil dirancang otomatis oleh AI."
        )
        const steps: GeneratedStep[] = data.workflow.nodes.map(
          (n: {
            id: string
            name: string
            type: string
            config: Record<string, unknown>
          }) => ({
            id: n.id,
            name: n.name,
            type: n.type,
            detail:
              (n.config.question as string) ||
              (n.config.text as string) ||
              (n.config.bodyText as string) ||
              "Langkah alur",
            captureVariable: n.config.captureVariable as string | undefined,
          })
        )
        setWorkflowSteps(steps)
        setGeneratedWorkflowRaw(data.workflow)
        setSimVariables({})

        // Set default name & prompt if empty
        if (!name) setName(data.workflow.name)
        if (!description) setDescription(data.workflow.description || "")

        // Setup chat simulation
        if (steps.length > 0) {
          setSimulatedChat([
            {
              role: "bot",
              text: steps[0].detail,
            },
          ])
        }
        toast.success("Alur berhasil dirancang otomatis!")
      } else {
        const errMsg = data.error || "Gagal merancang alur dengan AI."
        setGenerationError(errMsg)
        toast.error(errMsg)
      }
    } catch (err) {
      console.error("[ai-workflow] generate error:", err)
      const errMsg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat merancang alur."
      setGenerationError(errMsg)
      toast.error(errMsg)
    } finally {
      setGenerating(false)
    }
  }
  const handleSimulateReply = () => {
    if (!testInput.trim()) return
    const userMsg = testInput.trim()
    const nextChat = [
      ...simulatedChat,
      { role: "user" as const, text: userMsg },
    ]

    // Count user turns so far (including this new user turn)
    const userTurnCount = nextChat.filter((m) => m.role === "user").length
    const prevStepIndex = userTurnCount - 1
    const currentStepIndex = userTurnCount

    // Capture variable from previous prompt step if configured
    const updatedVariables = { ...simVariables }
    if (
      workflowSteps.length > prevStepIndex &&
      workflowSteps[prevStepIndex]?.captureVariable
    ) {
      const varName = workflowSteps[prevStepIndex].captureVariable as string
      updatedVariables[varName] = userMsg
      setSimVariables(updatedVariables)
    }

    // Simulate next step or completion AI response
    if (workflowSteps.length > currentStepIndex) {
      const step = workflowSteps[currentStepIndex]
      let renderedText = step.detail

      // Substitute captured variables
      for (const [key, value] of Object.entries(updatedVariables)) {
        renderedText = renderedText.replaceAll(`{{variables.${key}}}`, value)
      }
      // Also replace any remaining matching variable templates with generic userMsg if not captured
      renderedText = renderedText.replace(/\{\{variables\.\w+\}\}/g, userMsg)

      nextChat.push({
        role: "bot" as const,
        text: renderedText,
      })
    } else {
      nextChat.push({
        role: "bot" as const,
        text: `Terima kasih! Pesan Anda "${userMsg}" telah diproses asisten bot.`,
      })
    }

    setSimulatedChat(nextChat)
    setTestInput("")
  }

  const handleSave = async (openCanvasAfter = false) => {
    if (!name.trim()) {
      toast.error("Nama asisten wajib diisi.")
      return
    }

    setSaving(true)
    try {
      const res = await eden.api.console.ai.agents.post({
        name: name.trim(),
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        dailyUserLimit: dailyLimit,
        enableProfanityFilter: enableProfanity,
      })

      if (res.data && res.data.ok) {
        const savedAgent = res.data.data as { id: string; name: string }
        await loadAgents()
        setIsOpen(false)

        if (openCanvasAfter && generatedWorkflowRaw) {
          const draftPayload = {
            ...(generatedWorkflowRaw as Record<string, unknown>),
            name:
              name.trim() || (generatedWorkflowRaw as { name?: string }).name,
            agentProfileId: savedAgent.id,
            agentProfileName: savedAgent.name,
          }
          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              "draft_canvas_workflow",
              JSON.stringify(draftPayload)
            )
          }
          toast.success("Asisten disimpan! Membuka di WhatsApp Canvas...")
          router.push(`/${lang}/console/whatsapp/workflows/new/canvas`)
          return
        }

        toast.success("Asisten AI berhasil disimpan.")
        setName("")
        setDescription("")
        setSystemPrompt("")
        setWorkflowSteps([])
        setWorkflowSummary("")
        setSimVariables({})
        setGeneratedWorkflowRaw(null)
      } else {
        toast.error("Gagal menyimpan profil asisten.")
      }
    } catch (err) {
      console.error("[ai-agents] save error:", err)
      toast.error("Terjadi kesalahan saat menyimpan asisten.")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenBindingModal = async (agent: AgentProfile) => {
    setSelectedAgentForBinding(agent)
    setBindingModalOpen(true)
    setLoadingDevices(true)
    try {
      const res = await eden.api.whatsapp.devices.get()
      if (
        res.data &&
        "devices" in res.data &&
        Array.isArray(res.data.devices)
      ) {
        const devList = (
          res.data.devices as Array<{
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
      }
    } catch (err) {
      console.warn("[ai-agents] load devices error:", err)
      toast.error("Gagal memuat perangkat WhatsApp.")
    } finally {
      setLoadingDevices(false)
    }
  }

  const handleBindDevice = async (device: DeviceItem) => {
    if (!selectedAgentForBinding) return
    setBindingActionLoadingId(device.id)
    try {
      const res = await eden.api.console.ai.agents[
        selectedAgentForBinding.id
      ].bindings.post({
        channel: "WHATSAPP",
        targetId: device.id,
        targetName: device.name || device.phoneNumber,
      })
      if (res.data && res.data.ok) {
        toast.success(`WhatsApp (${device.phoneNumber}) berhasil dihubungkan!`)
        const updated = await eden.api.console.ai.agents.get()
        if (
          updated.data &&
          updated.data.ok &&
          Array.isArray(updated.data.data)
        ) {
          const allAgents = updated.data.data as AgentProfile[]
          setAgents(allAgents)
          const curr = allAgents.find(
            (a) => a.id === selectedAgentForBinding.id
          )
          if (curr) setSelectedAgentForBinding(curr)
        }
      } else {
        toast.error("Gagal menghubungkan nomor WhatsApp.")
      }
    } catch (err) {
      console.error("[ai-agents] bind device error:", err)
      toast.error("Terjadi kesalahan saat menghubungkan nomor.")
    } finally {
      setBindingActionLoadingId(null)
    }
  }

  const handleUnbindDevice = async (bindingId: string, phoneNumber: string) => {
    if (!selectedAgentForBinding) return
    setBindingActionLoadingId(bindingId)
    try {
      const res =
        await eden.api.console.ai.agents[selectedAgentForBinding.id].bindings[
          bindingId
        ].delete()
      if (res.data && res.data.ok) {
        toast.success(`Hubungan WhatsApp (${phoneNumber}) berhasil diputus.`)
        const updated = await eden.api.console.ai.agents.get()
        if (
          updated.data &&
          updated.data.ok &&
          Array.isArray(updated.data.data)
        ) {
          const allAgents = updated.data.data as AgentProfile[]
          setAgents(allAgents)
          const curr = allAgents.find(
            (a) => a.id === selectedAgentForBinding.id
          )
          if (curr) setSelectedAgentForBinding(curr)
        }
      } else {
        toast.error("Gagal memutuskan hubungan nomor.")
      }
    } catch (err) {
      console.error("[ai-agents] unbind error:", err)
      toast.error("Terjadi kesalahan saat memutuskan hubungan.")
    } finally {
      setBindingActionLoadingId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.heading}
          </h1>
          <p className="text-sm text-muted-foreground">{messages.subtitle}</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus size={16} weight="bold" />
              <span>{messages.createButton}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkle className="text-emerald-500" size={20} weight="fill" />
                <span>{messages.dialog.title}</span>
              </DialogTitle>
              <DialogDescription>
                {messages.dialog.description}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="ai-assistant" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai-assistant" className="gap-2">
                  <Sparkle size={14} />
                  <span>{messages.tabs.aiAssistant}</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2">
                  <Robot size={14} />
                  <span>{messages.tabs.manual}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai-assistant" className="space-y-4 pt-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <Label className="text-xs font-semibold text-emerald-600">
                    {messages.aiAssistant.presetsLabel}
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAssistantPrompt(
                          "Bikinin bot untuk cek nomor resi & status pengiriman paket"
                        )
                        void handleGenerateWorkflow(
                          "Bikinin bot untuk cek nomor resi & status pengiriman paket"
                        )
                      }}
                    >
                      {messages.aiAssistant.presetTrackingLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAssistantPrompt(
                          "Formulir pendaftaran dan tanya kebutuhan prospek baru"
                        )
                        void handleGenerateWorkflow(
                          "Formulir pendaftaran dan tanya kebutuhan prospek baru"
                        )
                      }}
                    >
                      {messages.aiAssistant.presetRegistrationLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAssistantPrompt(
                          "Menu tombol selamat datang dan info kontak CS"
                        )
                        void handleGenerateWorkflow(
                          "Menu tombol selamat datang dan info kontak CS"
                        )
                      }}
                    >
                      {messages.aiAssistant.presetGreetingLabel}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{messages.aiAssistant.promptLabel}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={messages.aiAssistant.promptPlaceholder}
                      value={assistantPrompt}
                      onChange={(e) => setAssistantPrompt(e.target.value)}
                    />
                    <Button
                      type="button"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      disabled={generating || !assistantPrompt.trim()}
                      onClick={() => handleGenerateWorkflow()}
                    >
                      <Lightning size={16} weight="fill" />
                      <span>
                        {generating ? "Merancang..." : "Rancang Alur"}
                      </span>
                    </Button>
                  </div>
                  {generationError && (
                    <p className="text-xs text-destructive">
                      {generationError}
                    </p>
                  )}
                </div>
                {workflowSummary && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                      <CheckCircle size={16} weight="fill" />
                      <span>{workflowSummary}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <Label className="text-xs font-semibold">
                          {messages.aiAssistant.generatedStepsLabel}
                        </Label>
                        <div className="space-y-2">
                          {workflowSteps.map((step, idx) => (
                            <div
                              key={step.id}
                              className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-2 text-xs"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-600">
                                {idx + 1}
                              </span>
                              <div className="flex-1 overflow-hidden">
                                <p className="font-medium text-foreground">
                                  {step.name}
                                </p>
                                <p className="line-clamp-2 text-muted-foreground">
                                  {step.detail}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* WhatsApp Live Bubble Simulator */}
                      <div className="flex flex-col rounded-lg border border-border bg-zinc-950 p-3 text-white">
                        <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div className="flex items-center gap-1.5">
                            <WhatsappLogo
                              size={16}
                              className="text-emerald-500"
                              weight="fill"
                            />
                            <span className="text-xs font-medium">
                              {messages.aiAssistant.simulatorTitle}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400">
                            {messages.aiAssistant.livePreview}
                          </span>
                        </div>

                        <div className="max-h-44 flex-1 space-y-2 overflow-y-auto p-1 text-xs">
                          {simulatedChat.map((msg, i) => (
                            <div
                              key={i}
                              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-2.5 py-1.5 ${
                                  msg.role === "user"
                                    ? "bg-emerald-700 text-white"
                                    : "bg-zinc-800 text-zinc-200"
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 flex gap-1 border-t border-zinc-800 pt-2">
                          <Input
                            placeholder={
                              messages.aiAssistant.testInputPlaceholder
                            }
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleSimulateReply()
                            }
                            className="h-8 border-zinc-700 bg-zinc-900 text-xs text-white"
                          />
                          <Button
                            size="sm"
                            type="button"
                            onClick={handleSimulateReply}
                            className="h-8 w-8 bg-emerald-600 p-0 hover:bg-emerald-700"
                          >
                            <PaperPlaneRight size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 pt-2">
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>{messages.manual.nameLabel}</Label>
                    <Input
                      placeholder={messages.manual.namePlaceholder}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{messages.manual.descriptionLabel}</Label>
                    <Input
                      placeholder={messages.manual.descriptionPlaceholder}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{messages.manual.systemPromptLabel}</Label>
                    <Textarea
                      rows={3}
                      placeholder={messages.manual.systemPromptPlaceholder}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{messages.manual.dailyLimitLabel}</Label>
                      <Input
                        type="number"
                        value={dailyLimit}
                        onChange={(e) =>
                          setDailyLimit(Number(e.target.value) || 1)
                        }
                      />
                    </div>
                    <div className="flex flex-col justify-end space-y-2 pb-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">
                          {messages.manual.profanityFilterLabel}
                        </Label>
                        <Switch
                          checked={enableProfanity}
                          onCheckedChange={setEnableProfanity}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                {messages.dialog.cancelButton}
              </Button>
              {generatedWorkflowRaw ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    onClick={() => handleSave(false)}
                    disabled={!name.trim() || saving}
                  >
                    {messages.dialog.saveProfileOnlyButton}
                  </Button>
                  <Button
                    onClick={() => handleSave(true)}
                    disabled={!name.trim() || saving}
                    className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Sparkle size={15} weight="fill" />
                    <span>{messages.dialog.saveAndOpenCanvasButton}</span>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => handleSave(false)}
                  disabled={!name.trim() || saving}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {saving ? "Menyimpan..." : "Simpan & Aktifkan"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.length === 0 ? (
          <Card className="col-span-2 flex flex-col items-center justify-center border-dashed p-8 text-center">
            <ChatCircleDots
              size={36}
              className="mb-2 text-emerald-500"
              weight="duotone"
            />
            <p className="text-sm font-medium">{messages.emptyState.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.emptyState.description}
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
                        {messages.badge.active}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {agent.description || "Tanpa deskripsi"}
                  </CardDescription>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Robot size={18} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <p className="line-clamp-2 font-mono">
                    &quot;{agent.systemPrompt || "Alur otomatis terkonfigurasi"}
                    &quot;
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      {messages.card.dailyLimitLabel}
                    </span>
                    <span className="ml-1 font-mono font-medium">
                      {agent.dailyUserLimit} {messages.card.reqPerUser}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <ShieldCheck size={14} />
                    <span>{messages.card.antiSpamProtection}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <WhatsappLogo size={16} className="text-emerald-500" />
                      <span>
                        {agent.channelsCount || 0}{" "}
                        {messages.card.channelsConnectedLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleOpenBindingModal(agent)}
                      >
                        {messages.card.manageNumbersButton}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
                        asChild
                      >
                        <Link
                          href={`/${lang}/console/whatsapp/workflows/new/canvas?agentProfileId=${agent.id}&agentProfileName=${encodeURIComponent(agent.name)}`}
                        >
                          <Sparkle size={13} weight="fill" />
                          <span>{messages.card.openCanvasButton}</span>
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {agent.channelBindings &&
                    agent.channelBindings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.channelBindings.map((b) => (
                          <Badge
                            key={b.id}
                            variant="secondary"
                            className="border border-emerald-500/20 bg-emerald-500/5 text-[10px] text-emerald-600 dark:text-emerald-400"
                          >
                            📱 {b.targetName || b.targetId}
                          </Badge>
                        ))}
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Kelola Nomor WhatsApp */}
      <Dialog open={bindingModalOpen} onOpenChange={setBindingModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WhatsappLogo
                size={20}
                className="text-emerald-500"
                weight="fill"
              />
              <span>{messages.bindingModal.title}</span>
            </DialogTitle>
            <DialogDescription>
              {messages.bindingModal.descriptionPrefix}{" "}
              <strong>{selectedAgentForBinding?.name}</strong>{" "}
              {messages.bindingModal.descriptionSuffix}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loadingDevices ? (
              <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                <ArrowsClockwise
                  size={16}
                  className="mr-2 animate-spin text-emerald-500"
                />
                <span>{messages.bindingModal.loadingDevices}</span>
              </div>
            ) : devices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <p>{messages.bindingModal.noDevices}</p>
                <Button
                  variant="link"
                  size="sm"
                  asChild
                  className="mt-1 h-auto p-0 text-emerald-600"
                >
                  <Link href={`/${lang}/console/whatsapp/devices`}>
                    {messages.bindingModal.connectDeviceLink}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((dev) => {
                  const binding =
                    selectedAgentForBinding?.channelBindings?.find(
                      (b) =>
                        b.channel.toUpperCase() === "WHATSAPP" &&
                        b.targetId === dev.id
                    )
                  const isBound = Boolean(binding)
                  const isLoading =
                    bindingActionLoadingId === dev.id ||
                    (binding && bindingActionLoadingId === binding.id)

                  return (
                    <div
                      key={dev.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {dev.name}
                          </span>
                          {isBound ? (
                            <Badge
                              variant="secondary"
                              className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600"
                            >
                              {messages.bindingModal.connectedBadge}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground"
                            >
                              {messages.bindingModal.availableBadge}
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {dev.phoneNumber}
                        </p>
                      </div>

                      {isBound && binding ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Boolean(isLoading)}
                          onClick={() =>
                            handleUnbindDevice(binding.id, dev.phoneNumber)
                          }
                          className="h-7 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                        >
                          {isLoading ? "Memproses..." : "Putuskan"}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={Boolean(isLoading)}
                          onClick={() => handleBindDevice(dev)}
                          className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                        >
                          {isLoading ? "Menghubungkan..." : "Hubungkan"}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBindingModalOpen(false)}
            >
              {messages.bindingModal.doneButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
