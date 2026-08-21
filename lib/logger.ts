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
