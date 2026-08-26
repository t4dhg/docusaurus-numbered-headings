# Migrating to 2.0

Version 2.0 is the supported line for Docusaurus 3. Upgrade the host project before upgrading this package.

## Requirements

- Node.js 20 or newer
- `@docusaurus/core` 3.x
- React and React DOM 18 or newer

Install the new major version with your package manager:

```shell
npm install docusaurus-numbered-headings@^2
```

## Plugin configuration

The Docusaurus plugin configuration remains the same:

```js
export default {
  plugins: [
    ["docusaurus-numbered-headings", { convention: "iso-2145", enabled: true }],
  ],
};
```

Supported conventions are `iso-2145`, `usa-classic`, and `spanish-forense`. Invalid option types or convention names now throw a `TypeError` during configuration.

## Module loading

Version 2.0 publishes explicit CommonJS, ESM, and type entry points. Existing `require` calls continue to work, and ESM consumers can use a default import:

```js
import numberedHeadings from "docusaurus-numbered-headings";
```

## Per-document frontmatter

To use per-document control, register the exported remark plugin in the Docusaurus docs preset:

```js
import { remarkFrontmatterToggle } from "docusaurus-numbered-headings";

export default {
  presets: [
    ["classic", { docs: { remarkPlugins: [remarkFrontmatterToggle] } }],
  ],
};
```

The `numbered_headings` frontmatter value may be `true`, `false`, `iso-2145`, `usa-classic`, or `spanish-forense`. A present unsupported value now throws a path-aware `TypeError` instead of falling back silently.

## Custom CSS

Heading rules are scoped to `.theme-doc-markdown`. Table-of-contents rules target the Docusaurus 3 desktop and mobile TOC containers under `.main-wrapper`. Update custom overrides that relied on bare heading or `.table-of-contents` selectors.
