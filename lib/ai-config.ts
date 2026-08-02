export const DEFAULT_AI_BASE_URL = "https://openrouter.ai/api/v1"

export const getAiProviderConfig = (): {
  apiKey: string
  baseURL: string
} => {
  const apiKey = process.env.AI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured")
  }

  return {
    apiKey,
    baseURL: process.env.AI_BASE_URL?.trim() || DEFAULT_AI_BASE_URL,
  }
}
