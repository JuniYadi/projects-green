import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = mock(() => {})

let capturedBody: Record<string, unknown> | null = null
const mockCreateTemplate = mock((body: unknown) => {
  capturedBody = body as Record<string, unknown>
  return Promise.resolve({ data: { id: "tpl-123", ok: true } })
})
const mockSubmitReview = mock(() => Promise.resolve({ data: { ok: true } }))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      templates: Object.assign(
        {
          post: mockCreateTemplate,
        },
        {
          "tpl-123": { "submit-review": { post: mockSubmitReview } },
        }
      ),
    },
  },
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
}))

import TemplateBuilderPage from "./page"

describe("TemplateBuilderPage", () => {
  beforeEach(() => {
    cleanup()
    mockPush.mockClear()
    capturedBody = null
  })

  afterEach(() => {
    cleanup()
  })
  it("renders Step 1: General Info by default", () => {
    render(<TemplateBuilderPage />)
    expect(screen.getByText("Custom Template Builder")).toBeDefined()
    expect(screen.getByText("Step 1: General Info")).toBeDefined()
    expect(
      screen.getByPlaceholderText("e.g. Next.js High Performance Stack")
    ).toBeDefined()
  })

  it("navigates through the 4 steps after filling required fields", async () => {
    render(<TemplateBuilderPage />)
    const user = userEvent.setup({ delay: null })

    // Step 1 - Fill name, tagline, description
    const nameInput = screen.getByPlaceholderText(
      "e.g. Next.js High Performance Stack"
    )
    const taglineInput = screen.getByPlaceholderText(
      "e.g. Production-ready Next.js 15 app with Redis caching and PostgreSQL"
    )
    const descInput = screen.getByPlaceholderText(
      /Explain what this stack does/i
    )

    await user.type(nameInput, "My Awesome Stack")
    await user.type(taglineInput, "High-performance fullstack app")
    await user.type(descInput, "A complete architecture stack description.")

    // Click Next -> Step 2
    const nextButton = screen.getByRole("button", { name: /Next/i })
    await user.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText("Step 2: Container Runtime")).toBeInTheDocument()
    })

    // Step 2 - Fill image
    const imageInput = screen.getByPlaceholderText(
      /e\.g\. ghcr\.io\/org\/my-app/i
    )
    await user.type(imageInput, "ghcr.io/org/my-app:v1.0.0")

    // Click Next -> Step 3
    await user.click(screen.getByRole("button", { name: /Next/i }))

    await waitFor(() => {
      expect(
        screen.getByText("Step 3: Dependencies & Storage")
      ).toBeInTheDocument()
    })

    // Step 3 - Click Next -> Step 4
    await user.click(screen.getByRole("button", { name: /Next/i }))

    await waitFor(() => {
      expect(
        screen.getByText("Step 4: Environment Schema Builder")
      ).toBeInTheDocument()
    })
  })

  it("allows adding environment variables in Step 4", async () => {
    render(<TemplateBuilderPage />)
    const user = userEvent.setup({ delay: null })

    // Advance through steps quickly
    await user.type(
      screen.getByPlaceholderText("e.g. Next.js High Performance Stack"),
      "Stack with Env"
    )
    await user.type(
      screen.getByPlaceholderText(
        "e.g. Production-ready Next.js 15 app with Redis caching and PostgreSQL"
      ),
      "Tagline"
    )
    await user.type(
      screen.getByPlaceholderText(/Explain what this stack does/i),
      "Description"
    )
    await user.click(screen.getByRole("button", { name: /Next/i }))

    // Step 2
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i)
      ).toBeInTheDocument()
    )
    await user.type(
      screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i),
      "node:20-alpine"
    )

    await user.click(screen.getByRole("button", { name: /Next/i }))

    // Step 3
    await waitFor(() =>
      expect(
        screen.getByText("Step 3: Dependencies & Storage")
      ).toBeInTheDocument()
    )
    await user.click(screen.getByRole("button", { name: /Next/i }))

    // Step 4
    await waitFor(() =>
      expect(
        screen.getByText("Step 4: Environment Schema Builder")
      ).toBeInTheDocument()
    )

    // Add variable
    const addVarBtn = screen.getByRole("button", { name: /Add Variable/i })
    await user.click(addVarBtn)
    expect(
      screen.getByPlaceholderText("e.g. API_KEY or PORT")
    ).toBeInTheDocument()
  })

  it("submits the template successfully as workspace template", async () => {
    render(<TemplateBuilderPage />)
    const user = userEvent.setup({ delay: null })

    await user.type(
      screen.getByPlaceholderText("e.g. Next.js High Performance Stack"),
      "Production NextJS"
    )
    await user.type(
      screen.getByPlaceholderText(
        "e.g. Production-ready Next.js 15 app with Redis caching and PostgreSQL"
      ),
      "Next.js 15 with Postgres"
    )
    await user.type(
      screen.getByPlaceholderText(/Explain what this stack does/i),
      "Complete app template"
    )

    // Go to Step 2
    await user.click(screen.getByRole("button", { name: /Next/i }))
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i)
      ).toBeInTheDocument()
    )
    await user.type(
      screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i),
      "nextjs:latest"
    )

    // Save as Workspace Template button from top bar
    const saveBtn = screen.getByRole("button", {
      name: /Save as Workspace Template/i,
    })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
      expect(capturedBody?.name).toBe("Production NextJS")
      const blueprint = capturedBody?.blueprintJson as {
        runtime: { image: string }
      }
      expect(blueprint?.runtime?.image).toBe("nextjs:latest")
      expect(mockPush).toHaveBeenCalledWith(
        "/en/console/app/marketplace/my-templates"
      )
    })
  })
})
