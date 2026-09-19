import { describe, expect, it, mock } from "bun:test"
import { renderToString } from "react-dom/server"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
  useRouter: () => ({ push: mock(() => {}) }),
}))

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
    warning: mock(() => {}),
  },
}))

import ActionIntentBuilder, {
  generateInquiryQuestion,
  inferSlotType,
  parseSampleJsonToSlots,
} from "./action-intent-builder"

describe("ActionIntentBuilder Unit Logic", () => {
  it("inferSlotType accurately detects NUMBER, DATE, and STRING", () => {
    expect(inferSlotType(12345)).toBe("NUMBER")
    expect(inferSlotType(0)).toBe("NUMBER")
    expect(inferSlotType(-42.5)).toBe("NUMBER")
    expect(inferSlotType("2026-09-19")).toBe("DATE")
    expect(inferSlotType("2026-09-19T00:00:00Z")).toBe("DATE")
    expect(inferSlotType("19/09/2026")).toBe("DATE")
    expect(inferSlotType("INV-12345")).toBe("STRING")
    expect(inferSlotType("Budi Santoso")).toBe("STRING")
    expect(inferSlotType(true)).toBe("STRING")
  })

  it("generateInquiryQuestion produces Indonesian questions", () => {
    expect(generateInquiryQuestion("no_kwitansi")).toBe(
      "Boleh minta no kwitansinya?"
    )
    expect(generateInquiryQuestion("birthDate")).toBe(
      "Boleh minta birth datenya?"
    )
    expect(generateInquiryQuestion("resi")).toBe("Boleh minta resinya?")
  })

  it("parseSampleJsonToSlots parses valid JSON sample into slot rows", () => {
    const sample = JSON.stringify({
      no_registrasi: "REG-991",
      tahun_lahir: 1995,
      tgl_pemeriksaan: "2026-09-19",
      catatan: "Puasa 8 jam",
    })

    const slots = parseSampleJsonToSlots(sample)
    expect(slots).toHaveLength(4)

    expect(slots[0].name).toBe("no_registrasi")
    expect(slots[0].type).toBe("STRING")
    expect(slots[0].required).toBe(true)

    expect(slots[1].name).toBe("tahun_lahir")
    expect(slots[1].type).toBe("NUMBER")

    expect(slots[2].name).toBe("tgl_pemeriksaan")
    expect(slots[2].type).toBe("DATE")

    expect(slots[3].name).toBe("catatan")
    expect(slots[3].type).toBe("STRING")
  })

  it("parseSampleJsonToSlots handles array of objects", () => {
    const sample = JSON.stringify([
      { sku: "BRG-01", qty: 10 },
      { sku: "BRG-02", qty: 5 },
    ])
    const slots = parseSampleJsonToSlots(sample)
    expect(slots).toHaveLength(2)
    expect(slots[0].name).toBe("sku")
    expect(slots[1].name).toBe("qty")
    expect(slots[1].type).toBe("NUMBER")
  })

  it("parseSampleJsonToSlots returns empty array for non-object json", () => {
    expect(parseSampleJsonToSlots('"plain string"')).toEqual([])
    expect(parseSampleJsonToSlots("123")).toEqual([])
    expect(parseSampleJsonToSlots("[]")).toEqual([])
  })
})

describe("ActionIntentBuilder Component Rendering", () => {
  it("renders Action Intent builder header and empty state", () => {
    const html = renderToString(
      <ActionIntentBuilder
        agents={[
          { id: "agent_1", name: "CS Bot" },
          { id: "agent_2", name: "Billing Bot" },
        ]}
        lang="id"
      />
    )

    expect(html).toContain("AI Agent Action Intent Builder")
    expect(html).toContain("Buat Action Intent Baru")
    expect(html).toContain("Belum ada Action Intent dibuat")
  })
})
