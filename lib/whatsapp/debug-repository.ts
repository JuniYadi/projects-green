export type DebugSnapshotInput = {
  deviceId: string
  reason: string
  payload: unknown
}

export function saveDebugSnapshot({
  deviceId,
  reason,
  payload,
}: DebugSnapshotInput): void {
  console.log(`[WhatsApp Debug] Device: ${deviceId}, Reason: ${reason}`, {
    payload,
    timestamp: new Date().toISOString(),
  })
}
