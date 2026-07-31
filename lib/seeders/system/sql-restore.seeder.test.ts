import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test"

const spawnCalls: string[][] = []
let spawnExitCode = 0
let spawnStderr = ""

const executeRawUnsafe = mock(async () => 0)
mock.module("@/lib/prisma", () => ({
  prisma: { $executeRawUnsafe: executeRawUnsafe },
}))
mock.module("@/prisma/seeds/manifest", () => ({
  SEED_TABLES: ["parents", "children"],
}))
mock.module("node:fs", () => ({
  existsSync: () => true,
  readFileSync: (filePath: string) =>
    `${filePath}\nINSERT INTO seed_data VALUES (1);\n`,
}))

const originalSpawn = Bun.spawn
Bun.spawn = mock((args: string[]) => {
  spawnCalls.push(args)
  return {
    exited: Promise.resolve(spawnExitCode),
    stderr: new Response(spawnStderr).body,
  } as never
}) as unknown as typeof Bun.spawn

const { SqlRestoreSeeder } = await import("./sql-restore.seeder")
const originalDatabaseUrl = process.env.DATABASE_URL

beforeEach(() => {
  executeRawUnsafe.mockClear()
  spawnCalls.length = 0
  spawnExitCode = 0
  spawnStderr = ""
  process.env.DATABASE_URL = "postgresql://localhost/test"
})

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
})

describe("SqlRestoreSeeder", () => {
  it("restores dump files with psql in manifest order", async () => {
    await new SqlRestoreSeeder().seed()
    expect(spawnCalls).toEqual([
      [
        "psql",
        "postgresql://localhost/test",
        "--file",
        `${process.cwd()}/prisma/seeds/parents.sql`,
        "--set",
        "ON_ERROR_STOP=1",
        "--single-transaction",
      ],
      [
        "psql",
        "postgresql://localhost/test",
        "--file",
        `${process.cwd()}/prisma/seeds/children.sql`,
        "--set",
        "ON_ERROR_STOP=1",
        "--single-transaction",
      ],
    ])
  })
  it("strips schema param for psql while preserving other params", async () => {
    process.env.DATABASE_URL =
      "postgresql://localhost/test?schema=public&application_name=seed-restore"
    await new SqlRestoreSeeder().seed()
    expect(spawnCalls).toEqual([
      [
        "psql",
        "postgresql://localhost/test?application_name=seed-restore",
        "--file",
        `${process.cwd()}/prisma/seeds/parents.sql`,
        "--set",
        "ON_ERROR_STOP=1",
        "--single-transaction",
      ],
      [
        "psql",
        "postgresql://localhost/test?application_name=seed-restore",
        "--file",
        `${process.cwd()}/prisma/seeds/children.sql`,
        "--set",
        "ON_ERROR_STOP=1",
        "--single-transaction",
      ],
    ])
  })
  it("tracks psql failures", async () => {
    spawnExitCode = 1
    spawnStderr = "restore failed"

    const seeder = new SqlRestoreSeeder()
    await seeder.seed()

    expect(seeder.getResult().errors).toEqual([
      "parents: restore failed",
      "children: restore failed",
    ])
  })

  it("reports missing DATABASE_URL without spawning psql", async () => {
    delete process.env.DATABASE_URL

    const seeder = new SqlRestoreSeeder()
    await seeder.seed()

    expect(spawnCalls).toEqual([])
    expect(seeder.getResult().errors).toEqual([
      "DATABASE_URL is required for SQL restore",
    ])
  })
})

afterAll(() => {
  Bun.spawn = originalSpawn
})
