import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test"
import { generateKeyPairSync } from "node:crypto"

const mockRedisGet = mock(async () => null as string | null)
const mockRedisSet = mock(async () => "OK")
const mockFetch = mock<typeof fetch>()

mock.module("@/lib/redis", () => ({
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
}))

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const validPrivateKeyBase64 = Buffer.from(
  privateKey.export({ type: "pkcs1", format: "pem" })
).toString("base64")

const originalFetch = global.fetch
const originalGithubAppId = process.env.GITHUB_APP_ID
const originalGithubAppPrivateKeyBase64 =
  process.env.GITHUB_APP_PRIVATE_KEY_BASE64
const originalAppSecret = process.env.APP_SECRET

const {
  listRepoFiles,
  readRepoFile,
} = await import("@/modules/github/github.service")

describe("GitHub Inspection Tools", () => {
  beforeEach(() => {
    global.fetch = mockFetch
    process.env.GITHUB_APP_ID = "12345"
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = validPrivateKeyBase64
    process.env.APP_SECRET = "test-app-secret"

    mockFetch.mockClear()
    mockRedisGet.mockClear()
    mockRedisSet.mockClear()
    mockRedisGet.mockResolvedValue(null)
    mockRedisSet.mockResolvedValue("OK")
  })

  afterEach(() => {
    global.fetch = originalFetch

    if (originalGithubAppId === undefined) {
      delete process.env.GITHUB_APP_ID
    } else {
      process.env.GITHUB_APP_ID = originalGithubAppId
    }

    if (originalGithubAppPrivateKeyBase64 === undefined) {
      delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64
    } else {
      process.env.GITHUB_APP_PRIVATE_KEY_BASE64 =
        originalGithubAppPrivateKeyBase64
    }

    if (originalAppSecret === undefined) {
      delete process.env.APP_SECRET
    } else {
      process.env.APP_SECRET = originalAppSecret
    }
  })

  it("lists repository files with a path prefix filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_mock_token_12345" }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "commit-sha" } }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          {
            path: "src/index.ts",
            mode: "100644",
            type: "blob",
            sha: "sha-1",
            url: "https://api.github.com/blob/1",
          },
          {
            path: "src/utils/math.ts",
            mode: "100644",
            type: "blob",
            sha: "sha-2",
            url: "https://api.github.com/blob/2",
          },
          {
            path: "README.md",
            mode: "100644",
            type: "blob",
            sha: "sha-3",
            url: "https://api.github.com/blob/3",
          },
        ],
        truncated: false,
      }),
    } as Response)

    const result = await listRepoFiles({
      installationId: 99999,
      owner: "test-org",
      repo: "test-repo",
      path: "src",
    })

    expect(result).toEqual({
      files: ["index.ts", "utils/math.ts"],
      truncated: false,
    })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockRedisGet).toHaveBeenCalledTimes(1)
    expect(mockRedisSet).toHaveBeenCalledTimes(1)
  })

  it("reads and decodes a repository file", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_mock_token_12345" }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "package.json",
        path: "package.json",
        content: Buffer.from('{"name":"demo"}').toString("base64"),
        encoding: "base64",
        sha: "file-sha",
        size: 15,
        url: "https://api.github.com/file/1",
      }),
    } as Response)

    const result = await readRepoFile({
      installationId: 99999,
      owner: "test-org",
      repo: "test-repo",
      filePath: "package.json",
    })

    expect(result).toEqual({
      content: '{"name":"demo"}',
      path: "package.json",
      sha: "file-sha",
      size: 15,
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockRedisGet).toHaveBeenCalledTimes(1)
    expect(mockRedisSet).toHaveBeenCalledTimes(1)
  })
})

describe("GitHub Service Types", () => {
  it("exports expected functions", async () => {
    const mod = await import("@/modules/github/github.service")
    expect(typeof mod.listRepoFiles).toBe("function")
    expect(typeof mod.readRepoFile).toBe("function")
  })
})
