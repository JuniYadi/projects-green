import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"

const mockContacts = [
  {
    id: "cnt_1",
    phoneNumber: "+6281234567890",
    name: "Budi Santoso",
    email: "budi@example.com",
    contactGroupId: "grp_vip",
    status: "ACTIVE" as const,
    isWhatsapp: true,
    lastMessage: "Halo, ada yang bisa dibantu?",
    lastMessageAt: "2026-09-10T10:00:00.000Z",
    organizationId: "org_test",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-10T10:00:00.000Z",
  },
  {
    id: "cnt_2",
    phoneNumber: "+6289876543210",
    name: "Siti Rahma",
    email: "siti@example.com",
    contactGroupId: null,
    status: "INACTIVE" as const,
    isWhatsapp: false,
    lastMessage: null,
    lastMessageAt: null,
    organizationId: "org_test",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
]

const mockGroups = [
  {
    id: "grp_vip",
    name: "VIP Customers",
    description: "Pelanggan prioritas",
    organizationId: "org_test",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
]

const mockListContacts = mock(() => Promise.resolve(mockContacts))
const mockListGroups = mock(() => Promise.resolve(mockGroups))

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
  useRouter: () => ({ push: mock(() => {}) }),
}))

mock.module("@/modules/whatsapp/whatsapp-client", () => ({
  whatsappClient: {
    listContacts: mockListContacts,
    listGroups: mockListGroups,
    createContact: mock(() => Promise.resolve({ id: "cnt_new" })),
    updateContact: mock(() => Promise.resolve({ id: "cnt_1" })),
    deleteContact: mock(() => Promise.resolve(true)),
  },
}))

mock.module("@/modules/whatsapp/onboarding/use-whatsapp-onboarding", () => ({
  useWhatsAppOnboarding: () => ({
    completedSteps: 1,
    totalSteps: 5,
    isDismissed: true,
  }),
}))

mock.module("@/modules/whatsapp/onboarding/flight-hud-widget", () => ({
  FlightHudWidget: () => null,
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          "agent-p": {
            execute: {
              post: mock(() =>
                Promise.resolve({
                  data: {
                    success: true,
                    data: { normalized: "+6281234567890", isValid: true },
                  },
                })
              ),
            },
          },
        },
      },
    },
  },
}))

import WhatsAppContactsPage from "./page-client"

describe("WhatsAppContactsPage Redesign", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    mockListContacts.mockClear()
    mockListGroups.mockClear()
    mockListContacts.mockImplementation(() => Promise.resolve(mockContacts))
    mockListGroups.mockImplementation(() => Promise.resolve(mockGroups))
  })

  it("renders unified header with outline Import and primary Add Contact buttons", async () => {
    const { getByRole, getByText } = render(<WhatsAppContactsPage />)

    await waitFor(() => {
      expect(getByText("Kontak")).toBeDefined()
      expect(
        getByText("Kelola kontak WhatsApp dan grup kontak Anda.")
      ).toBeDefined()
    })

    const addButton = getByRole("button", { name: /Tambah Kontak/i })
    expect(addButton).toBeDefined()
  })

  it("renders compact quick filter KPI ribbon with correct counts", async () => {
    const { getByText } = render(<WhatsAppContactsPage />)

    await waitFor(() => {
      const totalBtn = getByText("Total Kontak").closest("button")
      expect(totalBtn?.textContent).toContain("2")

      const activeBtn = getByText("Aktif").closest("button")
      expect(activeBtn?.textContent).toContain("1")

      const waBtn = getByText("Memiliki WhatsApp").closest("button")
      expect(waBtn?.textContent).toContain("1")

      const inactiveBtn = getByText("Tidak Aktif").closest("button")
      expect(inactiveBtn?.textContent).toContain("1")
    })
  })

  it("renders contacts in DataTable with columns and badges", async () => {
    const { getByText } = render(<WhatsAppContactsPage />)

    await waitFor(() => {
      expect(getByText("Budi Santoso")).toBeDefined()
      expect(getByText("+6281234567890")).toBeDefined()
      expect(getByText("budi@example.com")).toBeDefined()
      expect(getByText("VIP Customers")).toBeDefined()
      expect(getByText("Siti Rahma")).toBeDefined()
    })
  })

  it("filters contacts when clicking the quick filter cards", async () => {
    const { getByText, queryByText } = render(<WhatsAppContactsPage />)

    await waitFor(() => {
      expect(getByText("Budi Santoso")).toBeDefined()
      expect(getByText("Siti Rahma")).toBeDefined()
    })

    // Click "Aktif" filter card
    const activeFilterBtn = getByText("Aktif").closest("button")
    expect(activeFilterBtn).toBeDefined()
    if (activeFilterBtn) {
      fireEvent.click(activeFilterBtn)
    }

    await waitFor(() => {
      expect(getByText("Budi Santoso")).toBeDefined()
      expect(queryByText("Siti Rahma")).toBeNull()
    })

    // Click "Total Kontak" filter card to reset
    const totalFilterBtn = getByText("Total Kontak").closest("button")
    if (totalFilterBtn) {
      fireEvent.click(totalFilterBtn)
    }

    await waitFor(() => {
      expect(getByText("Budi Santoso")).toBeDefined()
      expect(getByText("Siti Rahma")).toBeDefined()
    })
  })

  it("renders empty state when there are no contacts", async () => {
    mockListContacts.mockImplementation(() => Promise.resolve([]))

    const { getByText } = render(<WhatsAppContactsPage />)

    await waitFor(() => {
      expect(getByText("Belum ada kontak")).toBeDefined()
      expect(getByText("Tambah kontak pertama")).toBeDefined()
    })
  })
})
