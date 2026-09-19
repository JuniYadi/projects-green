import "@testing-library/jest-dom"
import "@testing-library/jest-dom/matchers"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock"
}
if (!process.env.APP_HOSTING_JENKINS_RETRY_DELAY_MS) {
  process.env.APP_HOSTING_JENKINS_RETRY_DELAY_MS = "1"
}

GlobalRegistrator.register()
