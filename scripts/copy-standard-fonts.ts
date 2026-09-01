import fs from "node:fs"
import path from "node:path"

const nodeModulesDir = path.resolve(process.cwd(), "node_modules")
const targetDir = path.resolve(process.cwd(), "standard-fonts")

const sourceCandidates = [
  path.join(nodeModulesDir, "pdfkit", "js", "standard-fonts"),
  path.join(nodeModulesDir, "@react-pdf", "pdfkit", "js", "standard-fonts"),
  path.join(
    nodeModulesDir,
    "@react-pdf",
    "font",
    "node_modules",
    "pdfkit",
    "js",
    "standard-fonts"
  ),
]

let sourceDir: string | undefined

for (const candidate of sourceCandidates) {
  try {
    if (
      fs.statSync(candidate).isDirectory() &&
      fs.statSync(path.join(candidate, "Helvetica.cjs")).isFile()
    ) {
      sourceDir = candidate
      break
    }
  } catch {
    // Try the next supported package resolution.
  }
}

if (!sourceDir) {
  throw new Error(
    `Unable to find pdfkit standard fonts. Checked:\n${sourceCandidates.join("\n")}`
  )
}

try {
  fs.cpSync(sourceDir, targetDir, { recursive: true })
} catch (error) {
  throw new Error(
    `Unable to copy pdfkit standard fonts from ${sourceDir} to ${targetDir}`,
    { cause: error }
  )
}

try {
  if (
    !fs.statSync(targetDir).isDirectory() ||
    !fs.statSync(path.join(targetDir, "Helvetica.cjs")).isFile()
  ) {
    throw new Error("required Helvetica.cjs is missing")
  }
} catch (error) {
  throw new Error(
    `Copied pdfkit standard fonts are incomplete at ${targetDir}`,
    {
      cause: error,
    }
  )
}
