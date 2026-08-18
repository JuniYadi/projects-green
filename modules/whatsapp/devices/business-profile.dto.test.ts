import { describe, expect, it } from "bun:test"
import { toBusinessProfileDTO } from "./business-profile.dto"

describe("toBusinessProfileDTO", () => {
  it("maps all profile fields correctly", () => {
    const input = {
      about: "About text",
      address: "123 Street",
      description: "Business description",
      email: "test@example.com",
      profile_picture_url: "https://example.com/pic.png",
      profile_picture_handle: "handle-123",
      websites: ["https://example.com", 123, null],
      vertical: "OTHER",
      extra: "ignored",
    }

    const dto = toBusinessProfileDTO(input)
    expect(dto).toEqual({
      about: "About text",
      address: "123 Street",
      description: "Business description",
      email: "test@example.com",
      profile_picture_url: "https://example.com/pic.png",
      profile_picture_handle: "handle-123",
      websites: ["https://example.com"],
      vertical: "OTHER",
    })
  })

  it("handles empty and non-string values gracefully", () => {
    const input = {
      about: 123,
      address: null,
      description: undefined,
      email: {},
      profile_picture_url: 456,
      profile_picture_handle: [],
      websites: "not-an-array",
      vertical: 789,
    }

    const dto = toBusinessProfileDTO(
      input as unknown as Record<string, unknown>
    )
    expect(dto).toEqual({})
  })
})
