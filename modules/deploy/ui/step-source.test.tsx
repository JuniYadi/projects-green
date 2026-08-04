import { describe, expect, it, mock } from "bun:test"

mock.module("@/modules/deploy/deploy.constants", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const original = require("@/modules/deploy/deploy.constants")
  return {
    ...original,
    DEPLOY_TEMPLATES: [
      {
        id: "wordpress",
        name: "WordPress",
        description: "The world's most popular website builder.",
        category: "CMS",
        defaultCpu: 500,
        defaultMemory: 512,
        build: {
          language: "PHP",
          framework: "WordPress",
          buildCommand: "",
          useDockerfile: true,
        },
      },
    ],
  }
})

import { fireEvent, render, act } from "@testing-library/react"
import {
  StepSourceV2,
  type StepSourceProps,
} from "@/modules/deploy/ui/step-source-v2"
import type { ResourcePlanId } from "@/modules/deploy/deploy.types"

const createProps = (): StepSourceProps => ({
  sourceType: "github",
  templateId: undefined,
  githubConnectionStatus: "connected",
  isConnectingGithub: false,
  ownerOptionsLoading: false,
  ownerOptionsError: null,
  repositoryOptionsLoading: false,
  repositoryOptionsError: null,
  ownerSearch: "",
  repositorySearch: "",
  owners: [{ id: "owner-pfn", name: "owner-pfn", avatarUrl: "" }],
  repositories: [
    {
      id: "repo-console-next",
      ownerId: "owner-pfn",
      name: "console-next-app",
      isPrivate: true,
      defaultBranch: "main",
      installationId: 12345,
    },
  ],
  branches: [{ id: "branch-main", repoId: "repo-console-next", name: "main" }],
  selectedOwnerId: "owner-pfn",
  selectedRepositoryId: "",
  selectedBranchName: "",
  rootDirectory: "/",
  appName: "",
  templateResourcePlanId: "payg" as ResourcePlanId,
  onSourceTypeChange: mock(() => {}),
  onTemplateSelect: mock(() => {}),
  onOwnerSearchChange: mock(() => {}),
  onRepositorySearchChange: mock(() => {}),
  onAppNameChange: mock(() => {}),
  onTemplateResourcePlanChange: mock(() => {}),
  onPublicSourceUrlChange: mock(() => {}),
  onPublicSourceRefChange: mock(() => {}),
  onConnectGithub: mock(() => {}),
  onCancel: mock(() => {}),
  onNext: mock(() => {}),
  onOwnerSelect: mock(() => {}),
  onRepositorySelect: mock(() => {}),
  onBranchSelect: mock(() => {}),
  onRootDirectoryChange: mock(() => {}),
  canProceed: true,
  isDetecting: false,
  detectionError: null,
})
const changeSmartInput = (input: HTMLElement, value: string) => {
  const reactPropsKey = Object.keys(input).find((key) =>
    key.startsWith("__reactProps")
  )
  if (!reactPropsKey) {
    fireEvent.change(input, { target: { value } })
    return
  }
  const props = input as unknown as Record<
    string,
    { onChange?: (event: { target: { value: string } }) => void }
  >
  act(() => props[reactPropsKey].onChange?.({ target: { value } }))
}

describe("StepSourceV2 smart source input", () => {
  it("renders one heading, input, and result list without untrusted-code copy", () => {
    const view = render(<StepSourceV2 {...createProps()} />)

    expect(
      view.getByRole("heading", { name: "What are we deploying?" })
    ).toBeTruthy()
    expect(
      view.getByPlaceholderText("Paste a repo URL or search templates")
    ).toBeTruthy()
    expect(
      view.getByRole("listbox", { name: "Deployment sources" })
    ).toBeTruthy()
    expect(view.queryByText(/untrusted code/i)).toBeNull()
  })

  it("selects connected repositories through existing typed callbacks", () => {
    const props = createProps()
    const view = render(<StepSourceV2 {...props} />)

    fireEvent.click(view.getByRole("option", { name: /console-next-app/i }))

    expect(props.onSourceTypeChange).toHaveBeenCalledWith("github")
    expect(props.onRepositorySelect).toHaveBeenCalledWith("repo-console-next")
  })

  it.each(["https://github.com/acme/web", "https://gitlab.com/acme/web"])(
    "selects %s as a public source with safe defaults",
    (url) => {
      const props = createProps()
      const view = render(<StepSourceV2 {...props} />)

      changeSmartInput(
        view.getByPlaceholderText("Paste a repo URL or search templates"),
        url
      )
      expect(props.onSourceTypeChange).toHaveBeenCalledWith("public")
      expect(props.onPublicSourceUrlChange).toHaveBeenCalledWith(url)
      expect(props.onPublicSourceRefChange).toHaveBeenCalledWith("main")
      expect(props.onRootDirectoryChange).toHaveBeenCalledWith("/")
      expect(props.onAppNameChange).toHaveBeenCalled()
    }
  )

  it("filters ordinary text without guessing a source provider", () => {
    const props = createProps()
    const view = render(<StepSourceV2 {...props} />)
    const input = view.getByPlaceholderText(
      "Paste a repo URL or search templates"
    )

    changeSmartInput(input, "console")
    expect(props.onTemplateSelect).not.toHaveBeenCalled()
  })

  it("selects templates through the same input and preserves resource metadata", () => {
    const props = createProps()
    const view = render(<StepSourceV2 {...props} />)
    const input = view.getByPlaceholderText(
      "Paste a repo URL or search templates"
    )

    changeSmartInput(input, "WordPress")
    expect(view.getByText(/500m CPU · 512MB memory/)).toBeTruthy()
    fireEvent.click(view.getByRole("option", { name: /WordPress/i }))
    expect(props.onSourceTypeChange).toHaveBeenCalledWith("template")
    expect(props.onTemplateSelect).toHaveBeenCalledWith("wordpress")
  })

  it("keeps Advanced closed and preserves connection, cancel, and next controls", () => {
    const props = createProps()
    props.githubConnectionStatus = "error"
    props.githubReconnectRequired = true
    const view = render(<StepSourceV2 {...props} />)

    expect(
      view.getByText("GitHub access expired. Reconnect to continue.")
    ).toBeTruthy()
    fireEvent.click(view.getByRole("button", { name: /Reconnect GitHub/i }))
    fireEvent.click(view.getByRole("button", { name: "Cancel" }))
    fireEvent.click(view.getByRole("button", { name: "Next" }))
    expect(props.onConnectGithub).toHaveBeenCalledTimes(1)
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)

    const advanced = view.getByRole("button", { name: "Advanced" })
    expect(advanced.getAttribute("aria-expanded")).toBe("false")
  })

  it("renders actual recent sources only", () => {
    const props = createProps()
    props.recentSources = [
      {
        sourceType: "public",
        label: "Public app",
        publicSourceUrl: "https://github.com/acme/public-app",
        publicSourceRef: "main",
        rootDirectory: "/",
      },
    ]
    const view = render(<StepSourceV2 {...props} />)

    expect(view.getByText("Recent")).toBeTruthy()
    expect(view.getByRole("option", { name: /Public app/i })).toBeTruthy()
  })
})
