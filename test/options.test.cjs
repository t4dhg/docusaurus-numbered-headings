const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const plugin = require("../lib/index.js").default;

const conventions = ["iso-2145", "usa-classic", "spanish-forense"];
const overrideModules = [
  "styles/iso-2145-override.css",
  "styles/usa-classic-override.css",
  "styles/spanish-forense-override.css",
];

test("uses ISO 2145 and supplies five existing absolute client modules by default", () => {
  const modules = plugin({}, {}).getClientModules();

  assert.equal(modules.length, 5);
  assert.deepEqual(modules, [
    path.resolve(__dirname, "../lib/numbered-headings.css"),
    path.resolve(__dirname, "../lib/styles/iso-2145.css"),
    ...overrideModules.map((module) => path.resolve(__dirname, "../lib", module)),
  ]);
  for (const module of modules) {
    assert.ok(path.isAbsolute(module));
    assert.ok(fs.existsSync(module), `expected built asset to exist: ${module}`);
  }
});

test("returns no client modules when disabled", () => {
  assert.deepEqual(plugin({}, { enabled: false }).getClientModules(), []);
});

for (const convention of conventions) {
  test(`uses the ${convention} convention stylesheet`, () => {
    const modules = plugin({}, { convention }).getClientModules();

    assert.equal(modules[1], path.resolve(__dirname, `../lib/styles/${convention}.css`));
    assert.ok(fs.existsSync(modules[1]));
  });
}

test("rejects null plugin options", () => {
  assert.throws(() => plugin({}, null), {
    name: "TypeError",
    message: "[docusaurus-numbered-headings] plugin options must be an object",
  });
});

test("rejects non-boolean enabled options", () => {
  assert.throws(() => plugin({}, { enabled: "false" }), {
    name: "TypeError",
    message: '[docusaurus-numbered-headings] option "enabled" must be a boolean',
  });
});

test("rejects invalid conventions before resolving a missing stylesheet", () => {
  assert.throws(
    () => plugin({}, { convention: "legal" }),
    {
      name: "TypeError",
      message: '[docusaurus-numbered-headings] option "convention" must be one of: iso-2145, usa-classic, spanish-forense; received "legal"',
    }
  );
});
