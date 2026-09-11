import { describe, it, expect } from "bun:test"
import { render, cleanup } from "@testing-library/react"
import { LogHealthSummaryCards } from "./log-health-summary-cards"
import { LogHourlyChart } from "./log-hourly-chart"
import { LogTopErrorsCard } from "./log-top-errors-card"

describe("Frontend Log Health Components", () => {
  describe("LogHealthSummaryCards", () => {
    it("renders health score, errors, warnings and total logs correctly", () => {
      const view = render(
        <LogHealthSummaryCards
          healthScore={99.8}
          totalLogs={115860}
          errorCount={14}
          warnCount={38}
          periodLabel="11 Sep 2026"
        />
      )

      expect(view.getByText("Skor Kestabilan Aplikasi")).toBeTruthy()
      expect(view.getByText("99.8%")).toBeTruthy()
      expect(view.getByText("Stabil")).toBeTruthy()
      expect(view.getByText("Total Insiden Error")).toBeTruthy()
      expect(view.getByText("14")).toBeTruthy()
      expect(view.getByText("Peringatan (Warn)")).toBeTruthy()
      expect(view.getByText("38")).toBeTruthy()
      expect(view.getByText("Total Baris Log")).toBeTruthy()
      expect(view.getByText("115.860")).toBeTruthy()
      cleanup()
    })
  })

  describe("LogHourlyChart", () => {
    it("renders hourly error, warn, info trend chart", () => {
      const view = render(
        <LogHourlyChart
          trend={[
            { label: "00:00", info: 100, warn: 2, error: 1 },
            { label: "01:00", info: 120, warn: 0, error: 0 },
          ]}
          granularity="daily"
          periodLabel="11 Sep 2026"
        />
      )

      expect(view.getByText("Grafik Tren Insiden Log")).toBeTruthy()
      expect(
        view.getByText("Distribusi per jam (00:00 - 23:00 UTC) — 11 Sep 2026")
      ).toBeTruthy()
      cleanup()
    })
  })

  describe("LogTopErrorsCard", () => {
    it("renders detected error signatures and drilldown button", () => {
      const view = render(
        <LogTopErrorsCard
          appSlug="9router-daring-pulsar"
          topErrors={[
            {
              signature:
                "[MODULE_TYPELESS_PACKAGE_JSON] Module type is not specified",
              count: 12,
              sampleMessage:
                "Warning: Module type of file:///app/src/sse/services/backgroundTokenRefresh.js",
            },
          ]}
        />
      )

      expect(
        view.getByText("Daftar Masalah & Exception Terdeteksi")
      ).toBeTruthy()
      expect(
        view.getByText(
          "[MODULE_TYPELESS_PACKAGE_JSON] Module type is not specified"
        )
      ).toBeTruthy()
      expect(view.getByText("12x insiden")).toBeTruthy()
      expect(view.getByText("Lihat Semua Masalah")).toBeTruthy()
      cleanup()
    })

    it("renders clean state when no errors are detected", () => {
      const view = render(
        <LogTopErrorsCard appSlug="9router-daring-pulsar" topErrors={[]} />
      )

      expect(view.getByText("Aplikasi Berjalan Sempurna!")).toBeTruthy()
      cleanup()
    })
  })
})
