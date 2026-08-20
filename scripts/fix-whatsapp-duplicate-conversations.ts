import { prisma } from "@/lib/prisma"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"

/**
 * Deduplicates WhatsApp conversations where numbers were stored with and without '+'.
 * Merges messages and labels into the canonical E.164 conversation (+62...)
 */
async function deduplicateConversations() {
  console.log("Searching for duplicate WhatsApp conversations...")

  const allConversations = await prisma.whatsappConversation.findMany({
    include: {
      _count: {
        select: { whatsappMessages: true },
      },
    },
  })

  // Group by orgId + clean digits
  const grouped = new Map<string, typeof allConversations>()

  for (const conv of allConversations) {
    const normalized =
      normalizeIndonesianPhoneNumber(conv.contactPhone) ?? conv.contactPhone
    const key = `${conv.organizationId}:${normalized}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(conv)
  }

  let mergedCount = 0

  for (const [key, group] of grouped.entries()) {
    if (group.length <= 1) continue

    console.log(
      `Found duplicate conversations for key: ${key} (${group.length} records)`
    )

    // Pick canonical conversation: prefer one starting with '+'
    const canonical =
      group.find((c) => c.contactPhone.startsWith("+")) ?? group[0]
    const duplicates = group.filter((c) => c.id !== canonical.id)

    const normalizedPhone =
      normalizeIndonesianPhoneNumber(canonical.contactPhone) ??
      canonical.contactPhone

    console.log(
      `Canonical conversation: ${canonical.id} (${canonical.contactPhone} -> ${normalizedPhone})`
    )

    for (const dup of duplicates) {
      console.log(
        `Merging duplicate conversation: ${dup.id} (${dup.contactPhone}) into ${canonical.id}`
      )

      // 1. Move messages to canonical conversation
      const movedMessages = await prisma.whatsappMessage.updateMany({
        where: { conversationId: dup.id },
        data: { conversationId: canonical.id },
      })
      console.log(`Moved ${movedMessages.count} messages`)

      // 2. Move labels to canonical conversation
      const dupLabels =
        await prisma.whatsappConversationLabelOnConversation.findMany({
          where: { conversationId: dup.id },
        })

      for (const l of dupLabels) {
        await prisma.whatsappConversationLabelOnConversation
          .create({
            data: {
              conversationId: canonical.id,
              labelId: l.labelId,
            },
          })
          .catch(() => {
            // Already exists, ignore
          })
      }

      // 3. Delete duplicate conversation
      await prisma.whatsappConversation.delete({
        where: { id: dup.id },
      })
      console.log(`Deleted duplicate conversation ${dup.id}`)
    }

    // 4. Update canonical conversation with normalized phone and latest message timestamps/direction
    const latestMessage = await prisma.whatsappMessage.findFirst({
      where: { conversationId: canonical.id },
      orderBy: { createdAt: "desc" },
    })

    await prisma.whatsappConversation.update({
      where: { id: canonical.id },
      data: {
        contactPhone: normalizedPhone,
        ...(latestMessage
          ? {
              lastMessageAt: latestMessage.createdAt,
              lastDirection: latestMessage.direction,
            }
          : {}),
      },
    })

    mergedCount++
  }

  console.log(`Finished! Merged ${mergedCount} conversation groups.`)
}

deduplicateConversations()
  .catch((err) => {
    console.error("Migration error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
