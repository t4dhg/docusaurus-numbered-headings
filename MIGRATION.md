# Migrating to 2.0

Version 2.0 is the Docusaurus 3 line. Upgrade the host project before upgrading this package.

## Breaking requirements

- Node.js 20+
- `@docusaurus/core` and `@docusaurus/types` 3.x
- React and React DOM 18 or 19

## Upgrade checklist

1. Upgrade the host site and lockfile to the requirements above.
2. Install `docusaurus-numbered-headings@^2`.
3. Replace any unsupported plugin options or `numbered_headings` frontmatter values.
4. Update bare heading and TOC CSS overrides to the scoped selectors below.
5. Rebuild the site and check both desktop and mobile documentation TOCs.

`npm run verify` is for contributors to this repository only; package consumers should build and test their own Docusaurus site.

## Options and frontmatter validation

The plugin options are strictly validated: `enabled` must be a boolean and `convention` must be `iso-2145`, `usa-classic`, or `spanish-forense`.

The `numbered_headings` frontmatter key accepts exactly `true`, `false`, `iso-2145`, `usa-classic`, or `spanish-forense`. Omitted and `true` preserve the configured convention. Any present unsupported value throws a path-aware `TypeError` when a document path is available, instead of silently falling back.

Register the named remark export only when per-document control is needed:

```js
import numberedHeadings, {
  remarkFrontmatterToggle,
} from "docusaurus-numbered-headings";

export default {
  plugins: [[numberedHeadings, { convention: "iso-2145" }]],
  presets: [
    ["classic", { docs: { remarkPlugins: [remarkFrontmatterToggle] } }],
  ],
};
```

## Module loading

The package supports ESM and CommonJS. ESM consumers import the default plugin and named `remarkFrontmatterToggle` export:

```js
import numberedHeadings, {
  remarkFrontmatterToggle,
} from "docusaurus-numbered-headings";
```

CommonJS consumers require the same default and named exports:

```js
const {
  default: numberedHeadings,
  remarkFrontmatterToggle,
} = require("docusaurus-numbered-headings");
```

## Scoped CSS

Document counters are beneath `.theme-doc-markdown`. Desktop and mobile TOC counters are beneath `.main-wrapper` and use `:has()` with `:is()` to follow document-level frontmatter. Migrate bare overrides such as `h2::before` or unscoped `.table-of-contents` rules to scoped selectors:

```css
.theme-doc-markdown h2::before {
  color: var(--ifm-color-primary);
}

.main-wrapper
  :is(.theme-doc-toc-desktop, .theme-doc-toc-mobile)
  .table-of-contents
  > li::before {
  color: var(--ifm-color-primary);
}
```

Check the site in a modern browser with `:has()` support when per-document TOC behavior is important.
