import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render } from "@testing-library/react"
import {
  APP_HOSTING_DEPENDENCIES,
  AppHostingPlanConfigComponent,
  AppHostingProvisionAdapter,
  DEFAULT_APP_HOSTING_BLUEPRINT,
  DEFAULT_APP_HOSTING_PLAN_CONFIG,
  parseAppHostingBlueprint,
  parseAppHostingPlanConfig,
  validateAppHostingPlanConfig,
  type AppHostingPlanConfig,
} from "./app-hosting-provision-adapter"

describe("AppHostingProvisionAdapter", () => {
  beforeEach(() => {
    cleanup()
  })

  it("exposes default config and blueprint with updated defaults", () => {
    expect(AppHostingProvisionAdapter.id).toBe("APP_HOSTING")
    expect(AppHostingProvisionAdapter.name).toBe("App Hosting")
    expect(DEFAULT_APP_HOSTING_PLAN_CONFIG).toEqual({
      clusterIds: [],
      cpu: 1000,
      memory: 1024,
      storage: 20,
      maxCustomDomains: 3,
      wildcard: false,
      requiredDependencies: [],
    })
    expect(DEFAULT_APP_HOSTING_BLUEPRINT).toEqual(
      DEFAULT_APP_HOSTING_PLAN_CONFIG
    )
    expect(AppHostingProvisionAdapter.defaultConfig).toEqual(
      DEFAULT_APP_HOSTING_PLAN_CONFIG
    )
    expect(APP_HOSTING_DEPENDENCIES).toEqual(["POSTGRESQL", "MYSQL", "REDIS"])
  })

  describe("parseAppHostingPlanConfig", () => {
    it("returns default config when input is undefined or null", () => {
      expect(parseAppHostingPlanConfig(undefined)).toEqual(
        DEFAULT_APP_HOSTING_PLAN_CONFIG
      )
      expect(parseAppHostingPlanConfig(null)).toEqual(
        DEFAULT_APP_HOSTING_PLAN_CONFIG
      )
      expect(parseAppHostingBlueprint(undefined)).toEqual(
        DEFAULT_APP_HOSTING_PLAN_CONFIG
      )
    })

    it("parses valid partial config applying default values", () => {
      const parsed = parseAppHostingPlanConfig({
        cpu: 2000,
        memory: 2048,
      })
      expect(parsed).toEqual({
        ...DEFAULT_APP_HOSTING_PLAN_CONFIG,
        cpu: 2000,
        memory: 2048,
      })
    })

    it("extracts configuration from nested provisioning key", () => {
      const parsed = parseAppHostingPlanConfig({
        features: { planName: "Production" },
        provisioning: {
          cpu: 4000,
          memory: 8192,
          storage: 100,
          maxCustomDomains: 10,
          wildcard: true,
          requiredDependencies: ["POSTGRESQL", "REDIS"],
        },
      })
      expect(parsed).toEqual({
        ...DEFAULT_APP_HOSTING_PLAN_CONFIG,
        cpu: 4000,
        memory: 8192,
        storage: 100,
        maxCustomDomains: 10,
        wildcard: true,
        requiredDependencies: ["POSTGRESQL", "REDIS"],
      })
    })
    it("falls back to default config on invalid input types", () => {
      expect(parseAppHostingPlanConfig("invalid")).toEqual(
        DEFAULT_APP_HOSTING_PLAN_CONFIG
      )
      expect(parseAppHostingPlanConfig({ cpu: -100 })).toEqual(
        DEFAULT_APP_HOSTING_PLAN_CONFIG
      )
      expect(
        parseAppHostingPlanConfig({
          requiredDependencies: ["INVALID_DB"],
        })
      ).toEqual(DEFAULT_APP_HOSTING_PLAN_CONFIG)
    })
  })

  describe("validateAppHostingPlanConfig", () => {
    it("validates compliant configs", () => {
      const result = validateAppHostingPlanConfig({
        cpu: 1000,
        memory: 1024,
        storage: 20,
        maxCustomDomains: 3,
        wildcard: true,
        requiredDependencies: ["POSTGRESQL", "MYSQL", "REDIS"],
      })
      expect(result.valid).toBe(true)
    })

    it("rejects invalid cpu, memory, storage, and maxCustomDomains", () => {
      const resultCpu = validateAppHostingPlanConfig({ cpu: 0 })
      expect(resultCpu.valid).toBe(false)
      expect(resultCpu.errors?.cpu).toBeDefined()

      const resultMemory = validateAppHostingPlanConfig({ memory: 64 })
      expect(resultMemory.valid).toBe(false)
      expect(resultMemory.errors?.memory).toBeDefined()

      const resultStorage = validateAppHostingPlanConfig({ storage: 0 })
      expect(resultStorage.valid).toBe(false)
      expect(resultStorage.errors?.storage).toBeDefined()

      const resultDomains = validateAppHostingPlanConfig({
        maxCustomDomains: -1,
      })
      expect(resultDomains.valid).toBe(false)
      expect(resultDomains.errors?.maxCustomDomains).toBeDefined()
    })

    it("rejects invalid requiredDependencies entries", () => {
      const result = validateAppHostingPlanConfig({
        requiredDependencies: ["UNKNOWN_DB"],
      })
      expect(result.valid).toBe(false)
      expect(result.errors?.requiredDependencies).toBeDefined()
    })

    it("validates nested provisioning payload", () => {
      const result = validateAppHostingPlanConfig({
        provisioning: {
          cpu: 2000,
          memory: 2048,
          storage: 40,
          maxCustomDomains: 5,
          wildcard: false,
          requiredDependencies: ["POSTGRESQL"],
        },
      })
      expect(result.valid).toBe(true)
    })
  })

  describe("AppHostingPlanConfigComponent", () => {
    it("renders all form fields with initial values", () => {
      const initial: AppHostingPlanConfig = {
        clusterIds: [],
        cpu: 2000,
        memory: 4096,
        storage: 50,
        maxCustomDomains: 5,
        wildcard: true,
        requiredDependencies: ["POSTGRESQL", "REDIS"],
      }
      const onChange = mock()

      const view = render(
        <AppHostingPlanConfigComponent value={initial} onChange={onChange} />
      )

      expect(view.getByLabelText("CPU (mCPU)")).toHaveValue(2000)
      expect(view.getByLabelText("Memory (MB)")).toHaveValue(4096)
      expect(view.getByLabelText("Storage (GB)")).toHaveValue(50)
      expect(view.getByLabelText("Max custom domains")).toHaveValue(5)

      const wildcardSwitch = view.getByRole("switch")
      expect(wildcardSwitch.getAttribute("aria-checked")).toBe("true")

      const postgresCheckbox = view.getByLabelText("PostgreSQL")
      const mysqlCheckbox = view.getByLabelText("MySQL")
      const redisCheckbox = view.getByLabelText("Redis")

      expect(postgresCheckbox.getAttribute("aria-checked")).toBe("true")
      expect(mysqlCheckbox.getAttribute("aria-checked")).toBe("false")
      expect(redisCheckbox.getAttribute("aria-checked")).toBe("true")
    })

    it("triggers onChange when number fields are modified", () => {
      const initial = { ...DEFAULT_APP_HOSTING_PLAN_CONFIG }
      const onChange = mock()

      const view = render(
        <AppHostingPlanConfigComponent value={initial} onChange={onChange} />
      )

      fireEvent.change(view.getByLabelText("CPU (mCPU)"), {
        target: { value: "2500" },
      })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ cpu: 2500 })
      )

      fireEvent.change(view.getByLabelText("Memory (MB)"), {
        target: { value: "2048" },
      })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ memory: 2048 })
      )

      fireEvent.change(view.getByLabelText("Storage (GB)"), {
        target: { value: "80" },
      })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ storage: 80 })
      )

      fireEvent.change(view.getByLabelText("Max custom domains"), {
        target: { value: "10" },
      })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ maxCustomDomains: 10 })
      )
    })

    it("triggers onChange when wildcard switch is toggled", () => {
      const initial = { ...DEFAULT_APP_HOSTING_PLAN_CONFIG, wildcard: false }
      const onChange = mock()

      const view = render(
        <AppHostingPlanConfigComponent value={initial} onChange={onChange} />
      )

      fireEvent.click(view.getByRole("switch"))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ wildcard: true })
      )
    })

    it("triggers onChange when database dependency checkboxes are toggled", () => {
      const initial: AppHostingPlanConfig = {
        ...DEFAULT_APP_HOSTING_PLAN_CONFIG,
        requiredDependencies: ["POSTGRESQL"],
      }
      const onChange = mock()

      const view = render(
        <AppHostingPlanConfigComponent value={initial} onChange={onChange} />
      )

      // Check MySQL
      fireEvent.click(view.getByLabelText("MySQL"))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredDependencies: ["POSTGRESQL", "MYSQL"],
        })
      )

      // Uncheck PostgreSQL
      fireEvent.click(view.getByLabelText("PostgreSQL"))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredDependencies: [],
        })
      )
    })

    it("displays error messages when errors prop is provided", () => {
      const errors = {
        cpu: "CPU must be at least 1 mCPU",
        memory: "Memory too low",
        storage: "Storage required",
        maxCustomDomains: "Invalid custom domains",
        requiredDependencies: "Invalid database selection",
      }

      const view = render(
        <AppHostingPlanConfigComponent
          value={DEFAULT_APP_HOSTING_PLAN_CONFIG}
          onChange={() => {}}
          errors={errors}
        />
      )

      expect(view.getByText("CPU must be at least 1 mCPU")).toBeInTheDocument()
      expect(view.getByText("Memory too low")).toBeInTheDocument()
      expect(view.getByText("Storage required")).toBeInTheDocument()
      expect(view.getByText("Invalid custom domains")).toBeInTheDocument()
      expect(view.getByText("Invalid database selection")).toBeInTheDocument()
    })
  })
})
