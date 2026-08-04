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
        defaultCpu: 500,
        defaultMemory: 512,
        build: {
          language: "PHP",
          framework: "WordPress",
          buildCommand: "",
          useDockerfile: true,
        },
      },
      ...Array.from({ length: 9 }).map((_, i) => ({
        id: `template-${i}`,
        name: `Template ${i}`,
        description: `Description ${i}`,
        defaultCpu: 500,
        defaultMemory: 512,
        build: {
          language: "Node.js",
          framework: "Express",
          buildCommand: "",
          useDockerfile: false,
        },
      })),
    ],
  }
})

import { fireEvent, render, act } from "@testing-library/react"
import { StepSourceV2 } from "@/modules/deploy/ui/step-source-v2"
import type { StepSourceProps } from "@/modules/deploy/ui/step-source-v2"
import type { ResourcePlanId } from "@/modules/deploy/deploy.types"

const createProps = () => {
  return {
    sourceType: "github" as StepSourceProps["sourceType"],
    templateId: undefined as StepSourceProps["templateId"],
    githubConnectionStatus:
      "connected" as StepSourceProps["githubConnectionStatus"],
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
        installationId: 12345,
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
    appName: "" as string,
    templateResourcePlanId: "payg" as ResourcePlanId,
    onSourceTypeChange: mock(() => {}),
    onTemplateSelect: mock(() => {}),
    onOwnerSearchChange: mock(() => {}),
    onRepositorySearchChange: mock(() => {}),
    onAppNameChange: mock(() => {}),
    onTemplateResourcePlanChange: mock(() => {}),
    onOwnerSelect: mock(() => {}),
    onRepositorySelect: mock(() => {}),
    onBranchSelect: mock(() => {}),
    onRootDirectoryChange: mock(() => {}),
    onConnectGithub: mock(() => {}),
    onCancel: mock(() => {}),
    onNext: mock(() => {}),
    canProceed: false,
    isDetecting: false,
    detectionError: null,
  }
}

describe("StepSourceV2 outcome-led source", () => {
  // source button names include their descriptions for accessible context
  it("starts with template path expanded and exposes pressed source buttons", () => {
    const view = render(
      <StepSourceV2 {...createProps()} sourceType="template" />
    )

    expect(
      view.getByRole("heading", { name: "What would you like to publish?" })
    ).toBeTruthy()
    expect(
      view
        .getByRole("button", { name: /^Start with a ready-made site/ })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(view.getByText("Easiest way to start")).toBeTruthy()
    expect(
      view
        .getByRole("button", { name: /^Use a GitHub project/ })
        .getAttribute("aria-pressed")
    ).toBe("false")
    expect(
      view
        .getByRole("button", { name: /^Use a public Git link/ })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("reveals GitHub controls only for selected GitHub source", () => {
    const props = {
      ...createProps(),
      sourceType: "github" as const,
      selectedOwnerId: "owner-pfn",
      selectedRepositoryId: "repo-console-next",
      selectedBranchName: "main",
    }
    const view = render(<StepSourceV2 {...props} />)

    expect(view.getByText("GitHub account")).toBeTruthy()
    expect(view.getByText("Project")).toBeTruthy()
    expect(view.getByText("Version to publish")).toBeTruthy()
    expect(view.getByText("Project folder")).toBeTruthy()
    expect(view.getByText("Site name")).toBeTruthy()
    expect(
      view
        .getByRole("button", { name: /^Use a GitHub project/ })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })

  it("shows public safety copy only after selecting public source", () => {
    const templateView = render(
      <StepSourceV2 {...createProps()} sourceType="template" />
    )
    expect(
      templateView.queryByText(
        "Only publish code you trust. Public repositories can contain code you did not write."
      )
    ).toBeNull()

    templateView.rerender(
      <StepSourceV2 {...createProps()} sourceType="public" />
    )
    expect(
      templateView.getByText(
        "Only publish code you trust. Public repositories can contain code you did not write."
      )
    ).toBeTruthy()
    expect(templateView.getByText("Public Git link")).toBeTruthy()
    expect(templateView.getByText("Version to publish (optional)")).toBeTruthy()
    expect(templateView.getByText("Project folder")).toBeTruthy()
  })

  it("changes continuation helper when source becomes ready", () => {
    const props = createProps()
    const view = render(<StepSourceV2 {...props} sourceType="template" />)
    expect(view.getByRole("button", { name: "Continue" })).toBeTruthy()
    expect(
      view.getByText(
        "Choose a template, project, or public Git link to continue."
      )
    ).toBeTruthy()

    view.rerender(<StepSourceV2 {...props} sourceType="template" canProceed />)
    expect(view.getByRole("button", { name: "Continue to setup" })).toBeTruthy()
    expect(
      view.queryByText(
        "Choose a template, project, or public Git link to continue."
      )
    ).toBeNull()
  })
})

describe("StepSourceV2 catalog", () => {
  it("shows search, category, view, and pagination controls", () => {
    const props = { ...createProps(), sourceType: "template" as const }
    const view = render(<StepSourceV2 {...props} />)

    expect(view.getByLabelText("Search templates")).toBeTruthy()
    expect(view.getByRole("button", { name: "CMS" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Grid view" })).toBeTruthy()
    expect(view.getByRole("button", { name: "List view" })).toBeTruthy()
    expect(view.getByText(/Page 1 of/)).toBeTruthy()
  })

  it("filters and selects a template through the canonical callbacks", () => {
    const props = {
      ...createProps(),
      sourceType: "template" as const,
    }
    const onTemplateSelect = mock(() => {})
    props.onTemplateSelect = onTemplateSelect
    const view = render(<StepSourceV2 {...props} />)
    fireEvent.change(view.getByLabelText("Search templates"), {
      target: { value: "WordPress" },
    })
    fireEvent.click(
      view.getByRole("button", {
        name: /WordPress The world's most popular website builder/,
      })
    )

    expect(onTemplateSelect).toHaveBeenCalledWith("wordpress")
  })
  it("shows empty state when template filters match nothing", () => {
    const props = {
      ...createProps(),
      sourceType: "template" as const,
    }
    const view = render(<StepSourceV2 {...props} />)
    const searchInput = view.getByLabelText("Search templates")
    const reactPropsKey = Object.keys(searchInput).find((key) =>
      key.startsWith("__reactProps")
    )

    act(() => {
      if (reactPropsKey) {
        const inputWithProps = searchInput as unknown as Record<
          string,
          { onChange: (event: { target: { value: string } }) => void }
        >
        inputWithProps[reactPropsKey].onChange({
          target: { value: "does-not-exist" },
        })
      } else {
        fireEvent.change(searchInput, {
          target: { value: "does-not-exist" },
        })
      }
    })

    expect(
      view.getByText("No templates match your search or category.")
    ).toBeTruthy()
  })
})
