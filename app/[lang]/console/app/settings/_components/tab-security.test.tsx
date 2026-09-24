import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { TabSecurity } from "./tab-security"

describe("TabSecurity Component", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders with initial security values", () => {
    const { getByLabelText } = render(
      <TabSecurity
        security={{
          runAsUser: 1000,
          runAsGroup: 1001,
          fsGroup: 1002,
          readOnlyRootFilesystem: false,
          runAsNonRoot: false,
        }}
      />
    )

    const userInput = getByLabelText(/Run As User/i) as HTMLInputElement
    const groupInput = getByLabelText(/Run As Group/i) as HTMLInputElement
    const fsInput = getByLabelText(/Storage FSGroup/i) as HTMLInputElement

    expect(userInput.value).toBe("1000")
    expect(groupInput.value).toBe("1001")
    expect(fsInput.value).toBe("1002")
  })

  it("calls onSave when save button is clicked", async () => {
    const onSave = mock(async () => {})
    const { getByLabelText, getByText } = render(
      <TabSecurity
        security={{
          runAsUser: 1000,
          runAsGroup: 1000,
          fsGroup: 1000,
          readOnlyRootFilesystem: false,
          runAsNonRoot: false,
        }}
        onSave={onSave}
      />
    )

    const userInput = getByLabelText(/Run As User/i)
    fireEvent.change(userInput, { target: { value: "2000" } })

    const saveBtn = getByText("Save Security Settings")
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith({
      runAsUser: 2000,
      runAsGroup: 1000,
      fsGroup: 1000,
      readOnlyRootFilesystem: false,
      runAsNonRoot: false,
    })
  })
})
