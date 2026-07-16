// Bootstrap for Bun --preload: resolves test/setup.ts by absolute path
// so --isolate workers don't fail from a different CWD.
await import(import.meta.dir + "/../test/setup.ts")
