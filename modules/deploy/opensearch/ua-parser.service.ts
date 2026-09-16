import { UAParser } from "ua-parser-js"

export type DeviceClass = "desktop" | "mobile" | "tablet" | "bot" | "other"

export interface ParsedUserAgent {
  browserFamily: string
  osFamily: string
  deviceClass: DeviceClass
  /** Conservative automation signal, independent of ua-parser-js's own (v1 has no bot detection). */
  isAutomated: boolean
  automationReason?: string
}

// ponytail: fixed fragment lists, not a maintained bot database (that's what
// UAParser v2 PRO sells) -- covers common search/social crawlers and CLI/
// HTTP-library clients. Extend the lists if a real scanner slips through.
// Exported (not just the derived regex) so the OpenSearch query layer can
// build an equivalent "automated" filter from the SAME source instead of a
// second, independently-drifting pattern list -- see traffic-classification.service.ts.
export const BOT_SIGNAL_FRAGMENTS = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "facebookexternalhit",
  "slackbot",
  "twitterbot",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "preview",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
]

export const CLI_CLIENT_SIGNAL_FRAGMENTS = [
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "okhttp",
  "axios/",
  "node-fetch",
  "postmanruntime",
  "insomnia",
  "apache-httpclient",
  "libwww-perl",
  "scrapy",
  "go-resty",
]

function fragmentsToRegex(fragments: string[]): RegExp {
  const escaped = fragments.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  return new RegExp(escaped.join("|"), "i")
}

const KNOWN_BOT_PATTERNS = fragmentsToRegex(BOT_SIGNAL_FRAGMENTS)
const KNOWN_CLI_CLIENT_PATTERNS = fragmentsToRegex(CLI_CLIENT_SIGNAL_FRAGMENTS)

export function parseUserAgent(
  rawUserAgent: string | undefined | null
): ParsedUserAgent {
  const ua = (rawUserAgent ?? "").trim()

  if (!ua) {
    return {
      browserFamily: "Unknown",
      osFamily: "Unknown",
      deviceClass: "other",
      isAutomated: true,
      automationReason: "Empty or missing User-Agent",
    }
  }

  if (KNOWN_CLI_CLIENT_PATTERNS.test(ua)) {
    return {
      browserFamily: "CLI/HTTP Client",
      osFamily: "Unknown",
      deviceClass: "bot",
      isAutomated: true,
      automationReason: "Known CLI/HTTP client signature",
    }
  }

  if (KNOWN_BOT_PATTERNS.test(ua)) {
    return {
      browserFamily: "Bot/Crawler",
      osFamily: "Unknown",
      deviceClass: "bot",
      isAutomated: true,
      automationReason: "Known bot/crawler signature",
    }
  }

  const parsed = new UAParser(ua).getResult()
  const browserFamily = parsed.browser.name || "Unknown"
  const osFamily = parsed.os.name || "Unknown"
  const rawDeviceType = parsed.device.type

  let deviceClass: DeviceClass
  if (rawDeviceType === "mobile") deviceClass = "mobile"
  else if (rawDeviceType === "tablet") deviceClass = "tablet"
  else if (!rawDeviceType && browserFamily !== "Unknown")
    deviceClass = "desktop"
  else deviceClass = "other"

  // No browser family recognized at all -- not confidently human, but not a
  // known bot signature either. Flag it rather than silently calling it desktop.
  const isAutomated = browserFamily === "Unknown"

  return {
    browserFamily,
    osFamily,
    deviceClass,
    isAutomated,
    automationReason: isAutomated
      ? "No recognizable browser signature"
      : undefined,
  }
}
