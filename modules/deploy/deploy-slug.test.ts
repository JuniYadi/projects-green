import { describe, expect, it } from "bun:test"
import {
  slugify,
  resolveUniqueStackSlug,
  type StackSlugPrisma,
} from "./deploy-slug"

describe("deploy-slug", () => {
  describe("slugify", () => {
    it("converts standard names to clean lowercase hyphenated strings", () => {
      expect(slugify("My Cool App")).toBe("my-cool-app")
      expect(slugify("HELLO_WORLD_2026")).toBe("hello-world-2026")
      expect(slugify("already-valid-slug")).toBe("already-valid-slug")
    })

    it("prefixes leading numbers with app- for RFC 1035 compliance", () => {
      expect(slugify("9router")).toBe("app-9router")
      expect(slugify("9router-test")).toBe("app-9router-test")
      expect(slugify("12345")).toBe("app-12345")
    })

    it("does not add double app- prefix if already starts with app-", () => {
      expect(slugify("app-9router-test")).toBe("app-9router-test")
    })

    it("trims hyphens from beginning and end and collapses duplicates", () => {
      expect(slugify("---hello---world---")).toBe("hello-world")
      expect(slugify("---")).toBe("app")
      expect(slugify("")).toBe("app")
    })

    it("clamps length to maximum 63 characters", () => {
      const veryLong = "a".repeat(100)
      const slug = slugify(veryLong)
      expect(slug.length).toBe(63)
      expect(slug).toBe("a".repeat(63))
    })

    it("removes trailing hyphens when clamped to 63 chars", () => {
      const input = "a".repeat(62) + "-something"
      const slug = slugify(input)
      expect(slug.length).toBeLessThanOrEqual(63)
      expect(slug.endsWith("-")).toBe(false)
    })
  })

  describe("resolveUniqueStackSlug", () => {
    const createMockDb = (existingSlugs: string[] = []): StackSlugPrisma => {
      const set = new Set(existingSlugs)
      return {
        applicationStack: {
          findUnique: async ({ where }) => {
            const key = where.organizationId_slug.slug
            if (set.has(key)) {
              return { id: `id-${key}`, slug: key }
            }
            return null
          },
        },
      }
    }

    it("returns the base slug directly when no conflict exists", async () => {
      const db = createMockDb(["other-app"])
      const slug = await resolveUniqueStackSlug(db, "org-1", "my-app")
      expect(slug).toBe("my-app")
    })

    it("prefixes leading numbers with app- on first resolution", async () => {
      const db = createMockDb([])
      const slug = await resolveUniqueStackSlug(db, "org-1", "9router-test")
      expect(slug).toBe("app-9router-test")
    })

    it("increments numeric suffix when slug collision occurs", async () => {
      const db = createMockDb(["app-9router-test", "app-9router-test-2"])
      const slug = await resolveUniqueStackSlug(db, "org-1", "9router-test")
      expect(slug).toBe("app-9router-test-3")
    })

    it("handles collision between 9router-test and app-9router-test", async () => {
      // First app created: "9router-test" -> "app-9router-test"
      const db = createMockDb(["app-9router-test"])
      // Second app created with name: "app-9router-test"
      const slug = await resolveUniqueStackSlug(db, "org-1", "app-9router-test")
      expect(slug).toBe("app-9router-test-2")
    })

    it("allows the same slug if excludeStackId matches", async () => {
      const db: StackSlugPrisma = {
        applicationStack: {
          findUnique: async ({ where }) => {
            if (where.organizationId_slug.slug === "my-app") {
              return { id: "current-stack-id", slug: "my-app" }
            }
            return null
          },
        },
      }
      const slug = await resolveUniqueStackSlug(
        db,
        "org-1",
        "my-app",
        "current-stack-id"
      )
      expect(slug).toBe("my-app")
    })

    it("ensures long slugs with suffixes do not exceed 63 characters", async () => {
      const longBase = "a".repeat(60)
      const db = createMockDb([slugify(longBase)])
      const slug = await resolveUniqueStackSlug(db, "org-1", longBase)
      expect(slug.length).toBeLessThanOrEqual(63)
      expect(slug.endsWith("-2")).toBe(true)
    })

    it("handles mock returning mismatched slug safely without looping", async () => {
      const db: StackSlugPrisma = {
        applicationStack: {
          findUnique: async () => ({
            id: "generic-stack",
            slug: "unrelated-slug",
          }),
        },
      }
      const slug = await resolveUniqueStackSlug(db, "org-1", "target-app")
      expect(slug).toBe("target-app")
    })
  })
})
