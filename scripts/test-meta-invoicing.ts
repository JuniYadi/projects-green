/**
 * Meta WhatsApp & Business Invoicing Test Script
 *
 * Usage:
 *   ACCESS_TOKEN="your_token_here" bun scripts/test-meta-invoicing.ts
 *
 * Or with custom business / WABA ID:
 *   ACCESS_TOKEN="..." BUSINESS_ID="..." WABA_ID="..." bun scripts/test-meta-invoicing.ts
 */

import { prisma } from "../lib/prisma"
import { decryptWithAppKey } from "../lib/whatsapp/crypto"

async function main() {
  console.log("\n========================================================")
  console.log("  META BUSINESS & WHATSAPP BILLING/INVOICE INSPECTOR")
  console.log("========================================================\n")

  // 1. Resolve Access Token
  let token = process.env.ACCESS_TOKEN
  let defaultWabaId = process.env.WABA_ID
  const defaultBusinessId = process.env.BUSINESS_ID

  if (!token) {
    console.log(
      "ℹ️  No ACCESS_TOKEN passed in env. Reading active device from database..."
    )
    const device = await prisma.whatsappDevice.findFirst({
      where: {
        tokenEncrypted: { not: null },
        whatsappBusinessAccountId: { not: null },
      },
    })

    if (device?.tokenEncrypted) {
      token = await decryptWithAppKey(device.tokenEncrypted)
      defaultWabaId =
        defaultWabaId ?? device.whatsappBusinessAccountId ?? undefined
      console.log(
        `✅ Loaded token from DB device: ${device.phoneNumber ?? device.id}`
      )
    }
  }

  if (!token) {
    console.error(
      "❌ ERROR: No ACCESS_TOKEN found. Provide ACCESS_TOKEN in environment."
    )
    process.exit(1)
  }

  // 2. Inspect Token Debug & Permissions
  console.log("\n--- 1. Token Permissions & User Info ---")
  const resDebug = await fetch(
    `https://graph.facebook.com/v20.0/debug_token?input_token=${token}&access_token=${token}`
  )
  const debugData = await resDebug.json()

  if (debugData.error) {
    console.error("❌ Token validation failed:", debugData.error)
  } else {
    const d = debugData.data
    console.log(`App: ${d?.application} (App ID: ${d?.app_id})`)
    console.log(`Type: ${d?.type}, Valid: ${d?.is_valid}`)
    console.log(`Scopes: ${(d?.scopes ?? []).join(", ")}`)
  }

  // 3. Inspect WABA and identify Business ID
  console.log("\n--- 2. WhatsApp Business Account (WABA) Info ---")
  const wabaId = defaultWabaId ?? "101824669214076"
  let businessId = defaultBusinessId

  const resWaba = await fetch(
    `https://graph.facebook.com/v20.0/${wabaId}?fields=id,name,currency,timezone_id,account_review_status,owner_business_info`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  const wabaJson = await resWaba.json()

  if (wabaJson.error) {
    console.log(`⚠️ WABA ${wabaId} lookup:`, wabaJson.error.message)
  } else {
    console.log(`WABA ID: ${wabaJson.id}`)
    console.log(`Name: ${wabaJson.name}`)
    console.log(`Currency: ${wabaJson.currency}`)
    console.log(`Status: ${wabaJson.account_review_status}`)
    if (wabaJson.owner_business_info) {
      console.log(`Owner Business Name: ${wabaJson.owner_business_info.name}`)
      console.log(`Owner Business ID: ${wabaJson.owner_business_info.id}`)
      businessId = businessId ?? wabaJson.owner_business_info.id
    }
  }

  // Fallback to discovered Business ID
  businessId = businessId ?? "304226647846623"

  // 4. Test Meta Business Invoices
  console.log(
    `\n--- 3. Meta Business Invoices (Business ID: ${businessId}) ---`
  )
  const resInvoices = await fetch(
    `https://graph.facebook.com/v20.0/${businessId}/business_invoices`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  const invoicesJson = await resInvoices.json()
  if (invoicesJson.error) {
    console.log(`⚠️ Invoices Error:`, invoicesJson.error.message)
  } else {
    console.log(`✅ Found ${(invoicesJson.data ?? []).length} Invoices:`)
    console.log(JSON.stringify(invoicesJson.data, null, 2))
  }

  // 5. Test Extended Credit / Monthly Invoicing Lines
  console.log(`\n--- 4. Extended Credits & Invoices (Credit Line) ---`)
  const resCredits = await fetch(
    `https://graph.facebook.com/v20.0/${businessId}/extendedcredits?fields=id,credit_type,legal_entity_name,max_credit,balance,utilization_percentage`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  const creditsJson = await resCredits.json()
  if (creditsJson.error) {
    console.log(`⚠️ Extended Credits Error:`, creditsJson.error.message)
  } else {
    console.log(`✅ Extended Credits Info:`)
    console.log(JSON.stringify(creditsJson.data, null, 2))

    if (Array.isArray(creditsJson.data) && creditsJson.data.length > 0) {
      for (const credit of creditsJson.data) {
        console.log(
          `\n🔍 Checking Invoices on Extended Credit ID: ${credit.id}...`
        )
        const resCreditInvoices = await fetch(
          `https://graph.facebook.com/v20.0/${credit.id}/extended_credit_invoice_details?fields=invoice_id,amount,net_amount,tax_amount,status,invoice_date,due_date`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        const creditInvoicesJson = await resCreditInvoices.json()
        console.log(
          "Extended Credit Invoices:",
          JSON.stringify(creditInvoicesJson, null, 2)
        )
      }
    }
  }

  // 6. Test WhatsApp Pricing Analytics (Usage Cost)
  console.log(`\n--- 5. WhatsApp Analytics (Usage & Cost) ---`)
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysAgo = now - 30 * 24 * 3600
  const resPricing = await fetch(
    `https://graph.facebook.com/v20.0/${wabaId}?fields=pricing_analytics.start(${thirtyDaysAgo}).end(${now}).granularity(MONTHLY)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  const pricingJson = await resPricing.json()
  console.log("Pricing Analytics:", JSON.stringify(pricingJson, null, 2))

  console.log("\n========================================================")
  console.log("  TEST COMPLETE")
  console.log("========================================================\n")
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
