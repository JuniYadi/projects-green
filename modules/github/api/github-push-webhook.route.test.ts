import { describe, expect, it } from "bun:test"
import { createHmac } from "node:crypto"
import app from "./github-push-webhook.route"

function generateSignature(payload: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
}

describe("POST /push - github-push-webhook.route", () => {
  const secret = "test-secret"
  const originalSecret = process.env.GITHUB_WEBHOOK_SECRET

  it("returns 401 when signature header is missing", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = secret

    const payload = JSON.stringify({ ref: "refs/heads/main" })
    const res = await app.request("/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    })

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ error: "Invalid signature" })

    process.env.GITHUB_WEBHOOK_SECRET = originalSecret
  })

  it("returns 401 when signature is invalid", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = secret

    const payload = JSON.stringify({ ref: "refs/heads/main" })
    const res = await app.request("/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=invalidhexsignature0123456789abcdef",
      },
      body: payload,
    })

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ error: "Invalid signature" })

    process.env.GITHUB_WEBHOOK_SECRET = originalSecret
  })

  it("returns 200 with skipped message when branch is deleted", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = secret

    const payload = JSON.stringify({
      ref: "refs/heads/feature-branch",
      deleted: true,
      repository: {
        id: 12345,
        name: "test-repo",
        full_name: "org/test-repo",
        owner: { login: "org" },
      },
    })
    const signature = generateSignature(payload, secret)

    const res = await app.request("/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: payload,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ message: "Branch deleted, skipping" })

    process.env.GITHUB_WEBHOOK_SECRET = originalSecret
  })

  it("returns 200 with deprecated message for valid non-deleted push", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = secret

    const payload = JSON.stringify({
      ref: "refs/heads/main",
      after: "abc1234567890",
      deleted: false,
      commits: [
        {
          id: "abc1234",
          message: "fix: update tests",
          author: { name: "Dev", email: "dev@example.com" },
          url: "https://github.com/org/repo/commit/abc1234",
          timestamp: "2026-08-28T00:00:00Z",
        },
      ],
      pusher: { name: "Dev", email: "dev@example.com" },
      repository: {
        id: 12345,
        name: "test-repo",
        full_name: "org/test-repo",
        owner: { login: "org" },
      },
    })
    const signature = generateSignature(payload, secret)

    const res = await app.request("/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: payload,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({
      message: "Use the Elysia webhook endpoint instead",
    })

    process.env.GITHUB_WEBHOOK_SECRET = originalSecret
  })

  it("uses development-secret fallback when GITHUB_WEBHOOK_SECRET is unset", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET

    const payload = JSON.stringify({
      ref: "refs/heads/main",
      deleted: false,
    })
    const signature = generateSignature(payload, "development-secret")

    const res = await app.request("/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: payload,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({
      message: "Use the Elysia webhook endpoint instead",
    })

    process.env.GITHUB_WEBHOOK_SECRET = originalSecret
  })
})
