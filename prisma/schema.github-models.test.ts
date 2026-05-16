import { describe, expect, it } from "bun:test"

describe("github prisma models", () => {
  it("defines installation, repository connection, and webhook event models", async () => {
    const schema = await Bun.file("prisma/schema.prisma").text()

    expect(schema).toContain("model GithubInstallation {")
    expect(schema).toContain("githubInstallationId BigInt   @unique")
    expect(schema).toContain("@@index([workosUserId])")
    expect(schema).toContain("@@index([organizationId])")

    expect(schema).toContain("model GithubRepositoryConnection {")
    expect(schema).toContain("branchFilters      String[] @default([\"main\"])")
    expect(schema).toContain(
      "@@unique([githubRepositoryId, installationId])"
    )
    expect(schema).toContain(
      "@relation(fields: [installationId], references: [id], onDelete: Cascade)"
    )

    expect(schema).toContain("model GithubWebhookEvent {")
    expect(schema).toContain("deliveryId           String   @unique")
    expect(schema).toContain("processStatus        String   @default(\"pending\")")
    expect(schema).toContain("@@index([processStatus])")
  })
})
