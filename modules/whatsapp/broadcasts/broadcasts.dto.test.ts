import { describe, expect, it } from "bun:test"
import {
  WhatsappBroadcastRecipientStatus,
  WhatsappBroadcastStatus,
  type Prisma,
} from "@prisma/client"
import {
  toWhatsappBroadcastCampaignDTO,
  toWhatsappBroadcastRecipientDTO,
} from "./broadcasts.dto"

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const recipient = {
  id: "recipient-1",
  broadcastId: "campaign-1",
  phoneNumber: "+628123456789",
  name: "Ayu",
  dynamicValues: { "{{1}}": "Ayu" },
  status: WhatsappBroadcastRecipientStatus.QUEUED,
  attempts: 0,
  waMessageId: null,
  lastError: null,
  createdAt,
  updatedAt,
} satisfies Prisma.WhatsappBroadcastRecipientGetPayload<Prisma.WhatsappBroadcastRecipientDefaultArgs>

const campaign = {
  id: "campaign-1",
  organizationId: "org-1",
  templateId: "template-1",
  templateName: "Authoritative template",
  templateLanguage: "id",
  templateParams: { category: "MARKETING" },
  throttleMaxMessages: 40,
  throttlePerMinutes: 60,
  acknowledgeMultiDay: true,
  status: WhatsappBroadcastStatus.QUEUED,
  total: 1,
  queued: 1,
  sent: 0,
  failed: 0,
  startedAt: null,
  endedAt: null,
  createdAt,
  updatedAt,
  whatsappDeviceId: "device-1",
  whatsappContactGroupId: null,
} satisfies Prisma.WhatsappBroadcastCampaignGetPayload<Prisma.WhatsappBroadcastCampaignDefaultArgs>

describe("WhatsApp broadcast DTOs", () => {
  it("exposes the selected template and multi-day acknowledgement", () => {
    expect(toWhatsappBroadcastCampaignDTO(campaign)).toEqual({
      id: "campaign-1",
      templateId: "template-1",
      templateName: "Authoritative template",
      templateLanguage: "id",
      templateParams: { category: "MARKETING" },
      status: WhatsappBroadcastStatus.QUEUED,
      total: 1,
      queued: 1,
      sent: 0,
      failed: 0,
      startedAt: null,
      endedAt: null,
      createdAt,
      updatedAt,
      throttleMaxMessages: 40,
      throttlePerMinutes: 60,
      acknowledgeMultiDay: true,
      recipients: undefined,
      recipientCount: undefined,
    })
  })

  it("maps a recipient without exposing persistence-only fields", () => {
    expect(toWhatsappBroadcastRecipientDTO(recipient)).toEqual({
      id: "recipient-1",
      phoneNumber: "+628123456789",
      name: "Ayu",
      dynamicValues: { "{{1}}": "Ayu" },
      status: WhatsappBroadcastRecipientStatus.QUEUED,
      attempts: 0,
      waMessageId: null,
      lastError: null,
      createdAt,
      updatedAt,
    })
  })
})
