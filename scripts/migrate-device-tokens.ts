import { prisma } from "@/lib/prisma"
import { migrateAllTokens } from "@/lib/whatsapp/device-token"

async function main() {
  console.log("Starting WhatsApp device token migration...")

  try {
    const result = await migrateAllTokens()

    console.log("\nMigration completed:")
    console.log(`- Migrated: ${result.migrated}`)
    console.log(`- Skipped: ${result.skipped}`)
    console.log(`- Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log("\nErrors:")
      result.errors.forEach((err) => console.error(`  - ${err}`))
    }
  } catch (error) {
    console.error("Migration failed with unexpected error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
