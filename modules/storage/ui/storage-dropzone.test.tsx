import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { StorageDropzone } from "./storage-dropzone"

describe("StorageDropzone", () => {
  it("renders upload dropzone with custom label and icon", () => {
    const { getByText } = render(
      <StorageDropzone
        label="Upload Sample Header Image"
        description="PNG, JPG, or WEBP up to 5MB"
        mediaType="IMAGE"
      />
    )

    expect(getByText("Upload Sample Header Image")).toBeDefined()
    expect(getByText("PNG, JPG, or WEBP up to 5MB")).toBeDefined()
  })

  it("renders ready state when initial value is provided", () => {
    const { getByText } = render(
      <StorageDropzone
        value="https://example.com/image.png"
        label="Upload Sample Header Image"
      />
    )

    expect(getByText("Uploaded media file")).toBeDefined()
    expect(getByText("Ready")).toBeDefined()
  })
})
