import type { LoadContext, Plugin } from "@docusaurus/types";
import path from "path";
import fs from "fs";

export interface PluginOptions {
  /**
   * Whether to enable numbered headings
   * @default true
   */
  enabled?: boolean;
  /**
   * Numbering convention to use
   * @default "iso-2145"
   */
  convention?: "iso-2145" | "usa-classic";
}

export default function docusaurusNumberedHeadingsPlugin(
  context: LoadContext,
  options: PluginOptions = {}
): Plugin<void> {
  const { enabled = true, convention = "iso-2145" } = options;

  return {
    name: "docusaurus-numbered-headings",

    getClientModules() {
      if (!enabled) {
        return [];
      }

      // Generate a dynamic client module that imports the correct CSS
      const clientModulePath = path.resolve(
        __dirname,
        "./client-module-dynamic.js"
      );
      const clientModuleContent = `import "./numbered-headings.css";\nimport "./styles/${convention}.css";`;

      fs.writeFileSync(clientModulePath, clientModuleContent);

      return [clientModulePath];
    },
  };
}
