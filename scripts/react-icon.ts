import * as Si from "react-icons/si"

const query = process.argv[2]?.toLowerCase()
if (!query) {
  console.log("Usage: bun run scripts/react-icon.ts <search-query>")
  process.exit(1)
}

const keys = Object.keys(Si)
const matched = keys.filter((key) => key.toLowerCase().includes(query))

console.log(`Found ${matched.length} icons matching "${query}":`)
matched.forEach((name) => {
  console.log(`- ${name}`)
})
