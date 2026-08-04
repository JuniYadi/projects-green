import { describe, expect, it } from "bun:test"

import {
  buildDeploySubmitPayload,
  buildRepositoriesUrl,
  generateAppName,
  getDeploySubmitError,
  getRequestErrorMessage,
  mapGithubRepository,
  toGeneratedSubdomain,
  toOwnerOptions,
} from "@/modules/deploy/deploy-wizard.logic"
import type {
  DeployWizardState,
  Repository,
} from "@/modules/deploy/deploy.types"

const repositories: Repository[] = [
  {
    id: "1",
    ownerId: "zeta",
    name: "one",
    isPrivate: false,
    installationId: 10,
  },
  {
    id: "2",
    ownerId: "alpha",
    name: "two",
    isPrivate: true,
    installationId: 20,
  },
  {
    id: "3",
    ownerId: "zeta",
    name: "three",
    isPrivate: false,
    installationId: 10,
  },
]

const baseState: DeployWizardState = {
  step: "review",
  source: {
    sourceType: "github",
    appName: "",
    ownerId: "alpha",
    repositoryId: "2",
    branchName: "main",
    rootDirectory: "",
  },
  detectionResult: null,
  build: {
    language: "Node.js",
    framework: "Next.js",
    buildCommand: "bun run build",
    useDockerfile: false,
    defaultPort: 3000,
  },
  environment: {
    useGeneratedSubdomain: false,
    customDomain: " app.example.com ",
    envVars: [
      {
        id: "env-1",
        key: "API_URL",
        value: "https://api.example.com",
        type: "plain",
        scope: "runtime",
      },
    ],
    resourcePlanId: "payg",
    billingMode: "PAYG",
    paygBufferHours: 12,
    cpu: 100,
    memory: 256,
  },
  monitor: {
    status: "idle",
    logScope: "all",
    attempt: 0,
    tick: 0,
    isActive: false,
    shouldFail: false,
    failureReason: null,
  },
}

describe("Deploy Wizard logic", () => {
  it("maps and de-duplicates repository owners", () => {
    expect(toOwnerOptions(repositories)).toEqual([
      { id: "alpha", name: "alpha", avatarUrl: "" },
      { id: "zeta", name: "zeta", avatarUrl: "" },
    ])
    expect(
      mapGithubRepository({
        repositoryId: 42,
        name: "green",
        owner: "pfn",
        private: true,
        installationId: "99",
      })
    ).toEqual({
      id: "42",
      ownerId: "pfn",
      name: "green",
      isPrivate: true,
      defaultBranch: undefined,
      installationId: 99,
    })
  })

  it("builds repository URLs only from supplied filters", () => {
    expect(buildRepositoriesUrl({})).toBe(
      "/api/integrations/github/repositories?limit=100"
    )
    expect(
      buildRepositoriesUrl({ ownerId: "pfn", query: "green", limit: 25 })
    ).toBe(
      "/api/integrations/github/repositories?" +
        "ownerId=pfn&query=green&limit=25"
    )
  })

  it("normalizes generated app names and domains", () => {
    expect(toGeneratedSubdomain(" My--Green App! ")).toBe(
      "my-green-app.pfn.app"
    )
    expect(toGeneratedSubdomain("!!!")).toBe("my-app.pfn.app")
    expect(generateAppName("Next App", () => 0.5)).toBe("next-app-i")
  })

  it("returns useful request and submit errors", () => {
    expect(getRequestErrorMessage(new Error("offline"))).toBe("offline")
    expect(getRequestErrorMessage(null)).toContain("Unable to load")
    expect(
      getDeploySubmitError(false, {
        ok: false,
        message: "Please retry.",
      })
    ).toBe("Please retry.")
    expect(getDeploySubmitError(false, { ok: false })).toContain(
      "Unable to start"
    )
    expect(
      getDeploySubmitError(true, {
        ok: true,
        data: { deploymentId: "deploy-1", status: "queued" },
      })
    ).toBeNull()
  })

  it("builds a GitHub submission without UI state", () => {
    expect(
      buildDeploySubmitPayload({
        state: baseState,
        selectedRepository: repositories[1],
      })
    ).toMatchObject({
      sourceType: "GITHUB",
      repositoryId: "2",
      name: "two",
      branchName: "main",
      rootDirectory: "/",
      customDomain: "app.example.com",
      paygBufferHours: 12,
      envVars: [
        {
          key: "API_URL",
          value: "https://api.example.com",
          type: "plain",
          scope: "runtime",
        },
      ],
    })
  })

  it("builds a template-default submission", () => {
    const templateState: DeployWizardState = {
      ...baseState,
      source: {
        ...baseState.source,
        sourceType: "template",
        templateId: "wordpress",
        appName: "wordpress-demo",
      },
    }

    expect(
      buildDeploySubmitPayload({
        state: templateState,
        selectedRepository: null,
        deployWithTemplateDefaults: true,
      })
    ).toMatchObject({
      sourceType: "TEMPLATE",
      templateId: "wordpress",
      name: "wordpress-demo",
      branchName: "/",
      rootDirectory: "/",
      subdomain: "wordpress-demo.pfn.app",
      envVars: [],
    })
  })
  it("builds a public-source submission with stable source fields", () => {
    const publicState: DeployWizardState = {
      ...baseState,
      source: {
        ...baseState.source,
        sourceType: "public",
        appName: "project",
        publicSourceUrl: "https://gitlab.com/group/project",
        publicSourceRef: "release",
        rootDirectory: "/",
      },
      build: {
        ...baseState.build,
        frameworkVersion: "14",
      },
    }

    expect(
      buildDeploySubmitPayload({
        state: publicState,
        selectedRepository: null,
      })
    ).toMatchObject({
      sourceType: "PUBLIC",
      publicSourceUrl: "https://gitlab.com/group/project",
      name: "project",
      branchName: "release",
      rootDirectory: "/",
      framework: "Next.js",
      frameworkVersion: "14",
      defaultPort: 3000,
    })
  })
})
