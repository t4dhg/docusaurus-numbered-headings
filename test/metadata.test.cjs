const test = require("node:test");
const assert = require("node:assert/strict");
const pkg = require("../package.json");

test("declares the 2.x support and package contract", () => {
  assert.equal(pkg.version, "2.0.0");
  assert.equal(pkg.engines.node, ">=20.0.0");
  assert.equal(pkg.peerDependencies["@docusaurus/core"], "^3.0.0");
  assert.equal(pkg.peerDependencies.react, "^18.0.0 || ^19.0.0");
  assert.equal(pkg.peerDependencies["react-dom"], "^18.0.0 || ^19.0.0");
  assert.deepEqual(pkg.exports["."], {
    import: {
      types: "./lib/index.d.mts",
      default: "./lib/index.mjs",
    },
    require: {
      types: "./lib/index.d.ts",
      default: "./lib/index.js",
    },
  });
  assert.equal(pkg.exports["./package.json"], "./package.json");
  assert.deepEqual(pkg.files, [
    "lib",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "MIGRATION.md",
    "SECURITY.md",
  ]);
  for (const forbidden of [
    "postversion",
    "deploy",
    "deploy:patch",
    "deploy:minor",
    "deploy:major",
  ]) {
    assert.equal(pkg.scripts[forbidden], undefined);
  }
});
