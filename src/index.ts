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

      // Return CSS files directly as client modules
      return [
        path.resolve(__dirname, "./numbered-headings.css"),
        path.resolve(__dirname, `./styles/${convention}.css`),
      ];
    },
  };
}
