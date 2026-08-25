import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["cjs"],
    outDir: "lib",
    platform: "node",
    target: "node20",
    dts: true,
    clean: false,
    sourcemap: false,
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    outDir: "lib",
    platform: "node",
    target: "node20",
    dts: false,
    clean: false,
    sourcemap: false,
    outExtension: () => ({ js: ".mjs" }),
    banner: {
      js: [
        'import { fileURLToPath as __dnhFileURLToPath } from "node:url";',
        'import { dirname as __dnhDirname } from "node:path";',
        "const __filename = __dnhFileURLToPath(import.meta.url);",
        "const __dirname = __dnhDirname(__filename);",
      ].join("\n"),
    },
  },
]);
