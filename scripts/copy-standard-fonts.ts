import fs from "node:fs"
import path from "node:path"

const sourceDir = path.resolve(
  process.cwd(),
  "node_modules/pdfkit/js/standard-fonts"
)
const targetDir = path.resolve(process.cwd(), "standard-fonts")

if (fs.existsSync(sourceDir)) {
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}
