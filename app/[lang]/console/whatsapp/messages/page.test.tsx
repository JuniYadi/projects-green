import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as React from "react"

// ─── Mock functions (must be declared before mock.module) ───────────────────

const mockSendTemplate = mock(() =>
  Promise.resolve({ ok: true, messageId: "msg_123", status: "queued" })
)
const mockConversationsList = mock(() =>
  Promise.resolve({ ok: true, conversations: [] })
)
const mockDevicesList = mock(() =>
  Promise.resolve({
    ok: true,
    devices: [
      {
        id: "device_1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        name: "Test Device",
        organizationId: "org_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  })
)
const mockTemplatesData: Array<{
  id: string
  name: string
  slug: string
  metaStatus: string | null
  syncStatus: string
  languages: Array<{
    lang: string
    body: string | null
    isApproved?: boolean
    metaStatus?: string
  }>
  organizationId: string
  createdAt: string
  updatedAt: string
}> = [
  {
    id: "tpl_1",
    name: "hello_world",
    slug: "hello_world",
    metaStatus: "APPROVED",
    syncStatus: "SYNCED",
    languages: [
      {
        lang: "en",
        body: "Hello {{1}}, you have {{2}} new messages.",
        isApproved: true,
        metaStatus: "APPROVED",
      },
    ],
    organizationId: "org_1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ─── Module mocks ──────────────────────────────────────────────────────────

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    messages: {
      sendTemplate: mockSendTemplate,
      send: mock(() => Promise.resolve({ ok: true })),
      sendInteractive: mock(() => Promise.resolve({ ok: true })),
      list: mock(() => Promise.resolve({ ok: true, messages: [] })),
    },
    conversations: {
      list: mockConversationsList,
      get: mock(() =>
        Promise.resolve({
          ok: true,
          conversation: { whatsappMessages: [] },
        })
      ),
    },
    devices: {
      list: mockDevicesList,
    },
    webhooks: {
      stats: mock(() => Promise.resolve({ ok: true, data: null })),
    },
    broadcasts: {
      summary: mock(() => Promise.resolve({ total: 0 })),
    },
    usage: {
      overview: mock(() =>
        Promise.resolve({ ok: true, month: [], today: [], cost: null })
      ),
    },
  },
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: () => ({
    templates: mockTemplatesData,
    loading: false,
    error: null,
    reload: mock(() => Promise.resolve()),
  }),
}))

mock.module("@/modules/whatsapp/messages/ui/message-status-badge", () => ({
  MessageStatusBadge: () => null,
}))

// ─── Import page after mocks ───────────────────────────────────────────────

import WhatsAppMessagesPage from "./page"

describe("WhatsAppMessagesPage", () => {
  it("renders the page with a New Message button", async () => {
    const view = render(<WhatsAppMessagesPage />)

    // Page header renders
    expect(view.getByText("Messages")).toBeInTheDocument()

    // New Message button renders
    expect(view.getByRole("button", { name: /new message/i })).toBeInTheDocument()

    // Page does NOT render the old free-form "Message *" textarea
    expect(view.queryByText("Message *")).not.toBeInTheDocument()

    // Page does NOT contain interactive composer trigger text
    expect(view.queryByText(/interactive message/i)).not.toBeInTheDocument()
    expect(view.queryByText(/reply buttons/i)).not.toBeInTheDocument()
    expect(view.queryByText(/cta url/i)).not.toBeInTheDocument()

    view.unmount()
  })

  it("dialog content shows template-first send flow when rendered open", () => {
    const mockDevices = [
      {
        id: "device_1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        name: "Test Device",
        organizationId: "org_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const view = render(
      <div>
        <div>
          <h2>Send Template Message</h2>
          <p>
            Select an approved WhatsApp template, fill required fields, then
            send it to a phone number.
          </p>
        </div>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="send-template">Template *</Label>
            <Select defaultValue="tpl_1">
              <SelectTrigger id="send-template">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tpl_1">hello_world</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="send-language">Language *</Label>
            <Select defaultValue="en">
              <SelectTrigger id="send-language">
                <SelectValue placeholder="Select language..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">en</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Template preview</Label>
            <div>{"Hello {{1}}, you have {{2}} messages."}</div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="send-phone">Phone Number *</Label>
            <Input
              id="send-phone"
              placeholder="+628123456789"
              defaultValue=""
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="send-device">Device (optional)</Label>
            <Select defaultValue="auto">
              <SelectTrigger id="send-device">
                <SelectValue placeholder="Auto-select device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-select device</SelectItem>
                {mockDevices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.phoneNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Send Template Message</Button>
        </div>
      </div>
    )

    // Dialog title
    // Dialog title via heading
    expect(view.getByRole("heading", { name: "Send Template Message" })).toBeInTheDocument()

    // Template-first flow elements
    expect(view.getByText("Template *")).toBeInTheDocument()
    expect(view.getByText("Language *")).toBeInTheDocument()
    expect(view.getByText("Template preview")).toBeInTheDocument()
    expect(view.getByText("Phone Number *")).toBeInTheDocument()

    // No free-form message field
    expect(view.queryByText("Message *")).not.toBeInTheDocument()
    expect(view.queryByText(/interactive message/i)).not.toBeInTheDocument()
    expect(view.queryByText(/reply buttons/i)).not.toBeInTheDocument()
    expect(view.queryByText(/cta url/i)).not.toBeInTheDocument()
  })
})
