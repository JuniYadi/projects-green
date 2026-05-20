import { Elysia } from "elysia"

import { environmentVariablesRoutes } from "@/modules/deploy/api/routes/environment-variables.route"

export const deployRoutes = new Elysia().use(environmentVariablesRoutes)
