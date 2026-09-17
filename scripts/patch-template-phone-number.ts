import { prisma } from "@/lib/prisma"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"
import { buildMetaTemplateComponents } from "@/modules/whatsapp/templates/template-validator"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import type { Prisma, WhatsappBillingCategory } from "@prisma/client"

/**
 * Patch script to fix template button phone numbers that were saved
 * in local format (e.g. 08989279111) instead of international E.164 (+628989279111),
 * and optionally push the fixed template to Meta Cloud API.
 *
 * Usage:
 *   Dry-run with readonly env:
 *     bun --env-file=.env.readonly scripts/patch-template-phone-number.ts --dry-run
 *
 *   Execute update (requires write-enabled env, e.g. .env or .env.production):
 *     bun --env-file=.env.production scripts/patch-template-phone-number.ts
 *
 *   Execute update and push directly to Meta:
 *     bun --env-file=.env.production scripts/patch-template-phone-number.ts --push-meta
 */

interface ButtonItem {
  type: string
  text?: string
  phoneNumber?: string
  phone_number?: string
  [key: string]: unknown
}

const asPrismaJson = (value: unknown) => value as Prisma.InputJsonValue

async function main() {
  const isDryRun = process.argv.includes("--dry-run")
  const shouldPushMeta = process.argv.includes("--push-meta")
  const templateIdentifier =
    process.argv.slice(2).find((arg) => !arg.startsWith("--")) ||
    "2 stok kritis"

  console.log(`[Patch] Looking for template matching: "${templateIdentifier}"`)
  console.log(
    `[Patch] Mode: ${isDryRun ? "DRY RUN (no DB writes)" : "EXECUTE"}`
  )

  const templates = await prisma.whatsappTemplate.findMany({
    where: {
      OR: [
        { id: templateIdentifier },
        { slug: templateIdentifier },
        { name: { contains: templateIdentifier, mode: "insensitive" } },
      ],
    },
    include: {
      languages: true,
      whatsappDevice: true,
    },
  })

  if (templates.length === 0) {
    console.log(`[Patch] No templates found matching "${templateIdentifier}".`)
    return
  }

  for (const template of templates) {
    console.log(`\n======================================================`)
    console.log(
      `Template: "${template.name}" (ID: ${template.id}, Slug: ${template.slug})`
    )
    console.log(`Device ID: ${template.whatsappDeviceId ?? "None"}`)
    console.log(`Current Sync Status: ${template.syncStatus}`)

    let anyLanguageUpdated = false

    for (const lang of template.languages) {
      console.log(`\n  Language variant: "${lang.lang}" (ID: ${lang.id})`)
      const rawButtons = lang.buttons as ButtonItem[] | null

      if (!Array.isArray(rawButtons) || rawButtons.length === 0) {
        console.log(`    No buttons found.`)
        continue
      }

      let buttonsChanged = false
      const updatedButtons = rawButtons.map((btn, index) => {
        if (btn.type === "PHONE_NUMBER") {
          const rawPhone = (btn.phoneNumber || btn.phone_number || "")
            .toString()
            .trim()
          const normalized =
            normalizeIndonesianPhoneNumber(rawPhone) ?? rawPhone

          if (rawPhone !== normalized) {
            console.log(
              `    [Button #${index + 1}] PHONE_NUMBER normalized: "${rawPhone}" -> "${normalized}"`
            )
            buttonsChanged = true
            return {
              ...btn,
              phoneNumber: normalized,
            }
          } else {
            console.log(
              `    [Button #${index + 1}] PHONE_NUMBER already in valid format: "${rawPhone}"`
            )
          }
        }
        return btn
      })

      if (!buttonsChanged) {
        console.log(`    No button changes needed for language "${lang.lang}".`)
        continue
      }

      anyLanguageUpdated = true

      if (!isDryRun) {
        try {
          await prisma.whatsappTemplateLanguage.update({
            where: { id: lang.id },
            data: {
              buttons: asPrismaJson(updatedButtons),
            },
          })
          console.log(`    ✓ Database updated for language "${lang.lang}".`)
          lang.buttons = JSON.parse(JSON.stringify(updatedButtons))
        } catch (err: any) {
          console.error(`    ✗ Failed to update DB: ${err.message}`)
          if (err.message.includes("read-only")) {
            console.log(
              `    ℹ Note: The current database connection is read-only. Run with a writeable DATABASE_URL (e.g. .env.production).`
            )
          }
          return
        }
      } else {
        console.log(
          `    [DRY RUN] Would update buttons in DB to:`,
          JSON.stringify(updatedButtons, null, 2)
        )
      }
    }

    if (shouldPushMeta && template.whatsappDevice) {
      const device = template.whatsappDevice
      console.log(
        `\n  [Meta Push] Attempting direct push to Meta for device ${device.id}...`
      )

      const encryptedParts = device.tokenEncrypted?.split(".") ?? []
      const accessToken =
        device.tokenEncrypted && device.tokenIv && encryptedParts.length === 2
          ? `${encryptedParts[0]}.${device.tokenIv}.${encryptedParts[1]}`
          : (device.tokenEncrypted ?? device.token)

      const phoneNumberId = device.whatsappPhoneId
      const wabaId = device.whatsappBusinessAccountId

      if (!accessToken || !phoneNumberId || !wabaId) {
        console.error(
          `  ✗ Device is missing credentials (token, whatsappPhoneId, or whatsappBusinessAccountId). Cannot push to Meta.`
        )
        continue
      }

      const metaClient = await WhatsAppDeviceClient.fromDevice({
        accessToken,
        phoneNumberId,
        wabaId,
        organizationId: template.organizationId,
      })

      for (const lang of template.languages) {
        try {
          const components = buildMetaTemplateComponents({
            ...lang,
            category: template.category ?? undefined,
          })

          const payload = {
            name: template.slug || template.name,
            category:
              (template.category as WhatsappBillingCategory) || "UTILITY",
            language: lang.lang,
            components,
          }

          console.log(
            `  [Meta Push] Sending payload for language "${lang.lang}":`
          )
          console.log(JSON.stringify(payload, null, 2))

          if (!isDryRun) {
            const metaResult = await metaClient.createTemplate(payload)
            console.log(
              `  ✓ Meta API response:`,
              JSON.stringify(metaResult, null, 2)
            )

            const rawStatus = metaResult?.status?.toUpperCase()
            const supportedStatus =
              rawStatus === "APPROVED" ||
              rawStatus === "PENDING" ||
              rawStatus === "REJECTED"
                ? rawStatus
                : "PENDING"

            await prisma.whatsappTemplateLanguage.update({
              where: { id: lang.id },
              data: {
                metaStatus: supportedStatus,
                isApproved: supportedStatus === "APPROVED",
              },
            })

            await prisma.whatsappTemplate.update({
              where: { id: template.id },
              data: {
                syncStatus: "SYNCED",
                metaStatus: supportedStatus,
                lastSyncedAt: new Date(),
              },
            })
            console.log(`  ✓ Template status synced to: ${supportedStatus}`)
          } else {
            console.log(`  [DRY RUN] Skipping actual Meta API call.`)
          }
        } catch (metaErr: any) {
          console.error(`  ✗ Meta API error:`, metaErr.message || metaErr)
        }
      }
    } else if (anyLanguageUpdated && !shouldPushMeta) {
      console.log(
        `\n  💡 Tip: To push the updated template to Meta, re-run with --push-meta flag.`
      )
    }
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
