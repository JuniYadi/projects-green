#!/usr/bin/env bun
/**
 * Migration script to move all application environment variables and secrets
 * from PostgreSQL (ApplicationStack.envVarsJson) into HashiCorp Vault KV v2.
 *
 * Mandate:
 * - 100% Zero-plaintext values in PostgreSQL.
 * - All variables stored under tenants/{orgId}/stacks/{stackId}/{environment}/app-env.
 * - Default environment for stacks without -staging or -dev is "prod".
 *
 * Usage:
 *   bun run scripts/migrate-secrets-to-vault.ts [--dry-run] [--slug <app-slug>]
 */

import { prisma } from "@/lib/prisma"
import { VaultSecretsService } from "@/modules/secrets/vault-secrets.service"

type StoredEnvEntry = {
  key?: string
  value?: string
  type?: string
  scope?: "all" | "build" | "runtime"
  vaultPath?: string
  vaultKey?: string
  version?: number
  updatedAt?: string
  [k: string]: unknown
}

function resolveStackEnvironment(slug: string): "dev" | "prod" | "staging" {
  if (slug.endsWith("-staging")) return "staging"
  if (slug.endsWith("-dev")) return "dev"
  return "prod"
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run")
  const slugIndex = args.indexOf("--slug")
  const targetSlug = slugIndex !== -1 ? args[slugIndex + 1] : null

  console.log("=== HashiCorp Vault Secrets Migration ===")
  console.log(
    `Mode: ${isDryRun ? "DRY-RUN (no changes will be written)" : "LIVE EXECUTION"}`
  )
  if (targetSlug) {
    console.log(`Target stack slug: ${targetSlug}`)
  }

  const stacks = await prisma.applicationStack.findMany({
    where: targetSlug ? { slug: targetSlug } : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      organizationId: true,
      envVarsJson: true,
    },
  })

  console.log(`Found ${stacks.length} stack(s) to inspect.\n`)

  const vaultService = new VaultSecretsService()
  let migratedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const stack of stacks) {
    const rawEnvs = stack.envVarsJson
    if (!Array.isArray(rawEnvs) || rawEnvs.length === 0) {
      console.log(
        `[SKIP] Stack "${stack.slug}" (${stack.id}): No environment variables found.`
      )
      skippedCount++
      continue
    }

    const items = rawEnvs as StoredEnvEntry[]
    const environment = resolveStackEnvironment(stack.slug)

    // Collect all variables that have a plaintext value to migrate
    const plainSecretsToMigrate: Record<string, string> = {}
    let hasPlaintext = false

    for (const item of items) {
      if (item && typeof item.key === "string" && item.key.trim().length > 0) {
        const key = item.key.trim()
        if (typeof item.value === "string" && item.value.length > 0) {
          hasPlaintext = true
          plainSecretsToMigrate[key] = item.value
        }
      }
    }

    if (!hasPlaintext) {
      console.log(
        `[OK] Stack "${stack.slug}" (${stack.id}): Already zero-plaintext (${items.length} references).`
      )
      skippedCount++
      continue
    }

    const keysToMigrate = Object.keys(plainSecretsToMigrate)
    console.log(
      `[MIGRATE] Stack "${stack.slug}" (${stack.id}) -> Environment: "${environment}"`
    )
    console.log(
      `  Found ${keysToMigrate.length} variable(s) with plaintext values: [${keysToMigrate.join(", ")}]`
    )

    if (isDryRun) {
      console.log(
        "  [DRY-RUN] Would write secrets to Vault and sanitize PostgreSQL envVarsJson.\n"
      )
      migratedCount++
      continue
    }

    try {
      // 1. Write secrets to Vault KV v2 (this also merges references into envVarsJson)
      const writeResult = await vaultService.writeSecrets({
        organizationId: stack.organizationId,
        stackId: stack.id,
        environment,
        secrets: plainSecretsToMigrate,
      })

      console.log(
        `  [VAULT] Successfully wrote ${keysToMigrate.length} secrets to Vault path: ${writeResult.vaultPath} (version ${writeResult.version})`
      )

      // 2. Extra safety pass: Ensure NO item in envVarsJson retains any plaintext 'value'
      const refreshedStack = await prisma.applicationStack.findUnique({
        where: { id: stack.id },
        select: { envVarsJson: true },
      })

      const sanitizedItems = (
        Array.isArray(refreshedStack?.envVarsJson)
          ? (refreshedStack.envVarsJson as StoredEnvEntry[])
          : []
      ).map((entry) => {
        const { value: _value, ...rest } = entry
        return {
          ...rest,
          type: entry.type ?? "secret_ref",
          isStoredSecret: true,
          masked: true,
        }
      })

      await prisma.applicationStack.update({
        where: { id: stack.id },
        data: { envVarsJson: sanitizedItems },
      })

      console.log(
        `  [POSTGRES] Sanitized ${sanitizedItems.length} records. ZERO plaintext values remain in DB.\n`
      )
      migratedCount++
    } catch (error) {
      console.error(
        `  [ERROR] Failed migrating stack "${stack.slug}":`,
        error instanceof Error ? error.message : error
      )
      failedCount++
    }
  }

  console.log("=== Migration Summary ===")
  console.log(`Total Stacks: ${stacks.length}`)
  console.log(`Migrated:     ${migratedCount}`)
  console.log(`Skipped:      ${skippedCount}`)
  console.log(`Failed:       ${failedCount}`)

  if (failedCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Migration fatal error:", err)
  process.exit(1)
})
