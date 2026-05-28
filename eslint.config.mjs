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
  ]),
  // Standalone CLI scripts in `scripts/` are plain CommonJS Node — they
  // use `require()`, can `console.log`, and have no TS type info. Relax
  // the Next-app defaults so the IDE doesn't flood the Problems panel
  // with errors that don't apply to one-off operational scripts.
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
