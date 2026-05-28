import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { StepSource } from "@/modules/deploy/ui/step-source"
import type { StepSourceProps } from "@/modules/deploy/ui/step-source"

const createProps = () => {
  return {
    sourceType: "github" as StepSourceProps["sourceType"],
    templateId: undefined as StepSourceProps["templateId"],
    githubConnectionStatus: "connected" as StepSourceProps["githubConnectionStatus"],
    isConnectingGithub: false,
    ownerOptionsLoading: false,
    ownerOptionsError: null as StepSourceProps["ownerOptionsError"],
    repositoryOptionsLoading: false,
    repositoryOptionsError: null as StepSourceProps["repositoryOptionsError"],
    ownerSearch: "",
    repositorySearch: "",
    owners: [
      {
        id: "owner-pfn",
        name: "owner-pfn",
        avatarUrl: "",
      },
    ],
    repositories: [
      {
        id: "repo-console-next",
        ownerId: "owner-pfn",
        name: "console-next-app",
        isPrivate: true,
        defaultBranch: "main",
      },
    ],
    branches: [
      {
        id: "repo-console-next-main",
        repoId: "repo-console-next",
        name: "main",
      },
    ],
    selectedOwnerId: "",
    selectedRepositoryId: "",
    selectedBranchName: "",
    rootDirectory: "/",
    onSourceTypeChange: mock(() => {}),
    onTemplateSelect: mock(() => {}),
    onOwnerSearchChange: mock(() => {}),
    onRepositorySearchChange: mock(() => {}),
    onOwnerSelect: mock(() => {}),
    onRepositorySelect: mock(() => {}),
    onBranchSelect: mock(() => {}),
    onRootDirectoryChange: mock(() => {}),
    onConnectGithub: mock(() => {}),
    onCancel: mock(() => {}),
    onNext: mock(() => {}),
    canProceed: false,
  }
}

describe("StepSource", () => {
  it("renders source fields and organization choices", () => {
    const props = createProps()

    const view = render(<StepSource {...props} />)

    expect(view.getByText("Select Account / Organization")).toBeTruthy()
    expect(view.getByRole("button", { name: /owner-pfn/i })).toBeTruthy()
    expect(view.queryByText("Select Repository")).toBeNull()
  })

  it("renders selected source state and custom root directory", () => {
    const props = createProps()
    props.selectedOwnerId = "owner-pfn"
    props.selectedRepositoryId = "repo-console-next"
    props.selectedBranchName = "main"
    props.rootDirectory = "/apps/web"

    const view = render(<StepSource {...props} />)

    expect(view.getByRole("button", { name: /owner-pfn/i })).toBeTruthy()
    expect(view.getByText("console-next-app")).toBeTruthy()
    expect(view.getByRole("button", { name: /^main$/ })).toBeTruthy()
    expect(view.getByDisplayValue("/apps/web")).toBeTruthy()
  })

  it("shows empty search states for owners and repositories", () => {
    const props = createProps()
    props.owners = []

    const view = render(<StepSource {...props} />)
    expect(
      view.getByText("No accounts found. Please make sure the GitHub App is installed.")
    ).toBeTruthy()

    // Select owner to show repos
    const propsWithOwner = createProps()
    propsWithOwner.selectedOwnerId = "owner-pfn"
    propsWithOwner.repositories = []
    
    const viewWithRepos = render(<StepSource {...propsWithOwner} />)
    expect(
      viewWithRepos.getByText("No repositories found for this account.")
    ).toBeTruthy()
  })

  it("shows connected notice and starts GitHub connect action", () => {
    const props = createProps()
    props.githubConnectionStatus = "connected"

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText("Successfully connected to your GitHub account.")
    ).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: "Reconnect GitHub" }))
    expect(props.onConnectGithub).toHaveBeenCalledTimes(1)
  })

  it("shows connection failure error banner", () => {
    const props = createProps()
    props.githubConnectionStatus = "error"

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText("GitHub connection failed. Please try connecting again.")
    ).toBeTruthy()
  })

  it("shows owner and repository loading errors", () => {
    const props = createProps()
    props.githubConnectionStatus = "connected"
    props.selectedOwnerId = "owner-pfn"
    props.ownerOptionsError = "Unable to load owners."
    props.repositoryOptionsError = "Unable to load repositories."

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText("Unable to load owners.")
    ).toBeTruthy()
    expect(
      view.getByText("Unable to load repositories.")
    ).toBeTruthy()
  })

  it("shows loading indicators while owners and repositories are loading", () => {
    const props = createProps()
    props.ownerOptionsLoading = true
    props.selectedOwnerId = "owner-pfn"
    props.repositoryOptionsLoading = true

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText("Loading installations...")
    ).toBeTruthy()
    expect(
      view.getByText("Loading repositories...")
    ).toBeTruthy()
  })
})
