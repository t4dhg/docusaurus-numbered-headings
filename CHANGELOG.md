# Changelog

Notable changes to this package are documented here.

## 2.0.0 - Unreleased

### Breaking changes

- Require Node.js 20 or newer, Docusaurus 3, and React 18 or newer.
- Validate plugin options and `numbered_headings` frontmatter instead of silently accepting unsupported values.
- Scope document and table-of-contents counters to Docusaurus documentation containers.

### Added

- CommonJS and ECMAScript module entry points with exported TypeScript declarations.
- Per-document ISO 2145, USA Classic, Spanish Forense, and opt-out frontmatter controls.
- Package-level verification for the published archive and its CommonJS, ESM, and TypeScript consumers.

See [MIGRATION.md](MIGRATION.md) for upgrade instructions.
