export class VoucherNotFoundError extends Error {
  readonly code = "VOUCHER_NOT_FOUND"
  constructor(idOrCode: string) {
    super(`Voucher not found: ${idOrCode}`)
    this.name = "VoucherNotFoundError"
  }
}

export class VoucherExpiredError extends Error {
  readonly code = "VOUCHER_EXPIRED"
  constructor(code: string) {
    super(`Voucher has expired: ${code}`)
    this.name = "VoucherExpiredError"
  }
}

export class VoucherDepletedError extends Error {
  readonly code = "VOUCHER_DEPLETED"
  constructor(code: string) {
    super(`Voucher has reached maximum claims: ${code}`)
    this.name = "VoucherDepletedError"
  }
}

export class VoucherDisabledError extends Error {
  readonly code = "VOUCHER_DISABLED"
  constructor(code: string) {
    super(`Voucher is disabled: ${code}`)
    this.name = "VoucherDisabledError"
  }
}

export class VoucherAlreadyClaimedError extends Error {
  readonly code = "VOUCHER_ALREADY_CLAIMED"
  constructor(voucherCode: string, workosUserId: string) {
    super(`Voucher ${voucherCode} already claimed by user ${workosUserId}`)
    this.name = "VoucherAlreadyClaimedError"
  }
}

export class VoucherTargetUserMismatchError extends Error {
  readonly code = "VOUCHER_TARGET_USER_MISMATCH"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is not valid for this user`)
    this.name = "VoucherTargetUserMismatchError"
  }
}

export class VoucherTargetOrgMismatchError extends Error {
  readonly code = "VOUCHER_TARGET_ORG_MISMATCH"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is not valid for this organization`)
    this.name = "VoucherTargetOrgMismatchError"
  }
}

export class VoucherCollisionRetryExhaustedError extends Error {
  readonly code = "VOUCHER_COLLISION_RETRY_EXHAUSTED"
  constructor() {
    super("Failed to generate a unique voucher code after maximum retries")
    this.name = "VoucherCollisionRetryExhaustedError"
  }
}
