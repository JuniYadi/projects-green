import { describe, expect, it, mock } from "bun:test"
import { AppTemplateSeeder } from "./app-template.seeder"

describe("AppTemplateSeeder", () => {
  it("has correct configuration", () => {
    expect(AppTemplateSeeder.seederName).toBe("AppTemplates")
    expect(AppTemplateSeeder.classification).toBe("system")
    expect(AppTemplateSeeder.runOrder).toBe(25)
  })

  it("seeds official templates into prisma", async () => {
    const seeder = new AppTemplateSeeder()
    const mockUpsert = mock(async () => ({}))
    const mockPrisma = {
      appTemplate: {
        upsert: mockUpsert,
        deleteMany: mock(async () => ({ count: 5 })),
      },
    }
    // @ts-expect-error test mock
    seeder.prisma = mockPrisma

    await seeder.seed()
    expect(mockUpsert).toHaveBeenCalled()

    await seeder.unseed()
  })
})
