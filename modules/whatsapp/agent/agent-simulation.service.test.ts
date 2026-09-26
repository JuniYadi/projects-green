import { describe, it, expect, mock, beforeEach } from "bun:test"
import {
  simulateAgentInference,
  checkSimulationRateLimit,
  resetSimulationRateLimit,
  type AgentSimulateInput,
  type AgentSimulationDependencies,
} from "./agent-simulation.service"

describe("agent-simulation.service", () => {
  beforeEach(() => {
    resetSimulationRateLimit()
  })

  describe("rate limiting", () => {
    it("allows requests under the limit and blocks exceeding requests", () => {
      const orgId = "org_ratelimit_test"
      for (let i = 0; i < 5; i++) {
        const check = checkSimulationRateLimit(orgId, 5, 60_000)
        expect(check.allowed).toBe(true)
      }
      const blocked = checkSimulationRateLimit(orgId, 5, 60_000)
      expect(blocked.allowed).toBe(false)
      expect(blocked.retryAfterSec).toBeGreaterThan(0)

      resetSimulationRateLimit(orgId)
      const allowedAfterReset = checkSimulationRateLimit(orgId, 5, 60_000)
      expect(allowedAfterReset.allowed).toBe(true)
    })

    it("evicts expired rate limit entries when map grows", () => {
      // Seed 55 expired entries
      for (let i = 0; i < 55; i++) {
        checkSimulationRateLimit(`expired_org_${i}`, 5, -1000)
      }
      // Next call triggers eviction of expired entries
      const check = checkSimulationRateLimit("active_org", 5, 60_000)
      expect(check.allowed).toBe(true)
    })
  })

  describe("simulateAgentInference", () => {
    it("returns validation error for missing or empty fields", async () => {
      const auth = { orgId: "org_1" }

      const res1 = await simulateAgentInference(
        { agentProfileId: "", message: "Halo" },
        auth
      )
      expect(res1.ok).toBe(false)
      if (!res1.ok) {
        expect(res1.error).toBe("VALIDATION_ERROR")
        expect(res1.status).toBe(400)
      }

      const res2 = await simulateAgentInference(
        { agentProfileId: "agent_1", message: "   " },
        auth
      )
      expect(res2.ok).toBe(false)
      if (!res2.ok) {
        expect(res2.error).toBe("VALIDATION_ERROR")
        expect(res2.status).toBe(400)
      }
    })

    it("returns NOT_FOUND when agent does not exist", async () => {
      const auth = { orgId: "org_1" }
      const deps: AgentSimulationDependencies = {
        findAgent: mock(async () => null),
      }

      const res = await simulateAgentInference(
        { agentProfileId: "agent_999", message: "Halo" },
        auth,
        deps
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe("NOT_FOUND")
        expect(res.status).toBe(404)
      }
    })

    it("returns AGENT_INACTIVE when agent isActive is false", async () => {
      const auth = { orgId: "org_1" }
      const deps: AgentSimulationDependencies = {
        findAgent: mock(async () => ({
          id: "agent_inactive",
          organizationId: "org_1",
          name: "Inactive Bot",
          systemPrompt: "Prompt",
          fallbackMessage: "Offline",
          allowInteractiveReplies: false,
          isActive: false,
        })),
      }

      const res = await simulateAgentInference(
        { agentProfileId: "agent_inactive", message: "Halo" },
        auth,
        deps
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe("AGENT_INACTIVE")
        expect(res.status).toBe(400)
      }
    })

    it("returns AI_PROVIDER_ERROR when provider resolution fails", async () => {
      const auth = { orgId: "org_1" }
      const deps: AgentSimulationDependencies = {
        findAgent: mock(async () => ({
          id: "agent_active",
          organizationId: "org_1",
          name: "Bot",
          systemPrompt: "Prompt",
          fallbackMessage: "Offline",
          allowInteractiveReplies: false,
          isActive: true,
        })),
        resolveProvider: mock(async () => {
          throw new Error("Missing API credentials in Vault")
        }),
      }

      const res = await simulateAgentInference(
        { agentProfileId: "agent_active", message: "Halo" },
        auth,
        deps
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe("AI_PROVIDER_ERROR")
        expect(res.status).toBe(500)
      }
    })

    it("returns INFERENCE_ERROR when generateText fails", async () => {
      const auth = { orgId: "org_1" }
      const deps: AgentSimulationDependencies = {
        findAgent: mock(async () => ({
          id: "agent_active",
          organizationId: "org_1",
          name: "Bot",
          systemPrompt: "Prompt",
          fallbackMessage: "Offline",
          allowInteractiveReplies: false,
          isActive: true,
        })),
        resolveProvider: mock(async () => ({
          providerType: "MANAGED" as const,
          baseUrl: null,
          defaultModel: "gpt-4o",
          apiKey: "key",
        })),
        createModel: mock(() => ({}) as never),
        buildTools: mock(async () => ({})),
        generate: mock(async () => {
          throw new Error("LLM Rate limit exceeded on OpenRouter")
        }),
      }

      const res = await simulateAgentInference(
        { agentProfileId: "agent_active", message: "Halo" },
        auth,
        deps
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe("INFERENCE_ERROR")
        expect(res.status).toBe(500)
        expect(res.message).toContain("Offline")
      }
    })

    it("returns TIMEOUT with fallbackMessage and latencyMs when generate times out", async () => {
      const auth = { orgId: "org_1" }
      const deps: AgentSimulationDependencies = {
        findAgent: mock(async () => ({
          id: "agent_active",
          organizationId: "org_1",
          name: "Bot",
          systemPrompt: "Prompt",
          fallbackMessage: "Mohon coba lagi nanti.",
          allowInteractiveReplies: false,
          isActive: true,
        })),
        resolveProvider: mock(async () => ({
          providerType: "MANAGED" as const,
          baseUrl: null,
          defaultModel: "gpt-4o",
          apiKey: "key",
        })),
        createModel: mock(() => ({}) as never),
        buildTools: mock(async () => ({})),
        generate: mock(async () => {
          throw Object.assign(new Error("timed out"), {
            name: "TimeoutError",
          })
        }),
      }

      const res = await simulateAgentInference(
        { agentProfileId: "agent_active", message: "Halo" },
        auth,
        deps
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe("TIMEOUT")
        expect(res.status).toBe(500)
        expect(res.message).toContain("Mohon coba lagi nanti.")
        expect(res.message).toMatch(/latency: \d+ms/)
      }
    })

    it("uses fallbackMessage when model returns empty text", async () => {
      const auth = { orgId: "org_1" }
      const deps: AgentSimulationDependencies = {
        findAgent: mock(async () => ({
          id: "agent_active",
          organizationId: "org_1",
          name: "Bot",
          systemPrompt: "Prompt",
          fallbackMessage: "Pesan fallback toko",
          allowInteractiveReplies: false,
          isActive: true,
        })),
        resolveProvider: mock(async () => ({
          providerType: "MANAGED" as const,
          baseUrl: null,
          defaultModel: "gpt-4o",
          apiKey: "key",
        })),
        createModel: mock(() => ({}) as never),
        buildTools: mock(async () => ({})),
        generate: mock(
          async () =>
            ({
              text: "",
              usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
            }) as never
        ),
      }

      const res = await simulateAgentInference(
        { agentProfileId: "agent_active", message: "Halo" },
        auth,
        deps
      )
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data.replyText).toBe("Pesan fallback toko")
        expect(res.data.rawText).toBe("Pesan fallback toko")
      }
    })
  })
})
