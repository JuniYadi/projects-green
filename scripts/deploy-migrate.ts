#!/usr/bin/env bun
/**
 * Production Database Migration, Targeted Seeding, and Verification Script.
 * Runs directly with Bun runtime so `.env` is automatically loaded without bash sourcing.
 * Excludes `bun run seed:system` / `SqlRestore`.
 *
 * Usage:
 *   bun run scripts/deploy-migrate.ts
 */

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

async function runCommand(cmd: string[]): Promise<void> {
  console.log(`\n> ${cmd.join(" ")}`)
  const proc = Bun.spawn(cmd, {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: process.env,
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(
      `Command failed with exit code ${exitCode}: ${cmd.join(" ")}`
    )
  }
}

async function verifyDatabase(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })

  try {
    console.log("\n🔍 Verifying Database Integrity & Counts...")

    // 1. Connection check
    await prisma.$queryRaw`SELECT 1 as connected;`
    console.log("  [1/4] DB Connection: OK")

    // 2. Applied migrations check
    const appliedMigrations = (await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      WHERE rolled_back_at IS NULL 
      ORDER BY finished_at DESC 
      LIMIT 5;
    `) as Array<{ migration_name: string; finished_at: Date }>

    console.log(
      `  [2/4] Applied Migrations Checked (Latest ${appliedMigrations.length}): OK`
    )
    for (const m of appliedMigrations) {
      console.log(`        - ${m.migration_name}`)
    }

    // 3. Check core table records count
    const [
      appHostingClusters,
      vpnServers,
      servicePackages,
      servicePlans,
      servicePricings,
      currencies,
      knowledgeDocs,
      paymentGateways,
      detectorRules,
    ] = await Promise.all([
      prisma.appHostingCluster.count(),
      prisma.vpnServer.count(),
      prisma.servicePackage.count(),
      prisma.servicePlan.count(),
      prisma.servicePricing.count(),
      prisma.paymentCurrency.count(),
      prisma.docsKnowledgeDocument.count(),
      prisma.paymentGateway.count(),
      prisma.detectorRule.count(),
    ])

    console.log("  [3/4] Core Table Counts:")
    console.log(`        - AppHostingCluster:     ${appHostingClusters}`)
    console.log(`        - VpnServer:             ${vpnServers}`)
    console.log(`        - ServicePackages:       ${servicePackages}`)
    console.log(`        - ServicePlans:          ${servicePlans}`)
    console.log(`        - ServicePricings:       ${servicePricings}`)
    console.log(`        - PaymentCurrencies:     ${currencies}`)
    console.log(`        - PaymentGateways:       ${paymentGateways}`)
    console.log(`        - DocsKnowledgeDocument: ${knowledgeDocs}`)
    console.log(`        - DetectorRules:         ${detectorRules}`)

    console.log("  [4/4] Verification completed successfully.")
  } finally {
    await prisma.$disconnect()
  }
}

async function main(): Promise<void> {
  console.log("==================================================")
  console.log(" Starting Production DB Migration & Verification ")
  console.log("==================================================")

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    console.error(
      "❌ Error: DATABASE_URL is missing or empty in environment / .env"
    )
    process.exit(1)
  }

  console.log("✅ DATABASE_URL is present.")

  // 1. Prisma Migrate Deploy
  console.log("\n📦 Running Prisma Migrate Deploy...")
  await runCommand(["bun", "--bun", "prisma", "migrate", "deploy"])

  // 2. Prisma Generate Client
  console.log("\n⚙️ Generating Prisma Client...")
  await runCommand(["bun", "--bun", "prisma", "generate"])

  // 3. Targeted Seeders (Excluding seed:system)
  console.log("\n🌱 Running Production Seeders...")

  // Core system seeders run by exact name (avoids SqlRestore/sql dump wipe)
  const seeders = [
    "WorkosRoles",
    "Currencies",
    "Payment",
    "Billing",
    "WhatsappPricing",
    "AppHostingPolicy",
    "KnowledgeDocs",
  ]

  for (const seeder of seeders) {
    console.log(`-> Seeding ${seeder}...`)
    try {
      await runCommand([
        "bun",
        "run",
        "scripts/seed-runner.ts",
        `--seed=${seeder}`,
      ])
    } catch (err) {
      console.warn(`⚠️ Seeder ${seeder} failed or encountered an error:`, err)
      if (seeder === "Billing" || seeder === "Currencies") {
        throw err
      }
    }
  }

  // Standalone cluster & VPN coordinates
  if (await Bun.file("scripts/seed-app-hosting-cluster.ts").exists()) {
    console.log("-> Seeding App Hosting Cluster...")
    await runCommand(["bun", "run", "scripts/seed-app-hosting-cluster.ts"])
  }

  if (await Bun.file("scripts/seed-vpn-server-coordinates.ts").exists()) {
    console.log("-> Seeding VPN Server Coordinates...")
    await runCommand(["bun", "run", "scripts/seed-vpn-server-coordinates.ts"])
  }
  // 4. Verify Database
  await verifyDatabase(databaseUrl)

  console.log("\n==================================================")
  console.log(" 🎉 Migration and DB Verification Complete!       ")
  console.log("==================================================")
}

main().catch((err) => {
  console.error("\n❌ Execution failed:", err)
  process.exit(1)
})
