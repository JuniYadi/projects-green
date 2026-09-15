import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { TabBuild } from "./tab-build"

describe("TabBuild Component", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders with initial build and deploy properties", () => {
    const { getByLabelText, getByDisplayValue } = render(
      <TabBuild
        buildCommand="npm run build"
        rootDirectory="/app"
        dockerfileDetected={true}
        framework="Next.js"
      />
    )

    expect(getByDisplayValue("npm run build")).toBeTruthy()
    expect(getByDisplayValue("/app")).toBeTruthy()
    expect(getByDisplayValue("Next.js")).toBeTruthy()
    expect(getByLabelText("Toggle Dockerfile build")).toBeTruthy()
  })

  it("updates fields and triggers onSave callback with updated values", async () => {
    const onSave = mock(async () => {})
    const { getByPlaceholderText, getByText, getByLabelText } = render(
      <TabBuild
        buildCommand="npm run build"
        rootDirectory="/"
        dockerfileDetected={false}
        framework="Node"
        onSave={onSave}
      />
    )

    const buildInput = getByPlaceholderText("npm run build")
    fireEvent.change(buildInput, { target: { value: "pnpm build" } })

    const rootInput = getByPlaceholderText("/")
    fireEvent.change(rootInput, { target: { value: "/frontend" } })

    const frameworkInput = getByPlaceholderText("e.g. Next.js, Laravel, Docker")
    fireEvent.change(frameworkInput, { target: { value: "Next.js" } })

    const toggle = getByLabelText("Toggle Dockerfile build")
    fireEvent.click(toggle)

    const saveButton = getByText("Save Changes")
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledWith({
      buildCommand: "pnpm build",
      rootDirectory: "/frontend",
      dockerfileDetected: true,
      framework: "Next.js",
    })
  })

  it("renders with default fallback values when props are omitted", () => {
    const { getByText } = render(<TabBuild />)
    expect(getByText("Build & Deploy")).toBeTruthy()
    expect(getByText("Save Changes")).toBeTruthy()
  })

  it("renders prebuilt template info card when application is a template", () => {
    const { getByText, queryByText } = render(
      <TabBuild sourceType="TEMPLATE" templateName="9router" />
    )
    expect(getByText(/9router/)).toBeTruthy()
    expect(getByText(/Managed Container Image/i)).toBeTruthy()
    expect(queryByText("Save Changes")).toBeNull()
  })
})
