# Contributing

Contributions that improve compatibility, correctness, documentation, or test coverage are welcome.

## Development setup

Use Node.js 20+ and install the locked dependencies:

```shell
npm ci
```

Before submitting a change, run the single local gate:

```shell
npm run verify
```

`npm run verify` checks formatting, types, a fresh build, unit tests, package consumers, the Docusaurus fixture, and production dependency audit policy. Generated `lib` output is build output and is not committed.

## Focused checks

- `node --test test/options.test.cjs` checks plugin option validation while working on options.
- `node --test test/documentation.test.cjs` checks public documentation and metadata contract changes.
- `npm run test:package` packs the package and checks CommonJS, ESM, and TypeScript consumers.
- `npm run test:docusaurus` builds the fixture site for disabled, ISO, USA, and Spanish conventions; it expects scoped CSS for document headings and both desktop/mobile TOCs.
- `npm run format` applies the repository formatter. Use it before the full verification gate when Markdown, JSON, or source formatting changes.

Add or update tests and public documentation whenever behavior or the public contract changes.

## Reports and releases

Use an issue for reproducible bugs or narrowly described proposals. For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

Contributors do not manually bump versions, publish packages, create tags, or create a Release. Merged contributions do not authorize a release; only the maintainer-owned release workflow may publish after review.
