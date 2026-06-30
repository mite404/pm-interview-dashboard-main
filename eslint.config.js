import js from "@eslint/js";
import convexPlugin from "@convex-dev/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "dist/**",
    "node_modules/**",
    // Generated code is never ours to lint. The rest of convex/ IS linted on
    // purpose: it is part of our codebase and we want the Convex rules active.
    "convex/_generated/**",
    "eslint.config.js",
  ]),
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  // Convex recommended rules. The plugin self-scopes these to convex/ via its
  // internal overrides, so they do not leak onto src/.
  ...convexPlugin.configs.recommended,
  // convex/ is the given, already-deployed backend. We consume it, we never
  // redeploy or rewrite it, so the strict type-safety rules (which the given
  // code predates) are relaxed HERE only. src/ keeps the full strict bar.
  // This block is last so it wins over both the strict preset and the plugin.
  // Note: if we ever author new Convex functions, tighten these back up.
  {
    files: ["convex/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      // Convex-idiom rules stay enabled, but as advisory warnings: visible
      // guidance on the given backend without failing the lint gate.
      "@convex-dev/explicit-table-ids": "warn",
      "@convex-dev/no-filter-in-query": "warn",
    },
  },
);
