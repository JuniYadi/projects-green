import "@testing-library/jest-dom"
import "@testing-library/jest-dom/matchers"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
import { mock } from "bun:test"
mock.module("server-only", () => ({}))
