import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import AiAgentsPage from "./page"

describe("AiAgentsPage", () => {
  it("renders Master Agent Profiles and Create button", () => {
    const view = render(<AiAgentsPage />)
    expect(view.getByText("Master Agent Profiles")).toBeTruthy()
    expect(view.getByText("Buat Agent Profile Baru")).toBeTruthy()
    expect(view.getByText("Asisten CS & Penjualan Toko")).toBeTruthy()
  })
})
