import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import { TrafficSummaryCards } from "./traffic-summary-cards"
import { TrafficHourlyChart } from "./traffic-hourly-chart"
import { TrafficTopPagesCard } from "./traffic-top-pages-card"
import { TrafficGeoCard } from "./traffic-geo-card"

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

  describe("TrafficGeoCard", () => {
    it("renders top countries and top IP visitors with location badges", () => {
      const view = render(
        <TrafficGeoCard
          topCountries={[
            {
              countryCode: "SG",
              countryName: "Singapura",
              requests: 1500,
              percentage: 75,
            },
            {
              countryCode: "ID",
              countryName: "Indonesia",
              requests: 500,
              percentage: 25,
            },
          ]}
          topIps={[
            {
              ip: "149.22.90.218",
              requestsCount: 1200,
              countryCode: "SG",
              countryName: "Singapura",
              city: "Singapore",
              status2xx: 1080,
              status3xx: 0,
              status4xx: 120,
              status5xx: 0,
              successRatio: 90,
            },
            {
              ip: "103.10.10.1",
              requestsCount: 500,
              countryCode: "ID",
              countryName: "Indonesia",
              city: "Jakarta",
              status2xx: 500,
              status3xx: 0,
              status4xx: 0,
              status5xx: 0,
              successRatio: 100,
            },
          ]}
        />
      )

      expect(view.getByText("Asal Negara Pengunjung (GeoIP)")).toBeTruthy()
      expect(view.getByText("Singapura")).toBeTruthy()
      expect(view.getByText("75%")).toBeTruthy()
      expect(view.getByText("Indonesia")).toBeTruthy()
      expect(view.getByText("25%")).toBeTruthy()

      expect(view.getByText("Top 10 Alamat IP Pengunjung")).toBeTruthy()
      expect(view.getByText("149.22.90.218")).toBeTruthy()
      expect(view.getByText("Singapore, Singapura")).toBeTruthy()
      expect(view.getByText("103.10.10.1")).toBeTruthy()
      expect(view.getByText("Jakarta, Indonesia")).toBeTruthy()
      expect(view.getByText("90% sukses")).toBeTruthy()
      expect(view.getByText("100% sukses")).toBeTruthy()
      // Non-2xx counts must be readable as persistent text, not only a
      // hover-only bar segment.
      expect(view.getByText("120 4xx")).toBeTruthy()

      // Asserts that SVG flags for SG and ID are rendered (country-flag-icons renders svg elements)
      const svgs = view.container.querySelectorAll("svg")
      expect(svgs.length).toBeGreaterThanOrEqual(4)
    })

    it("renders fallback icon when country code is unknown or local", () => {
      const view = render(
        <TrafficGeoCard
          topCountries={[
            {
              countryCode: "LOCAL",
              countryName: "Local Network",
              requests: 10,
              percentage: 100,
            },
          ]}
          topIps={[
            {
              ip: "127.0.0.1",
              requestsCount: 10,
              countryCode: "LOCAL",
              countryName: "Local Network",
              city: "Localhost",
              status2xx: 10,
              status3xx: 0,
              status4xx: 0,
              status5xx: 0,
              successRatio: 100,
            },
          ]}
        />
      )

      expect(view.getByText("Local Network")).toBeTruthy()
      expect(view.getByText("127.0.0.1")).toBeTruthy()
      expect(
        view.container.querySelectorAll("svg").length
      ).toBeGreaterThanOrEqual(2)
    })

    it("renders empty state messages when country and IP arrays are empty", () => {
      const view = render(<TrafficGeoCard topCountries={[]} topIps={[]} />)

      expect(view.getByText("Belum ada data geolokasi pengunjung")).toBeTruthy()
      expect(
        view.getByText("Belum ada data client IP yang tercatat")
      ).toBeTruthy()
    })
  })
})
