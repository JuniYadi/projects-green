/**
 * Meta WhatsApp Real Cost & Usage Extractor
 *
 * Fetches REAL usage charges directly from Meta Pricing Analytics API.
 *
 * Usage:
 *   ACCESS_TOKEN="..." WABA_ID="..." bun scripts/get-whatsapp-real-charges.ts
 */

import { prisma } from "../lib/prisma"
import { decryptWithAppKey } from "../lib/whatsapp/crypto"

async function main() {
  console.log("\n========================================================")
  console.log("  META WHATSAPP REAL CHARGES & USAGE EXTRACTOR")
  console.log("========================================================\n")

  // 1. Resolve Access Token and WABA ID
  let token = process.env.ACCESS_TOKEN
  let wabaId = process.env.WABA_ID

  if (!token || !wabaId) {
    const device = await prisma.whatsappDevice.findFirst({
      where: {
        tokenEncrypted: { not: null },
        whatsappBusinessAccountId: { not: null },
      },
    })
    if (device?.tokenEncrypted) {
      token = token ?? (await decryptWithAppKey(device.tokenEncrypted))
      wabaId = wabaId ?? device.whatsappBusinessAccountId ?? undefined
      console.log(`📱 Loaded device: ${device.phoneNumber ?? device.id}`)
    }
  }

  if (!token) {
    console.error("❌ ERROR: Missing ACCESS_TOKEN environment variable.")
    process.exit(1)
  }

  if (!wabaId) {
    console.error("❌ ERROR: Missing WABA_ID environment variable.")
    process.exit(1)
  }

  // 2. Fetch WABA Basic Information
  const resWaba = await fetch(
    `https://graph.facebook.com/v20.0/${wabaId}?fields=id,name,currency,timezone_id`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  const wabaInfo = (await resWaba.json()) as {
    id?: string
    name?: string
    currency?: string
  }
  console.log(`Account Name : ${wabaInfo.name ?? "N/A"}`)
  console.log(`WABA ID      : ${wabaInfo.id ?? wabaId}`)
  console.log(`Currency     : ${wabaInfo.currency ?? "IDR"}\n`)

  // 3. Define time window (Last 90 Days)
  const now = Math.floor(Date.now() / 1000)
  const days = Number(process.env.DAYS ?? "90")
  const start = now - days * 24 * 3600

  console.log(`📊 Fetching Real Meta Charges for the last ${days} days...`)

  const resPricing = await fetch(
    `https://graph.facebook.com/v20.0/${wabaId}?fields=pricing_analytics.start(${start}).end(${now}).granularity(DAILY)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const pricingData = (await resPricing.json()) as {
    error?: { message: string }
    pricing_analytics?: {
      data?: Array<{
        data_points?: Array<{
          start: number
          end: number
          volume?: number
          cost?: number
        }>
      }>
    }
  }

  if (pricingData.error) {
    console.error("❌ Meta API Error:", pricingData.error)
    process.exit(1)
  }

  const dataPoints = pricingData.pricing_analytics?.data?.[0]?.data_points ?? []

  if (dataPoints.length === 0) {
    console.log("ℹ️ No billable usage data found for this period.")
    return
  }

  // Sort newest first
  dataPoints.sort((a, b) => b.start - a.start)

  console.log(
    "----------------------------------------------------------------------------------------"
  )
  console.log(
    "| Date (UTC)  | Volume | Meta Base Cost (IDR) | PPN 11% (IDR) | Total Meta Charge (IDR) |"
  )
  console.log(
    "----------------------------------------------------------------------------------------"
  )

  let totalVolume = 0
  let totalBaseCost = 0
  let totalVat = 0
  let totalNetCharge = 0

  for (const dp of dataPoints) {
    const dateStr = new Date(dp.start * 1000).toISOString().split("T")[0]
    const volume = Number(dp.volume ?? 0)
    const baseCost = Number(dp.cost ?? 0)
    const vat = baseCost * 0.11
    const totalCharge = baseCost + vat

    totalVolume += volume
    totalBaseCost += baseCost
    totalVat += vat
    totalNetCharge += totalCharge

    const formattedBase = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(baseCost)
    const formattedVat = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(vat)
    const formattedTotal = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(totalCharge)

    console.log(
      `| ${dateStr}  | ${String(volume).padStart(6, " ")} | Rp ${formattedBase.padStart(18, " ")} | Rp ${formattedVat.padStart(11, " ")} | Rp ${formattedTotal.padStart(21, " ")} |`
    )
  }

  console.log(
    "----------------------------------------------------------------------------------------"
  )
  const totalBaseStr = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalBaseCost)
  const totalVatStr = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalVat)
  const totalNetStr = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalNetCharge)

  console.log(
    `| TOTAL       | ${String(totalVolume).padStart(6, " ")} | Rp ${totalBaseStr.padStart(18, " ")} | Rp ${totalVatStr.padStart(11, " ")} | Rp ${totalNetStr.padStart(21, " ")} |`
  )
  console.log(
    "----------------------------------------------------------------------------------------\n"
  )

  console.log("💡 Ringkasan Finansial Tagihan Meta:")
  console.log(`   - Total Pesan Berbayar : ${totalVolume} pesan`)
  console.log(`   - Biaya Dasar Meta     : Rp ${totalBaseStr}`)
  console.log(`   - PPN 11% Meta         : Rp ${totalVatStr}`)
  console.log(`   - Total Beban Tagihan  : Rp ${totalNetStr}\n`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
