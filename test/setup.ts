import "@/test/register"
import React from "react"
import { afterEach, expect, mock } from "bun:test"
import { cleanup } from "@testing-library/react"
import * as matchers from "@testing-library/jest-dom/matchers"

mock.module("react-icons/si", () => {
  const React = require("react")
  const createMock = (name: string) => (props: any) =>
    React.createElement(
      "div",
      { ...props, "data-testid": `si-${name.toLowerCase()}` },
      `${name} Icon`
    )

  return {
    SiWordpress: createMock("SiWordpress"),
    SiN8N: createMock("SiN8N"),
    SiDocker: createMock("SiDocker"),
    SiGhost: createMock("SiGhost"),
    SiStrapi: createMock("SiStrapi"),
    SiDirectus: createMock("SiDirectus"),
    SiPayloadcms: createMock("SiPayloadcms"),
    SiPocketbase: createMock("SiPocketbase"),
    SiUmami: createMock("SiUmami"),
    SiPlausibleanalytics: createMock("SiPlausibleanalytics"),
  }
})

mock.module("next/navigation", () => {
  const { mock } = require("bun:test")

  const routerMock = {
    push: mock(),
    replace: mock(),
    prefetch: mock(),
    back: mock(),
    refresh: mock(),
    forward: mock(),
  }

  return {
    useRouter: mock(() => routerMock),
    usePathname: mock(() => ""),
    useSearchParams: mock(() => new URLSearchParams()),
    useParams: mock(() => ({})),
    redirect: mock(),
    notFound: mock(),
  }
})

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
