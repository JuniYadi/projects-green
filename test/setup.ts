import { afterEach, expect } from "bun:test"
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

// Note: Prisma mocking is done in individual test files using mock.module()
// to avoid module evaluation order issues with DATABASE_URL check

afterEach(() => {
  cleanup()
})
