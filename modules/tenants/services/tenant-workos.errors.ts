export class TenantWorkOSOperationUnsupportedError extends Error {
  readonly operation: string

  constructor(operation: string) {
    super(`WorkOS operation '${operation}' is not supported by this SDK.`)
    this.name = "TenantWorkOSOperationUnsupportedError"
    this.operation = operation
  }
}
