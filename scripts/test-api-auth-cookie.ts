#!/usr/bin/env bun
/**
 * E2E test: cookie-based API auth.
 *
 * Prerequisites:
 *   1. `bun run dev` running on http://localhost:3300
 *   2. Log in via the browser, then copy the wos-session cookie value
 *      from DevTools (Application > Cookies > wos-session).
 *
 * Usage:
 *   WOS_SESSION_COOKIE="<value>" bun run scripts/test-api-auth-cookie.ts
 *   WOS_SESSION_COOKIE="<value>" BASE_URL="http://localhost:3300" bun run scripts/test-api-auth-cookie.ts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3300"
const COOKIE = process.env.WOS_SESSION_COOKIE ?? ""

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
  console.log(`\nE2E: Cookie auth tests against ${BASE_URL}\n`)

  // Test 1: No auth → whoami returns ok:false, HTTP 200
  {
    const res = await fetch(`${BASE_URL}/api/auth/whoami`)
    const body = (await res.json()) as Record<string, unknown>
    assert(
      "GET /api/auth/whoami (no auth) → 200 + ok:false",
      res.status === 200 && body.ok === false && body.auth === null,
      `status=${res.status} ok=${body.ok} auth=${JSON.stringify(body.auth)}`
    )
  }

  // Test 2: No auth + strict=1 → 401
  {
    const res = await fetch(`${BASE_URL}/api/auth/whoami?strict=1`)
    const body = (await res.json()) as Record<string, unknown>
    assert(
      "GET /api/auth/whoami?strict=1 (no auth) → 401",
      res.status === 401 && body.ok === false && body.error === "UNAUTHORIZED",
      `status=${res.status} ok=${body.ok} error=${body.error}`
    )
  }

  // Test 3: With cookie → whoami returns ok:true, auth.type=workos
  if (COOKIE) {
    const res = await fetch(`${BASE_URL}/api/auth/whoami`, {
      headers: { Cookie: `wos-session=${COOKIE}` },
    })
    const body = (await res.json()) as Record<string, unknown>
    const auth = body.auth as Record<string, unknown> | null
    assert(
      "GET /api/auth/whoami (with cookie) → 200 + ok:true + type:workos",
      res.status === 200 && body.ok === true && auth?.type === "workos",
      `status=${res.status} ok=${body.ok} type=${auth?.type}`
    )
  } else {
    assert(
      "GET /api/auth/whoami (with cookie) → SKIPPED (no WOS_SESSION_COOKIE)",
      true,
      "skipped"
    )
  }

  // Test 4: With cookie → devices returns 200
  if (COOKIE) {
    const res = await fetch(`${BASE_URL}/api/whatsapp/devices`, {
      headers: { Cookie: `wos-session=${COOKIE}` },
    })
    const body = (await res.json()) as Record<string, unknown>
    assert(
      "GET /api/whatsapp/devices (with cookie) → 200",
      res.status === 200 && body.ok === true,
      `status=${res.status} ok=${body.ok}`
    )
  } else {
    assert(
      "GET /api/whatsapp/devices (with cookie) → SKIPPED (no WOS_SESSION_COOKIE)",
      true,
      "skipped"
    )
  }

  // Test 5: No auth → devices returns 401
  {
    const res = await fetch(`${BASE_URL}/api/whatsapp/devices`)
    const body = (await res.json()) as Record<string, unknown>
    assert(
      "GET /api/whatsapp/devices (no auth) → 401",
      res.status === 401 && body.ok === false && body.error === "UNAUTHORIZED",
      `status=${res.status} ok=${body.ok} error=${body.error}`
    )
  }

  // Summary
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`)
  process.exit(failed > 0 ? 1 : 0)
}

run()
