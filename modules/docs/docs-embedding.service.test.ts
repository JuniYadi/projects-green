import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockEmbed = mock(() =>
  Promise.resolve({
    embedding: new Array(1536).fill(0.123),
  })
)

const mockTextEmbeddingModel = mock((modelName: string) => ({
  modelId: modelName,
}))

const mockCreateOpenAI = mock(() => ({
  textEmbeddingModel: mockTextEmbeddingModel,
}))

mock.module("ai", () => ({
  embed: mockEmbed,
}))

mock.module("@ai-sdk/openai", () => ({
  createOpenAI: mockCreateOpenAI,
}))

mock.module("@/lib/ai-config", () => ({
  getAiProviderConfig: () => ({
    apiKey: "test-openai-key",
  }),
}))

import {
  EMBEDDING_DIMENSIONS,
  embedDocument,
  generateEmbedding,
} from "./docs-embedding.service"

describe("docs-embedding.service", () => {
  beforeEach(() => {
    mockEmbed.mockClear()
    mockTextEmbeddingModel.mockClear()
    mockCreateOpenAI.mockClear()
  })

  it("exports EMBEDDING_DIMENSIONS constant as 1536", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1536)
  })

  it("generates embedding using default model text-embedding-3-small", async () => {
    delete process.env.AI_EMBEDDING_MODEL

    const result = await generateEmbedding("Sample text for embedding")

    expect(mockTextEmbeddingModel).toHaveBeenCalledWith(
      "text-embedding-3-small"
    )
    expect(mockEmbed).toHaveBeenCalledWith({
      model: expect.anything(),
      value: "Sample text for embedding",
    })
    expect(result.embedding).toHaveLength(1536)
    expect(result.embedding[0]).toBe(0.123)
  })

  it("uses AI_EMBEDDING_MODEL env variable when configured", async () => {
    process.env.AI_EMBEDDING_MODEL = "text-embedding-3-large"

    await generateEmbedding("Text with custom model")

    expect(mockTextEmbeddingModel).toHaveBeenCalledWith(
      "text-embedding-3-large"
    )

    delete process.env.AI_EMBEDDING_MODEL
  })

  it("formats structured document and returns embedding vector", async () => {
    const docInput = {
      path: "docs/getting-started.md",
      title: "Getting Started",
      purpose: "Provide developer onboarding instructions",
      howTo: ["Clone repository", "Install dependencies", "Run bun dev"],
      notes: ["Requires Node/Bun 1.3+", "Postgres must be running"],
    }

    const embedding = await embedDocument(docInput)

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        value:
          "Title: Getting Started\n\n" +
          "Path: docs/getting-started.md\n\n" +
          "Purpose: Provide developer onboarding instructions\n\n" +
          "How to:\n- Clone repository\n- Install dependencies\n- Run bun dev\n\n" +
          "Notes:\n- Requires Node/Bun 1.3+\n- Postgres must be running",
      })
    )
    expect(embedding).toHaveLength(1536)
  })

  it("handles document with empty howTo and notes lists", async () => {
    const docInput = {
      path: "docs/overview.md",
      title: "Overview",
      purpose: "High level architecture",
      howTo: [],
      notes: [],
    }

    const embedding = await embedDocument(docInput)

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        value:
          "Title: Overview\n\n" +
          "Path: docs/overview.md\n\n" +
          "Purpose: High level architecture",
      })
    )
    expect(embedding).toHaveLength(1536)
  })

  it("throws error when embedding vector dimensions do not match expected 1536", async () => {
    mockEmbed.mockResolvedValueOnce({
      embedding: [0.1, 0.2, 0.3], // invalid dimension length 3 != 1536
    } as never)

    const docInput = {
      path: "docs/error.md",
      title: "Error Doc",
      purpose: "Testing error handling",
      howTo: [],
      notes: [],
    }

    await expect(embedDocument(docInput)).rejects.toThrow(
      "Embedding dimension mismatch: expected 1536, got 3"
    )
  })
})
