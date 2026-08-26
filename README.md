# Docusaurus Numbered Headings

[![npm version](https://img.shields.io/npm/v/docusaurus-numbered-headings.svg)](https://www.npmjs.com/package/docusaurus-numbered-headings)
[![CI](https://github.com/t4dhg/docusaurus-numbered-headings/actions/workflows/ci.yml/badge.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/docusaurus-numbered-headings.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/blob/master/LICENSE)

A Docusaurus 3 plugin for Node.js 20+ projects using React and React DOM 18 or 19. It uses CSS counters to number documentation headings and their table of contents entries without modifying heading text.

## Installation

```shell
npm install docusaurus-numbered-headings
```

## Configuration

The plugin defaults to enabled ISO 2145 numbering. The exact options are:

| Option       | Type      | Default      | Values                                                |
| ------------ | --------- | ------------ | ----------------------------------------------------- |
| `enabled`    | `boolean` | `true`       | `true` or `false`                                     |
| `convention` | string    | `"iso-2145"` | `"iso-2145"`, `"usa-classic"`, or `"spanish-forense"` |

Use an ESM Docusaurus configuration:

```js
import numberedHeadings, {
  remarkFrontmatterToggle,
} from "docusaurus-numbered-headings";

export default {
  plugins: [[numberedHeadings, { enabled: true, convention: "iso-2145" }]],
  presets: [
    ["classic", { docs: { remarkPlugins: [remarkFrontmatterToggle] } }],
  ],
};
```

Or use a CommonJS configuration:

```js
const {
  default: numberedHeadings,
  remarkFrontmatterToggle,
} = require("docusaurus-numbered-headings");

module.exports = {
  plugins: [[numberedHeadings, { enabled: true, convention: "usa-classic" }]],
  presets: [
    ["classic", { docs: { remarkPlugins: [remarkFrontmatterToggle] } }],
  ],
};
```

The package exposes the plugin as the default export and `remarkFrontmatterToggle` as a named export in both module systems. The remark plugin is optional: register it only when using per-document frontmatter.

## Numbering conventions

| Convention        | Heading sequence                   |
| ----------------- | ---------------------------------- |
| `iso-2145`        | `1.`, `1.1.`, `1.1.1.`, `1.1.1.1.` |
| `usa-classic`     | `I.`, `A.`, `1.`, `a.`             |
| `spanish-forense` | `I.`, `Primero.-`, `1.`, `a.`      |

All conventions number `h2` through `h5`; `h1` remains the document title. Spanish Forense provides written Spanish ordinals through `Vigésimo`, then falls back to decimal numbering.

## Per-document frontmatter

With `remarkFrontmatterToggle` registered, `numbered_headings` controls one MDX document:

| Value               | Result                                                   |
| ------------------- | -------------------------------------------------------- |
| omitted or `true`   | Keep the configured convention and do not add a wrapper. |
| `false`             | Disable numbering for the document.                      |
| `"iso-2145"`        | Use ISO 2145 for the document.                           |
| `"usa-classic"`     | Use USA Classic for the document.                        |
| `"spanish-forense"` | Use Spanish Forense for the document.                    |

```md
---
title: Formal document
numbered_headings: "spanish-forense"
---

## Antecedentes
```

Any present value other than `true`, `false`, or one of the three convention strings throws a path-aware `TypeError` when the MDX file path is available.

For `false` or a convention override, the remark plugin emits one of these classes:

- `disable_numbered_headings`
- `numbered_headings_iso_2145`
- `numbered_headings_usa_classic`
- `numbered_headings_spanish_forense`

## CSS scope and customization

Heading counters are scoped beneath `.theme-doc-markdown`. Desktop and mobile table of contents counters are scoped beneath `.main-wrapper` with `:has()` and `:is()`, because those TOC containers sit outside the document wrapper. This requires a modern browser with `:has()` support; the package does not promise specific browser-version coverage.

Customize headings with the document root, never bare selectors:

```css
.theme-doc-markdown h2::before,
.theme-doc-markdown h3::before,
.theme-doc-markdown h4::before,
.theme-doc-markdown h5::before {
  color: var(--ifm-color-primary);
  font-weight: 700;
}

.main-wrapper
  :is(.theme-doc-toc-desktop, .theme-doc-toc-mobile)
  .table-of-contents
  > li::before {
  color: var(--ifm-color-primary);
}
```

## Troubleshooting

- **No numbering:** confirm the plugin is configured with `enabled: true`, then rebuild the Docusaurus site.
- **One document differs:** inspect its `numbered_headings` frontmatter; omitted and `true` retain the configured convention.
- **CSS precedence or theme overrides:** place a scoped override after theme CSS and retain `.theme-doc-markdown` (and the `.main-wrapper` TOC root where applicable).
- **Invalid values:** use only `true`, `false`, `iso-2145`, `usa-classic`, or `spanish-forense`; the thrown `TypeError` includes the document path when Docusaurus supplies it.
- **Module loading:** use the default plugin export plus the named `remarkFrontmatterToggle` export, following the ESM or CommonJS example above.
- **Stale output:** clear the site's generated cache/build output and rebuild after changing configuration or CSS.

## Project documents

Read [MIGRATION.md](MIGRATION.md) before moving an existing site to 2.0, [CHANGELOG.md](CHANGELOG.md) for release history, [CONTRIBUTING.md](CONTRIBUTING.md) for local development, and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

MIT
