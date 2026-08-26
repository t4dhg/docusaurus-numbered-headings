# Docusaurus Numbered Headings

[![npm version](https://img.shields.io/npm/v/docusaurus-numbered-headings.svg)](https://www.npmjs.com/package/docusaurus-numbered-headings)
[![npm downloads](https://img.shields.io/npm/dm/docusaurus-numbered-headings.svg)](https://www.npmjs.com/package/docusaurus-numbered-headings)
[![license](https://img.shields.io/npm/l/docusaurus-numbered-headings.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/t4dhg/docusaurus-numbered-headings?style=social)](https://github.com/t4dhg/docusaurus-numbered-headings)
[![Build Status](https://github.com/t4dhg/docusaurus-numbered-headings/actions/workflows/build.yml/badge.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/actions)

A simple Docusaurus plugin that automatically adds numbered headings (1., 1.1., 1.1.1., etc.) to h2, h3, and h4 elements in your documentation.

## Features

- 🔢 Automatically numbers h2, h3, h4, and h5 headings
- 🎨 Clean CSS-based implementation using CSS counters
- ⚡ Zero JavaScript overhead - pure CSS solution
- 🌍 Support for multiple numbering conventions (ISO 2145 and USA Classic)
- 🔧 Easy to install and configure
- 🎛️ Optional configuration to disable if needed

## Numbering conventions

| Convention         | Code            | Structure Example  | Common In                       | Region         | Key Characteristics                                                                                                 |
| ------------------ | --------------- | ------------------ | ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Decimal (ISO 2145) | iso-2145        | 1, 1.1, 1.1.1      | Technical, Scientific, Academic | Europe, Global | Clean hierarchy; easy to reference; used in Docusaurus, LaTeX, academic papers, theses; ISO standard                |
| Classical Outline  | usa-classic     | I, A, 1, a         | Academic essays, legal outlines | USA            | Multilevel styles for papers; common in school instruction; Roman numerals + letters + numbers + lowercase letters  |
| Spanish Forensic   | spanish-forense | I, Primero.-, 1, a | Legal escritos, MASC, judicial  | Spain          | Upper-roman + written-out Spanish ordinals (Primero, Segundo…) at h3 + decimal + lowercase; idiomatic forense style |

### `iso-2145`

This style implements the international standard **ISO 2145** for numbering sections in technical and scientific documents.

- Format: `1`, `1.1`, `1.1.1`, etc.
- Each number level corresponds to a heading level (h2 → 1, h3 → 1.1, h4 → 1.1.1)
- Only decimal digits are used (no letters or Roman numerals)
- Clear, flat, hierarchical structure
- Widely used in academic, scientific, and technical documentation

Example:

```markdown
## 2 Methods

### 2.1 Data Collection

#### 2.1.1 Survey Design
```

### `usa-classic`

This style mimics the **classical outline format** commonly taught and used in the United States, especially in educational and legal contexts.

- Format: I, A, 1, a, etc. (Roman numerals, uppercase letters, digits, lowercase letters)
- Style progresses through different formats by depth
- h2 → Roman numeral (I, II, III)
- h3 → Capital letter (A, B, C)
- h4 → Arabic number (1, 2, 3)

Reflects traditional outline structures seen in essays, legal briefs, and academic writing in the US

Example:

```markdown
## I. Introduction

### A. Background

#### 1. Early Work
```

### `spanish-forense`

The dominant numbering convention for Spanish legal writings (escritos forenses): demandas, contestaciones, recursos, escritos de conclusiones, and pre-litigation submissions under the new Spanish MASC regime (Ley Orgánica 1/2025).

- Format: I, Primero.-, 1, a
- h2 → upper-roman (`I.`, `II.`, `III.`) — section headings like `I.- HECHOS`, `II.- FUNDAMENTOS DE DERECHO`
- h3 → **written-out Spanish ordinals** (`Primero.-`, `Segundo.-`, `Tercero.-`, …) — the single most distinctive marker of Spanish forensic style
- h4 → decimal (`1.`, `2.`, `3.`)
- h5 → lowercase letters (`a.`, `b.`, `c.`)

The Spanish ordinal counter supports `Primero` through `Vigésimo` (1–20); beyond that the counter falls back to decimal automatically. Suffix is `.-` (period-hyphen), the traditional Spanish forensic punctuation.

Example:

```markdown
## Antecedentes

### Hechos del presente conflicto

### Antecedentes documentales

## Fundamentos de derecho

### Aplicación al caso
```

Rendered:

> **I. Antecedentes**
> **Primero.- Hechos del presente conflicto**
> **Segundo.- Antecedentes documentales**
> **II. Fundamentos de derecho**
> **Primero.- Aplicación al caso**

Implementation uses CSS `@counter-style`, which requires Firefox (all versions), Chrome 91+, and Safari 17+.

## Installation

```bash
npm install docusaurus-numbered-headings
```

or

```bash
yarn add docusaurus-numbered-headings
```

## Usage

Add the plugin to your `docusaurus.config.js`:

```javascript
module.exports = {
  // ... other config
  plugins: ["docusaurus-numbered-headings"],
  // ... rest of config
};
```

That's it! Your headings will now be automatically numbered.

## Configuration

You can also pass options to the plugin:

```javascript
module.exports = {
  // ... other config
  plugins: [
    [
      "docusaurus-numbered-headings",
      {
        enabled: true, // Set to false to disable the plugin
        convention: "iso-2145", // Choose numbering convention
      },
    ],
  ],
  // ... rest of config
};
```

### Options

| Option       | Type                                                   | Default      | Description                                  |
| ------------ | ------------------------------------------------------ | ------------ | -------------------------------------------- |
| `enabled`    | `boolean`                                              | `true`       | Whether to enable numbered headings          |
| `convention` | `"iso-2145"` \| `"usa-classic"` \| `"spanish-forense"` | `"iso-2145"` | Numbering convention to use for the headings |

## Disabling Numbering on Specific Pages

You can disable numbered headings on specific pages using the class `disable_numbered_headings`.

```html
<div class="disable_numbered_headings">
  <h2>Heading without numbering</h2>
  <p>This section will not have numbered headings.</p>
</div>
```

This implementation works because typically the reason for disabling numbered headings is to have a React component or a specific section that does not require automatic numbering. By wrapping the content in a `div` with the class `disable_numbered_headings`, the plugin will skip applying the numbering styles to that section.

### Per-document control via frontmatter

Wire the bundled `remarkFrontmatterToggle` remark plugin into your docs preset:

```javascript
// docusaurus.config.js
const { remarkFrontmatterToggle } = require("docusaurus-numbered-headings");

module.exports = {
  // ...
  presets: [
    [
      "classic",
      {
        docs: {
          remarkPlugins: [remarkFrontmatterToggle],
          // ...
        },
      },
    ],
  ],
};
```

Then in any MDX file, use the `numbered_headings` frontmatter key to control numbering on that page:

| Frontmatter value                      | Effect                                                          |
| -------------------------------------- | --------------------------------------------------------------- |
| `numbered_headings: false`             | Disable auto-numbering entirely on this page                    |
| `numbered_headings: "iso-2145"`        | Force ISO 2145 (`1`, `1.1`, `1.1.1`) on this page               |
| `numbered_headings: "usa-classic"`     | Force USA Classic (`I`, `A`, `1`, `a`) on this page             |
| `numbered_headings: "spanish-forense"` | Force Spanish Forense (`I`, `Primero.-`, `1`, `a`) on this page |
| `numbered_headings: true`              | Explicit default (same as omitting the key)                     |
| _(omitted)_                            | Use the convention configured in `docusaurus.config.js`         |

Example — a formal document with manually-written Roman numerals that should not be auto-numbered:

```markdown
---
title: My document
numbered_headings: false
---

## I. First section

Headings here are written by hand and will render exactly as written.
```

Example — an academic essay in a repo whose global convention is `iso-2145`, but which itself wants USA Classic outline numbering:

```markdown
---
title: My essay
numbered_headings: usa-classic
---

## Introduction

### Background
```

Behind the scenes the remark plugin wraps the document body in `<div className="...">` carrying one of:

- `disable_numbered_headings` (for `false`)
- `numbered_headings_iso_2145` (for `"iso-2145"`)
- `numbered_headings_usa_classic` (for `"usa-classic"`)
- `numbered_headings_spanish_forense` (for `"spanish-forense"`)

The CSS files shipped by the plugin define class-scoped rules for each override, which win by specificity over the global rules. The right-rail Table of Contents — which lives outside the wrapped document body — is scoped via `:root:has(...)`, requiring a modern browser (Chrome 105+, Firefox 121+, Safari 15.4+).

Imports/exports and other MDX ESM nodes remain at the top level of the document. Requires Docusaurus 3+ (which exposes parsed frontmatter on `file.data.frontMatter`).

## How it works

This plugin injects CSS that uses CSS counters to automatically number your headings based on the selected convention:

### ISO 2145 Convention (default)

- H2 headings get numbers like: `1.`, `2.`, `3.`
- H3 headings get numbers like: `1.1.`, `1.2.`, `2.1.`
- H4 headings get numbers like: `1.1.1.`, `1.1.2.`, `1.2.1.`
- H5 headings get numbers like: `1.1.1.1.`, `1.1.1.2.`, `1.1.2.1.`

### USA Classic Convention

- H2 headings get Roman numerals: `I.`, `II.`, `III.`
- H3 headings get uppercase letters: `A.`, `B.`, `C.`
- H4 headings get decimal numbers: `1.`, `2.`, `3.`
- H5 headings get lowercase letters: `a.`, `b.`, `c.`

The numbering resets appropriately when moving between different heading levels.

## Styling

If you want to customize the appearance, you can override the CSS in your custom stylesheet:

```css
h2::before,
h3::before,
h4::before {
  color: #your-color;
  font-weight: bold;
  /* your custom styles */
}
```

## Compatibility

- ✅ Docusaurus v2.x
- ✅ Docusaurus v3.x
- ✅ Works with Markdown and MDX files
- ✅ Compatible with all Docusaurus themes

## License

MIT

## Contributing

Issues and pull requests are welcome! Please check the [GitHub repository](https://github.com/t4dhg/docusaurus-numbered-headings) for more information.

## Changelog

### 1.6.0

- Added `remarkFrontmatterToggle` remark plugin: per-document control via the `numbered_headings` frontmatter key
  - `false` → disable auto-numbering on the page
  - `"iso-2145"` → force ISO 2145 on the page (override global)
  - `"usa-classic"` → force USA Classic on the page (override global)
  - `"spanish-forense"` → force Spanish Forense on the page (override global)
- New `spanish-forense` convention: upper-roman at h2 + written-out Spanish ordinals at h3 (`Primero.-`, `Segundo.-`, `Tercero.-`, …) + decimal at h4 + lowercase letters at h5. The idiomatic numbering for Spanish legal escritos (demandas, contestaciones, MASC submissions under Ley Orgánica 1/2025). Uses CSS `@counter-style`.
- New class-scoped override stylesheets (`iso-2145-override.css`, `usa-classic-override.css`, `spanish-forense-override.css`) loaded alongside the existing global convention
- TOC scoping via `:root:has(...)` so the right-rail Table of Contents respects the per-doc setting (requires modern browsers)

### 1.5.0

- Added support to disable numbered headings
- Enhanced documentation for disabling numbering

### 1.4.0

- Added support for table of contents (ToC) numbering
- Improved CSS for better compatibility with various themes

### 1.3.0

- Remove margin-right from h2-h5 pseudo-elements
- Clean up styles across all conventions
- Added comprehensive CI/CD workflows for automated deployment

### 1.2.0

- Enhanced package configuration and security
- Added comprehensive `.npmignore` for optimized package size
- Added security policy (`SECURITY.md`)
- Improved npm discoverability with additional keywords
- Added Node.js engine requirements (>=16.0.0)
- Package size optimized to 5.2kB compressed

### 1.1.0

- Added support for multiple numbering conventions
- Added `iso-2145` convention (decimal numbering: 1, 1.1, 1.1.1)
- Added `usa-classic` convention (Roman numerals, letters, numbers: I, A, 1, a)
- Extended numbering support to h5 elements
- Improved configuration options

### 1.0.0

- Initial release
- Basic numbered headings for h2, h3, h4
- Plugin configuration options
