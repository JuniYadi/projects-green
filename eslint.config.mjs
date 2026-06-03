import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test files - lower strictness
    "test/**",
    // Ignore worktrees
    ".claude/worktrees/**",
    ".worktrees/**",
  ]),
  // Relaxed rules for test files
  {
    files: ["test/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  // WhatsApp modules - use consistent pattern with Elysia guards that require any
  {
    files: ["modules/whatsapp/**/*.ts", "lib/whatsapp/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // lib API files - use any for request handlers
  {
    files: ["lib/api/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-assign-module-variable": "off",
    },
  },
  // UI components with hydration pattern
  {
    files: ["components/nav-user.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Email service test files use module.exports pattern
  {
    files: ["modules/invoices/email.service.test.ts", "modules/support-tickets/email.service.test.ts"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
]);

export default eslintConfig;
