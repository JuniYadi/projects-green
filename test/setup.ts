import "@/test/register"
import React from "react"
import { afterEach, expect, mock } from "bun:test"
import { cleanup } from "@testing-library/react"
import * as matchers from "@testing-library/jest-dom/matchers"

mock.module("react-icons/si", () => {
  return {
    SiWordpress: (props: any) =>
      React.createElement("div", { ...props, "data-testid": "si-wordpress" }, "WordPress Icon"),
    SiN8N: (props: any) =>
      React.createElement("div", { ...props, "data-testid": "si-n8n" }, "n8n Icon"),
    SiDocker: (props: any) =>
      React.createElement("div", { ...props, "data-testid": "si-docker" }, "Docker Icon"),
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