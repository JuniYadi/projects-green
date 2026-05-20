import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"

import { StepSource } from "@/modules/deploy/ui/step-source"

const createProps = () => {
  return {
    githubConnectionStatus: "idle" as const,
    isConnectingGithub: false,
    ownerOptionsLoading: false,
    ownerOptionsError: null,
    repositoryOptionsLoading: false,
    repositoryOptionsError: null,
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
  it("renders source field guidance before selections", () => {
    const props = createProps()

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText("Select an owner to unlock repository options.")
    ).toBeTruthy()
    expect(view.getByText("Pick an owner first.")).toBeTruthy()
    expect(view.getByText("Select a repository to load branches.")).toBeTruthy()
    expect(
      view.getByText(
        "Using repository root. Example nested app paths: /apps/web or /packages/site."
      )
    ).toBeTruthy()
  })

  it("renders selected source state and custom root directory guidance", () => {
    const props = createProps()
    props.selectedOwnerId = "owner-pfn"
    props.selectedRepositoryId = "repo-console-next"
    props.selectedBranchName = "main"
    props.rootDirectory = "/apps/web"

    const view = render(<StepSource {...props} />)

    expect(view.getByText("Owner selected: owner-pfn")).toBeTruthy()
    expect(view.getByText("Repository selected: console-next-app")).toBeTruthy()
    expect(view.getByText("Branch selected: main")).toBeTruthy()
    expect(
      view.getByText(
        "Deploy from /apps/web. Ensure build files exist in this path."
      )
    ).toBeTruthy()
  })

  it("shows empty search states for owners and repositories", () => {
    const props = createProps()
    props.ownerSearch = "unknown-owner"
    props.owners = []
    props.selectedOwnerId = "owner-pfn"
    props.repositorySearch = "missing-repo"
    props.repositories = []

    const view = render(<StepSource {...props} />)

    expect(view.getByText("No owners match your search yet.")).toBeTruthy()
    expect(view.getByText("No repositories match your search.")).toBeTruthy()
  })

  it("shows connected notice and starts GitHub connect action", () => {
    const props = createProps()
    props.githubConnectionStatus = "connected"

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText(
        "GitHub connected. Select an owner and repository to continue."
      )
    ).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: "Connect GitHub" }))
    expect(props.onConnectGithub).toHaveBeenCalledTimes(1)
  })

  it("shows callback and repository loading errors", () => {
    const props = createProps()
    props.githubConnectionStatus = "error"
    props.selectedOwnerId = "owner-pfn"
    props.ownerOptionsError = "Unable to load owners."
    props.repositoryOptionsError = "Unable to load repositories."

    const view = render(<StepSource {...props} />)

    expect(
      view.getByText("GitHub connection failed. Please try connecting again.")
    ).toBeTruthy()
    expect(
      view.getByText(
        "We could not load owners. Try searching again or reconnect GitHub."
      )
    ).toBeTruthy()
    expect(
      view.getByText("We could not load repositories for this owner.")
    ).toBeTruthy()
  })

  it("disables selectors while owners and repositories are loading", () => {
    const props = createProps()
    props.ownerOptionsLoading = true
    props.repositoryOptionsLoading = true
    props.selectedOwnerId = "owner-pfn"

    const view = render(<StepSource {...props} />)

    expect(view.getByLabelText("Owner selector")).toBeDisabled()
    expect(view.getByLabelText("Repository selector")).toBeDisabled()
    expect(
      view.getByText("Loading owners from your GitHub installations.")
    ).toBeTruthy()
    expect(view.getByText("Loading repositories.")).toBeTruthy()
  })
})
