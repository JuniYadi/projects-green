import "@/test/register"
import { afterEach, expect, mock, test } from "bun:test"
import { render } from "@testing-library/react"

let currentLocale = "en"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: currentLocale }),
}))

import { DeviceHealthBadge } from "./device-health-badge"

afterEach(() => {
  currentLocale = "en"
})

test("renders the English connected health status", () => {
  const view = render(<DeviceHealthBadge status="CONNECTED" />)

  expect(view.getByText("Connected")).toBeInTheDocument()
  expect(view.queryByText(/Last seen:/)).not.toBeInTheDocument()
})

test("renders the Indonesian disconnected status and localized heartbeat age", () => {
  currentLocale = "id"
  const lastHeartbeatAt = new Date(Date.now() - 305_000).toISOString()

  const view = render(
    <DeviceHealthBadge
      status="DISCONNECTED"
      lastHeartbeatAt={lastHeartbeatAt}
    />
  )

  expect(view.getByText("Terputus")).toBeInTheDocument()
  expect(view.getByText("Terakhir terlihat: 5 menit lalu")).toBeInTheDocument()
})
