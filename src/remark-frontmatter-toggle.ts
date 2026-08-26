/**
 * Remark plugin that drives per-document numbered-heading behavior via frontmatter.
 *
 * Wire it into your Docusaurus docs preset:
 *
 *   const { remarkFrontmatterToggle } = require("docusaurus-numbered-headings");
 *   // ...
 *   docs: { remarkPlugins: [remarkFrontmatterToggle], ... }
 *
 * Then in any MDX file, control numbering with the `numbered_headings` frontmatter
 * key:
 *
 *   ---
 *   numbered_headings: false              # disable auto-numbering on this page
 *   numbered_headings: "iso-2145"         # force ISO 2145 (1, 1.1, 1.1.1)
 *   numbered_headings: "usa-classic"      # force USA Classic (I, A, 1, a)
 *   numbered_headings: "spanish-forense"  # force Spanish forensic (I, Primero.-, 1, a)
 *   numbered_headings: true               # explicit default (same as unset)
 *   ---
 *
 * When set, the plugin wraps the document body in a `<div className="…">` carrying:
 *   - `disable_numbered_headings`         for `false`
 *   - `numbered_headings_iso_2145`        for `"iso-2145"`
 *   - `numbered_headings_usa_classic`     for `"usa-classic"`
 *   - `numbered_headings_spanish_forense` for `"spanish-forense"`
 *
 * Plugin CSS recognizes those classes and applies (or suppresses) the right
 * counters. The right-rail Table of Contents is scoped via `:root:has(...)`
 * since it lives outside the wrapped document body.
 *
 * Compatible with Docusaurus 3+, which exposes parsed frontmatter on
 * `file.data.frontMatter`.
 */

type AnyNode = { type: string; [key: string]: unknown };
type Root = { type: "root"; children: AnyNode[] };
type VFileLike = {
  data?: { frontMatter?: Record<string, unknown> };
  path?: string;
};

const TOP_LEVEL_PRESERVE = new Set(["mdxjsEsm", "yaml", "toml"]);

function classForFrontmatter(value: unknown, filePath?: string): string {
  if (value === false) return "disable_numbered_headings";
  if (value === "iso-2145") return "numbered_headings_iso_2145";
  if (value === "usa-classic") return "numbered_headings_usa_classic";
  if (value === "spanish-forense") return "numbered_headings_spanish_forense";

  throw new TypeError(
    '[docusaurus-numbered-headings] frontmatter "numbered_headings"' +
      (filePath ? ` in ${filePath}` : "") +
      " must be true, false, iso-2145, usa-classic, or spanish-forense; received " +
      JSON.stringify(value),
  );
}

export function remarkFrontmatterToggle() {
  return (tree: Root, file: VFileLike): void => {
    const fm = file?.data?.frontMatter;
    if (!fm) return;

    if (!Object.prototype.hasOwnProperty.call(fm, "numbered_headings")) return;

    const value = fm.numbered_headings;
    if (value === true) return;

    const wrapperClass = classForFrontmatter(value, file?.path);

    const preserved: AnyNode[] = [];
    const wrapped: AnyNode[] = [];
    for (const child of tree.children) {
      if (TOP_LEVEL_PRESERVE.has(child.type)) {
        preserved.push(child);
      } else {
        wrapped.push(child);
      }
    }

    const wrapper: AnyNode = {
      type: "mdxJsxFlowElement",
      name: "div",
      attributes: [
        {
          type: "mdxJsxAttribute",
          name: "className",
          value: wrapperClass,
        },
      ],
      children: wrapped,
    };

    tree.children = [...preserved, wrapper];
  };
}

export default remarkFrontmatterToggle;
