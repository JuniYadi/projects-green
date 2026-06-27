/**
 * Shared error classes for the VPN mobile module (T1.2/T1.3).
 *
 * Defined separately so both device + pairing services can import them
 * without circular dependencies.
 */

export class VpnMobileDeviceNotFoundError extends Error {
  constructor(message = "VPN mobile device not found.") {
    super(message)
    this.name = "VpnMobileDeviceNotFoundError"
  }
}

export class VpnMobileDeviceAlreadyRevokedError extends Error {
  constructor(message = "VPN mobile device has already been revoked.") {
    super(message)
    this.name = "VpnMobileDeviceAlreadyRevokedError"
  }
}

export class VpnPairingTokenInvalidError extends Error {
  constructor(message = "Pairing token is invalid.") {
    super(message)
    this.name = "VpnPairingTokenInvalidError"
  }
}

export class VpnPairingTokenExpiredError extends Error {
  constructor(message = "Pairing token has expired.") {
    super(message)
    this.name = "VpnPairingTokenExpiredError"
  }
}

export class VpnPairingTokenAlreadyUsedError extends Error {
  constructor(message = "Pairing token has already been used.") {
    super(message)
    this.name = "VpnPairingTokenAlreadyUsedError"
  }
}

export class VpnMobileDeviceLimitError extends Error {
  constructor(message = "Device limit reached for this subscription.") {
    super(message)
    this.name = "VpnMobileDeviceLimitError"
  }
}
