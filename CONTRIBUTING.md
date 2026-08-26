# Contributing

Contributions that improve compatibility, correctness, documentation, or test coverage are welcome.

## Development setup

Use Node.js 20 or newer and install the locked dependencies:

```shell
npm ci
```

Keep changes focused and add a regression test for behavior changes. Before submitting a change, run:

```shell
npm run build
npm run typecheck
npm run test:unit
npm run test:package
```

The package test builds and installs the generated archive in disposable CommonJS and ESM consumers. Generated `lib` output is not committed.

## Reports and proposals

Use an issue for reproducible bugs or narrowly described proposals. For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
