import type { LoadContext, Plugin } from "@docusaurus/types";
import path from "path";
import fs from "fs";

export { remarkFrontmatterToggle } from "./remark-frontmatter-toggle";

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
  convention?: "iso-2145" | "usa-classic" | "spanish-forense";
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

      // Base CSS + the configured global convention + both per-doc override
      // stylesheets. Override stylesheets define class-scoped rules that win
      // over the global rules by specificity when a doc opts in via the
      // `remarkFrontmatterToggle` remark plugin.
      return [
        path.resolve(__dirname, "./numbered-headings.css"),
        path.resolve(__dirname, `./styles/${convention}.css`),
        path.resolve(__dirname, "./styles/iso-2145-override.css"),
        path.resolve(__dirname, "./styles/usa-classic-override.css"),
        path.resolve(__dirname, "./styles/spanish-forense-override.css"),
      ];
    },
  };
}
