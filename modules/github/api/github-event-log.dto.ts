// DTOs — stable API contract for GitHub event log responses

export type GithubEventRowDTO = {
  id: string
  deliveryId: string | null
  eventName: string
  action: string | null
  repositoryFullName: string | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  senderLogin: string | null
  eventDisposition: string | null
  ignoreReason: string | null
  processStatus: string | null
  processError: string | null
  receivedAt: Date
  processedAt: Date | null
  deletedAt: Date | null
}

export type GithubEventDetailDTO = GithubEventRowDTO & {
  payloadJson: unknown
}

export type GithubEventListDTO = {
  items: GithubEventRowDTO[]
  total: number
  page: number
  pageSize: number
}

// Mappers — convert Prisma results to DTOs
export const toEventRowDTO = (event: unknown): GithubEventRowDTO => {
  const e = event as Record<string, unknown>
  return {
    id: String(e.id),
    deliveryId: e.deliveryId as string | null,
    eventName: String(e.eventName),
    action: e.action as string | null,
    repositoryFullName: e.repositoryFullName as string | null,
    branch: e.branch as string | null,
    commitSha: e.commitSha as string | null,
    commitMessage: e.commitMessage as string | null,
    senderLogin: e.senderLogin as string | null,
    eventDisposition: e.eventDisposition as string | null,
    ignoreReason: e.ignoreReason as string | null,
    processStatus: e.processStatus as string | null,
    processError: e.processError as string | null,
    receivedAt: e.receivedAt as Date,
    processedAt: e.processedAt as Date | null,
    deletedAt: e.deletedAt as Date | null,
  }
}

export const toEventDetailDTO = (event: unknown): GithubEventDetailDTO => {
  const e = event as Record<string, unknown>
  return {
    ...toEventRowDTO(e),
    payloadJson: e.payloadJson,
  }
}
