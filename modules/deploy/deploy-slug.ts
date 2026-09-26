export type StackSlugPrisma = {
  applicationStack: {
    findUnique: (args: {
      where: {
        organizationId_slug: {
          organizationId: string
          slug: string
        }
      }
      select?: { id: true; slug?: true }
    }) => Promise<{ id: string; slug?: string } | null>
  }
}

/**
 * Normalizes a candidate name into an RFC 1035 compliant Kubernetes / DNS label.
 *
 * Rules:
 * - lowercase alphanumeric characters or '-'
 * - must start with an alphabetic character ('a'-'z') -> prefixed with "app-" if starting with a digit
 * - must end with an alphanumeric character ('a'-'z', '0'-'9')
 * - maximum 63 characters
 */
export function slugify(value: string): string {
  let slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

  if (!slug) return "app"

  if (/^[0-9]/.test(slug)) {
    slug = `app-${slug}`
  }

  if (slug.length > 63) {
    slug = slug.slice(0, 63).replace(/-+$/, "")
  }

  return slug
}

/**
 * Resolves a unique slug within an organization.
 * If the base slug already exists, appends incrementing numeric suffixes (-2, -3, etc.)
 * while maintaining the RFC 1035 63-character limit.
 */
export async function resolveUniqueStackSlug(
  db: StackSlugPrisma,
  organizationId: string,
  baseName: string,
  excludeStackId?: string
): Promise<string> {
  const baseSlug = slugify(baseName)
  let candidate = baseSlug
  let counter = 1

  while (counter < 100) {
    const existing = await db.applicationStack.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug: candidate,
        },
      },
      select: { id: true, slug: true },
    })

    if (
      !existing ||
      (excludeStackId && existing.id === excludeStackId) ||
      (typeof existing.slug === "string" && existing.slug !== candidate)
    ) {
      return candidate
    }

    counter++
    const suffix = `-${counter}`
    const maxBaseLen = 63 - suffix.length
    const truncatedBase = baseSlug.slice(0, maxBaseLen).replace(/-+$/, "")
    candidate = `${truncatedBase}${suffix}`
  }

  return `${candidate.slice(0, 58)}-${Date.now().toString(36).slice(-4)}`
}
