import "@/test/register"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import type {
  WhatsAppTemplate,
  WhatsAppTemplateLanguage,
} from "@/lib/api/whatsapp-client"

const routerPush = mock()

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => "",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: mock(),
  notFound: mock(),
}))

const { TemplateDetailView } = await import("./template-detail")

const baseLanguage: WhatsAppTemplateLanguage = {
  id: "language-en",
  lang: "en",
  headerText: "Welcome",
  body: "Hello {{1}}, your order is ready.",
  footer: "Reply STOP to opt out",
  parameters: {
    components: [{ type: "BODY", example: { body_text: [["Alice"]] } }],
  },
  buttons: [{ type: "QUICK_REPLY", text: "Track order" }],
}

const baseTemplate: WhatsAppTemplate = {
  id: "template-1",
  slug: "order_ready",
  name: "Order Ready",
  organizationId: "org-1",
  metaStatus: "APPROVED",
  category: "UTILITY",
  languages: [baseLanguage],
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
}

const propsFor = (
  overrides: Partial<React.ComponentProps<typeof TemplateDetailView>> = {}
) => ({
  template: baseTemplate,
  loading: false,
  error: null,
  onRetry: mock(),
  ...overrides,
})

describe("TemplateDetailView", () => {
  beforeEach(() => {
    cleanup()
    routerPush.mockClear()
  })
  it("renders loading skeletons", () => {
    const { container } = render(
      <TemplateDetailView {...propsFor({ template: null, loading: true })} />
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(7)
  })

  it("renders an error and retries when requested", () => {
    const onRetry = mock()
    const view = render(
      <TemplateDetailView
        {...propsFor({
          template: null,
          error: "Unable to load template",
          onRetry,
        })}
      />
    )

    expect(view.getByRole("alert")).toHaveTextContent("Unable to load template")
    fireEvent.click(view.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("renders a not-found message when no template is available", () => {
    const view = render(
      <TemplateDetailView {...propsFor({ template: null })} />
    )

    expect(view.getByText("Template not found.")).toBeInTheDocument()
  })

  it("renders approved template spec, interactive tester, and WhatsApp preview", () => {
    const indonesian: WhatsAppTemplateLanguage = {
      ...baseLanguage,
      id: "language-id",
      lang: "id",
      body: "Halo {{1}}, pesananmu siap.",
      parameters: {
        components: [{ type: "BODY", example: { body_text: [["Budi"]] } }],
      },
    }
    const view = render(
      <TemplateDetailView
        {...propsFor({
          template: { ...baseTemplate, languages: [baseLanguage, indonesian] },
        })}
      />
    )

    expect(
      view.getByRole("heading", { name: "Order Ready" })
    ).toBeInTheDocument()
    expect(view.getByText("Approved")).toBeInTheDocument()
    expect(
      view.getByText("Hello Alice, your order is ready.")
    ).toBeInTheDocument()
    expect(view.getAllByText("Track order").length).toBeGreaterThanOrEqual(1)
    expect(view.getByText("en")).toBeInTheDocument()
    expect(
      view.getByRole("button", { name: /Get Code Snippet/i })
    ).toBeInTheDocument()
  })

  it("shows the current Meta category and available status reason", () => {
    const view = render(
      <TemplateDetailView
        {...propsFor({
          template: {
            ...baseTemplate,
            category: "MARKETING",
            languages: [
              {
                ...baseLanguage,
                metaReason: "Template no longer meets utility guidance",
              },
            ],
          },
        })}
      />
    )

    expect(view.getByText("Kategori Meta: MARKETING")).toBeInTheDocument()
    expect(view.getByText("Informasi dari Meta")).toBeInTheDocument()
    expect(
      view.getByText(
        "Alasan dari Meta: Template no longer meets utility guidance"
      )
    ).toBeInTheDocument()
    expect(view.getByText("Approved")).toBeInTheDocument()
    expect(view.queryByText("Rejected")).not.toBeInTheDocument()
  })

  it("omits the Meta notice when no reason is available", () => {
    const view = render(<TemplateDetailView {...propsFor()} />)

    expect(view.getByText("Kategori Meta: UTILITY")).toBeInTheDocument()
    expect(view.queryByText("Informasi dari Meta")).not.toBeInTheDocument()
    expect(view.queryByText(/Alasan dari Meta:/)).not.toBeInTheDocument()
  })

  it("removes outer divider rings while preserving the responsive columns", () => {
    const view = render(<TemplateDetailView {...propsFor()} />)
    const cards = view.container.querySelectorAll('[data-slot="card"]')
    const layout = view.container.querySelector(".lg\\:grid-cols-12")

    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveClass("ring-0")
    expect(cards[1]).toHaveClass("ring-0")
    expect(layout).toHaveClass("grid", "gap-6", "lg:grid-cols-12")
  })

  it.each([
    [
      "INCORRECT_CATEGORY",
      "Kategori Template Tidak Sesuai",
      "Ubah kategori menjadi AUTHENTICATION",
    ],
    [
      "TAG_CONTENT_MISMATCH",
      "Format Parameter {{1}} Tidak Valid",
      "Pastikan semua variabel {{1}}, {{2}}",
    ],
    [
      "PROMOTIONAL_CONTENT",
      "Terdeteksi Konten Promosi pada Kategori Utility",
      "Ganti kategori template menjadi MARKETING",
    ],
    [
      "OTHER_REASON",
      "Format Template Ditolak oleh Meta",
      "Buat duplikat template, perbaiki teks pesan",
    ],
  ])("renders guidance for %s rejection", (reason, title, fix) => {
    const language = { ...baseLanguage, rejectReason: reason }
    const view = render(
      <TemplateDetailView
        {...propsFor({
          template: {
            ...baseTemplate,
            metaStatus: "REJECTED",
            languages: [language],
          },
        })}
      />
    )

    expect(view.container.textContent).toContain(title)
    expect(view.container.textContent).toContain(fix)
    expect(view.container.textContent).toContain(reason)
  })

  it("navigates to localized test-message and duplicate actions", () => {
    const view = render(<TemplateDetailView {...propsFor()} />)

    fireEvent.click(view.getByRole("button", { name: "Send Test Message" }))
    expect(routerPush).toHaveBeenLastCalledWith(
      "/en/console/whatsapp/messages?template=template-1"
    )

    fireEvent.click(view.getByRole("button", { name: "Duplicate" }))
    expect(routerPush).toHaveBeenLastCalledWith(
      "/en/console/whatsapp/templates/new?duplicate=template-1"
    )
  })
})
