import type {
  BusinessProfileFields,
  Vertical,
} from "@/lib/whatsapp/meta-cloud/types/business-profile"

export type BusinessProfileDTO = {
  about?: string
  address?: string
  description?: string
  email?: string
  profile_picture_url?: string
  profile_picture_handle?: string
  websites?: string[]
  vertical?: Vertical
}

export function toBusinessProfileDTO(
  profile: BusinessProfileFields | Record<string, unknown>
): BusinessProfileDTO {
  const values = profile as Record<string, unknown>
  const dto: BusinessProfileDTO = {}

  if (typeof values.about === "string") dto.about = values.about
  if (typeof values.address === "string") dto.address = values.address
  if (typeof values.description === "string") {
    dto.description = values.description
  }
  if (typeof values.email === "string") dto.email = values.email
  if (typeof values.profile_picture_url === "string") {
    dto.profile_picture_url = values.profile_picture_url
  }
  if (typeof values.profile_picture_handle === "string") {
    dto.profile_picture_handle = values.profile_picture_handle
  }
  if (Array.isArray(values.websites)) {
    dto.websites = values.websites.filter(
      (website): website is string => typeof website === "string"
    )
  }
  if (typeof values.vertical === "string") {
    dto.vertical = values.vertical as Vertical
  }

  return dto
}
