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
  error:
    | "INVALID_PATH"
    | "DOC_NOT_FOUND"
    | "INVALID_PAYLOAD"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
  message: string
}

export type KnowledgeChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type KnowledgeCitation = {
  id: string
  title: string
  path: string
  updatedAt: string
}

export type KnowledgeChatRequest = {
  messages: KnowledgeChatMessage[]
  routePath: string
}

export type KnowledgeChatStreamFrame =
  | {
      type: "delta"
      text: string
    }
  | {
      type: "done"
      answer: string
      citations: KnowledgeCitation[]
    }
  | {
      type: "error"
      message: string
    }
