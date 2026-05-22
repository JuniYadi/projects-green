import { afterEach, expect, mock } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { cleanup } from "@testing-library/react"
import * as matchers from "@testing-library/jest-dom/matchers"

GlobalRegistrator.register()
expect.extend(matchers)

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Mock Prisma client globally to prevent DATABASE_URL errors in tests
// that rely on the real prisma module being mocked in their test file.
// This ensures prisma is never instantiated with a real connection.
mock.module("@/lib/prisma", () => ({
  prisma: {
    $connect: mock.fn(),
    $disconnect: mock.fn(),
  },
}))

afterEach(() => {
  cleanup()
})
