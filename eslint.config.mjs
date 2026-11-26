import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/next-env.d.ts",
      "apps/web/public/engine/**",
      "apps/web/app_models/**",
      "apps/desktop/src-tauri/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/public/sw.js"],
    languageOptions: { globals: { self: "readonly" } },
  },
  {
    files: ["apps/desktop/start/**/*.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { URL: "readonly", console: "readonly" } },
  },
);
