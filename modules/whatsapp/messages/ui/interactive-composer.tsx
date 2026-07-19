/**
 * Interactive Composer — compose WhatsApp interactive messages with
 * Reply Buttons, List, and CTA URL modes. Client-side validation matches
 * Meta Cloud API constraints, and a preview panel shows the raw payload.
 *
 * ponytail: single component, switch mode via radio. Preview just renders
 * the JSON payload — no simulated UI, because Meta's actual rendering depends
 * on the client (Android/iOS/Web) and we'd maintain a brittle fake.
 * Add a proper simulated preview when product design specifies it.
 */

"use client"

import * as React from "react"
import { X, Plus, Eye, EyeSlash } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// ─── Meta Constraints ─────────────────────────────────────────────────────────

const META = {
  BUTTON_MIN: 1,
  BUTTON_MAX: 3,
  BUTTON_TITLE_MAX: 20,
  BUTTON_ID_MAX: 256,
  BODY_TEXT_MAX: 1024,
  FOOTER_TEXT_MAX: 60,
  HEADER_TEXT_MAX: 60,
  LIST_BUTTON_MAX: 20,
  SECTION_MAX: 10,
  SECTION_TITLE_MAX: 24,
  ROW_MIN: 1,
  ROW_MAX: 10,
  ROW_TITLE_MAX: 24,
  ROW_ID_MAX: 200,
  ROW_DESC_MAX: 72,
} as const

// ─── Local Types ──────────────────────────────────────────────────────────────

type ComposerMode = "buttons" | "list" | "cta_url"

type ButtonRow = { id: string; title: string }
type CtaUrlRow = { display_text: string; url: string; id?: string }
type SectionRow = { id: string; title: string; description?: string }
type SectionData = { title: string; rows: SectionRow[] }

// ─── Validation Helpers ───────────────────────────────────────────────────────

function validateButtons(buttons: ButtonRow[]): string | null {
  if (buttons.length < META.BUTTON_MIN || buttons.length > META.BUTTON_MAX) {
    return `${META.BUTTON_MIN}-${META.BUTTON_MAX} buttons required`
  }
  for (const b of buttons) {
    if (b.title.length > META.BUTTON_TITLE_MAX)
      return `Button title max ${META.BUTTON_TITLE_MAX} chars`
    if (b.id.length > META.BUTTON_ID_MAX)
      return `Button ID max ${META.BUTTON_ID_MAX} chars`
  }
  return null
}

function validateList(input: {
  button: string
  sections: SectionData[]
}): string | null {
  if (input.button.length > META.LIST_BUTTON_MAX)
    return `List button text max ${META.LIST_BUTTON_MAX} chars`
  if (input.sections.length < 1 || input.sections.length > META.SECTION_MAX)
    return `1-${META.SECTION_MAX} sections required`
  const hasMultiSection = input.sections.length > 1
  for (const s of input.sections) {
    if (hasMultiSection && !s.title.trim())
      return "Section title required when >1 section"
    if (s.title.length > META.SECTION_TITLE_MAX)
      return `Section title max ${META.SECTION_TITLE_MAX} chars`
    if (s.rows.length < META.ROW_MIN || s.rows.length > META.ROW_MAX)
      return `Each section needs ${META.ROW_MIN}-${META.ROW_MAX} rows`
    for (const r of s.rows) {
      if (r.id.length > META.ROW_ID_MAX)
        return `Row ID max ${META.ROW_ID_MAX} chars`
      if (r.title.length > META.ROW_TITLE_MAX)
        return `Row title max ${META.ROW_TITLE_MAX} chars`
      if (r.description && r.description.length > META.ROW_DESC_MAX)
        return `Row description max ${META.ROW_DESC_MAX} chars`
    }
  }
  return null
}

function validateCtaUrl(buttons: CtaUrlRow[]): string | null {
  if (buttons.length < 1 || buttons.length > META.BUTTON_MAX)
    return `1-${META.BUTTON_MAX} CTA URL buttons required`
  for (const b of buttons) {
    if (!b.display_text.trim()) return "Display text required"
    if (!b.url.startsWith("http")) return "URL must start with http(s)://"
  }
  return null
}

// ─── Build Payload ────────────────────────────────────────────────────────────

function buildPayload(mode: ComposerMode, state: ComposerState): unknown {
  const base = {
    type: mode === "list" ? "list" : "button",
    body: { text: state.bodyText },
    ...(state.headerText && {
      header: { type: "text", text: state.headerText },
    }),
    ...(state.footerText && { footer: { text: state.footerText } }),
  }

  if (mode === "buttons") {
    return {
      ...base,
      action: {
        buttons: state.buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    }
  }

  if (mode === "cta_url") {
    return {
      ...base,
      action: {
        buttons: state.ctaButtons.map((b) => ({
          type: "cta_url",
          cta_url: {
            display_text: b.display_text,
            url: b.url,
            ...(b.id && { id: b.id }),
          },
        })),
      },
    }
  }

  // list
  return {
    ...base,
    action: {
      button: state.listButton,
      sections: state.sections.map((s) => ({
        ...(s.title && { title: s.title }),
        rows: s.rows.map((r) => ({
          id: r.id,
          title: r.title,
          ...(r.description && { description: r.description }),
        })),
      })),
    },
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

type ComposerState = {
  bodyText: string
  headerText: string
  footerText: string
  buttons: ButtonRow[]
  listButton: string
  sections: SectionData[]
  ctaButtons: CtaUrlRow[]
}

const INITIAL_STATE: ComposerState = {
  bodyText: "",
  headerText: "",
  footerText: "",
  buttons: [{ id: "", title: "" }],
  listButton: "View Options",
  sections: [{ title: "", rows: [{ id: "", title: "" }] }],
  ctaButtons: [{ display_text: "", url: "" }],
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: ButtonRow[]
  onChange: (b: ButtonRow[]) => void
}) {
  const update = (i: number, field: keyof ButtonRow, value: string) => {
    const next = buttons.map((b, idx) =>
      idx === i ? { ...b, [field]: value } : b
    )
    onChange(next)
  }
  const add = () => {
    if (buttons.length < META.BUTTON_MAX)
      onChange([...buttons, { id: "", title: "" }])
  }
  const remove = (i: number) => {
    if (buttons.length > META.BUTTON_MIN)
      onChange(buttons.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <Label>
        Reply Buttons ({buttons.length}/{META.BUTTON_MAX})
      </Label>
      {buttons.map((b, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <div>
              <Input
                placeholder="Button ID"
                value={b.id}
                onChange={(e) => update(i, "id", e.target.value)}
                maxLength={META.BUTTON_ID_MAX}
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {b.id.length}/{META.BUTTON_ID_MAX}
              </p>
            </div>
            <div>
              <Input
                placeholder="Button title"
                value={b.title}
                onChange={(e) => update(i, "title", e.target.value)}
                maxLength={META.BUTTON_TITLE_MAX}
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {b.title.length}/{META.BUTTON_TITLE_MAX}
              </p>
            </div>
          </div>
          {buttons.length > META.BUTTON_MIN && (
            <Button variant="ghost" size="icon" onClick={() => remove(i)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {buttons.length < META.BUTTON_MAX && (
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 size-3" /> Add Button
        </Button>
      )}
    </div>
  )
}

function CtaUrlEditor({
  buttons,
  onChange,
}: {
  buttons: CtaUrlRow[]
  onChange: (b: CtaUrlRow[]) => void
}) {
  const update = (i: number, field: keyof CtaUrlRow, value: string) => {
    const next = buttons.map((b, idx) =>
      idx === i ? { ...b, [field]: value } : b
    )
    onChange(next)
  }
  const add = () => {
    if (buttons.length < META.BUTTON_MAX)
      onChange([...buttons, { display_text: "", url: "" }])
  }
  const remove = (i: number) => {
    if (buttons.length > 1) onChange(buttons.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <Label>
        CTA URL Buttons ({buttons.length}/{META.BUTTON_MAX})
      </Label>
      {buttons.map((b, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Input
              placeholder="Display text"
              value={b.display_text}
              onChange={(e) => update(i, "display_text", e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Input
                placeholder="https://example.com"
                value={b.url}
                onChange={(e) => update(i, "url", e.target.value)}
              />
              {buttons.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      {buttons.length < META.BUTTON_MAX && (
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 size-3" /> Add Button
        </Button>
      )}
    </div>
  )
}

function SectionEditor({
  section,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  section: SectionData
  index: number
  onChange: (s: SectionData) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const updateRow = (ri: number, field: keyof SectionRow, value: string) => {
    const rows = section.rows.map((r, idx) =>
      idx === ri ? { ...r, [field]: value } : r
    )
    onChange({ ...section, rows })
  }
  const addRow = () => {
    if (section.rows.length < META.ROW_MAX)
      onChange({ ...section, rows: [...section.rows, { id: "", title: "" }] })
  }
  const removeRow = (ri: number) => {
    if (section.rows.length > META.ROW_MIN)
      onChange({
        ...section,
        rows: section.rows.filter((_, idx) => idx !== ri),
      })
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Label>Section {index + 1}</Label>
        {canRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Input
          placeholder="Section title (required if >1 section)"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          maxLength={META.SECTION_TITLE_MAX}
        />
        <p className="text-[10px] text-muted-foreground">
          Title: {section.title.length}/{META.SECTION_TITLE_MAX}
        </p>
        {section.rows.map((r, ri) => (
          <div key={ri} className="flex items-start gap-2">
            <div className="grid flex-1 grid-cols-3 gap-2">
              <Input
                placeholder="Row ID"
                value={r.id}
                onChange={(e) => updateRow(ri, "id", e.target.value)}
                maxLength={META.ROW_ID_MAX}
              />
              <Input
                placeholder="Title"
                value={r.title}
                onChange={(e) => updateRow(ri, "title", e.target.value)}
                maxLength={META.ROW_TITLE_MAX}
              />
              <Input
                placeholder="Description (optional)"
                value={r.description ?? ""}
                onChange={(e) => updateRow(ri, "description", e.target.value)}
                maxLength={META.ROW_DESC_MAX}
              />
            </div>
            {section.rows.length > META.ROW_MIN && (
              <Button variant="ghost" size="icon" onClick={() => removeRow(ri)}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {section.rows.length < META.ROW_MAX && (
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 size-3" /> Add Row
          </Button>
        )}
      </div>
    </div>
  )
}

function ListEditor({
  buttonText,
  sections,
  onButtonChange,
  onSectionsChange,
}: {
  buttonText: string
  sections: SectionData[]
  onButtonChange: (v: string) => void
  onSectionsChange: (s: SectionData[]) => void
}) {
  const updateSection = (i: number, s: SectionData) => {
    onSectionsChange(sections.map((sec, idx) => (idx === i ? s : sec)))
  }
  const addSection = () => {
    if (sections.length < META.SECTION_MAX)
      onSectionsChange([
        ...sections,
        { title: "", rows: [{ id: "", title: "" }] },
      ])
  }
  const removeSection = (i: number) => {
    if (sections.length > 1)
      onSectionsChange(sections.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>List Button Text</Label>
        <Input
          value={buttonText}
          onChange={(e) => onButtonChange(e.target.value)}
          maxLength={META.LIST_BUTTON_MAX}
        />
        <p className="text-[10px] text-muted-foreground">
          {buttonText.length}/{META.LIST_BUTTON_MAX}
        </p>
      </div>
      <div className="space-y-3">
        <Label>
          Sections ({sections.length}/{META.SECTION_MAX})
        </Label>
        {sections.map((s, i) => (
          <SectionEditor
            key={i}
            section={s}
            index={i}
            onChange={(updated) => updateSection(i, updated)}
            onRemove={() => removeSection(i)}
            canRemove={sections.length > 1}
          />
        ))}
        {sections.length < META.SECTION_MAX && (
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="mr-1 size-3" /> Add Section
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── JSON Preview ─────────────────────────────────────────────────────────────

function JsonPreview({ payload }: { payload: unknown }) {
  return (
    <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type InteractiveComposerProps = {
  onSend: (payload: {
    phoneNumber: string
    deviceId?: string
    interactive: unknown
  }) => Promise<void>
  devices?: Array<{ id: string; phoneNumber: string; status: string }>
  /** Override open state for parent control */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function InteractiveComposer({
  onSend,
  devices = [],
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: InteractiveComposerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen

  const [mode, setMode] = React.useState<ComposerMode>("buttons")
  const [state, setState] = React.useState<ComposerState>(INITIAL_STATE)
  const [showPreview, setShowPreview] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [deviceId, setDeviceId] = React.useState("")

  const payload = React.useMemo(() => buildPayload(mode, state), [mode, state])

  const validationError = React.useMemo(() => {
    if (!state.bodyText.trim()) return "Body text is required"
    if (state.bodyText.length > META.BODY_TEXT_MAX)
      return `Body text max ${META.BODY_TEXT_MAX} chars`
    if (state.footerText.length > META.FOOTER_TEXT_MAX)
      return `Footer text max ${META.FOOTER_TEXT_MAX} chars`
    if (mode === "buttons") return validateButtons(state.buttons)
    if (mode === "cta_url") return validateCtaUrl(state.ctaButtons)
    if (mode === "list")
      return validateList({
        button: state.listButton,
        sections: state.sections,
      })
    return null
  }, [mode, state])

  const resetForm = () => {
    setState(INITIAL_STATE)
    setPhoneNumber("")
    setDeviceId("")
    setShowPreview(false)
    setMode("buttons")
  }

  const handleSend = async () => {
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (!phoneNumber.trim()) {
      toast.error("Phone number is required")
      return
    }

    setSending(true)
    try {
      await onSend({
        phoneNumber: phoneNumber.trim(),
        deviceId: deviceId || undefined,
        interactive: payload,
      })
      toast.success(`Interactive message queued for delivery`)
      setOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" weight="bold" />
          Interactive Message
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Interactive Message</DialogTitle>
          <DialogDescription>
            Compose a Reply Buttons, List, or CTA URL message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mode selector */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as ComposerMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="buttons">Reply Buttons</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="cta_url">CTA URL</TabsTrigger>
            </TabsList>

            {/* Common fields */}
            <div className="mt-4 space-y-4">
              <div className="grid gap-2">
                <Label>Phone Number *</Label>
                <Input
                  placeholder="+628123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Header (optional)</Label>
                <Input
                  placeholder="Header text"
                  value={state.headerText}
                  onChange={(e) =>
                    setState({ ...state, headerText: e.target.value })
                  }
                  maxLength={META.HEADER_TEXT_MAX}
                />
                <p className="text-[10px] text-muted-foreground">
                  {state.headerText.length}/{META.HEADER_TEXT_MAX}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Body *</Label>
                <Textarea
                  placeholder="Message body text"
                  value={state.bodyText}
                  onChange={(e) =>
                    setState({ ...state, bodyText: e.target.value })
                  }
                  maxLength={META.BODY_TEXT_MAX}
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground">
                  {state.bodyText.length}/{META.BODY_TEXT_MAX}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Footer (optional)</Label>
                <Input
                  placeholder="Footer text"
                  value={state.footerText}
                  onChange={(e) =>
                    setState({ ...state, footerText: e.target.value })
                  }
                  maxLength={META.FOOTER_TEXT_MAX}
                />
                <p className="text-[10px] text-muted-foreground">
                  {state.footerText.length}/{META.FOOTER_TEXT_MAX}
                </p>
              </div>

              <TabsContent value="buttons" className="mt-0">
                <ButtonsEditor
                  buttons={state.buttons}
                  onChange={(b) => setState({ ...state, buttons: b })}
                />
              </TabsContent>

              <TabsContent value="list" className="mt-0">
                <ListEditor
                  buttonText={state.listButton}
                  sections={state.sections}
                  onButtonChange={(v) => setState({ ...state, listButton: v })}
                  onSectionsChange={(s) => setState({ ...state, sections: s })}
                />
              </TabsContent>

              <TabsContent value="cta_url" className="mt-0">
                <CtaUrlEditor
                  buttons={state.ctaButtons}
                  onChange={(b) => setState({ ...state, ctaButtons: b })}
                />
              </TabsContent>

              {/* Device selector */}
              {devices.length > 0 && (
                <div className="grid gap-2">
                  <Label>Device (optional)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                  >
                    <option value="">Auto-select device</option>
                    {devices.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        disabled={d.status !== "ACTIVE"}
                      >
                        {d.phoneNumber} {d.status !== "ACTIVE" && "(inactive)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Tabs>
        </div>

        {/* Validation error */}
        {validationError && (
          <p className="text-sm text-destructive">{validationError}</p>
        )}

        {/* Preview toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <EyeSlash className="mr-1 size-4" />
            ) : (
              <Eye className="mr-1 size-4" />
            )}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
        </div>
        {showPreview && <JsonPreview payload={payload} />}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !!validationError}>
            {sending
              ? "Sending..."
              : `Send ${mode === "buttons" ? "Buttons" : mode === "list" ? "List" : "CTA URL"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
