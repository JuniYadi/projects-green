import "@/test/register"
import React from "react"
import { afterEach, expect, mock } from "bun:test"
import { cleanup } from "@testing-library/react"
import * as matchers from "@testing-library/jest-dom/matchers"

mock.module("react-icons/si", () => {
  const React = require("react")
  const icons = [
    "SiWordpress",
    "SiN8N",
    "SiDocker",
    "SiGhost",
    "SiStrapi",
    "SiDirectus",
    "SiPayloadcms",
    "SiPocketbase",
    "SiUmami",
    "SiPlausibleanalytics",
  ]
  const mockIcons: any = {}
  icons.forEach((icon) => {
    mockIcons[icon] = (props: any) =>
      React.createElement("div", { ...props, "data-testid": `si-${icon.toLowerCase()}` }, `${icon} Icon`)
  })
  return mockIcons
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