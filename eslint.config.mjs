import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable broken rule — chokes on route group dirs like `(home)`, see eslint-config-next#103
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "graphify-out/**",
    "standard-fonts/**",
    // Test files - lower strictness
    "test/**",
    "e2e/**",
    // Ignore worktrees
    ".claude/worktrees/**",
    ".crew/worktrees/**",
    ".worktrees/**",
    "coverage/**",
  ]),
  // Allow intentional underscore-prefixed unused vars/args (tests, route handlers)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Route-group dirs with parens crash no-html-link-for-pages regex
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
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
  // Ban raw fetch() — use eden (lib/eden.ts) for type-safe API calls
  {
    files: [
      "app/**/*.ts",
      "app/**/*.tsx",
      "app/**/*/page.ts",
      "app/**/*/page.tsx",
      "app/**/*/*.ts",
      "app/**/*/*.tsx",
      "app/**/*/*/*.ts",
      "app/**/*/*/*.tsx",
      "components/**/*.ts",
      "components/**/*.tsx",
      "hooks/**/*.ts",
      "hooks/**/*.tsx",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use `eden` from '@/lib/eden' instead of raw fetch(). Eden provides type-safe API calls with compile-time validation.",
        },
      ],
    },
  },
  // UI components with hydration pattern
  {
    files: ["components/nav-user.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Deploy module — Prisma enum workarounds in source + bun mock any in tests
  {
    files: ["modules/deploy/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // VPN admin module tests - prisma mocks require any
  {
    files: ["modules/vpn/admin/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Email service module tests - next module variable assignment
  {
    files: ["modules/invoices/email.service.test.ts", "modules/support-tickets/email.service.test.ts"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
  // Scripts and CLI tooling - allow console logging and script utility patterns
  {
    files: ["scripts/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
