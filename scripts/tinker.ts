#!/usr/bin/env bun
/**
 * Interactive REPL — like `php artisan tinker` for this app.
 *
 * Usage: bun tinker
 *
 * Globals:
 *   prisma   — PrismaClient (connected)
 *   Prisma   — Prisma namespace (enums, types)
 *   models   — delegate map
 *   p        — alias for prisma
 *
 * Examples:
 *   > await p.invoice.findFirst({ where: { status: "DRAFT" } })
 *   > Object.keys(Prisma.WhatsappMessageStatusScalarFieldEnum)
 */

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"

const DATABASE_URL = process.env.DATABASE_URL?.trim()
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL")

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
})
await prisma.$connect()

// ── Enumerate model delegates ───────────────────────────────────────────────
const skip: Record<string, true> = {
  $connect: true,
  $disconnect: true,
  $executeRaw: true,
  $executeRawUnsafe: true,
  $queryRaw: true,
  $queryRawUnsafe: true,
  $transaction: true,
  $use: true,
  $extends: true,
  $on: true,
  $metrics: true,
  $dmmf: true,
}

const models: Record<string, unknown> = {}
for (const key of Object.keys(prisma)) {
  if (!(key in skip) && typeof prisma[key as keyof PrismaClient] === "object") {
    models[key] = prisma[key as keyof PrismaClient]
  }
}

// ── REPL context ────────────────────────────────────────────────────────────
const ctx: Record<string, unknown> = {
  prisma,
  Prisma,
  models,
  p: prisma,
}
const ctxKeys = Object.keys(ctx)

const stmtRe =
  /^\s*(const|let|var|if|for|while|do|switch|function|class|return|try|throw|import|export)\b/

function compile(input: string): string {
  const args = ctxKeys.join(",")
  const body = stmtRe.test(input) ? input : "return " + input
  return "return (async({" + args + "})=>{" + body + "})(ctx)"
}

async function evalLine(line: string): Promise<void> {
  const code = compile(line)
  const fn = new Function("ctx", code)
  const result = await fn(ctx)
  if (result !== undefined) {
    const out =
      typeof result === "object"
        ? JSON.stringify(result, null, 2)
        : String(result)
    process.stdout.write(out + "\n")
  }
}

// ── Raw stdin REPL ──────────────────────────────────────────────────────────
const isTty = process.stdin.isTTY
const promptStr = "tinker> "
if (isTty) process.stdout.write(promptStr)

let lineBuf = ""
let pending = 0
let exiting = false

function shutdown(): void {
  const wait = setInterval(() => {
    if (pending === 0) {
      clearInterval(wait)
      prisma.$disconnect().catch(() => {})
      process.exit(0)
    }
  }, 50)
}

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  lineBuf += chunk

  while (lineBuf.includes("\n")) {
    const nl = lineBuf.indexOf("\n")
    const raw = lineBuf.slice(0, nl)
    lineBuf = lineBuf.slice(nl + 1)
    const line = raw.trim()

    if (line === ".exit" || line === "exit" || line === "quit") {
      exiting = true
      shutdown()
      return
    }

    if (line) {
      pending++
      evalLine(line)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          process.stderr.write("ERROR: " + msg + "\n")
        })
        .finally(() => {
          pending--
        })
    }
  }
})

process.stdin.on("end", () => {
  if (exiting) return
  shutdown()
})
