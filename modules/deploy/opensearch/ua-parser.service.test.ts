import { describe, it, expect } from "bun:test"
import { parseUserAgent } from "./ua-parser.service"

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
const CURL = "curl/7.68.0"

describe("ua-parser.service", () => {
  it("classifies a desktop browser as human, not automated", () => {
    const result = parseUserAgent(CHROME_WINDOWS)
    expect(result.browserFamily).toBe("Chrome")
    expect(result.osFamily).toBe("Windows")
    expect(result.deviceClass).toBe("desktop")
    expect(result.isAutomated).toBe(false)
  })

  it("classifies a mobile Safari UA as mobile", () => {
    const result = parseUserAgent(SAFARI_IPHONE)
    expect(result.deviceClass).toBe("mobile")
    expect(result.isAutomated).toBe(false)
  })

  it("classifies an iPad UA as tablet", () => {
    const result = parseUserAgent(SAFARI_IPAD)
    expect(result.deviceClass).toBe("tablet")
  })

  it("flags a known crawler as bot/automated", () => {
    const result = parseUserAgent(GOOGLEBOT)
    expect(result.deviceClass).toBe("bot")
    expect(result.isAutomated).toBe(true)
    expect(result.browserFamily).toBe("Bot/Crawler")
    expect(result.automationReason).toBeTruthy()
  })

  it("flags a known CLI/HTTP client as bot/automated", () => {
    const result = parseUserAgent(CURL)
    expect(result.deviceClass).toBe("bot")
    expect(result.isAutomated).toBe(true)
    expect(result.browserFamily).toBe("CLI/HTTP Client")
  })

  it("treats an empty or missing User-Agent as automated/unknown, not silently human", () => {
    expect(parseUserAgent("").isAutomated).toBe(true)
    expect(parseUserAgent(undefined).isAutomated).toBe(true)
    expect(parseUserAgent(null).deviceClass).toBe("other")
  })

  it("flags an unrecognized garbage UA as automated instead of guessing desktop", () => {
    const result = parseUserAgent("this-is-not-a-real-browser-string-12345")
    expect(result.browserFamily).toBe("Unknown")
    expect(result.isAutomated).toBe(true)
    expect(result.deviceClass).toBe("other")
  })
})
