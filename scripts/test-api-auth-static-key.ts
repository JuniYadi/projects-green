#!/usr/bin/env bun
/**
 * E2E test: static API key auth.
 *
 * Prerequisites:
 *   1. `bun run dev` running on http://localhost:3300
 *   2. DATABASE_URL set in env
 *   3. An organization exists in the database
 *
 * Usage:
 *   ORGANIZATION_ID=org_xxx bun run scripts/test-api-auth-static-key.ts
 *   ORGANIZATION_ID=org_xxx BASE_URL="http://localhost:3300" bun run scripts/test-api-auth-static-key.ts
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { generateRawApiKey } from "@/lib/whatsapp/crypto"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3300"
const DATABASE_URL = process.env.DATABASE_URL?.trim()
const ORGANIZATION_ID = process.env.ORGANIZATION_ID ?? ""

interface TestResult {
  name: string
  pass: boolean
  detail: string
}

const results: TestResult[] = []

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, pass: condition, detail })
  const icon = condition ? "\u2705" : "\u274c"
  console.log(`${icon} ${name}${condition ? "" : ` — ${detail}`}`)
}

async function run() {
  console.log(`\nE2E: Static API key auth tests against ${BASE_URL}\n`)

  if (!DATABASE_URL) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }
  if (!ORGANIZATION_ID) {
    console.error("ORGANIZATION_ID is required")
    process.exit(1)
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  })

  let keyId = ""
  let rawKey = ""

  try {
    // Issue a test key
    const { raw, hash } = await generateRawApiKey("test_")
    rawKey = raw

    const apiKey = await prisma.authApiKey.create({
      data: {
        name: "e2e-static-key-test",
        keyHash: hash,
        environment: "SANDBOX",
        organizationId: ORGANIZATION_ID,
        scopes: ["platform:admin"],
        active: true,
      },
    })
    keyId = apiKey.id
    console.log(`Created test API key: ${keyId} (raw key printed below)\n`)

    // Test 1: whoami with valid key → 200 + ok:true + type:platform
    {
      const res = await fetch(`${BASE_URL}/api/auth/whoami`, {
        headers: { Authorization: `Bearer ${rawKey}` },
      })
      const body = (await res.json()) as Record<string, unknown>
      const auth = body.auth as Record<string, unknown> | null
      assert(
        "GET /api/auth/whoami (valid Bearer key) → 200 + ok:true + type:platform",
        res.status === 200 && body.ok === true && auth?.type === "platform",
        `status=${res.status} ok=${body.ok} type=${auth?.type}`
      )
    }

    // Test 2: devices with valid key → 200
    {
      const res = await fetch(`${BASE_URL}/api/whatsapp/devices`, {
        headers: { Authorization: `Bearer ${rawKey}` },
      })
      const body = (await res.json()) as Record<string, unknown>
      assert(
        "GET /api/whatsapp/devices (valid Bearer key) → 200",
        res.status === 200 && body.ok === true,
        `status=${res.status} ok=${body.ok}`
      )
    }

    // Test 3: devices with garbage key → 401
    {
      const res = await fetch(`${BASE_URL}/api/whatsapp/devices`, {
        headers: { Authorization: "Bearer test_garbage_value_12345" },
      })
      const body = (await res.json()) as Record<string, unknown>
      assert(
        "GET /api/whatsapp/devices (garbage Bearer key) → 401",
        res.status === 401 &&
          body.ok === false &&
          body.error === "UNAUTHORIZED",
        `status=${res.status} ok=${body.ok} error=${body.error}`
      )
    }

    // Test 4: devices with wos_ prefix → 401 (should NOT be treated as API key)
    {
      const res = await fetch(`${BASE_URL}/api/whatsapp/devices`, {
        headers: { Authorization: "Bearer wos_fake_session_data" },
      })
      const body = (await res.json()) as Record<string, unknown>
      assert(
        "GET /api/whatsapp/devices (wos_ prefix) → 401",
        res.status === 401 && body.ok === false,
        `status=${res.status} ok=${body.ok}`
      )
    }

    // Test 5: devices with no auth → 401
    {
      const res = await fetch(`${BASE_URL}/api/whatsapp/devices`)
      const body = (await res.json()) as Record<string, unknown>
      assert(
        "GET /api/whatsapp/devices (no auth) → 401",
        res.status === 401 &&
          body.ok === false &&
          body.error === "UNAUTHORIZED",
        `status=${res.status} ok=${body.ok} error=${body.error}`
      )
    }
  } finally {
    // Cleanup: delete the test key
    if (keyId) {
      await prisma.authApiKey.delete({ where: { id: keyId } }).catch(() => {})
      console.log(`\nCleaned up test key: ${keyId}`)
    }
    await prisma.$disconnect()
  }

  // Summary
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`)
  process.exit(failed > 0 ? 1 : 0)
}

run()
