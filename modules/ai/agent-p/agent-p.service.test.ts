import { beforeEach, describe, expect, it, mock } from "bun:test"
import { z } from "zod"
import type { ResolvedAiProvider } from "@/modules/ai/ai-provider.factory"

const streamTextMock = mock(() => ({ textStream: "stream" }))
const generateObjectMock = mock(async () => ({ object: { answer: "ok" } }))

mock.module("ai", () => ({
  generateObject: generateObjectMock,
  streamText: streamTextMock,
  tool: (definition: unknown) => definition,
}))

const { AgentPService } = await import("./agent-p.service")

const options = {
  organizationId: "org-1",
  userId: "user-1",
  role: "ADMIN",
  prompt: "Hello",
}

describe("AgentPService", () => {
  beforeEach(() => {
    streamTextMock.mockClear()
    generateObjectMock.mockClear()
    process.env.AI_PROVIDER = "OPENROUTER"
  })

  it("resolves an OpenRouter model and streams with session context", async () => {
    const resolveProvider = mock(async () => ({
      providerType: "OPENAI_COMPATIBLE" as const,
      baseUrl: "https://example.test/v1",
      defaultModel: "model",
      apiKey: "key",
    }))
    const createModel = mock(() => ({}) as never)
    const service = new AgentPService({ resolveProvider, createModel })

    await service.stream(options)

    expect(resolveProvider).toHaveBeenCalledWith({
      organizationId: "org-1",
      providerId: undefined,
      modelOverride: undefined,
    })
    expect(createModel).toHaveBeenCalled()
    const firstCall = createModel.mock.calls[0] as unknown as
      [ResolvedAiProvider] | undefined
    expect(firstCall?.[0].providerType).toBe("MANAGED")
    expect(streamTextMock).toHaveBeenCalled()
  })

  it("uses OpenAI-compatible selection for structured generation", async () => {
    process.env.AI_PROVIDER = "OPENAI_COMPATIBLE"
    const createModel = mock(() => ({}) as never)
    const service = new AgentPService({
      resolveProvider: mock(async () => ({
        providerType: "MANAGED" as const,
        baseUrl: null,
        defaultModel: "model",
        apiKey: "key",
      })),
      createModel,
    })

    const result = await service.generateObject({
      ...options,
      schema: z.object({ answer: z.string() }),
    })

    expect(result.object.answer).toBe("ok")
    expect(createModel).toHaveBeenCalled()
    const firstCall = createModel.mock.calls[0] as unknown as
      [ResolvedAiProvider] | undefined
    expect(firstCall?.[0].providerType).toBe("OPENAI_COMPATIBLE")
    expect(generateObjectMock).toHaveBeenCalled()
  })
})
