import { beforeEach, describe, expect, mock, test } from "bun:test"

const sendMessage = mock(async () => ({ jobId: "j" }))
const generateText = mock(async () => ({ text: "  generated answer  " }))
const resolveAiProviderConfig = mock(async () => ({
  provider: "openai",
  model: "gpt",
}))
const createAiLanguageModel = mock(() => ({}) as never)
mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: { sendMessage },
}))
mock.module("ai", () => ({ generateText }))
mock.module("@/modules/ai/ai-provider.factory", () => ({
  resolveAiProviderConfig,
  createAiLanguageModel,
}))
const { executeWorkflowNode } = await import("./workflow-executor")

const base = (node: unknown, extra: Record<string, unknown> = {}) => ({
  organizationId: "org",
  deviceId: "dev",
  phoneNumber: "+1",
  node: node as never,
  templateContext: { variables: {}, steps: {}, session: {} },
  ...extra,
})
describe("executeWorkflowNode", () => {
  beforeEach(() => {
    sendMessage.mockClear()
    generateText.mockClear()
    resolveAiProviderConfig.mockClear()
  })
  test("sends media and caption", async () => {
    const result = await executeWorkflowNode(
      base(
        {
          type: "send_message",
          id: "x",
          name: "x",
          config: {
            text: "hi",
            messageType: "image",
            mediaUrl: "{{variables.url}}",
            caption: "cap",
          },
        },
        {
          templateContext: {
            variables: { url: "https://x" },
            steps: {},
            session: {},
          },
        }
      )
    )
    expect(result).toEqual({
      status: "COMPLETED",
      outputPort: "default",
      stepOutput: { sent: true },
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "image",
        mediaUrl: "https://x",
        caption: "cap",
      })
    )
  })
  test("falls back to plain text for interactive non-button", async () => {
    await executeWorkflowNode(
      base({
        type: "send_interactive",
        id: "x",
        name: "x",
        config: { interactiveType: "list", bodyText: "Choose" },
      })
    )
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Choose" })
    )
  })
  test("rejects malformed and unsupported nodes", async () => {
    const bad = await executeWorkflowNode(
      base({
        type: "http_request",
        id: "x",
        name: "x",
        config: { url: "not a url", method: "GET" },
      })
    )
    expect(bad.errorMessage).toBe("Invalid URL format")
    const unsupported = await executeWorkflowNode(
      base({ type: "unknown", id: "x", name: "x", config: {} })
    )
    expect(unsupported.status).toBe("FAILED")
  })
  test("handles successful and failed HTTP responses", async () => {
    const original = globalThis.fetch
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    ) as never
    const ok = await executeWorkflowNode(
      base(
        {
          type: "http_request",
          id: "x",
          name: "x",
          config: {
            url: "https://example.com",
            method: "POST",
            forwardContext: true,
            headers: { Authorization: "Bearer x" },
          },
        },
        {
          templateContext: {
            variables: { customer_name: "Budi" },
            steps: { step_1: { done: true } },
            session: { phone_number: "+62811" },
          },
        }
      )
    )
    expect(ok.outputPort).toBe("success")
    globalThis.fetch = mock(
      async () => new Response("no", { status: 500 })
    ) as never
    const fail = await executeWorkflowNode(
      base({
        type: "http_request",
        id: "x",
        name: "x",
        config: { url: "https://example.com", method: "GET" },
      })
    )
    expect(fail.outputPort).toBe("error")
    globalThis.fetch = mock(async (url, init) => {
      expect(init?.method).toBe("PUT")
      expect(JSON.parse(init?.body as string)).toEqual({ updatedName: "Budi" })
      return new Response(JSON.stringify({ updated: true }), { status: 200 })
    }) as never
    const putResult = await executeWorkflowNode(
      base(
        {
          type: "http_request",
          id: "node_put",
          name: "PUT update",
          config: {
            url: "https://example.com/update",
            method: "PUT",
            bodyJson: { updatedName: "{{variables.customer_name}}" },
          },
        },
        {
          templateContext: {
            variables: { customer_name: "Budi" },
            steps: {},
            session: {},
          },
        }
      )
    )
    expect(putResult.outputPort).toBe("success")
    globalThis.fetch = original
  })
  test("generates AI output, does not send reply by default, and respects sendReply: true", async () => {
    const result = await executeWorkflowNode(
      base({
        type: "ai_generate",
        id: "x",
        name: "x",
        config: { prompt: "Say hi", captureVariable: "answer" },
      })
    )
    expect(result.capturedVariable).toEqual({
      name: "answer",
      value: "generated answer",
    })
    expect(sendMessage).not.toHaveBeenCalled()

    sendMessage.mockClear()
    const replyResult = await executeWorkflowNode(
      base({
        type: "ai_generate",
        id: "x",
        name: "x",
        config: {
          prompt: "Say hi",
          captureVariable: "answer",
          sendReply: true,
        },
      })
    )
    expect(replyResult.status).toBe("COMPLETED")
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "+1",
        message: "generated answer",
      })
    )
    resolveAiProviderConfig.mockRejectedValueOnce(
      new Error("provider unavailable")
    )
    const failed = await executeWorkflowNode(
      base({
        type: "ai_generate",
        id: "x",
        name: "x",
        config: { prompt: "Say hi", captureVariable: "answer" },
      })
    )
    expect(failed.status).toBe("FAILED")
  })
})
