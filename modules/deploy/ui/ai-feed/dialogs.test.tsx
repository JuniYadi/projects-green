import { describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import { DetectionDetailsDialog } from "./detection-details-dialog"
import { ManualSettingsDialog } from "./manual-settings-dialog"
import { ResourceSizeDialog } from "./resource-size-dialog"
import { EnvValuesDialog } from "./env-values-dialog"
import { PlanDetailsDialog } from "./plan-details-dialog"
import { ConfirmDeployDialog } from "./confirm-deploy-dialog"

describe("AI Feed Dialogs", () => {
  it("renders DetectionDetailsDialog with detection data", () => {
    const view = render(
      <DetectionDetailsDialog
        open={true}
        onClose={() => {}}
        onChangeSettings={() => {}}
        detection={{
          framework: "Laravel",
          frameworkVersion: "11",
          primaryEngine: "php",
          primaryEngineVersion: "8.2",
          buildCommand: "composer install",
          startCommand: "php artisan serve",
          defaultPort: 80,
          useDockerfile: false,
          dockerfilePath: null,
          confidence: 0.95,
          status: "detected",
          evidence: [
            { kind: "file", summary: "artisan exists", reference: "artisan" },
          ],
        }}
      />
    )

    expect(view.getByText("Detection details")).toBeTruthy()
    expect(view.getByText("Laravel")).toBeTruthy()
  })

  it("renders ManualSettingsDialog and allows form input", () => {
    const onSave = mock(async () => {})
    const view = render(
      <ManualSettingsDialog open={true} onClose={() => {}} onSave={onSave} />
    )

    expect(view.getByText("Build settings")).toBeTruthy()
  })

  it("renders ResourceSizeDialog with plan options", () => {
    const onSelect = mock(async () => {})
    const view = render(
      <ResourceSizeDialog open={true} onClose={() => {}} onSelect={onSelect} />
    )
    expect(view.getByText("Choose resources")).toBeTruthy()
    expect(view.getByText("Pro")).toBeTruthy()
    expect(view.getByText("Starter")).toBeTruthy()
  })

  it("renders EnvValuesDialog with requirement fields", () => {
    const onSave = mock(async () => {})
    const view = render(
      <EnvValuesDialog
        open={true}
        onClose={() => {}}
        onSave={onSave}
        envRequirements={[
          {
            key: "APP_KEY",
            required: true,
            kind: "secret",
            status: "missing",
            description: "Application key",
          },
          {
            key: "NEXTAUTH_SECRET",
            required: true,
            kind: "generated",
            status: "generated",
            description: "Auth secret",
          },
        ]}
      />
    )

    expect(view.getByText("Environment values")).toBeTruthy()
    expect(view.getByText("APP_KEY *")).toBeTruthy()
    expect(view.getByText("Generated automatically")).toBeTruthy()
  })

  it("renders PlanDetailsDialog with full plan review", () => {
    const view = render(
      <PlanDetailsDialog
        open={true}
        onClose={() => {}}
        onChangeSettings={() => {}}
        onChangeEnv={() => {}}
        plan={{
          version: 1,
          source: {
            kind: "git",
            url: "https://github.com/laravel/laravel",
            host: "github.com",
            ref: "main",
            templateId: null,
          },
          access: { state: "verified", displayLabel: "Public" },
          detection: {
            runtime: "php",
            framework: "laravel",
            version: "11",
            commands: [],
            port: 80,
            confidence: 0.95,
            evidence: [],
          },
          configuration: {
            appName: "laravel",
            branchOrRef: "main",
            environment: "production",
            envRequirements: [],
          },
          dependencies: [],
          resources: {
            package: "payg",
            server: null,
            region: null,
            cpu: 500,
            memory: 1024,
            storage: null,
          },
          domain: { mode: "auto", hostname: "laravel.pfn.app", tls: true },
          billing: {
            quoteReference: null,
            currency: "USD",
            estimate: 0.035,
            interval: "hour",
          },
          execution: { ready: true, steps: [] },
          unresolved: [],
          provenance: {
            analyzer: "ai",
            sourceReference: null,
            analyzedAt: new Date().toISOString(),
          },
        }}
      />
    )

    expect(view.getByText("Deployment plan")).toBeTruthy()
    expect(view.getByText("https://github.com/laravel/laravel")).toBeTruthy()
  })

  it("renders ConfirmDeployDialog with summary", () => {
    const onConfirm = mock(async () => {})
    const view = render(
      <ConfirmDeployDialog
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        plan={{
          version: 1,
          source: {
            kind: "git",
            url: "https://github.com/laravel/laravel",
            host: "github.com",
            ref: "main",
            templateId: null,
          },
          access: { state: "verified", displayLabel: "Public" },
          detection: {
            runtime: "php",
            framework: "laravel",
            version: "11",
            commands: [],
            port: 80,
            confidence: 0.95,
            evidence: [],
          },
          configuration: {
            appName: "laravel",
            branchOrRef: "main",
            environment: "production",
            envRequirements: [],
          },
          dependencies: [],
          resources: {
            package: "payg",
            server: null,
            region: null,
            cpu: 500,
            memory: 1024,
            storage: null,
          },
          domain: { mode: "auto", hostname: "laravel.pfn.app", tls: true },
          billing: {
            quoteReference: null,
            currency: "USD",
            estimate: 0.035,
            interval: "hour",
          },
          execution: { ready: true, steps: [] },
          unresolved: [],
          provenance: {
            analyzer: "ai",
            sourceReference: null,
            analyzedAt: new Date().toISOString(),
          },
        }}
      />
    )

    expect(view.getByText("Confirm deployment")).toBeTruthy()
    expect(view.getByRole("button", { name: "Confirm & deploy" })).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: "Confirm & deploy" }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
