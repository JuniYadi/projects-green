export type UiDocEntry = {
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes?: string[]
  updatedAt: string
}

export type UiDocSuccessResponse = {
  ok: true
} & UiDocEntry

export type UiDocErrorResponse = {
  ok: false
  error: "INVALID_PATH" | "DOC_NOT_FOUND" | "INVALID_PAYLOAD"
  message: string
}
