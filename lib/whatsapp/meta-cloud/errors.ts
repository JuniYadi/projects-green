export type NormalizedMetaErrorKind =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "INVALID_TEMPLATE"
  | "INVALID_RECIPIENT"
  | "PROVIDER_TEMPORARY_FAILURE"

export type NormalizedMetaError = {
  kind: NormalizedMetaErrorKind
}

export type MetaErrorCandidate = {
  error?: {
    message?: string
    type?: string
    code?: unknown
    error_subcode?: number
    fbtrace_id?: string
  }
}

export class MetaCloudError extends Error {
  readonly code: number | undefined
  readonly type: string | undefined
  readonly fbtrace_id: string | undefined
  readonly httpStatus: number | undefined

  constructor(message: string, options: { 
    code?: number; 
    type?: string; 
    fbtrace_id?: string;
    httpStatus?: number;
  } = {}) {
    super(message)
    this.name = "MetaCloudError"
    this.code = options.code
    this.type = options.type
    this.fbtrace_id = options.fbtrace_id
    this.httpStatus = options.httpStatus
  }
}

export const normalizeMetaError = (
  candidate: MetaErrorCandidate,
): NormalizedMetaError => {
  const code = candidate?.error?.code

  if (typeof code !== "number") {
    return { kind: "PROVIDER_TEMPORARY_FAILURE" }
  }

  if (code === 190) {
    return { kind: "AUTH_ERROR" }
  }

  if (code === 4 || code === 80007) {
    return { kind: "RATE_LIMIT" }
  }

  if (code === 132000) {
    return { kind: "INVALID_TEMPLATE" }
  }

  if (code === 131026) {
    return { kind: "INVALID_RECIPIENT" }
  }

  return { kind: "PROVIDER_TEMPORARY_FAILURE" }
}
