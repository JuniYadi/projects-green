/**
 * VPN Mobile App Access module (PRD §9 Phase 1).
 *
 * Barrel re-exports services, error classes, and DTOs.
 */

export {
  VpnMobileDeviceService,
  vpnMobileDeviceService,
} from "./vpn-mobile-device.service"
export type {
  CreateMobileDeviceInput,
  ListMobileDeviceFilter,
} from "./vpn-mobile-device.service"

export {
  VpnPairingTokenService,
  vpnPairingTokenService,
} from "./vpn-pairing-token.service"
export type {
  PairingClaims,
  PairingClaimInput,
  PairingGenerateInput,
  PairingGenerateResult,
  PairingStatusResult,
  PairingTokenServiceDeps,
} from "./vpn-pairing-token.service"

export {
  VpnMobileDeviceAlreadyRevokedError,
  VpnMobileDeviceLimitError,
  VpnMobileDeviceNotFoundError,
  VpnPairingTokenAlreadyUsedError,
  VpnPairingTokenExpiredError,
  VpnPairingTokenInvalidError,
} from "./vpn-mobile.errors"

export {
  toMobileDeviceDTO,
  toMobileDeviceListDTO,
} from "./vpn-mobile-device.dto"
export type {
  VpnMobileDeviceDTO,
  VpnMobileDeviceListDTO,
} from "./vpn-mobile-device.dto"

export {
  toPairingClaimResultDTO,
  toPairingGenerateResultDTO,
} from "./vpn-pairing-token.dto"
export type {
  PairingClaimProfileDTO,
  PairingClaimResultDTO,
  PairingClaimSubscriptionDTO,
  PairingGenerateResultDTO,
} from "./vpn-pairing-token.dto"
