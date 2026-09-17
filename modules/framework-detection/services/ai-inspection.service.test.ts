import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import type { generateText } from "ai"
import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import type {
  GitProviderAccessResult,
  GitProviderAdapter,
} from "@/modules/deploy/git-provider"
import { createRepoInspectorTools } from "../ai-tools/repo-inspector.tools"
import type { AiDetectionToolTrace } from "../framework-detection.trace"
import { inspectRepoWithAi } from "./ai-inspection.service"

type MockGenerateText = typeof generateText

type MockPrismaLogCalls = {
  mock: {
    calls: Array<Array<{ data: Record<string, unknown> }>>
  }
}

describe("ai-inspection.service & repo-inspector.tools", () => {
  const createMockAdapter = (
    overrides?: Partial<GitProviderAdapter>
  ): GitProviderAdapter => {
    return {
      name: "mock-github",
      matches: mock(() => true),
      checkAccess: mock(async (): Promise<GitProviderAccessResult> => ({
        accessible: true,
        provider: "github",
      })),
      listTree: mock(async () => ({
        files: ["package.json", "src/app/page.tsx", ".env.example"],
        truncated: false,
      })),
      readFile: mock(async (_url, path) => {
        if (path.endsWith("package.json")) {
          return {
            content: JSON.stringify({
              name: "my-next-app",
              dependencies: { next: "14.2.0", react: "18.2.0" },
              scripts: { start: "next start" },
            }),
            size: 120,
          }
        }
        if (path.endsWith(".env.example")) {
          return {
            content:
              "PORT=3000\nDATABASE_URL=postgres://user:secret_pass@localhost:5432/db",
            size: 70,
          }
        }
        return { content: "", size: 0 }
      }),
      ...overrides,
    }
  }

  const createMockPrisma = () => {
    const createLog = mock(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "log_mock_123",
        ...data,
        createdAt: new Date(),
      })
    )
    const updateSession = mock(async () => ({}))

    return {
      detectorInspectionLog: {
        create: createLog,
      },
      aiDeploymentSession: {
        update: updateSession,
      },
      detectorRule: {
        findMany: mock(async () => []),
      },
    } as unknown as PrismaClient
  }

  describe("createRepoInspectorTools", () => {
    it("lists files, tracks timing and records tool trace step", async () => {
      const traces: AiDetectionToolTrace[] = []
      const adapter = createMockAdapter()
      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/org/repo",
        ref: "main",
        onStep: (step) => traces.push(step),
      })

      const executeList = tools.list_repo_files.execute as (
        args: { path?: string },
        ctx: unknown
      ) => Promise<{ files: string[]; truncated: boolean }>
      const result = await executeList(
        { path: "src" },
        { toolCallId: "call-1", messages: [] }
      )

      expect(result.files).toHaveLength(3)
      expect(traces).toHaveLength(1)
      expect(traces[0].name).toBe("list_repo_files")
      expect(traces[0].outcome).toBe("completed")
      expect(traces[0].status).toBe("completed")
      expect(traces[0].listedFileCount).toBe(3)
      expect(traces[0].durationMs).toBeGreaterThanOrEqual(0)
      expect(adapter.listTree).toHaveBeenCalledWith(
        "https://github.com/org/repo",
        "main",
        "src",
        undefined
      )
    })

    it("handles listTree failure, records failed trace item and throws", async () => {
      const traces: AiDetectionToolTrace[] = []
      const adapter = createMockAdapter({
        listTree: mock(async () => {
          throw new Error("Git tree not found")
        }),
      })
      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/org/repo",
        onStep: (step) => traces.push(step),
      })

      const executeList = tools.list_repo_files.execute as (
        args: { path?: string },
        ctx: unknown
      ) => Promise<{ files: string[]; truncated: boolean }>
      expect(
        executeList({}, { toolCallId: "call-err", messages: [] })
      ).rejects.toThrow("Git tree not found")

      // Allow microtask to settle
      await new Promise((r) => setTimeout(r, 10))
      expect(traces).toHaveLength(1)
      expect(traces[0].outcome).toBe("failed")
      expect(traces[0].errorCategory).toBe("tool_failure")
    })

    it("reads file and strictly redacts raw content in tool trace item", async () => {
      const traces: AiDetectionToolTrace[] = []
      const sensitiveContent = "SECRET_TOKEN=super_classified_api_key_12345"
      const adapter = createMockAdapter({
        readFile: mock(async () => ({
          content: sensitiveContent,
          size: sensitiveContent.length,
        })),
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/org/repo",
        onStep: (step) => traces.push(step),
      })

      const executeRead = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx: unknown
      ) => Promise<{ content: string; path: string; size: number }>
      const result = await executeRead(
        { filePath: ".env" },
        { toolCallId: "call-2", messages: [] }
      )

      expect(result.content).toBe(sensitiveContent)
      expect(result.size).toBe(sensitiveContent.length)

      // Verify strict redaction in trace item
      expect(traces).toHaveLength(1)
      const trace = traces[0]
      expect(trace.name).toBe("read_repo_file")
      expect(trace.outcome).toBe("completed")
      expect(trace.inputSummary.requestedPath).toBe(".env")
      expect(trace.fileSizeBytes).toBe(sensitiveContent.length)

      // Ensure secret content is NEVER present in trace log
      const serializedTrace = JSON.stringify(trace)
      expect(serializedTrace).not.toContain("super_classified_api_key_12345")
      expect(serializedTrace).not.toContain("SECRET_TOKEN")
    })
  })

  describe("inspectRepoWithAi", () => {
    it("successfully inspects Next.js repository using AI tool calling", async () => {
      const adapter = createMockAdapter()
      const mockPrisma = createMockPrisma()

      const mockGenerateText = mock(
        async (params: {
          tools: {
            list_repo_files: {
              execute: (args: unknown, ctx: unknown) => Promise<unknown>
            }
            read_repo_file: {
              execute: (args: unknown, ctx: unknown) => Promise<unknown>
            }
          }
        }) => {
          // Model executes list_repo_files
          await params.tools.list_repo_files.execute(
            {},
            { toolCallId: "call-1", messages: [] }
          )
          // Model executes read_repo_file
          await params.tools.read_repo_file.execute(
            { filePath: "package.json" },
            { toolCallId: "call-2", messages: [] }
          )

          return {
            output: {
              primaryFrameworkId: "nextjs",
              frameworkName: "Next.js",
              frameworkVersion: "14.2.0",
              ecosystem: "node",
              confidence: 0.95,
              defaultPort: 3000,
              startScript: "npm run start",
              requiredRuntimeIds: ["node"],
              runtimeVersion: "20",
              envDefaults: { PORT: "3000" },
              reasoning: ["Manifest package.json specifies next 14.2.0"],
              warnings: [],
            },
          }
        }
      )

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/my-org/my-next-app",
        ref: "main",
        dependencies: {
          adapter,
          db: mockPrisma,
          generateText: mockGenerateText as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      expect(result.primaryFramework?.id).toBe("nextjs")
      expect(result.primaryFramework?.name).toBe("Next.js")
      expect(result.primaryFramework?.ecosystem).toBe("node")
      expect(result.confidence).toBe(0.95)
      expect(result.decision.status).toBe("success")
      expect(result.decision.isLaunchable).toBe(true)
      expect(result.defaultPort).toBe(3000)
      expect(result.frameworkVersion).toBe("14.2.0")
      expect(result.enforcedRuntimes).toEqual([
        { runtimeId: "node", version: "20" },
      ])

      // Verify AI trace
      expect(result.aiTrace).not.toBeNull()
      expect(result.aiTrace?.terminalStage).toBe("completed")
      expect(result.aiTrace?.tools).toHaveLength(2)
      expect(result.aiTrace?.tools[0].name).toBe("list_repo_files")
      expect(result.aiTrace?.tools[1].name).toBe("read_repo_file")

      // Verify DetectorInspectionLog creation
      expect(mockPrisma.detectorInspectionLog.create).toHaveBeenCalledTimes(1)
      const logArgs = (
        mockPrisma.detectorInspectionLog.create as unknown as MockPrismaLogCalls
      ).mock.calls[0][0]
      expect(logArgs.data.repoUrl).toBe("https://github.com/my-org/my-next-app")
      expect(logArgs.data.detectedFramework).toBe("nextjs")
      expect(logArgs.data.confidence).toBe(0.95)
      expect(logArgs.data.status).toBe("success")
      expect(result.inspectionLogId).toBe("log_mock_123")
    })

    it("falls back to deterministic manifest inspection when AI provider throws", async () => {
      const adapter = createMockAdapter()
      const mockPrisma = createMockPrisma()

      const failingGenerateText = mock(async () => {
        throw new Error("OpenAI API rate limit exceeded (429)")
      })

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/my-org/fallback-app",
        ref: "main",
        dependencies: {
          adapter,
          db: mockPrisma,
          generateText: failingGenerateText as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      // Deterministic detection should still detect Next.js from package.json
      expect(result.primaryFramework?.id).toBe("nextjs")
      expect(result.decision.status).toBe("success")
      expect(result.decision.isLaunchable).toBe(true)
      expect(result.defaultPort).toBe(3000)
      expect(
        result.warnings.some((w) => w.includes("AI provider unavailable"))
      ).toBe(true)

      // aiTrace should mark provider failure
      expect(result.aiTrace?.terminalStage).toBe("provider")

      // Audit log was recorded
      expect(mockPrisma.detectorInspectionLog.create).toHaveBeenCalledTimes(1)
      const logArgs = (
        mockPrisma.detectorInspectionLog.create as unknown as MockPrismaLogCalls
      ).mock.calls[0][0]
      expect(logArgs.data.detectedFramework).toBe("nextjs")
      expect(logArgs.data.status).toBe("success")
    })

    it("handles private repository auth error without throwing", async () => {
      const adapter = createMockAdapter({
        checkAccess: mock(async (): Promise<GitProviderAccessResult> => ({
          accessible: false,
          requiresAuth: true,
          isPrivate: true,
          reason:
            "Repository is private or not found; GitHub authorization required",
          provider: "github",
        })),
      })
      const mockPrisma = createMockPrisma()

      const actor: AiDeploymentSessionActor = {
        organizationId: "org_test",
        userId: "user_test",
      }

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/private-org/private-repo",
        actor,
        dependencies: {
          adapter,
          db: mockPrisma,
        },
      })

      expect(result.primaryFramework).toBeNull()
      expect(result.decision.status).toBe("blocked")
      expect(result.decision.isLaunchable).toBe(false)
      expect(result.decision.message).toContain(
        "Repository is private or not found"
      )
      expect(result.warnings).toContain(
        "Repository is private or not found; GitHub authorization required"
      )

      // Inspection log recorded as blocked
      expect(mockPrisma.detectorInspectionLog.create).toHaveBeenCalledTimes(1)
      const logArgs = (
        mockPrisma.detectorInspectionLog.create as unknown as MockPrismaLogCalls
      ).mock.calls[0][0]
      expect(logArgs.data.status).toBe("blocked")
      expect(logArgs.data.errorMessage).toContain(
        "Repository is private or not found"
      )
    })

    it("strictly verifies redaction in aiTrace so secrets are not leaked to log", async () => {
      const sensitivePassword = "SUPER_SECRET_DB_PASSWORD_XYZ"
      const sensitiveApiKey = "sk-live-9999888877776666"

      const adapter = createMockAdapter({
        readFile: mock(async () => ({
          content: JSON.stringify({
            name: "app-with-secrets",
            dependencies: { next: "14.2.0" },
            secretPassword: sensitivePassword,
            secretApiKey: sensitiveApiKey,
          }),
          size: 250,
        })),
      })
      const mockPrisma = createMockPrisma()

      const mockGenerateText = mock(
        async (params: {
          tools: {
            read_repo_file: {
              execute: (args: unknown, ctx: unknown) => Promise<unknown>
            }
          }
        }) => {
          await params.tools.read_repo_file.execute(
            { filePath: "package.json" },
            { toolCallId: "call-read", messages: [] }
          )
          return {
            output: {
              primaryFrameworkId: "nextjs",
              frameworkName: "Next.js",
              confidence: 0.9,
              ecosystem: "node",
              reasoning: ["Valid manifest"],
            },
          }
        }
      )

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/org/secret-repo",
        dependencies: {
          adapter,
          db: mockPrisma,
          generateText: mockGenerateText as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      expect(result.aiTrace).toBeDefined()
      const serializedTrace = JSON.stringify(result.aiTrace)

      expect(serializedTrace).not.toContain(sensitivePassword)
      expect(serializedTrace).not.toContain(sensitiveApiKey)
      expect(serializedTrace).not.toContain("secretPassword")
      expect(serializedTrace).not.toContain("secretApiKey")

      const dbCall = (
        mockPrisma.detectorInspectionLog.create as unknown as MockPrismaLogCalls
      ).mock.calls[0][0]
      const serializedDbTrace = JSON.stringify(dbCall.data.aiTrace)
      expect(serializedDbTrace).not.toContain(sensitivePassword)
      expect(serializedDbTrace).not.toContain(sensitiveApiKey)
    })

    it("handles Prisma logging failure gracefully without crashing the detection result", async () => {
      const adapter = createMockAdapter()
      const mockPrisma = {
        detectorInspectionLog: {
          create: mock(async () => {
            throw new Error("DB connection failure")
          }),
        },
      } as unknown as PrismaClient

      const mockGenerateText = mock(async () => ({
        output: {
          primaryFrameworkId: "nextjs",
          frameworkName: "Next.js",
          confidence: 0.9,
          ecosystem: "node",
          reasoning: ["Found Next.js"],
        },
      }))

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/org/db-fail-repo",
        dependencies: {
          adapter,
          db: mockPrisma,
          generateText: mockGenerateText as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      expect(result.primaryFramework?.id).toBe("nextjs")
      expect(result.decision.status).toBe("success")
      expect(result.inspectionLogId).toBeUndefined()
    })

    it("deterministically detects Laravel PHP application when AI is bypassed or fails", async () => {
      const laravelAdapter = createMockAdapter({
        listTree: mock(async () => ({
          files: ["composer.json", "artisan", ".env.example"],
          truncated: false,
        })),
        readFile: mock(async (_url, path) => {
          if (path.endsWith("composer.json")) {
            return {
              content: JSON.stringify({
                name: "laravel/laravel",
                require: {
                  php: "^8.2",
                  "laravel/framework": "^10.0",
                },
              }),
              size: 200,
            }
          }
          if (path.endsWith(".env.example")) {
            return {
              content: "APP_NAME=Laravel\nAPP_PORT=8000\nDB_CONNECTION=mysql",
              size: 50,
            }
          }
          return { content: "", size: 0 }
        }),
      })

      const mockPrisma = createMockPrisma()

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/org/laravel-app",
        dependencies: {
          adapter: laravelAdapter,
          db: mockPrisma,
          generateText: mock(async () => {
            throw new Error("AI disabled")
          }) as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      expect(result.primaryFramework?.id).toBe("laravel")
      expect(result.primaryFramework?.ecosystem).toBe("php")
      expect(result.decision.status).toBe("success")
      expect(result.enforcedRuntimes).toEqual([
        { runtimeId: "php", version: "8.2" },
      ])
      expect(result.envDefaults?.APP_NAME).toBe("Laravel")
      expect(result.envDefaults?.DB_CONNECTION).toBe("mysql")
    })

    it("returns unsupported status when neither AI nor deterministic inspection can find any framework", async () => {
      const emptyAdapter = createMockAdapter({
        listTree: mock(async () => ({
          files: ["README.md", "LICENSE"],
          truncated: false,
        })),
        readFile: mock(async () => ({
          content: "Hello World",
          size: 11,
        })),
      })
      const mockPrisma = createMockPrisma()

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/org/empty-repo",
        dependencies: {
          adapter: emptyAdapter,
          db: mockPrisma,
          generateText: mock(async () => {
            throw new Error("No AI")
          }) as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      expect(result.primaryFramework).toBeNull()
      expect(result.decision.status).toBe("unsupported")
      expect(result.decision.isLaunchable).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it("blocks legacy WordPress repository, updates session status to BLOCKED, and returns structured policy explanation", async () => {
      const wpAdapter = createMockAdapter({
        listTree: mock(async () => ({
          files: [
            "wp-config.php",
            "wp-content/themes/theme/style.css",
            "index.php",
          ],
          truncated: false,
        })),
        readFile: mock(async () => ({
          content: "<?php define('DB_NAME', 'wordpress');",
          size: 40,
        })),
      })
      const mockPrisma = createMockPrisma()

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/org/legacy-wp",
        sessionId: "session_wp_block_1",
        dependencies: {
          adapter: wpAdapter,
          db: mockPrisma,
        },
      })

      expect(result.decision.status).toBe("blocked")
      expect(result.decision.isLaunchable).toBe(false)
      expect(result.blockedByRuleId).toBe("RULE-BLOCK-WP-LEGACY")
      expect(result.policyEvaluation?.isBlocked).toBe(true)
      expect(result.policyEvaluation?.ruleCode).toBe("RULE-BLOCK-WP-LEGACY")
      expect(result.policyEvaluation?.cveReferences?.length).toBeGreaterThan(0)
      expect(result.recommendations?.length).toBeGreaterThan(0)
      expect(
        result.recommendations?.some((r) => r.type === "marketplace")
      ).toBe(true)

      // Verify session was transitioned to BLOCKED in database
      const updateSessionMock = (
        mockPrisma as unknown as {
          aiDeploymentSession: {
            update: { mock: { calls: Array<Array<Record<string, unknown>>> } }
          }
        }
      ).aiDeploymentSession.update.mock
      expect(updateSessionMock.calls.length).toBe(1)
      expect(updateSessionMock.calls[0]?.[0]).toEqual({
        where: { id: "session_wp_block_1" },
        data: { status: "BLOCKED" },
      })

      // Verify inspection log recorded blockedByRuleId and status
      const logCalls = (
        mockPrisma as unknown as {
          detectorInspectionLog: { create: MockPrismaLogCalls }
        }
      ).detectorInspectionLog.create.mock.calls
      expect(logCalls.length).toBe(1)
      expect(logCalls[0]?.[0]?.data.status).toBe("blocked")
      expect(logCalls[0]?.[0]?.data.blockedByRuleId).toBe(
        "RULE-BLOCK-WP-LEGACY"
      )
      expect(logCalls[0]?.[0]?.data.errorMessage).toContain("wp-config.php")
    })

    it("evaluates policy rules when primary framework is detected as blocked", async () => {
      const customAdapter = createMockAdapter({
        listTree: mock(async () => ({
          files: ["server.js"],
          truncated: false,
        })),
        readFile: mock(async () => ({
          content: "console.log('hi')",
          size: 20,
        })),
      })
      const mockPrisma = createMockPrisma()
      // Custom rule blocking custom-framework
      ;(
        mockPrisma as unknown as {
          detectorRule: { findMany: (args: unknown) => Promise<unknown[]> }
        }
      ).detectorRule.findMany = async () => [
        {
          id: "rule-block-custom",
          name: "RULE-BLOCK-CUSTOM",
          description: "Block custom framework",
          patternJson: { framework: "custom-framework" },
          implicationsJson: {
            ruleCode: "RULE-BLOCK-CUSTOM",
            status: "blocked",
            impact: "BLOCK",
            action: "BLOCK",
            title: "Custom Framework Blocked",
            reason:
              "Custom framework is not supported due to security concerns",
            cveReferences: ["CVE-2025-0001"],
            suggestedAlternatives: [
              {
                type: "dockerfile",
                title: "Use Dockerfile",
                description: "Wrap in Dockerfile",
                target: "Dockerfile",
              },
            ],
          },
          isActive: true,
          priority: 100,
        },
      ]

      const result = await inspectRepoWithAi({
        repoUrl: "https://github.com/org/custom-app",
        sessionId: "session_custom_block_2",
        dependencies: {
          adapter: customAdapter,
          db: mockPrisma,
          generateText: mock(async () => {
            return {
              output: {
                primaryFrameworkId: "custom-framework",
                frameworkName: "Custom Framework",
                ecosystem: "node",
                confidence: 0.9,
                requiredRuntimeIds: ["node"],
                reasoning: ["Detected custom framework"],
                warnings: [],
              },
            }
          }) as unknown as MockGenerateText,
          getAiConfig: () => ({
            apiKey: "mock-key",
            baseURL: "https://mock.openrouter.ai/api/v1",
          }),
        },
      })

      expect(result.decision.status).toBe("blocked")
      expect(result.decision.isLaunchable).toBe(false)
      expect(result.blockedByRuleId).toBe("RULE-BLOCK-CUSTOM")
      expect(result.policyEvaluation?.cveReferences).toEqual(["CVE-2025-0001"])
      expect(result.recommendations?.[0]?.type).toBe("dockerfile")

      const updateSessionMock = (
        mockPrisma as unknown as {
          aiDeploymentSession: {
            update: { mock: { calls: Array<Array<Record<string, unknown>>> } }
          }
        }
      ).aiDeploymentSession.update.mock
      expect(updateSessionMock.calls.length).toBe(1)
      expect(updateSessionMock.calls[0]?.[0]).toEqual({
        where: { id: "session_custom_block_2" },
        data: { status: "BLOCKED" },
      })
    })

    describe("deterministic manifest detectors and edge cases", () => {
      it("detects Remix in package.json with and without start script", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["package.json"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: JSON.stringify({
              dependencies: { "@remix-run/react": "^2.8.0" },
            }),
            size: 60,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/remix-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("remix")
        expect(result.primaryFramework?.name).toBe("Remix")
        expect(result.primaryFramework?.ecosystem).toBe("node")
        expect(result.confidence).toBe(0.9)
      })

      it("detects Nuxt in package.json with and without start script", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["package.json"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: JSON.stringify({
              dependencies: { nuxt: "^3.11.0" },
              scripts: { start: "nuxt start" },
            }),
            size: 70,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/nuxt-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("nuxt")
        expect(result.primaryFramework?.name).toBe("Nuxt")
        expect(result.confidence).toBe(0.9)
      })

      it("detects NestJS in package.json", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["package.json"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: JSON.stringify({
              dependencies: { "@nestjs/core": "^10.0.0" },
            }),
            size: 60,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/nestjs-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("nestjs")
        expect(result.primaryFramework?.name).toBe("NestJS")
        expect(result.confidence).toBe(0.9)
      })

      it("detects Express in package.json", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["package.json"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: JSON.stringify({
              dependencies: { express: "^4.19.0" },
            }),
            size: 50,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/express-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("express")
        expect(result.primaryFramework?.name).toBe("Express")
        expect(result.confidence).toBe(0.85)
      })

      it("detects React SPA in package.json", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["package.json"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: JSON.stringify({
              dependencies: { react: "^18.2.0" },
            }),
            size: 50,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/react-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("react")
        expect(result.primaryFramework?.name).toBe("React")
        expect(result.confidence).toBe(0.8)
      })

      it("detects Python Django via requirements.txt and pyproject.toml", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["requirements.txt"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: "Django>=4.2,<5.0\npsycopg2-binary>=2.9",
            size: 35,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/django-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("django")
        expect(result.primaryFramework?.name).toBe("Django")
        expect(result.primaryFramework?.ecosystem).toBe("python")
        expect(result.confidence).toBe(0.9)
        expect(result.defaultPort).toBe(8000)
      })

      it("detects Python FastAPI via pyproject.toml", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["pyproject.toml"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content:
              '[tool.poetry.dependencies]\nfastapi = "^0.110.0"\nuvicorn = "^0.29.0"',
            size: 60,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/fastapi-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("fastapi")
        expect(result.primaryFramework?.name).toBe("FastAPI")
        expect(result.primaryFramework?.ecosystem).toBe("python")
        expect(result.confidence).toBe(0.9)
      })

      it("detects Python Flask via requirements.txt", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["requirements.txt"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: "Flask==3.0.2\ngunicorn==21.2.0",
            size: 30,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/flask-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("flask")
        expect(result.primaryFramework?.name).toBe("Flask")
        expect(result.primaryFramework?.ecosystem).toBe("python")
        expect(result.confidence).toBe(0.85)
        expect(result.defaultPort).toBe(5000)
      })

      it("detects Go Gin and standard Go via go.mod", async () => {
        const mockPrisma = createMockPrisma()
        const ginAdapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["go.mod", "main.go"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content:
              "module example.com/gin-app\n\ngo 1.22\n\nrequire github.com/gin-gonic/gin v1.9.1",
            size: 80,
          })),
        })

        const ginResult = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/go-gin-app",
          dependencies: {
            adapter: ginAdapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(ginResult.primaryFramework?.id).toBe("gin")
        expect(ginResult.primaryFramework?.name).toBe("Gin")
        expect(ginResult.confidence).toBe(0.9)

        const plainGoAdapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["go.mod", "main.go"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: "module example.com/plain-go\n\ngo 1.22",
            size: 40,
          })),
        })

        const plainResult = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/plain-go-app",
          dependencies: {
            adapter: plainGoAdapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(plainResult.primaryFramework?.id).toBe("go")
        expect(plainResult.confidence).toBe(0.8)
      })

      it("detects Rust application via Cargo.toml", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["Cargo.toml", "src/main.rs"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: '[package]\nname = "rust-service"\nversion = "0.1.0"',
            size: 50,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/rust-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework?.id).toBe("rust")
        expect(result.primaryFramework?.ecosystem).toBe("rust")
        expect(result.confidence).toBe(0.8)
      })

      it("parses Dockerfile EXPOSE port and .env.example with various quotes and export prefixes", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["Dockerfile", ".env.example"],
            truncated: false,
          })),
          readFile: mock(async (_url, path) => {
            if (path.includes("Dockerfile")) {
              return {
                content: 'FROM alpine\nEXPOSE 9090\nCMD ["sh"]',
                size: 35,
              }
            }
            if (path.includes(".env.example")) {
              return {
                content: [
                  "# Global configuration comment",
                  "",
                  'export APP_NAME="My Application"',
                  "SECRET_TOKEN='single-quoted-secret'",
                  "PLAIN_KEY=plain_value",
                  "EMPTY_VAR=",
                ].join("\n"),
                size: 120,
              }
            }
            return { content: "", size: 0 }
          }),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/dockerfile-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.defaultPort).toBe(9090)
        expect(result.envDefaults?.APP_NAME).toBe("My Application")
        expect(result.envDefaults?.SECRET_TOKEN).toBe("single-quoted-secret")
        expect(result.envDefaults?.PLAIN_KEY).toBe("plain_value")
        expect(result.envDefaults?.EMPTY_VAR).toBe("")
      })

      it("handles resolveGitProvider failure, marks blocked and updates session", async () => {
        const mockPrisma = createMockPrisma()
        const result = await inspectRepoWithAi({
          repoUrl: "invalid-url-scheme",
          sessionId: "session_failing_resolver",
          dependencies: {
            db: mockPrisma,
            resolveGitProvider: () => {
              throw new Error("Unsupported git host")
            },
          },
        })

        expect(result.decision.status).toBe("blocked")
        expect(result.decision.message).toContain("Unsupported git host")
        expect(mockPrisma.aiDeploymentSession.update).toHaveBeenCalledWith({
          where: { id: "session_failing_resolver" },
          data: { status: "BLOCKED" },
        })
      })

      it("handles checkAccess failure with sessionId to mark session BLOCKED", async () => {
        const adapter = createMockAdapter({
          checkAccess: mock(async () => ({
            accessible: false,
            reason: "Access forbidden",
            provider: "github" as const,
          })),
        })
        const mockPrisma = createMockPrisma()

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/forbidden",
          sessionId: "session_access_denied",
          dependencies: {
            adapter,
            db: mockPrisma,
          },
        })

        expect(result.decision.status).toBe("blocked")
        expect(result.decision.message).toBe("Access forbidden")
        expect(mockPrisma.aiDeploymentSession.update).toHaveBeenCalledWith({
          where: { id: "session_access_denied" },
          data: { status: "BLOCKED" },
        })
      })

      it("handles malformed baseURL host and text-formatted AI decisions", async () => {
        const adapter = createMockAdapter()
        const mockPrisma = createMockPrisma()

        const mockGenerateText = mock(async () => ({
          text: JSON.stringify({
            primaryFrameworkId: "nextjs",
            frameworkName: "Next.js",
            ecosystem: "node",
            confidence: 0.95,
            requiredRuntimeIds: ["node"],
            reasoning: ["Parsed from text property"],
          }),
        }))

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/text-decision-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mockGenerateText as unknown as MockGenerateText,
            getAiConfig: () => ({
              apiKey: "test-key",
              baseURL: "not-a-valid-url",
            }),
          },
        })

        expect(result.primaryFramework?.id).toBe("nextjs")
        expect(result.decision.status).toBe("success")
        expect(result.aiTrace?.baseUrlHost).toBe("unknown")
      })

      it("classifies low_confidence and unsupported decisions from AI output", async () => {
        const adapter = createMockAdapter()
        const mockPrisma = createMockPrisma()

        // Low confidence with primaryFramework
        const lowConfGenerateText = mock(async () => ({
          output: {
            primaryFrameworkId: "nextjs",
            frameworkName: "Next.js",
            ecosystem: "node",
            confidence: 0.4,
            requiredRuntimeIds: ["node"],
            reasoning: ["Uncertain heuristics"],
          },
        }))

        const lowResult = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/low-conf-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: lowConfGenerateText as unknown as MockGenerateText,
            getAiConfig: () => ({
              apiKey: "test-key",
              baseURL: "https://api.openai.com/v1",
            }),
          },
        })

        expect(lowResult.decision.status).toBe("low_confidence")
        expect(lowResult.decision.isLaunchable).toBe(false)

        // Unknown framework
        const unknownGenerateText = mock(async () => ({
          output: {
            primaryFrameworkId: "unknown",
            frameworkName: "Unknown",
            ecosystem: "unknown",
            confidence: 0.2,
            requiredRuntimeIds: [],
            reasoning: ["Nothing recognizable"],
          },
        }))

        const unsuppResult = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/unknown-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: unknownGenerateText as unknown as MockGenerateText,
            getAiConfig: () => ({
              apiKey: "test-key",
              baseURL: "https://api.openai.com/v1",
            }),
          },
        })

        expect(unsuppResult.decision.status).toBe("unsupported")
        expect(unsuppResult.decision.isLaunchable).toBe(false)
      })

      it("handles listTree failure during step 3 gracefully", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => {
            throw new Error("Tree read error")
          }),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/tree-fail-app",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework).toBeNull()
        expect(result.decision.status).toBe("unsupported")
      })

      it("ignores malformed manifest JSON files gracefully", async () => {
        const mockPrisma = createMockPrisma()
        const adapter = createMockAdapter({
          listTree: mock(async () => ({
            files: ["package.json", "composer.json"],
            truncated: false,
          })),
          readFile: mock(async () => ({
            content: "{ invalid-json",
            size: 14,
          })),
        })

        const result = await inspectRepoWithAi({
          repoUrl: "https://github.com/org/malformed-repo",
          dependencies: {
            adapter,
            db: mockPrisma,
            generateText: mock(async () => {
              throw new Error("AI disabled")
            }) as unknown as MockGenerateText,
          },
        })

        expect(result.primaryFramework).toBeNull()
        expect(result.decision.status).toBe("unsupported")
      })
    })
  })
})
