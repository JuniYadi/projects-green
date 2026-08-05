import crypto from "node:crypto"

export function buildAccountUsername(organizationId: string): string {
  const safeOrg = organizationId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()
  const orgHint = safeOrg.slice(-8) || "org"
  const suffix = crypto.randomBytes(3).toString("hex")
  return `org${orgHint}-${suffix}`
}
