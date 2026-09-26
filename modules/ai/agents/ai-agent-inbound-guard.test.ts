import { describe, expect, it } from "bun:test"

import { checkInboundAgentGuardrails } from "./ai-agent-inbound-guard"

describe("modules/ai/agents/ai-agent-inbound-guard", () => {
  it("allows text within limits", () => {
    const result = checkInboundAgentGuardrails({
      text: "Halo, ada promo hari ini?",
      maxCharLength: 800,
      enableProfanityFilter: true,
      customBlockedWords: ["kasar"],
      fallbackMessage: "Maaf, coba lagi nanti.",
      dailyUserLimit: 30,
      currentMessageCount: 5,
    })

    expect(result).toEqual({ ok: true })
  })

  it("blocks over maxCharLength with null message", () => {
    const result = checkInboundAgentGuardrails({
      text: "Pesan ini terlalu panjang sekali.",
      maxCharLength: 10,
      fallbackMessage: "Maaf, coba lagi nanti.",
    })

    expect(result).toEqual({
      ok: false,
      reason: "MAX_CHAR_EXCEEDED",
      replyMessage: null,
    })
  })

  it("blocks blocked word with fallbackMessage", () => {
    const result = checkInboundAgentGuardrails({
      text: "Dasar kata Kasar kamu!",
      maxCharLength: 500,
      enableProfanityFilter: true,
      customBlockedWords: ["kasar", "anjing"],
      fallbackMessage: "Mohon gunakan bahasa yang sopan.",
    })

    expect(result).toEqual({
      ok: false,
      reason: "BLOCKED_WORD_TRIGGERED",
      replyMessage: "Mohon gunakan bahasa yang sopan.",
    })
  })

  it("blocks blocked word without inventing a message when unset", () => {
    const result = checkInboundAgentGuardrails({
      text: "Dasar kasar kamu!",
      maxCharLength: 500,
      enableProfanityFilter: true,
      customBlockedWords: ["kasar"],
      fallbackMessage: null,
    })

    expect(result).toEqual({
      ok: false,
      reason: "BLOCKED_WORD_TRIGGERED",
      replyMessage: null,
    })
  })

  it("blocks at daily limit", () => {
    const result = checkInboundAgentGuardrails({
      text: "Halo lagi",
      maxCharLength: 500,
      dailyUserLimit: 1,
      fallbackMessage: "Batas chat harian Anda telah habis.",
      currentMessageCount: 1,
    })

    expect(result).toEqual({
      ok: false,
      reason: "DAILY_LIMIT_REACHED",
      replyMessage: "Batas chat harian Anda telah habis.",
    })
  })

  it("skips the daily-limit check when currentMessageCount is omitted", () => {
    const result = checkInboundAgentGuardrails({
      text: "Halo",
      maxCharLength: 500,
      dailyUserLimit: 0,
    })

    expect(result).toEqual({ ok: true })
  })

  it("matches blocked words case-insensitively", () => {
    const result = checkInboundAgentGuardrails({
      text: "KAMU ANJING BANGET",
      maxCharLength: 500,
      enableProfanityFilter: true,
      customBlockedWords: ["Anjing"],
      fallbackMessage: "Mohon gunakan bahasa yang sopan.",
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toBe("BLOCKED_WORD_TRIGGERED")
  })
})
