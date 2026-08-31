import { render } from "@react-email/components"
import { redis } from "@/lib/redis"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/queue/email"
import { getPlatformSuperAdminEmails } from "@/lib/platform-admin-emails"
import {
  DeviceStateChangeEmail,
  type DeviceStateChangeDiff,
} from "@/modules/whatsapp/emails/device-state-change"
import {
  DailyDeviceDigestEmail,
  type DeviceDigestItem,
} from "@/modules/whatsapp/emails/daily-device-digest"

export interface WhatsAppDeviceStateSnapshot {
  nameStatus: string | null
  verifiedName: string | null
  qualityRating: string | null
  status: string | null
}

const STATE_CACHE_TTL_SECONDS = 30 * 86400 // 30 days

export function deviceStateKey(deviceId: string): string {
  return `whatsapp:device:state:${deviceId}`
}

/**
 * Compares current device state with cached state in Redis.
 * If changed, sends instant alert to all Platform Super Admins.
 */
export async function trackAndNotifyDeviceStateChange(params: {
  deviceId: string
  phoneNumber: string
  orgName?: string
  currentState: WhatsAppDeviceStateSnapshot
}): Promise<{ changed: boolean; diffs: DeviceStateChangeDiff[] }> {
  const {
    deviceId,
    phoneNumber,
    orgName = "Unknown Organization",
    currentState,
  } = params
  const key = deviceStateKey(deviceId)

  try {
    const rawPrevious = await redis.get(key)
    const previousState: WhatsAppDeviceStateSnapshot | null = rawPrevious
      ? (JSON.parse(rawPrevious) as WhatsAppDeviceStateSnapshot)
      : null

    const diffs: DeviceStateChangeDiff[] = []

    if (previousState) {
      if (
        currentState.nameStatus &&
        previousState.nameStatus !== currentState.nameStatus
      ) {
        diffs.push({
          field: "Meta Name Status",
          oldValue: previousState.nameStatus ?? "UNSET",
          newValue: currentState.nameStatus,
        })
      }

      if (
        currentState.verifiedName &&
        previousState.verifiedName !== currentState.verifiedName
      ) {
        diffs.push({
          field: "Verified Display Name",
          oldValue: previousState.verifiedName ?? "EMPTY",
          newValue: currentState.verifiedName,
        })
      }

      if (
        currentState.qualityRating &&
        previousState.qualityRating !== currentState.qualityRating
      ) {
        diffs.push({
          field: "Quality Rating",
          oldValue: previousState.qualityRating ?? "UNKNOWN",
          newValue: currentState.qualityRating,
        })
      }

      if (currentState.status && previousState.status !== currentState.status) {
        diffs.push({
          field: "Connection Status",
          oldValue: previousState.status ?? "UNKNOWN",
          newValue: currentState.status,
        })
      }
    }

    // Always update cache to latest state
    await redis.set(
      key,
      JSON.stringify(currentState),
      "EX",
      STATE_CACHE_TTL_SECONDS
    )

    // If diff detected and this isn't the initial population
    if (diffs.length > 0) {
      const adminEmails = await getPlatformSuperAdminEmails()

      if (adminEmails.length > 0) {
        const html = await render(
          <DeviceStateChangeEmail
            deviceName={currentState.verifiedName || phoneNumber}
            phoneNumber={phoneNumber}
            orgName={orgName}
            changes={diffs}
            changedAt={new Date().toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
          />
        )

        const subject = `[Admin Alert] WhatsApp Device Status Changed: ${phoneNumber} (${orgName})`

        await Promise.all(
          adminEmails.map((email) =>
            sendEmail({
              to: email,
              subject,
              html,
            }).catch((err) =>
              console.error(
                `[WhatsAppStateTracker] Failed sending to ${email}:`,
                err
              )
            )
          )
        )
      }

      return { changed: true, diffs }
    }

    return { changed: false, diffs: [] }
  } catch (error) {
    console.error("[WhatsAppStateTracker] Error diffing state:", error)
    return { changed: false, diffs: [] }
  }
}

/**
 * Runs 07:00 AM daily digest briefing sent to Super Admins.
 */
export async function sendDailyDeviceDigest(): Promise<void> {
  const adminEmails = await getPlatformSuperAdminEmails()
  if (adminEmails.length === 0) {
    console.log(
      "[WhatsAppDailyDigest] No super admin emails configured. Skipping."
    )
    return
  }

  const devices = await prisma.whatsappDevice.findMany({
    orderBy: { createdAt: "desc" },
  })

  if (devices.length === 0) {
    return
  }

  let approved = 0
  let pending = 0
  let declinedOrExpired = 0
  let active = 0

  const items: DeviceDigestItem[] = devices.map((d) => {
    const profile =
      d.whatsappProfile &&
      typeof d.whatsappProfile === "object" &&
      !Array.isArray(d.whatsappProfile)
        ? (d.whatsappProfile as Record<string, unknown>)
        : {}

    const nameStatus = (
      (profile.name_status as string) || "UNSET"
    ).toUpperCase()
    const verifiedName = (profile.verified_name as string) || d.phoneNumber
    const qualityRating = (
      (profile.quality_rating as string) || "UNKNOWN"
    ).toUpperCase()

    if (nameStatus === "APPROVED") approved++
    else if (nameStatus === "PENDING" || nameStatus === "PENDING_REVIEW")
      pending++
    else if (
      nameStatus === "DECLINED" ||
      nameStatus === "EXPIRED" ||
      nameStatus === "REJECTED"
    ) {
      declinedOrExpired++
    }

    if (d.status === "ACTIVE") active++

    return {
      id: d.id,
      phoneNumber: d.phoneNumber,
      displayName: verifiedName,
      orgName: d.organizationId,
      nameStatus,
      qualityRating,
      status: d.status,
    }
  })

  const stats = {
    total: devices.length,
    approved,
    pending,
    declinedOrExpired,
    active,
  }

  const html = await render(
    <DailyDeviceDigestEmail
      devices={items}
      stats={stats}
      generatedAt={new Date().toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    />
  )

  const subject = `[WhatsApp Daily Digest] ${stats.total} Devices Summary (${stats.approved} Approved, ${stats.pending} Pending)`

  await Promise.all(
    adminEmails.map((email) =>
      sendEmail({
        to: email,
        subject,
        html,
      }).catch((err) =>
        console.error(
          `[WhatsAppDailyDigest] Failed sending digest to ${email}:`,
          err
        )
      )
    )
  )
}
