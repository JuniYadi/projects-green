/**
 * Shared VPN package utilities.
 *
 * Extracted from vpn-packages.tsx and vpn-package-comparison.tsx
 * to avoid duplicate function definitions.
 */

import type { VpnPackageSummary } from "@/lib/vpn-client"

/**
 * Pick the package with the most servers as the recommended one.
 * Returns `null` when the list is empty.
 */
export function recommendedPackageId(
  packages: VpnPackageSummary[]
): string | null {
  if (packages.length === 0) return null
  return packages.reduce((best, pkg) =>
    pkg.serverCount > best.serverCount ? pkg : best
  ).id
}
