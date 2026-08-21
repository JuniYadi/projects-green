import { describe, expect, it } from "bun:test"
import { logger } from "./logger"

describe("centralized logger", () => {
  it("exports a valid pino logger instance with expected methods", () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe("function")
    expect(typeof logger.error).toBe("function")
    expect(typeof logger.warn).toBe("function")
    expect(typeof logger.debug).toBe("function")
    expect(typeof logger.child).toBe("function")
  })
})
