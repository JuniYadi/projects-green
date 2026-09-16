import { describe, it, expect } from "bun:test"
import {
  classifyTraffic,
  isProbePath,
  isStaticAssetPath,
  isValidIpAddress,
  normalizeIpAddress,
} from "./traffic-classification.service"

describe("traffic-classification.service", () => {
  it("classifies clean, mostly-2xx, mostly-browser traffic as likely_human", () => {
    const result = classifyTraffic({
      totalRequests: 100,
      automatedUaRequests: 2,
      successRequests: 95,
      errorRequests: 5,
      probePathRequests: 0,
    })
    expect(result.label).toBe("likely_human")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it("classifies bot-UA-heavy traffic hitting probe paths as likely_automated", () => {
    const result = classifyTraffic({
      totalRequests: 50,
      automatedUaRequests: 45,
      successRequests: 5,
      errorRequests: 45,
      probePathRequests: 10,
    })
    expect(result.label).toBe("likely_automated")
    expect(result.confidence).toBeGreaterThanOrEqual(70)
  })

  it("classifies conflicting evidence (probe-path hits + otherwise clean human navigation) as mixed", () => {
    const result = classifyTraffic({
      totalRequests: 100,
      automatedUaRequests: 5, // ratio 0.05, well under the automated-UA threshold
      successRequests: 95, // ratio 0.95, triggers the human-navigation signal
      errorRequests: 5,
      probePathRequests: 15, // ratio 0.15, triggers the probe-path signal on its own
    })
    expect(result.label).toBe("mixed")
  })

  it("returns unknown for too few requests instead of guessing", () => {
    const result = classifyTraffic({
      totalRequests: 2,
      automatedUaRequests: 2,
      successRequests: 0,
      errorRequests: 2,
      probePathRequests: 0,
    })
    expect(result.label).toBe("unknown")
    expect(result.confidence).toBe(0)
  })

  it("returns unknown rather than likely_automated on a single weak signal (high error ratio alone)", () => {
    const result = classifyTraffic({
      totalRequests: 20,
      automatedUaRequests: 0,
      successRequests: 8,
      errorRequests: 12, // 60% error, but no automated-UA or probe corroboration
      probePathRequests: 0,
    })
    expect(result.label).toBe("unknown")
    expect(result.reasons.some((r) => r.includes("error"))).toBe(true)
  })

  it("is deterministic: same input always produces the same output", () => {
    const input = {
      totalRequests: 40,
      automatedUaRequests: 5,
      successRequests: 38,
      errorRequests: 2,
      probePathRequests: 0,
    }
    expect(classifyTraffic(input)).toEqual(classifyTraffic(input))
  })

  describe("isProbePath", () => {
    it("detects sensitive files and scanner targets", () => {
      expect(isProbePath("/.env")).toBe(true)
      expect(isProbePath("/.git/config")).toBe(true)
      expect(isProbePath("/wp-admin/install.php")).toBe(true)
      expect(isProbePath("/phpmyadmin")).toBe(true)
      expect(isProbePath("/database.sql")).toBe(true)
      expect(isProbePath("/api/users")).toBe(false)
      expect(isProbePath("/dashboard")).toBe(false)
      expect(isProbePath("")).toBe(false)
    })
  })

  describe("isStaticAssetPath", () => {
    it("detects static assets by prefix and file extension", () => {
      expect(isStaticAssetPath("/_next/static/chunks/main.js")).toBe(true)
      expect(isStaticAssetPath("/static/logo.svg")).toBe(true)
      expect(isStaticAssetPath("/favicon.ico")).toBe(true)
      expect(isStaticAssetPath("/images/banner.webp")).toBe(true)
      expect(isStaticAssetPath("/fonts/inter.woff2")).toBe(true)
      expect(isStaticAssetPath("/api/deploy/apps")).toBe(false)
      expect(isStaticAssetPath("/console/traffic")).toBe(false)
    })
  })

  describe("isValidIpAddress and normalizeIpAddress", () => {
    it("validates IPv4 and IPv6 addresses correctly", () => {
      expect(isValidIpAddress("192.168.1.1")).toBe(true)
      expect(isValidIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(
        true
      )
      expect(isValidIpAddress("invalid-ip")).toBe(false)
      expect(isValidIpAddress("192.168.1.1/24")).toBe(false) // CIDR rejected
      expect(isValidIpAddress("")).toBe(false)
    })

    it("normalizes IP addresses to lowercase trimmed strings", () => {
      expect(normalizeIpAddress("  192.168.1.1  ")).toBe("192.168.1.1")
      expect(
        normalizeIpAddress("2001:0DB8:85A3:0000:0000:8A2E:0370:7334")
      ).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
      expect(() => normalizeIpAddress("not-an-ip")).toThrow()
    })
  })
})
