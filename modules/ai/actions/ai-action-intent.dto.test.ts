import { describe, expect, it } from "bun:test"
import {
  parseActionSlots,
  toAiActionIntentDTO,
} from "./ai-action-intent.dto"

describe("ai-action-intent.dto", () => {
  it("parseActionSlots parses slots from string or array", () => {
    const rawArray = [
      {
        name: "phone",
        type: "STRING",
        required: true,
        inquiryQuestion: "Nomor?",
      },
    ]
    const parsed = parseActionSlots(rawArray)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe("phone")
    expect(parsed[0].type).toBe("STRING")
  })

  it("toAiActionIntentDTO formats database entity to DTO", () => {
    const entity = {
      id: "act_100",
      organizationId: "org_100",
      agentProfileId: "ag_1",
      name: "Cek Kwitansi",
      description: "Untuk cek kwitansi",
      connectionId: "conn_1",
      subpath: "/receipt",
      method: "GET",
      slots: [
        {
          name: "kwitansi",
          type: "STRING",
          required: true,
          inquiryQuestion: "Nomor kwitansi?",
        },
      ],
      requireCustomerConfirmation: true,
      enableMultimodalVision: true,
      isActive: true,
      createdAt: new Date("2026-09-19T00:00:00.000Z"),
      updatedAt: new Date("2026-09-19T00:00:00.000Z"),
      connection: { name: "Finance API" },
    }

    const dto = toAiActionIntentDTO(entity)
    expect(dto.id).toBe("act_100")
    expect(dto.connectionName).toBe("Finance API")
    expect(dto.requireCustomerConfirmation).toBe(true)
    expect(dto.enableMultimodalVision).toBe(true)
    expect(dto.slots).toHaveLength(1)
    expect(dto.slots[0].name).toBe("kwitansi")
  })
})
