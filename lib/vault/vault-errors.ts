export type VaultErrorOptions = {
  cause?: unknown
  status?: number
}

export class VaultError extends Error {
  readonly status?: number

  constructor(message: string, options: VaultErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.status = options.status
  }
}

export class VaultAuthError extends VaultError {}

export class VaultSecretNotFoundError extends VaultError {}

export class VaultNetworkError extends VaultError {}
