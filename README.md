# Docusaurus Numbered Headings

[![npm version](https://img.shields.io/npm/v/docusaurus-numbered-headings.svg)](https://www.npmjs.com/package/docusaurus-numbered-headings)
[![npm downloads](https://img.shields.io/npm/dm/docusaurus-numbered-headings.svg)](https://www.npmjs.com/package/docusaurus-numbered-headings)
[![license](https://img.shields.io/npm/l/docusaurus-numbered-headings.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/t4dhg/docusaurus-numbered-headings?style=social)](https://github.com/t4dhg/docusaurus-numbered-headings)
[![Build Status](https://github.com/t4dhg/docusaurus-numbered-headings/actions/workflows/ci.yml/badge.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/actions)

A simple Docusaurus plugin that automatically adds numbered headings (1., 1.1., 1.1.1., etc.) to h2, h3, and h4 elements in your documentation.

## Features

- 🔢 Automatically numbers h2, h3, h4, and h5 headings
- 🎨 Clean CSS-based implementation using CSS counters
- ⚡ Zero JavaScript overhead - pure CSS solution
- 🌍 Support for multiple numbering conventions (ISO 2145 and USA Classic)
- 🔧 Easy to install and configure
- 🎛️ Optional configuration to disable if needed

## Numbering conventions

| Convention         | Code        | Structure Example | Common In                       | Region         | Key Characteristics                                                                                                |
| ------------------ | ----------- | ----------------- | ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Decimal (ISO 2145) | iso-2145    | 1, 1.1, 1.1.1     | Technical, Scientific, Academic | Europe, Global | Clean hierarchy; easy to reference; used in Docusaurus, LaTeX, academic papers, theses; ISO standard               |
| Classical Outline  | usa-classic | I, A, 1, a        | Academic essays, legal outlines | USA            | Multilevel styles for papers; common in school instruction; Roman numerals + letters + numbers + lowercase letters |

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

| Option       | Type                            | Default      | Description                                  |
| ------------ | ------------------------------- | ------------ | -------------------------------------------- |
| `enabled`    | `boolean`                       | `true`       | Whether to enable numbered headings          |
| `convention` | `"iso-2145"` \| `"usa-classic"` | `"iso-2145"` | Numbering convention to use for the headings |

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

## Example Output

### ISO 2145 Convention

```markdown
# My Documentation (H1 - not numbered)

## Introduction (becomes "1. Introduction")

### Getting Started (becomes "1.1. Getting Started")

#### Installation (becomes "1.1.1. Installation")

#### Configuration (becomes "1.1.2. Configuration")

### Advanced Usage (becomes "1.2. Advanced Usage")

## API Reference (becomes "2. API Reference")

### Methods (becomes "2.1. Methods")
```

### USA Classic Convention

```markdown
# My Documentation (H1 - not numbered)

## Introduction (becomes "I. Introduction")

### Getting Started (becomes "A. Getting Started")

#### Installation (becomes "1. Installation")

#### Configuration (becomes "2. Configuration")

### Advanced Usage (becomes "B. Advanced Usage")

## API Reference (becomes "II. API Reference")

### Methods (becomes "A. Methods")
```

## Styling

The plugin adds subtle styling to the numbers:

- Numbers appear in a slightly muted color (`#666`)
- Normal font weight (not bold like the heading text)
- Proper spacing between the number and heading text

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
