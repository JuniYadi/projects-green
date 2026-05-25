import type {
  TestingLibraryMatchers,
} from "@testing-library/jest-dom/matchers"

declare module "bun:test" {
  interface Matchers<T>
    extends TestingLibraryMatchers<HTMLElement, ReturnType<T>> {}
}