import { defineConfig, Options } from "tsup";

export default defineConfig((options: Options) => ({
  ...options,
  entry: {
    index: "src/index.ts",
    langchain: "src/langchain.ts",
    langgraph: "src/langgraph.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    entry: ["src/index.ts", "src/langchain.ts", "src/langgraph.ts"],
  },
  minify: false,
  external: [],
  sourcemap: true,
  entryNames: "[name]",
  exclude: [
    "**/*.test.ts", // Exclude TypeScript test files
    "**/*.test.tsx", // Exclude TypeScript React test files
    "**/__tests__/*", // Exclude any files inside a __tests__ directory
  ],
}));
