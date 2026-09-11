import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import { TrafficSummaryCards } from "./traffic-summary-cards"
import { TrafficHourlyChart } from "./traffic-hourly-chart"
import { TrafficTopPagesCard } from "./traffic-top-pages-card"

describe("Frontend Traffic Components", () => {
  afterEach(() => {
    cleanup()
  })

  describe("TrafficSummaryCards", () => {
    it("renders total requests, success rate, latency and bandwidth correctly", () => {
      const view = render(
        <TrafficSummaryCards
          totalRequests={12450}
          successRate={99.2}
          avgLatencyMs={140}
          totalBytesFormatted="450.0 MB"
          periodLabel="10 Sep 2026"
        />
      )

      expect(view.getByText("Total Kunjungan")).toBeTruthy()
      expect(view.getByText("12.450")).toBeTruthy()
      expect(view.getByText("Tingkat Keberhasilan")).toBeTruthy()
      expect(view.getByText("99.2%")).toBeTruthy()
      expect(view.getByText("Lancar")).toBeTruthy()
      expect(view.getByText("Kecepatan Respon")).toBeTruthy()
      expect(view.getByText("0.14s")).toBeTruthy()
      expect(view.getByText("Transfer Data")).toBeTruthy()
      expect(view.getByText("450.0 MB")).toBeTruthy()
    })
  })

  describe("TrafficHourlyChart", () => {
    it("renders hourly trend chart with bar representation and tooltips", () => {
      const view = render(
        <TrafficHourlyChart
          trend={[
            { label: "00:00", requests: 50, errors: 1 },
            { label: "01:00", requests: 120, errors: 0 },
          ]}
          granularity="daily"
          periodLabel="10 Sep 2026"
        />
      )

      expect(view.getByText("Grafik Tren Kunjungan")).toBeTruthy()
      expect(
        view.getByText("Distribusi per jam (00:00 - 23:00 UTC) — 10 Sep 2026")
      ).toBeTruthy()
    })
  })

  describe("TrafficTopPagesCard", () => {
    it("renders top visited pages and broken links alert", () => {
      const view = render(
        <TrafficTopPagesCard
          topPages={[
            { path: "/catalog", views: 4200 },
            { path: "/checkout", views: 890 },
          ]}
          troubledPages={[
            { path: "/diskon-spesial", errors: 14, sampleStatus: 404 },
          ]}
        />
      )

      expect(view.getByText("Halaman Paling Sering Dikunjungi")).toBeTruthy()
      expect(view.getByText("/catalog")).toBeTruthy()
      expect(view.getByText("4.200 views")).toBeTruthy()
      expect(view.getByText("Tautan Rusak & Error Terdeteksi")).toBeTruthy()
      expect(view.getByText("/diskon-spesial")).toBeTruthy()
      expect(view.getByText("14 kali gagal")).toBeTruthy()
      expect(view.getByText("404")).toBeTruthy()
    })

    it("renders clean state when no troubled pages exist", () => {
      const view = render(
        <TrafficTopPagesCard
          topPages={[{ path: "/catalog", views: 100 }]}
          troubledPages={[]}
        />
      )

      expect(view.getByText("Semua Tautan Bersih!")).toBeTruthy()
    })
  })
})
