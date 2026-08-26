const test = require("node:test");
const assert = require("node:assert/strict");
const pkg = require("../package.json");

test("declares the 2.x support and package contract", () => {
  assert.equal(pkg.version, "2.0.0");
  assert.equal(pkg.engines.node, ">=20.0.0");
  assert.equal(pkg.peerDependencies["@docusaurus/core"], "^3.0.0");
  assert.equal(pkg.peerDependencies["@docusaurus/types"], "^3.0.0");
  assert.equal(pkg.devDependencies["@docusaurus/types"], "3.10.2");
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

test("exposes a fail-fast verification script contract", () => {
  assert.equal(
    pkg.scripts.verify,
    "npm run format:check && npm run typecheck && npm run build && npm test && npm run audit:ci",
  );
  assert.equal(
    pkg.scripts.test,
    "npm run test:unit && npm run test:package && npm run test:docusaurus",
  );
  assert.equal(
    pkg.scripts["audit:ci"],
    "npm audit --omit=dev --audit-level=high",
  );
  assert.equal(pkg.scripts.prepublishOnly, "npm run verify");
  assert.doesNotMatch(
    JSON.stringify(pkg.scripts),
    /\|\|\s*(?:true|echo\b)|;\s*(?:true|echo\b|exit\s+0\b)/,
  );
});
