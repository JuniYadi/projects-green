import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import ts from "typescript"

const root = process.cwd()
const routeRoot = join(root, "app/[lang]/console/whatsapp")
const moduleRoot = join(root, "modules/whatsapp")
const attributeNames = new Set(["aria-label", "placeholder", "title"])
const excludedFiles = new Set([
  "modules/whatsapp/whatsapp-client.ts",
  "modules/whatsapp/whatsapp-client.tsx",
])

// These are UI-independent values: identifiers, config fragments, or language
// names. They must not become a translation backlog merely because they render.
const technicalTerms = new Set([
  "API",
  "CSV",
  "cURL",
  "Go",
  "GraphQL",
  "HTTP",
  "JSON",
  "Meta",
  "Node.js",
  "PHP",
  "Python",
  "REST",
  "SDK",
  "SQL",
  "URL",
  "WhatsApp",
  "XML",
])

const englishWords = new Set([
  "a",
  "about",
  "access",
  "account",
  "action",
  "actions",
  "add",
  "all",
  "and",
  "any",
  "are",
  "as",
  "at",
  "back",
  "body",
  "by",
  "cancel",
  "choose",
  "clear",
  "click",
  "close",
  "code",
  "column",
  "columns",
  "confirm",
  "contact",
  "contacts",
  "copy",
  "create",
  "current",
  "date",
  "default",
  "delete",
  "delivery",
  "description",
  "details",
  "device",
  "disabled",
  "download",
  "edit",
  "email",
  "enabled",
  "error",
  "event",
  "events",
  "failed",
  "file",
  "filter",
  "first",
  "for",
  "from",
  "group",
  "has",
  "header",
  "help",
  "id",
  "import",
  "in",
  "is",
  "key",
  "last",
  "load",
  "loading",
  "log",
  "logs",
  "message",
  "messages",
  "name",
  "new",
  "no",
  "not",
  "number",
  "of",
  "open",
  "or",
  "page",
  "phone",
  "please",
  "preview",
  "processing",
  "profile",
  "recipient",
  "recipients",
  "refresh",
  "remove",
  "required",
  "retry",
  "save",
  "search",
  "select",
  "send",
  "sent",
  "settings",
  "status",
  "success",
  "template",
  "templates",
  "the",
  "this",
  "to",
  "total",
  "try",
  "unknown",
  "update",
  "upload",
  "usage",
  "use",
  "view",
  "with",
  "you",
  "your",
])

const indonesianWords = new Set([
  "akun",
  "anda",
  "antar",
  "bahasa",
  "baru",
  "batal",
  "belum",
  "buka",
  "cari",
  "catatan",
  "dari",
  "dengan",
  "dikirim",
  "diubah",
  "dipilih",
  "diperbarui",
  "gagal",
  "ke",
  "kesalahan",
  "kirim",
  "memilih",
  "memuat",
  "nama",
  "nomor",
  "pada",
  "penerima",
  "perangkat",
  "pesan",
  "pilih",
  "saat",
  "sebagai",
  "selesai",
  "semua",
  "siaran",
  "status",
  "tersedia",
  "tidak",
  "untuk",
  "unggah",
  "yang",
])

type Category =
  | "product_static_english"
  | "already_indonesian"
  | "sample_data"
  | "url_or_code"
  | "punctuation_or_format"
  | "technical_term"
  | "non_english_or_proper_name"

type Candidate = {
  file: string
  line: number
  value: string
  category: Category
  reason: string
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : []
  })

const resolveImport = (sourceFile: string, specifier: string) => {
  const base = specifier.startsWith("@/")
    ? join(root, specifier.slice(2))
    : resolve(sourceFile, "..", specifier)
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile()
    } catch {
      return false
    }
  })
}

const collectRenderedDependencies = () => {
  const queue = walk(routeRoot)
  const collected = new Set(queue)

  while (queue.length > 0) {
    const path = queue.shift()
    if (!path) continue
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )

    source.forEachChild((node) => {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier)
      ) {
        return
      }
      const imported = resolveImport(path, node.moduleSpecifier.text)
      if (
        !imported ||
        !imported.startsWith(moduleRoot) ||
        !imported.endsWith(".tsx")
      ) {
        return
      }
      if (!collected.has(imported)) {
        collected.add(imported)
        queue.push(imported)
      }
    })
  }

  return [...collected].filter(
    (path) => !excludedFiles.has(relative(root, path))
  )
}

const words = (value: string) =>
  value.toLowerCase().match(/[a-z]+(?:\.[a-z]+)?/g) ?? []

const classify = (value: string): Pick<Candidate, "category" | "reason"> => {
  const trimmed = value.trim()
  const valueWords = words(trimmed)

  if (
    /^[+]?\d[\d()\s.-]*$/.test(trimmed) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  ) {
    return { category: "sample_data", reason: "Sample phone or email value." }
  }
  if (
    /^(https?:\/\/|www\.)/i.test(trimmed) ||
    /[{};]|=>|\b(?:const|import|return)\b/.test(trimmed)
  ) {
    return {
      category: "url_or_code",
      reason: "URL, payload, or code fragment.",
    }
  }
  if (
    !/[\p{L}]/u.test(trimmed) ||
    /^[\d\s.,:/%+*()\[\]{}|—–…-]+$/u.test(trimmed)
  ) {
    return {
      category: "punctuation_or_format",
      reason: "Punctuation, counter, or format value.",
    }
  }
  if (
    technicalTerms.has(trimmed) ||
    (valueWords.length > 0 &&
      valueWords.every((word) => technicalTerms.has(word)))
  ) {
    return {
      category: "technical_term",
      reason: "Technical product or language name.",
    }
  }
  if (valueWords.some((word) => indonesianWords.has(word))) {
    return {
      category: "already_indonesian",
      reason: "Already Indonesian UI copy.",
    }
  }
  if (valueWords.some((word) => englishWords.has(word))) {
    return {
      category: "product_static_english",
      reason: "Product-controlled English UI copy.",
    }
  }
  return {
    category: "non_english_or_proper_name",
    reason: "Non-English copy or proper name.",
  }
}

const candidates = collectRenderedDependencies().flatMap((path) => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const text: Candidate[] = []
  const add = (node: ts.Node, value: string) => {
    const classification = classify(value)
    text.push({
      file: relative(root, path),
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      value: value.trim(),
      ...classification,
    })
  }
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && node.text.trim()) add(node, node.text)
    if (
      ts.isJsxAttribute(node) &&
      attributeNames.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      add(node, node.initializer.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return text
})

const categoryCounts = Object.fromEntries(
  (
    [
      "product_static_english",
      "already_indonesian",
      "sample_data",
      "url_or_code",
      "punctuation_or_format",
      "technical_term",
      "non_english_or_proper_name",
    ] as Category[]
  ).map((category) => [
    category,
    candidates.filter((candidate) => candidate.category === category).length,
  ])
)

console.log(
  JSON.stringify(
    {
      scope:
        "Console WhatsApp route TSX files plus recursively imported modules/whatsapp TSX UI dependencies.",
      extraction:
        "Rendered JSX text and aria-label, placeholder, and title string attributes. Tests and non-React implementation files are excluded.",
      classification: {
        product_static_english:
          "Only product-controlled English UI copy requiring typed catalog extraction; this is the completion gate.",
        already_indonesian:
          "Indonesian UI copy retained as localized copy, not an extraction candidate.",
        sample_data: "Phone numbers and email values.",
        url_or_code: "URLs, raw payloads, configuration, and code fragments.",
        punctuation_or_format:
          "Punctuation, emojis, counters, and format-only values.",
        technical_term:
          "Technical language, tool, and product names whose translation is not an Indonesian UI improvement.",
        non_english_or_proper_name:
          "Provider/user content, proper names, or copy outside the English-to-Indonesian catalog scope.",
      },
      excluded_files: [...excludedFiles],
      category_counts: categoryCounts,
      remaining_product_static: categoryCounts.product_static_english,
      candidates,
    },
    null,
    2
  )
)
