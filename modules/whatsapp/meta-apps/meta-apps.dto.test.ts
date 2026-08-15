import { describe, expect, it } from "bun:test"

import {
  toWhatsappMetaAppDTO,
  toWhatsappMetaAppListItemDTO,
} from "./meta-apps.dto"

const app = {
  id: "meta-app-1",
  name: "Primary app",
  metaAppId: "meta-123",
  appSecretEncrypted: "encrypted-secret",
  verifyTokenEncrypted: "encrypted-token",
  webhookKey: "webhook-key",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

describe("WhatsApp Meta app DTO mappers", () => {
  it("maps a WhatsApp Meta app to a DTO", () => {
    expect(toWhatsappMetaAppDTO(app)).toEqual({
      id: app.id,
      name: app.name,
      metaAppId: app.metaAppId,
      webhookKey: app.webhookKey,
      active: app.active,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      callbackPath: `/api/whatsapp/meta-webhook/${app.webhookKey}`,
    })
  })

  it("maps a WhatsApp Meta app to a list item DTO", () => {
    expect(
      toWhatsappMetaAppListItemDTO({
        ...app,
        _count: { devices: 3 },
      })
    ).toEqual({
      id: app.id,
      name: app.name,
      metaAppId: app.metaAppId,
      webhookKey: app.webhookKey,
      active: app.active,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      callbackPath: `/api/whatsapp/meta-webhook/${app.webhookKey}`,
      deviceCount: 3,
    })
  })
})
