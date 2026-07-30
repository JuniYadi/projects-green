const runGit = (args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], {
    stdout: "pipe",
    stderr: "ignore",
  })

  if (result.exitCode !== 0) {
    return []
  }

  return result.stdout
    .toString()
    .split("\n")
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(Boolean)
}

const resolveBase = () => {
  for (const ref of ["origin/main", "main"]) {
    const result = Bun.spawnSync(["git", "rev-parse", "--verify", ref], {
      stderr: "ignore",
    })
    if (result.exitCode === 0) {
      return ref
    }
  }

  return null
}

export const collectChangedFiles = () => {
  const files = new Set<string>()
  const base = resolveBase()

  if (base) {
    for (const path of runGit(["diff", "--name-only", `${base}...HEAD`])) {
      files.add(path)
    }
  }

  for (const args of [
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    for (const path of runGit(args)) {
      files.add(path)
    }
  }

  return [...files].sort()
}
