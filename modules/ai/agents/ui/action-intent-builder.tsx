"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle,
  Eye,
  Lightning,
  PencilSimple,
  Plus,
  ShieldCheck,
  Sparkle,
  Trash,
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type {
  ActionIntentSlotDTO,
  ActionIntentSlotType,
  AiActionIntentDTO,
} from "../../actions/ai-action-intent.dto"

export type ConnectionOption = {
  id: string
  name: string
  baseUrl: string
}

export type AgentOption = {
  id: string
  name: string
}

export interface ActionIntentBuilderProps {
  initialAgentProfileId?: string
  agents?: AgentOption[]
  lang?: string
}

export function inferSlotType(val: unknown): ActionIntentSlotType {
  if (typeof val === "number") return "NUMBER"
  if (typeof val === "string") {
    const trimmed = val.trim()
    const isIsoDate = new RegExp(
      "^\\d{4}[-/]\\d{2}[-/]\\d{2}" +
        "(T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})?)?$"
    ).test(trimmed)
    const isDmyDate = /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)
    if (isIsoDate || isDmyDate) {
      return "DATE"
    }
  }
  return "STRING"
}

export function generateInquiryQuestion(key: string): string {
  const humanized = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
  return `Boleh minta ${humanized}nya?`
}

export function parseSampleJsonToSlots(
  rawJson: string
): ActionIntentSlotDTO[] {
  const parsed = JSON.parse(rawJson)
  const obj = Array.isArray(parsed) ? parsed[0] : parsed
  if (!obj || typeof obj !== "object") return []

  return Object.entries(obj).map(([key, val]) => ({
    name: key,
    type: inferSlotType(val),
    required: true,
    inquiryQuestion: generateInquiryQuestion(key),
  }))
}

export default function ActionIntentBuilder({
  initialAgentProfileId,
  agents = [],
  lang = "id",
}: ActionIntentBuilderProps) {
  const t = getMessagesForMaybeLocale(lang).console.aiAgents.actionIntents

  const [actions, setActions] = useState<AiActionIntentDTO[]>([])
  const [connections, setConnections] = useState<ConnectionOption[]>([])
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>(
    initialAgentProfileId || "ALL"
  )
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [agentProfileId, setAgentProfileId] = useState<string | null>(
    initialAgentProfileId || null
  )
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [subpath, setSubpath] = useState("/")
  const [method, setMethod] = useState("GET")
  const [slots, setSlots] = useState<ActionIntentSlotDTO[]>([])
  const [requireConfirmation, setRequireConfirmation] = useState(false)
  const [enableVision, setEnableVision] = useState(false)

  // Auto-Detect Dialog State
  const [autoDetectOpen, setAutoDetectOpen] = useState(false)
  const [sampleJsonText, setSampleJsonText] = useState("")

  const loadActions = useCallback(async () => {
    setLoading(true)
    try {
      const query =
        selectedAgentFilter !== "ALL"
          ? { agentProfileId: selectedAgentFilter }
          : {}
      const res = await eden.api.console.ai.actions.get({ $query: query })
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        setActions(res.data.data as AiActionIntentDTO[])
      }
    } catch (err) {
      console.warn("[action-builder] load error:", err)
      toast.error(t.toasts.loadError)
    } finally {
      setLoading(false)
    }
  }, [selectedAgentFilter, t.toasts.loadError])

  const loadConnections = useCallback(async () => {
    try {
      const res = await eden.api.console.ai.connections.get()
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        setConnections(
          (
            res.data.data as Array<{
              id: string
              name: string
              baseUrl: string
            }>
          ).map((c) => ({
            id: c.id,
            name: c.name,
            baseUrl: c.baseUrl,
          }))
        )
      }
    } catch (err) {
      console.warn("[action-builder] load connections error:", err)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadActions()
    void loadConnections()
  }, [loadActions, loadConnections])

  const resetForm = () => {
    setEditingId(null)
    setName("")
    setDescription("")
    setAgentProfileId(
      selectedAgentFilter !== "ALL" ? selectedAgentFilter : null
    )
    setConnectionId(null)
    setSubpath("/")
    setMethod("GET")
    setSlots([])
    setRequireConfirmation(false)
    setEnableVision(false)
  }

  const handleOpenCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const handleOpenEdit = (action: AiActionIntentDTO) => {
    setEditingId(action.id)
    setName(action.name)
    setDescription(action.description || "")
    setAgentProfileId(action.agentProfileId)
    setConnectionId(action.connectionId)
    setSubpath(action.subpath)
    setMethod(action.method)
    setSlots(action.slots)
    setRequireConfirmation(action.requireCustomerConfirmation)
    setEnableVision(action.enableMultimodalVision)
    setModalOpen(true)
  }

  const handleAddSlot = () => {
    setSlots((prev) => [
      ...prev,
      {
        name: "",
        type: "STRING",
        required: true,
        inquiryQuestion: "",
      },
    ])
  }

  const handleUpdateSlot = (
    index: number,
    field: keyof ActionIntentSlotDTO,
    value: unknown
  ) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    )
  }

  const handleRemoveSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAutoDetectApply = () => {
    if (!sampleJsonText.trim()) return
    try {
      const detectedSlots = parseSampleJsonToSlots(sampleJsonText)
      if (detectedSlots.length === 0) {
        toast.error(t.autoDetectDialog.noKeysFound)
        return
      }

      setSlots((prev) => {
        const existingNames = new Set(prev.map((s) => s.name))
        const newSlots = detectedSlots.filter((s) => !existingNames.has(s.name))
        return [...prev, ...newSlots]
      })

      setAutoDetectOpen(false)
      setSampleJsonText("")
      toast.success(t.autoDetectDialog.success)
    } catch {
      toast.error(t.autoDetectDialog.invalidJson)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        agentProfileId: agentProfileId || null,
        connectionId: connectionId || null,
        subpath: subpath.trim() || "/",
        method,
        slots,
        requireCustomerConfirmation: requireConfirmation,
        enableMultimodalVision: enableVision,
      }

      if (editingId) {
        const res = await eden.api.console.ai.actions[editingId].patch(
          payload
        )
        if (res.data && res.data.ok) {
          toast.success(t.toasts.updateSuccess)
          setModalOpen(false)
          void loadActions()
        } else {
          toast.error("Gagal memperbarui Action Intent.")
        }
      } else {
        const res = await eden.api.console.ai.actions.post(payload)
        if (res.data && res.data.ok) {
          toast.success(t.toasts.createSuccess)
          setModalOpen(false)
          void loadActions()
        } else {
          toast.error("Gagal membuat Action Intent.")
        }
      }
    } catch (err) {
      console.error("[action-builder] save error:", err)
      toast.error("Terjadi kesalahan saat menyimpan Action Intent.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.toasts.deleteConfirm)) return
    try {
      const res = await eden.api.console.ai.actions[id].delete()
      if (res.data && res.data.ok) {
        toast.success(t.toasts.deleteSuccess)
        void loadActions()
      } else {
        toast.error("Gagal menghapus Action Intent.")
      }
    } catch (err) {
      console.error("[action-builder] delete error:", err)
      toast.error("Terjadi kesalahan saat menghapus.")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header and Controls */}
      <div
        className={
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t.title}</h2>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <Select
              value={selectedAgentFilter}
              onValueChange={setSelectedAgentFilter}
            >
              <SelectTrigger className="w-[180px] text-xs">
                <SelectValue placeholder={t.filterAllAgents} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.filterAllAgents}</SelectItem>
                {agents.map((ag) => (
                  <SelectItem key={ag.id} value={ag.id}>
                    {ag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={handleOpenCreate}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus size={16} weight="bold" />
            <span>{t.createButton}</span>
          </Button>
        </div>
      </div>

      {/* Action Intent List */}
      {loading ? (
        <div className="flex justify-center p-8 text-xs text-muted-foreground">
          Memuat Action Intent...
        </div>
      ) : actions.length === 0 ? (
        <Card
          className={
            "flex flex-col items-center justify-center border-dashed p-8 " +
            "text-center"
          }
        >
          <Lightning
            size={36}
            className="mb-2 text-emerald-500"
            weight="duotone"
          />
          <p className="text-sm font-medium">{t.emptyTitle}</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {t.emptyDescription}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCreate}
            className="mt-4 gap-1.5"
          >
            <Plus size={14} />
            <span>{t.createButton}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((act) => (
            <Card key={act.id} className="border-border">
              <CardHeader
                className="flex flex-row items-start justify-between pb-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {act.method}
                    </Badge>
                    <CardTitle className="text-base font-semibold">
                      {act.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2 text-xs">
                    {act.description || "Tanpa instruksi pemicu"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={
                      "h-7 w-7 text-muted-foreground hover:text-foreground"
                    }
                    onClick={() => handleOpenEdit(act)}
                    title={t.editButton}
                  >
                    <PencilSimple size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={
                      "h-7 w-7 text-muted-foreground hover:text-destructive"
                    }
                    onClick={() => handleDelete(act.id)}
                    title={t.deleteButton}
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div
                  className={
                    "rounded-lg bg-muted p-2 text-xs font-mono " +
                    "text-muted-foreground"
                  }
                >
                  <span className="font-medium text-foreground">
                    {act.connectionName || "REST API"}
                  </span>
                  <span className="ml-1">{act.subpath}</span>
                </div>

                {/* Slots Preview */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Parameter Slots ({act.slots.length}):
                  </Label>
                  {act.slots.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {act.slots.map((s, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="border border-border text-[10px]"
                        >
                          {s.name}
                          <span
                            className="ml-1 text-[9px] text-muted-foreground"
                          >
                            ({s.type})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-muted-foreground">
                      Tanpa parameter slot tambahan
                    </p>
                  )}
                </div>

                {/* Toggles Status Badges */}
                <div
                  className={
                    "flex flex-wrap items-center gap-2 border-t border-border "
                    + "pt-2 text-[11px]"
                  }
                >
                  {act.enableMultimodalVision && (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-border text-foreground"
                    >
                      <Eye size={12} className="text-emerald-500" />
                      <span>Vision OCR</span>
                    </Badge>
                  )}
                  {act.requireCustomerConfirmation && (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-border text-foreground"
                    >
                      <ShieldCheck size={12} className="text-emerald-500" />
                      <span>Confirmation Gate</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Create/Edit Action Intent Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightning
                className="text-emerald-500"
                size={20}
                weight="fill"
              />
              <span>
                {editingId ? t.editButton : t.createButton}
              </span>
            </DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Action Name & Description */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="action-name" className="text-xs font-semibold">
                  {t.nameLabel} *
                </Label>
                <Input
                  id="action-name"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="action-agent"
                  className="text-xs font-semibold"
                >
                  Profil Asisten AI
                </Label>
                <Select
                  value={agentProfileId || "GLOBAL"}
                  onValueChange={(val) =>
                    setAgentProfileId(val === "GLOBAL" ? null : val)
                  }
                >
                  <SelectTrigger id="action-agent">
                    <SelectValue placeholder="Pilih Profil..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">
                      Global (Semua Profil)
                    </SelectItem>
                    {agents.map((ag) => (
                      <SelectItem key={ag.id} value={ag.id}>
                        {ag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="action-description"
                className="text-xs font-semibold"
              >
                {t.descriptionLabel}
              </Label>
              <Textarea
                id="action-description"
                rows={2}
                placeholder={t.descriptionPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Connection & Endpoint */}
            <div
              className="rounded-lg border border-border bg-card p-3 space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs font-semibold">
                    {t.connectionLabel}
                  </Label>
                  <Select
                    value={connectionId || "NONE"}
                    onValueChange={(val) =>
                      setConnectionId(val === "NONE" ? null : val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.connectionPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">
                        {t.noConnectionOption}
                      </SelectItem>
                      {connections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs font-semibold">
                    {t.methodLabel}
                  </Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs font-semibold">
                    {t.subpathLabel}
                  </Label>
                  <Input
                    placeholder={t.subpathPlaceholder}
                    value={subpath}
                    onChange={(e) => setSubpath(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Slots Section */}
            <div className="space-y-2">
              <div
                className={
                  "flex flex-col gap-2 sm:flex-row sm:items-center " +
                  "sm:justify-between"
                }
              >
                <div>
                  <Label
                    className={
                      "text-xs font-semibold uppercase tracking-wider " +
                      "text-muted-foreground"
                    }
                  >
                    {t.slotsSection.title}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t.slotsSection.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setAutoDetectOpen(true)}
                  >
                    <Sparkle size={14} className="text-emerald-500" />
                    <span>{t.autoDetectButton}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={handleAddSlot}
                  >
                    <Plus size={14} />
                    <span>{t.slotsSection.addRowButton}</span>
                  </Button>
                </div>
              </div>

              {slots.length === 0 ? (
                <div
                  className={
                    "rounded-lg border border-dashed border-border p-4 " +
                    "text-center text-xs text-muted-foreground"
                  }
                >
                  {t.slotsSection.emptySlots}
                </div>
              ) : (
                <div
                  className="overflow-x-auto rounded-lg border border-border"
                >
                  <table className="w-full text-left text-xs">
                    <thead
                      className={
                        "border-b border-border bg-muted/40 text-[11px] " +
                        "text-muted-foreground"
                      }
                    >
                      <tr>
                        <th className="p-2 pl-3">
                          {t.slotsSection.colName}
                        </th>
                        <th className="p-2">{t.slotsSection.colType}</th>
                        <th className="p-2 text-center">
                          {t.slotsSection.colRequired}
                        </th>
                        <th className="p-2">
                          {t.slotsSection.colQuestion}
                        </th>
                        <th className="p-2 pr-3 text-center">
                          {t.slotsSection.colAction}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slots.map((slot, index) => (
                        <tr key={index} className="hover:bg-muted/20">
                          <td className="p-2 pl-3">
                            <Input
                              value={slot.name}
                              onChange={(e) =>
                                handleUpdateSlot(
                                  index,
                                  "name",
                                  e.target.value
                                )
                              }
                              placeholder="nama_parameter"
                              className="h-7 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <Select
                              value={slot.type}
                              onValueChange={(val: ActionIntentSlotType) =>
                                handleUpdateSlot(index, "type", val)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="STRING">
                                  {t.slotsSection.typeString}
                                </SelectItem>
                                <SelectItem value="NUMBER">
                                  {t.slotsSection.typeNumber}
                                </SelectItem>
                                <SelectItem value="DATE">
                                  {t.slotsSection.typeDate}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={slot.required}
                              onCheckedChange={(checked) =>
                                handleUpdateSlot(
                                  index,
                                  "required",
                                  Boolean(checked)
                                )
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={slot.inquiryQuestion}
                              onChange={(e) =>
                                handleUpdateSlot(
                                  index,
                                  "inquiryQuestion",
                                  e.target.value
                                )
                              }
                              placeholder={
                                t.slotsSection.questionPlaceholder
                              }
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-2 pr-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={
                                "h-7 w-7 text-muted-foreground " +
                                "hover:text-destructive"
                              }
                              onClick={() => handleRemoveSlot(index)}
                            >
                              <Trash size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Toggles & Guardrails */}
            <div
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              {/* Multimodal Vision */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div
                    className="flex items-center gap-1.5 font-semibold text-xs"
                  >
                    <Eye size={16} className="text-emerald-500" />
                    <span>{t.toggles.visionTitle}</span>
                  </div>
                  <Label
                    htmlFor="toggle-vision"
                    className={
                      "text-xs font-normal text-muted-foreground " +
                      "cursor-pointer"
                    }
                  >
                    {t.toggles.visionLabel}
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    {t.toggles.visionDesc}
                  </p>
                </div>
                <Switch
                  id="toggle-vision"
                  checked={enableVision}
                  onCheckedChange={setEnableVision}
                />
              </div>

              <div className="border-t border-border pt-3">
                {/* Confirmation Gate */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div
                      className={
                        "flex items-center gap-1.5 font-semibold text-xs"
                      }
                    >
                      <ShieldCheck size={16} className="text-emerald-500" />
                      <span>{t.toggles.confirmationGateTitle}</span>
                    </div>
                    <Label
                      htmlFor="toggle-confirmation"
                      className={
                        "text-xs font-normal text-muted-foreground " +
                        "cursor-pointer"
                      }
                    >
                      {t.toggles.confirmationGateLabel}
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      {t.toggles.confirmationGateDesc}
                    </p>
                  </div>
                  <Switch
                    id="toggle-confirmation"
                    checked={requireConfirmation}
                    onCheckedChange={setRequireConfirmation}
                  />
                </div>

                {/* Interactive Confirmation Preview */}
                {requireConfirmation && (
                  <div
                    className={
                      "mt-3 rounded-lg border border-border bg-muted/30 " +
                      "p-3 space-y-2"
                    }
                  >
                    <Label
                      className={
                        "text-[11px] font-semibold text-muted-foreground"
                      }
                    >
                      {t.toggles.previewTitle}
                    </Label>
                    <div
                      className={
                        "rounded border border-border bg-background " +
                        "p-2.5 text-xs"
                      }
                    >
                      <p className="text-muted-foreground">
                        Halo Kak, mohon konfirmasi data pemeriksaan Anda:
                      </p>
                      <ul className="my-1 list-disc pl-4 text-[11px]">
                        {slots.length > 0 ? (
                          slots.map((s, idx) => (
                            <li key={idx}>
                              <span className="font-mono font-medium">
                                {s.name || `param_${idx + 1}`}:
                              </span>{" "}
                              <span className="italic text-muted-foreground">
                                &lt;nilai pelanggan&gt;
                              </span>
                            </li>
                          ))
                        ) : (
                          <li>
                            <span className="font-mono font-medium">
                              nomor_kwitansi:
                            </span>{" "}
                            <span className="italic text-muted-foreground">
                              KW-12345
                            </span>
                          </li>
                        )}
                      </ul>
                      <p className="text-[11px] text-muted-foreground">
                        Apakah data di atas sudah benar untuk dicek?
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <div
                        className={
                          "rounded-md border border-emerald-500/40 " +
                          "bg-emerald-500/10 px-3 py-1.5 text-xs " +
                          "font-medium text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {t.toggles.previewConfirm}
                      </div>
                      <div
                        className={
                          "rounded-md border border-border bg-muted " +
                          "px-3 py-1.5 text-xs font-medium " +
                          "text-muted-foreground"
                        }
                      >
                        {t.toggles.previewReject}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t.buttons.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle size={16} weight="fill" />
              <span>{saving ? t.buttons.saving : t.buttons.save}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Auto-Detect from Sample JSON Dialog */}
      <Dialog open={autoDetectOpen} onOpenChange={setAutoDetectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkle
                className="text-emerald-500"
                size={20}
                weight="fill"
              />
              <span>{t.autoDetectDialog.title}</span>
            </DialogTitle>
            <DialogDescription>
              {t.autoDetectDialog.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Textarea
              rows={8}
              className="font-mono text-xs"
              placeholder={t.autoDetectDialog.textareaPlaceholder}
              value={sampleJsonText}
              onChange={(e) => setSampleJsonText(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setAutoDetectOpen(false)}
            >
              {t.autoDetectDialog.cancelButton}
            </Button>
            <Button
              onClick={handleAutoDetectApply}
              disabled={!sampleJsonText.trim()}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Sparkle size={15} weight="fill" />
              <span>{t.autoDetectDialog.parseButton}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
