import { existsSync, readdirSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { collectChangedFiles } from "./changed-files"

export const collectChangedTsFiles = (files?: readonly string[]) => {
  const fileList = files ?? collectChangedFiles()
  return fileList
    .map((file) => file.replaceAll("\\", "/"))
    .filter(
      (file) =>
        /\.(?:ts|tsx)$/.test(file) &&
        !file.endsWith(".d.ts") &&
        existsSync(file)
    )
}

export const runTypecheckChanged = (files?: readonly string[]) => {
  const tsFiles = collectChangedTsFiles(files)

  if (tsFiles.length === 0) {
    console.log("typecheck:changed: no TypeScript files changed")
    return 0
  }

  console.log(
    `typecheck:changed: checking ${tsFiles.length} changed TypeScript file${
      tsFiles.length === 1 ? "" : "s"
    }...`
  )

  const tempConfigPath = resolve(
    process.cwd(),
    `.tsconfig.typecheck-changed.${Date.now()}-${process.pid}.json`
  )

  const typeDeclarationFiles = existsSync("types")
    ? readdirSync("types")
        .filter((file) => file.endsWith(".d.ts"))
        .map((file) => `types/${file}`)
    : []

  const tempConfig = {
    extends: "./tsconfig.json",
    compilerOptions: {
      incremental: false,
    },
    files: [
      ...(existsSync("next-env.d.ts") ? ["next-env.d.ts"] : []),
      ...typeDeclarationFiles,
      ...tsFiles,
    ],
    include: [],
  }

  try {
    writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2), "utf-8")
    const result = Bun.spawnSync(
      ["bunx", "tsc", "--project", tempConfigPath, "--noEmit"],
      {
        stdout: "inherit",
        stderr: "inherit",
      }
    )
    return result.exitCode ?? 0
  } finally {
    if (existsSync(tempConfigPath)) {
      try {
        unlinkSync(tempConfigPath)
      } catch {
        // ignore error during cleanup
      }
    }
  }
}

if (import.meta.main) {
  const exitCode = runTypecheckChanged()
  process.exit(exitCode)
}
