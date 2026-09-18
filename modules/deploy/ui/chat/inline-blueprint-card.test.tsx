import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import {
  InlineBlueprintCard,
  type InlineBlueprintData,
} from "./inline-blueprint-card"

const sampleBlueprint: InlineBlueprintData = {
  framework: "Laravel 11.x",
  runtime: "PHP 8.2",
  port: 8000,
  computeTier: "Medium (2GB RAM)",
  subdomain: "backend-api",
  startCommand: "php artisan serve",
  envVarsCount: 12,
  hourlyRate: 0.04,
}

describe("InlineBlueprintCard", () => {
  afterEach(cleanup)
  it("renders header proposal badge and tweak hint chip", () => {
    const onReadyToLaunch = mock(() => {})
    const view = render(
      <InlineBlueprintCard
        blueprint={sampleBlueprint}
        onReadyToLaunch={onReadyToLaunch}
        lang="en"
      />
    )

    expect(view.getByText("INLINE BLUEPRINT PROPOSAL")).toBeTruthy()
    expect(view.getByText("Tweak via chat")).toBeTruthy()
  })

  it("renders 2-column specification grid with detected parameters", () => {
    const onReadyToLaunch = mock(() => {})
    const view = render(
      <InlineBlueprintCard
        blueprint={sampleBlueprint}
        onReadyToLaunch={onReadyToLaunch}
        lang="en"
      />
    )

    expect(view.getByText("Laravel 11.x · PHP 8.2")).toBeTruthy()
    expect(view.getByText("8000 (HTTP)")).toBeTruthy()
    expect(view.getByText("Medium (2GB RAM) · $0.04/jam")).toBeTruthy()
    expect(view.getByText("backend-api.sg.pfnapp.dev")).toBeTruthy()
    expect(view.getByText("12 keys from .env.example ready")).toBeTruthy()
    expect(
      view.getByText("Can be configured later in App Settings")
    ).toBeTruthy()
  })

  it("triggers onReadyToLaunch callback when Primary Green CTA is clicked", () => {
    const onReadyToLaunch = mock(() => {})
    const view = render(
      <InlineBlueprintCard
        blueprint={sampleBlueprint}
        onReadyToLaunch={onReadyToLaunch}
        lang="en"
      />
    )

    const cta = view.getByRole("button", {
      name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
    })
    fireEvent.click(cta)

    expect(onReadyToLaunch).toHaveBeenCalledTimes(1)
  })

  it("triggers onTweakClick callback when secondary helper chip is clicked", () => {
    const onTweakClick = mock((_field: string) => {})
    const view = render(
      <InlineBlueprintCard
        blueprint={sampleBlueprint}
        onReadyToLaunch={() => {}}
        onTweakClick={onTweakClick}
        lang="en"
      />
    )

    const tweakBtn = view.getByText("💬 Ganti Port / Tier via Prompt")
    fireEvent.click(tweakBtn)

    expect(onTweakClick).toHaveBeenCalledWith("port")
  })

  it("displays mutating indicator when isMutating is true", () => {
    const view = render(
      <InlineBlueprintCard
        blueprint={sampleBlueprint}
        isMutating={true}
        onReadyToLaunch={() => {}}
        lang="en"
      />
    )

    expect(view.getByText("Updating...")).toBeTruthy()
  })

  it("renders Indonesian copy when lang is id", () => {
    const view = render(
      <InlineBlueprintCard
        blueprint={sampleBlueprint}
        onReadyToLaunch={() => {}}
        lang="id"
      />
    )

    expect(view.getByText("Tweak lewat chat")).toBeTruthy()
    expect(view.getByText("Dapat disetel nanti di App Settings")).toBeTruthy()
  })
})
