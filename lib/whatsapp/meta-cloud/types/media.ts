export type MediaMetadata = {
  url: string
  mime_type: string
  sha256: string
  file_size: number
  id: string
  messaging_product: string
}

export type DeleteMediaResult = {
  success: boolean
}
