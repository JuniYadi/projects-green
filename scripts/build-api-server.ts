import { resolve } from "node:path"

const result = await Bun.build({
  entrypoints: ["./scripts/api-server.ts"],
  outdir: "./dist",
  target: "bun",
  naming: "api-server.js",
  plugins: [
    {
      name: "server-only-shim",
      setup(build) {
        // server-only throws when imported outside React Server Components.
        // In a standalone Bun backend, we resolve it to its official empty.js stub.
        build.onResolve({ filter: /^server-only$/ }, () => {
          return { path: resolve("./node_modules/server-only/empty.js") }
        })
      },
    },
  ],
  external: ["@prisma/client", "@prisma/adapter-pg", "pg", "ssh2"],
})

if (!result.success) {
  console.error("Build failed:", result.logs)
  process.exit(1)
}

console.log("✓ Built dist/api-server.js successfully")
