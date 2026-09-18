import { describe, expect, it } from "bun:test"
import {
  createJenkinsHmacSignature,
  createJenkinsWebhookHeaders,
  verifyJenkinsHmacSignature,
} from "./jenkins-webhook-auth"

describe("jenkins-webhook-auth", () => {
  const secret = "super-secret-token"
  const rawBody = JSON.stringify({ slug: "my-app", imageTag: "v1.0.0" })

  it("verifies valid HMAC signature with Record headers", () => {
    const headers = createJenkinsWebhookHeaders(rawBody, secret)
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(true)
  })

  it("verifies valid HMAC signature with Fetch Headers instance", () => {
    const headerObj = createJenkinsWebhookHeaders(rawBody, secret)
    const headers = new Headers(headerObj)
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(true)
  })

  it("verifies valid signature when prefixed with sha256=", () => {
    const headers = createJenkinsWebhookHeaders(rawBody, secret, {
      prefixSha256: true,
    })
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(true)
  })

  it("verifies valid signature with fallback header x-jenkins-signature", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(rawBody, secret, timestamp)
    const headers = {
      "x-jenkins-timestamp": timestamp,
      "x-jenkins-signature": signature,
    }
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(true)
  })

  it("verifies valid signature with timestamp in milliseconds", () => {
    const timestamp = Date.now().toString()
    const signature = createJenkinsHmacSignature(rawBody, secret, timestamp)
    const headers = {
      "x-jenkins-timestamp": timestamp,
      "x-jenkins-signature-256": signature,
    }
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(true)
  })

  it("rejects when signature does not match (wrong secret)", () => {
    const headers = createJenkinsWebhookHeaders(rawBody, "wrong-secret")
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(false)
  })

  it("rejects when rawBody has been tampered with", () => {
    const headers = createJenkinsWebhookHeaders(rawBody, secret)
    const tamperedBody = JSON.stringify({ slug: "my-app", imageTag: "v2.0.0" })
    expect(verifyJenkinsHmacSignature(tamperedBody, headers, secret)).toBe(false)
  })

  it("rejects when timestamp is older than 60 seconds", () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 61
    const headers = createJenkinsWebhookHeaders(rawBody, secret, {
      timestamp: pastTimestamp,
    })
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(false)
  })

  it("rejects when timestamp is more than 60 seconds in the future", () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 65
    const headers = createJenkinsWebhookHeaders(rawBody, secret, {
      timestamp: futureTimestamp,
    })
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(false)
  })

  it("rejects when timestamp header is missing", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(rawBody, secret, timestamp)
    const headers = {
      "x-jenkins-signature-256": signature,
    }
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(false)
  })

  it("rejects when signature header is missing", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const headers = {
      "x-jenkins-timestamp": timestamp,
    }
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(false)
  })

  it("rejects when webhookToken is empty", () => {
    const headers = createJenkinsWebhookHeaders(rawBody, secret)
    expect(verifyJenkinsHmacSignature(rawBody, headers, "")).toBe(false)
  })

  it("rejects when timestamp is invalid NaN", () => {
    const headers = {
      "x-jenkins-timestamp": "not-a-number",
      "x-jenkins-signature-256": "abcdef",
    }
    expect(verifyJenkinsHmacSignature(rawBody, headers, secret)).toBe(false)
  })
})
