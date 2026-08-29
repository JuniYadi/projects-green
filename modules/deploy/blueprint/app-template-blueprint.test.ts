import { describe, expect, it } from "bun:test"

import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"
import {
  buildInitialEnvVars,
  validateBlueprint,
} from "@/modules/deploy/blueprint/app-template-blueprint.service"

const validSampleBlueprint: AppTemplateBlueprint = {
  version: "1.0.0",
  runtime: {
    image: "ghost:5-alpine",
    command: ["node", "current/index.js"],
    args: ["--production"],
    defaultPort: 2368,
    healthCheckPath: "/ghost/api/v4/admin/site/",
    runAsNonRoot: true,
  },
  resources: {
    defaultCpu: 500,
    defaultMemory: 512,
    minCpu: 250,
    minMemory: 256,
  },
  storage: {
    enabled: true,
    mountPath: "/var/lib/ghost/content",
    sizeGbDefault: 10,
  },
  dependencies: [
    {
      serviceType: "MYSQL",
      alias: "ghost-db",
      envPrefix: "database__connection__",
    },
  ],
  envSchema: [
    {
      key: "url",
      label: "Ghost URL",
      description: "Public domain url for Ghost blog",
      defaultValue: "http://localhost:2368",
      required: true,
      isSecret: false,
      dataType: "string",
    },
    {
      key: "ADMIN_PASSWORD",
      label: "Admin Password",
      required: true,
      isSecret: true,
      dataType: "string",
      generateRandomHex: 32,
    },
    {
      key: "NODE_ENV",
      label: "Environment",
      defaultValue: "production",
      required: true,
      isSecret: false,
      dataType: "select",
      options: ["production", "development"],
    },
  ],
}

describe("AppTemplateBlueprint Validation & Service", () => {
  it("should validate a valid blueprint successfully", () => {
    const result = validateBlueprint(validSampleBlueprint)
    expect(result.valid).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.version).toBe("1.0.0")
    expect(result.data?.runtime.image).toBe("ghost:5-alpine")
    expect(result.data?.runtime.defaultPort).toBe(2368)
    expect(result.errors).toBeUndefined()
  })

  it("should fail validation if version is not 1.0.0", () => {
    const invalid = {
      ...validSampleBlueprint,
      version: "2.0.0",
    }
    const result = validateBlueprint(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.version).toBeDefined()
  })

  it("should fail validation for invalid runtime image and port out of range", () => {
    const invalidImage = {
      ...validSampleBlueprint,
      runtime: {
        ...validSampleBlueprint.runtime,
        image: "   ",
      },
    }
    const resultImage = validateBlueprint(invalidImage)
    expect(resultImage.valid).toBe(false)
    expect(resultImage.errors?.["runtime.image"]).toBeDefined()

    const invalidPort = {
      ...validSampleBlueprint,
      runtime: {
        ...validSampleBlueprint.runtime,
        defaultPort: 70000,
      },
    }
    const resultPort = validateBlueprint(invalidPort)
    expect(resultPort.valid).toBe(false)
    expect(resultPort.errors?.["runtime.defaultPort"]).toBeDefined()

    const zeroPort = {
      ...validSampleBlueprint,
      runtime: {
        ...validSampleBlueprint.runtime,
        defaultPort: 0,
      },
    }
    const resultZero = validateBlueprint(zeroPort)
    expect(resultZero.valid).toBe(false)
    expect(resultZero.errors?.["runtime.defaultPort"]).toBeDefined()
  })

  it("should fail validation for invalid resources", () => {
    const invalidCpu = {
      ...validSampleBlueprint,
      resources: {
        defaultCpu: 50,
        defaultMemory: 512,
      },
    }
    const resultCpu = validateBlueprint(invalidCpu)
    expect(resultCpu.valid).toBe(false)
    expect(resultCpu.errors?.["resources.defaultCpu"]).toBeDefined()

    const invalidMem = {
      ...validSampleBlueprint,
      resources: {
        defaultCpu: 500,
        defaultMemory: 64,
      },
    }
    const resultMem = validateBlueprint(invalidMem)
    expect(resultMem.valid).toBe(false)
    expect(resultMem.errors?.["resources.defaultMemory"]).toBeDefined()
  })

  it("should generate initial environment variables correctly with defaults and random hex tokens", () => {
    const envVars = buildInitialEnvVars(validSampleBlueprint)

    expect(envVars.url).toBe("http://localhost:2368")
    expect(envVars.NODE_ENV).toBe("production")
    expect(envVars.ADMIN_PASSWORD).toBeDefined()
    expect(envVars.ADMIN_PASSWORD.length).toBe(32)
    expect(/^[0-9a-f]{32}$/.test(envVars.ADMIN_PASSWORD)).toBe(true)
  })

  it("should allow user overrides for default and random hex env vars", () => {
    const userOverrides = {
      url: "https://myblog.com",
      ADMIN_PASSWORD: "custom-secret-pass",
      EXTRA_VAR: "extra-value",
    }
    const envVars = buildInitialEnvVars(validSampleBlueprint, userOverrides)

    expect(envVars.url).toBe("https://myblog.com")
    expect(envVars.NODE_ENV).toBe("production")
    expect(envVars.ADMIN_PASSWORD).toBe("custom-secret-pass")
    expect(envVars.EXTRA_VAR).toBe("extra-value")
  })

  it("defaults deploymentType to deployment and additionalPorts to empty when omitted", () => {
    const result = validateBlueprint(validSampleBlueprint)
    expect(result.valid).toBe(true)
    expect(result.data?.runtime.deploymentType).toBe("deployment")
    expect(result.data?.runtime.additionalPorts).toEqual([])
  })

  it("accepts an explicit statefulset deploymentType and additionalPorts list", () => {
    const statefulBlueprint = {
      ...validSampleBlueprint,
      runtime: {
        ...validSampleBlueprint.runtime,
        deploymentType: "statefulset" as const,
        additionalPorts: [{ port: 9119, name: "dashboard" }],
      },
    }
    const result = validateBlueprint(statefulBlueprint)
    expect(result.valid).toBe(true)
    expect(result.data?.runtime.deploymentType).toBe("statefulset")
    expect(result.data?.runtime.additionalPorts).toEqual([
      { port: 9119, name: "dashboard" },
    ])
  })

  it("rejects an invalid deploymentType value", () => {
    const invalid = {
      ...validSampleBlueprint,
      runtime: {
        ...validSampleBlueprint.runtime,
        deploymentType: "daemonset",
      },
    }
    const result = validateBlueprint(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors?.["runtime.deploymentType"]).toBeDefined()
  })

  it("rejects an additionalPorts entry missing a name", () => {
    const invalid = {
      ...validSampleBlueprint,
      runtime: {
        ...validSampleBlueprint.runtime,
        additionalPorts: [{ port: 9119, name: "" }],
      },
    }
    const result = validateBlueprint(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors?.["runtime.additionalPorts.0.name"]).toBeDefined()
  })
})
