/**
 * Seed script: set known coordinates for existing VPN servers based on region.
 *
 * Run: bun run scripts/seed-vpn-server-coordinates.ts
 *
 * Only updates servers whose latitude/longitude is currently NULL.
 * Safe to re-run — skips servers that already have coordinates.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Known city coordinates keyed by region slug.
const COORDS_BY_REGION_SLUG: Record<string, { lat: number; lng: number }> = {
  jakarta: { lat: -6.2088, lng: 106.8456 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  "los-angeles": { lat: 34.0522, lng: -118.2437 },
  "hong-kong": { lat: 22.3193, lng: 114.1694 },
  japan: { lat: 35.6762, lng: 139.6503 },
  canada: { lat: 43.6532, lng: -79.3832 },
}

async function main() {
  const servers = await prisma.vpnServer.findMany({
    where: {
      latitude: null,
      longitude: null,
    },
    include: { region: true },
  })

  if (servers.length === 0) {
    console.log("All servers already have coordinates. Nothing to do.")
    return
  }

  let updated = 0
  let skipped = 0

  for (const server of servers) {
    const coords = COORDS_BY_REGION_SLUG[server.region.slug]
    if (!coords) {
      console.log(`  SKIP  ${server.name} — unknown region slug "${server.region.slug}"`)
      skipped++
      continue
    }

    await prisma.vpnServer.update({
      where: { id: server.id },
      data: { latitude: coords.lat, longitude: coords.lng },
    })
    console.log(
      `  OK    ${server.name} → ${coords.lat}, ${coords.lng} (${server.region.name})`
    )
    updated++
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped.`)
}

main()
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
