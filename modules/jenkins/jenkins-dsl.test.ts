import { describe, expect, it } from "bun:test"
import { generateJenkinsDsl, generatePhpDsl, generateNodeDsl, generateDockerDsl } from "./jenkins-dsl"
import type { JenkinsDslOptions } from "./jenkins-dsl"

const baseOptions: JenkinsDslOptions = {
  appStackSlug: "my-app",
  gitRepoUrl: "https://github.com/acme/my-app",
  gitRepoBranch: "main",
  gitCredentialId: "github-app-creds",
  phpVersion: "8.4",
  nodeVersion: "22",
  runNodeBuild: false,
  tagVersion: "latest",
  useAlpine: true,
  env: "dev",
}

describe("jenkins-dsl", () => {
  describe("generatePhpDsl", () => {
    it("generates valid PHP DSL with all defaults", () => {
      const dsl = generatePhpDsl(baseOptions)
      expect(dsl).toContain("pipelineJob('my-app')")
      expect(dsl).toContain("laravelPipeline([")
      expect(dsl).toContain("codeRepo: 'https://github.com/acme/my-app'")
      expect(dsl).toContain("codeBranch: 'main'")
      expect(dsl).toContain("codeGitCredentialsId: 'github-app-creds'")
    })

    it("uses custom PHP version when provided", () => {
      const dsl = generatePhpDsl({ ...baseOptions, phpVersion: "8.3" })
      expect(dsl).toContain("'8.3'")
    })

    it("uses prod environment when specified", () => {
      const dsl = generatePhpDsl({ ...baseOptions, env: "prod" })
      expect(dsl).toContain("webhookEnv: 'prod'")
    })
  })

  describe("generateNodeDsl", () => {
    it("generates valid Node.js DSL", () => {
      const dsl = generateNodeDsl(baseOptions)
      expect(dsl).toContain("pipelineJob('my-app')")
      expect(dsl).toContain("nodejsPipeline([")
      expect(dsl).toContain("nodeVersion: '22'")
    })

    it("respects runNodeBuild flag", () => {
      const dsl = generateNodeDsl({ ...baseOptions, runNodeBuild: true })
      expect(dsl).toContain("runNodeBuild: 'true'")
    })
  })

  describe("generateDockerDsl", () => {
    it("generates Docker pipeline DSL", () => {
      const dsl = generateDockerDsl(baseOptions)
      expect(dsl).toContain("pipelineJob('my-app')")
      expect(dsl).toContain("dockerPipeline([")
      expect(dsl).toContain("dockerImage: 'my-app'")
    })

    it("uses custom docker registry URL", () => {
      const dsl = generateDockerDsl({ ...baseOptions, dockerRegistryUrl: "gcr.io/acme" })
      expect(dsl).toContain("dockerRegistryUrl: 'gcr.io/acme'")
    })

    it("renders environment variables", () => {
      const dsl = generateDockerDsl({
        ...baseOptions,
        environmentVariables: { NODE_ENV: "production", PORT: "8080" },
      })
      expect(dsl).toContain("'NODE_ENV': 'production'")
      expect(dsl).toContain("'PORT': '8080'")
    })
  })

  describe("generateJenkinsDsl", () => {
    it("dispatches to PHP generator", () => {
      const dsl = generateJenkinsDsl({ name: "app", type: "php", repositoryUrl: "https://github.com/acme/app" })
      expect(dsl).toContain("laravelPipeline([")
    })

    it("dispatches to Node generator", () => {
      const dsl = generateJenkinsDsl({ name: "app", type: "node", repositoryUrl: "https://github.com/acme/app" })
      expect(dsl).toContain("nodejsPipeline([")
    })

    it("dispatches to Docker generator", () => {
      const dsl = generateJenkinsDsl({ name: "app", type: "docker" })
      expect(dsl).toContain("dockerPipeline([")
    })

    it("throws on unknown job type", () => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generateJenkinsDsl({ name: "app", type: "golang" } as any)
      ).toThrow("Unsupported job type: golang")
    })

    it("uses main as default branch", () => {
      const dsl = generateJenkinsDsl({ name: "app", type: "php", repositoryUrl: "https://github.com/acme/app" })
      expect(dsl).toContain("codeBranch: 'main'")
    })
  })
})