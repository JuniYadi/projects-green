/**
 * In-process mutex for serializing owner-affecting membership mutations
 * (delete / demote) per organization.
 *
 * Because memberships live in WorkOS (external API) and not in a local
 * database, we cannot use database transactions or SELECT … FOR UPDATE.
 * Instead we serialize at the application level so two concurrent
 * requests for the same organization cannot both pass the "active owner
 * count > 1" check before either mutation executes.
 *
 * NOTE: This protects a single Node.js process.  If the app is scaled
 * horizontally behind a load-balancer, a distributed lock (e.g. Redis
 * SETNX) would be needed — but for the current single-process
 * deployment this is sufficient.
 */

const locks = new Map<string, Promise<void>>()

/**
 * Acquire a per-organization lock, execute `fn`, then release.
 * Concurrent callers for the *same* `organizationId` will queue.
 */
export async function withOwnershipLock<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for any pending operation on this org to finish
  const pending = locks.get(organizationId) ?? Promise.resolve()

  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  locks.set(organizationId, next)

  try {
    await pending
    return await fn()
  } finally {
    release()
    // Clean up to avoid unbounded memory growth when the queue drains
    if (locks.get(organizationId) === next) {
      locks.delete(organizationId)
    }
  }
}
