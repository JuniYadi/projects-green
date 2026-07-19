import { describe, expect, it } from "bun:test"
import {
  actionTone,
  extractKnownDetails,
  extractOtherDetails,
} from "./whatsapp-audit-details"

describe("actionTone", () => {
  it('returns "success" for SYNCED, CREATED, UPDATED, SENT, DELIVERED, IMPORTED actions', () => {
    expect(actionTone("TEMPLATE_SYNCED")).toBe("success")
    expect(actionTone("TEMPLATE_CREATED")).toBe("success")
    expect(actionTone("TEMPLATE_UPDATED")).toBe("success")
    expect(actionTone("MESSAGE_SENT")).toBe("success")
    expect(actionTone("MESSAGE_DELIVERED")).toBe("success")
    expect(actionTone("CONTACT_IMPORTED")).toBe("success")
  })

  it('returns "danger" for FAILED, CANCELLED, DELETED actions', () => {
    expect(actionTone("TEMPLATE_SYNC_FAILED")).toBe("danger")
    expect(actionTone("TEMPLATE_CREATE_FAILED")).toBe("danger")
    expect(actionTone("BROADCAST_CANCELLED")).toBe("danger")
    expect(actionTone("TEMPLATE_DELETED")).toBe("danger")
  })

  it('returns "warning" for REQUESTED, RETRIED, STATUS_CHANGED actions', () => {
    expect(actionTone("TEMPLATE_SYNC_REQUESTED")).toBe("warning")
    expect(actionTone("WEBHOOK_RETRIED")).toBe("warning")
    expect(actionTone("DEVICE_STATUS_CHANGED")).toBe("warning")
  })

  it('returns "neutral" for READ action', () => {
    expect(actionTone("MESSAGE_READ")).toBe("neutral")
  })
})

describe("extractKnownDetails", () => {
  it("returns empty object for null details", () => {
    expect(extractKnownDetails(null)).toEqual({})
  })

  it("returns truthy known keys", () => {
    const details = {
      templateId: "tpl-1",
      slug: "welcome",
      waMessageId: "wamid-1",
      source: "import",
    }
    const result = extractKnownDetails(details)
    expect(result.templateId).toBe("tpl-1")
    expect(result.slug).toBe("welcome")
  })

  it("skips null and empty values", () => {
    const details = { templateId: null, slug: "" }
    expect(extractKnownDetails(details)).toEqual({})
  })
})

describe("extractOtherDetails", () => {
  it("excludes known keys", () => {
    const details = {
      templateId: "tpl-1",
      customField: "custom-val",
      extraData: 42,
    }
    const result = extractOtherDetails(details)
    expect(result.customField).toBe("custom-val")
    expect(result.extraData).toBe(42)
    expect((result as any).templateId).toBeUndefined()
  })
})
