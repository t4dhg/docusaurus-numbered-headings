# Changelog

Notable changes to this package are documented here.

## 2.0.0 - Unreleased (release candidate)

### Breaking changes

- Require Node.js 20+, Docusaurus core/types 3.x, and React/React DOM 18 or 19.
- Strictly validate plugin options and present `numbered_headings` frontmatter values.
- Scope document and desktop/mobile TOC CSS to Docusaurus documentation containers.

### Added and changed

- CommonJS and ESM entry points with matching TypeScript declarations; the plugin is the default export and `remarkFrontmatterToggle` is named.
- Per-document ISO 2145, USA Classic, Spanish Forense, and opt-out frontmatter behavior with path-aware validation errors.
- CSS counter contract tests, package-consumer tests, and a Docusaurus fixture covering scoped document and TOC output.
- CI, governance, documentation, and security preparation for the 2.0 release line.
- Contributor verification and release preparation documentation.

This release candidate is not published, tagged, or a GitHub Release.

See [MIGRATION.md](MIGRATION.md) for upgrade instructions.

## Earlier releases

- **1.6.0:** added per-document frontmatter control, the Spanish Forense convention, and class-scoped override styles.
- **1.5.0:** added opt-out support for numbered headings.
- **1.4.0:** added table-of-contents numbering support.
- **1.3.0:** refined pseudo-element spacing and styles.
- **1.2.0:** added security policy and package metadata improvements.
- **1.1.0:** added ISO 2145 and USA Classic conventions and `h5` numbering.
- **1.0.0:** initial numbered-headings plugin release.
