import { describe, expect, it } from "bun:test"
import {
  parseManualBuildSettings,
  type ManualBuildSettingsInput,
} from "./manual-build-settings"
import { AiDeploymentSessionError } from "./ai-deployment-session.service"
import {
  MANUAL_FRAMEWORK_OPTIONS,
  MANUAL_LANGUAGE_OPTIONS,
} from "./deploy.constants"

describe("manual-build-settings", () => {
  const validSettings: ManualBuildSettingsInput = {
    language: "Node.js",
    framework: "Next.js",
    runtimeVersion: "20.x",
    packageManager: "bun",
    buildCommand: "bun run build",
    startCommand: "bun run start",
    port: 3000,
    useDockerfile: false,
    dockerfilePath: null,
  }

  describe("parseManualBuildSettings - valid cases", () => {
    it("parses valid non-docker build settings successfully", () => {
      const result = parseManualBuildSettings(validSettings)
      expect(result).toEqual(validSettings)
    })

    it("parses valid docker build settings with valid relative dockerfilePath", () => {
      const dockerSettings: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "Dockerfile",
      }

      const result = parseManualBuildSettings(dockerSettings)
      expect(result).toEqual(dockerSettings)
    })

    it("parses valid docker build settings with nested relative path", () => {
      const dockerSettings: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "docker/prod.Dockerfile",
      }

      const result = parseManualBuildSettings(dockerSettings)
      expect(result).toEqual(dockerSettings)
    })

    it("accepts all supported language options", () => {
      for (const language of MANUAL_LANGUAGE_OPTIONS) {
        const settings: ManualBuildSettingsInput = {
          ...validSettings,
          language,
        }
        expect(parseManualBuildSettings(settings)).toEqual(settings)
      }
    })

    it("accepts all supported framework options", () => {
      for (const framework of MANUAL_FRAMEWORK_OPTIONS) {
        const settings: ManualBuildSettingsInput = {
          ...validSettings,
          framework,
        }
        expect(parseManualBuildSettings(settings)).toEqual(settings)
      }
    })

    it("accepts boundary port numbers 1 and 65535", () => {
      const minPortSettings = { ...validSettings, port: 1 }
      const maxPortSettings = { ...validSettings, port: 65535 }

      expect(parseManualBuildSettings(minPortSettings)).toEqual(minPortSettings)
      expect(parseManualBuildSettings(maxPortSettings)).toEqual(maxPortSettings)
    })
  })

  describe("parseManualBuildSettings - validation failures", () => {
    it("throws MANUAL_SETTINGS_INVALID for unsupported language", () => {
      const invalid = { ...validSettings, language: "Rust" }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        AiDeploymentSessionError
      )
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })

    it("throws MANUAL_SETTINGS_INVALID for unsupported framework", () => {
      const invalid = { ...validSettings, framework: "RubyOnRails" }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })

    it("throws MANUAL_SETTINGS_INVALID for empty or whitespace buildCommand", () => {
      expect(() =>
        parseManualBuildSettings({ ...validSettings, buildCommand: "" })
      ).toThrow("MANUAL_SETTINGS_INVALID")

      expect(() =>
        parseManualBuildSettings({ ...validSettings, buildCommand: "   " })
      ).toThrow("MANUAL_SETTINGS_INVALID")
    })

    it("throws MANUAL_SETTINGS_INVALID for empty or whitespace startCommand", () => {
      expect(() =>
        parseManualBuildSettings({ ...validSettings, startCommand: "" })
      ).toThrow("MANUAL_SETTINGS_INVALID")

      expect(() =>
        parseManualBuildSettings({ ...validSettings, startCommand: "  \t " })
      ).toThrow("MANUAL_SETTINGS_INVALID")
    })

    it("throws MANUAL_SETTINGS_INVALID for invalid port numbers", () => {
      // 0 or negative
      expect(() =>
        parseManualBuildSettings({ ...validSettings, port: 0 })
      ).toThrow("MANUAL_SETTINGS_INVALID")
      expect(() =>
        parseManualBuildSettings({ ...validSettings, port: -1 })
      ).toThrow("MANUAL_SETTINGS_INVALID")

      // greater than 65535
      expect(() =>
        parseManualBuildSettings({ ...validSettings, port: 65536 })
      ).toThrow("MANUAL_SETTINGS_INVALID")

      // non-integer
      expect(() =>
        parseManualBuildSettings({ ...validSettings, port: 3000.5 })
      ).toThrow("MANUAL_SETTINGS_INVALID")
      expect(() =>
        parseManualBuildSettings({
          ...validSettings,
          port: NaN as unknown as number,
        })
      ).toThrow("MANUAL_SETTINGS_INVALID")
    })

    it("throws MANUAL_SETTINGS_INVALID when useDockerfile is true but dockerfilePath is null", () => {
      const invalid: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: null,
      }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })

    it("throws MANUAL_SETTINGS_INVALID for absolute dockerfile path", () => {
      const invalid: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "/root/Dockerfile",
      }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })

    it("throws MANUAL_SETTINGS_INVALID for dockerfile path with directory traversal (..)", () => {
      const invalid: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "../Dockerfile",
      }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )

      const nestedInvalid: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "docker/../../etc/passwd",
      }
      expect(() => parseManualBuildSettings(nestedInvalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })

    it("throws MANUAL_SETTINGS_INVALID for dockerfile path with URL schema (://)", () => {
      const invalid: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "http://example.com/Dockerfile",
      }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })

    it("throws MANUAL_SETTINGS_INVALID for dockerfile path with illegal characters", () => {
      const invalid: ManualBuildSettingsInput = {
        ...validSettings,
        useDockerfile: true,
        dockerfilePath: "Dockerfile;rm -rf /",
      }
      expect(() => parseManualBuildSettings(invalid)).toThrow(
        "MANUAL_SETTINGS_INVALID"
      )
    })
  })
})
