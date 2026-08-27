import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react"
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
    const user = userEvent.setup()

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
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText("Step 2: Container Runtime")).toBeDefined()
    })

    // Step 2 - Fill image
    const imageInput = screen.getByPlaceholderText(
      /e\.g\. ghcr\.io\/org\/my-app/i
    )
    await user.type(imageInput, "ghcr.io/org/my-app:v1.0.0")

    // Click Next -> Step 3
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    await waitFor(() => {
      expect(screen.getByText("Step 3: Dependencies & Storage")).toBeDefined()
    })

    // Step 3 - Click Next -> Step 4
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    await waitFor(() => {
      expect(
        screen.getByText("Step 4: Environment Schema Builder")
      ).toBeDefined()
    })
  })

  it("allows adding environment variables in Step 4", async () => {
    render(<TemplateBuilderPage />)
    const user = userEvent.setup()
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
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    // Step 2
    await waitFor(() =>
      screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i)
    )
    await user.type(
      screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i),
      "node:20-alpine"
    )

    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    // Step 3
    await waitFor(() => screen.getByText("Step 3: Dependencies & Storage"))
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))

    // Step 4
    await waitFor(() => screen.getByText("Step 4: Environment Schema Builder"))

    // Add variable
    const addVarBtn = screen.getByRole("button", { name: /Add Variable/i })
    fireEvent.click(addVarBtn)

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/e\.g\. API_KEY or PORT/i)
      ).toBeDefined()
    })
  })

  it("submits the template successfully as workspace template", async () => {
    const user = userEvent.setup()
    render(<TemplateBuilderPage />)

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
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))
    await waitFor(() =>
      screen.getByPlaceholderText(/e\.g\. ghcr\.io\/org\/my-app/i)
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
        "/en/console/marketplace/my-templates"
      )
    })
  })
})
