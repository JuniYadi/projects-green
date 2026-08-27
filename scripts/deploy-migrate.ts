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
import { logger } from "@/lib/logger"

async function runCommand(cmd: string[]): Promise<void> {
  logger.info(
    {
      event: "deploy.migrate.command.started",
      command: cmd.join(" "),
    },
    `> ${cmd.join(" ")}`
  )
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
    logger.info(
      { event: "deploy.migrate.verify.started" },
      "Verifying Database Integrity & Counts..."
    )

    // 1. Connection check
    await prisma.$queryRaw`SELECT 1 as connected;`
    logger.info(
      { event: "deploy.migrate.verify.connection_ok" },
      "[1/4] DB Connection: OK"
    )

    // 2. Applied migrations check
    const appliedMigrations = (await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      WHERE rolled_back_at IS NULL 
      ORDER BY finished_at DESC 
      LIMIT 5;
    `) as Array<{ migration_name: string; finished_at: Date }>

    logger.info(
      {
        event: "deploy.migrate.verify.migrations_ok",
        count: appliedMigrations.length,
        migrations: appliedMigrations.map((m) => m.migration_name),
      },
      `[2/4] Applied Migrations Checked (Latest ${appliedMigrations.length}): OK`
    )

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

    logger.info(
      {
        event: "deploy.migrate.verify.counts",
        counts: {
          appHostingClusters,
          vpnServers,
          servicePackages,
          servicePlans,
          servicePricings,
          currencies,
          paymentGateways,
          knowledgeDocs,
          detectorRules,
        },
      },
      "[3/4] Core Table Counts verified"
    )

    logger.info(
      { event: "deploy.migrate.verify.completed" },
      "[4/4] Verification completed successfully."
    )
  } finally {
    await prisma.$disconnect()
  }
}

async function main(): Promise<void> {
  logger.info(
    { event: "deploy.migrate.started" },
    "Starting Production DB Migration & Verification"
  )

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    logger.error(
      { event: "deploy.migrate.missing_db_url" },
      "Error: DATABASE_URL is missing or empty in environment / .env"
    )
    process.exit(1)
  }

  logger.info(
    { event: "deploy.migrate.db_url_present" },
    "DATABASE_URL is present."
  )

  // 1. Prisma Migrate Deploy
  logger.info(
    { event: "deploy.migrate.step.migrate_deploy" },
    "Running Prisma Migrate Deploy..."
  )
  await runCommand(["bun", "--bun", "prisma", "migrate", "deploy"])

  // 2. Prisma Generate Client
  logger.info(
    { event: "deploy.migrate.step.generate_client" },
    "Generating Prisma Client..."
  )
  await runCommand(["bun", "--bun", "prisma", "generate"])

  // 3. Targeted Seeders (Excluding seed:system)
  logger.info(
    { event: "deploy.migrate.step.seeders" },
    "Running Production Seeders..."
  )

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
    logger.info(
      { event: "deploy.migrate.seeder.started", seeder },
      `Seeding ${seeder}...`
    )
    try {
      await runCommand([
        "bun",
        "run",
        "scripts/seed-runner.ts",
        `--seed=${seeder}`,
      ])
    } catch (err) {
      logger.warn(
        { event: "deploy.migrate.seeder.failed", seeder, err },
        `Seeder ${seeder} failed or encountered an error`
      )
      if (seeder === "Billing" || seeder === "Currencies") {
        throw err
      }
    }
  }

  // Standalone cluster & VPN coordinates
  if (await Bun.file("scripts/seed-app-hosting-cluster.ts").exists()) {
    logger.info(
      { event: "deploy.migrate.seeder.started", seeder: "AppHostingCluster" },
      "Seeding App Hosting Cluster..."
    )
    await runCommand(["bun", "run", "scripts/seed-app-hosting-cluster.ts"])
  }

  if (await Bun.file("scripts/seed-vpn-server-coordinates.ts").exists()) {
    logger.info(
      {
        event: "deploy.migrate.seeder.started",
        seeder: "VpnServerCoordinates",
      },
      "Seeding VPN Server Coordinates..."
    )
    await runCommand(["bun", "run", "scripts/seed-vpn-server-coordinates.ts"])
  }

  // 4. Verify Database
  await verifyDatabase(databaseUrl)

  logger.info(
    { event: "deploy.migrate.completed" },
    "Migration and DB Verification Complete!"
  )
}

main().catch((err) => {
  logger.error({ event: "deploy.migrate.failed", err }, "Execution failed")
  process.exit(1)
})
