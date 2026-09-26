import pino from "pino"

const isDevelopment = process.env.NODE_ENV !== "production"
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  base: undefined, // Remove pid and hostname for cleaner output
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
})

export type Logger = typeof logger

export type AiBotChannel = "WHATSAPP" | "WEB_LIVECHAT" | "CONSOLE"

export type LogStageFailureParams = {
  agentProfileId?: string
  sessionId?: string
  channel: AiBotChannel
  stage: string
  error: unknown
}

/**
 * Emits one structured `ai_bot.stage_failed` warning for a bot-pipeline
 * stage failure (provider resolution, generation, or a send call), so no
 * failure on the WhatsApp/widget/simulator paths is ever silent.
 */
export function logStageFailure(params: LogStageFailureParams): void {
  const { error, ...context } = params
  logger.warn(
    {
      event: "ai_bot.stage_failed",
      ...context,
      error: error instanceof Error ? error.message : String(error),
    },
    "AI bot stage failed"
  )
}
