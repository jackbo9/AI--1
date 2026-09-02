import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [{ ignores: [".next/**", "data/**", "node_modules/**", "next-env.d.ts"] }, js.configs.recommended, ...compat.extends("next/core-web-vitals"), ...tseslint.configs.recommended];
export default config;
