import { createOpenAI } from "@ai-sdk/openai"
import { embed } from "ai"

const EMBEDDING_DIMENSIONS = 1536

type EmbeddingResult = {
  embedding: number[]
}

/**
 * Generate embedding vector for a text using OpenAI's embedding model.
 * Uses AI_EMBEDDING_MODEL env var, falls back to text-embedding-3-small.
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  const apiKey = process.env.AI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured")
  }

  const modelName =
    process.env.AI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small"

  const provider = createOpenAI({ apiKey })

  const { embedding } = await embed({
    model: provider.textEmbeddingModel(modelName),
    value: text,
  })

  return {
    embedding: embedding as number[],
  }
}

/**
 * Generate embedding for a knowledge document — combines searchable text fields.
 */
export async function embedDocument(input: {
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes: string[]
}): Promise<number[]> {
  const combinedText = [
    `Title: ${input.title}`,
    `Path: ${input.path}`,
    `Purpose: ${input.purpose}`,
    input.howTo.length ? `How to:\n${input.howTo.map((h) => `- ${h}`).join("\n")}` : "",
    input.notes.length ? `Notes:\n${input.notes.map((n) => `- ${n}`).join("\n")}` : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n\n")

  const { embedding } = await generateEmbedding(combinedText)

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
    )
  }

  return embedding
}

export { EMBEDDING_DIMENSIONS }