const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryRoot = path.resolve(__dirname, "..");
const pkg = require("../package.json");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

const readme = read("README.md");
const migration = read("MIGRATION.md");
const changelog = read("CHANGELOG.md");
const contributing = read("CONTRIBUTING.md");

test("README publishes the supported runtime, consumption, and numbering contract", () => {
  assert.match(
    readme,
    /actions\/workflows\/ci\.yml\/badge\.svg/u,
    "README must use the current CI badge",
  );
  assert.doesNotMatch(readme, /workflows\/build\.yml\/badge\.svg/u);
  assert.match(readme, /Docusaurus 3/u);
  assert.match(readme, /Node\.js 20\+/u);
  assert.match(readme, /React(?: and React DOM)? 18 or 19/u);
  assert.match(readme, /CSS counters/u);
  assert.doesNotMatch(readme, /Docusaurus (?:v)?2(?:\.x)?/iu);
  assert.match(
    readme,
    /import numberedHeadings,\s*\{\s*remarkFrontmatterToggle,?\s*\}\s*from "docusaurus-numbered-headings";/u,
  );
  assert.match(
    readme,
    /const\s*\{\s*default: numberedHeadings,\s*remarkFrontmatterToggle,?\s*\}\s*= require\("docusaurus-numbered-headings"\);/u,
  );
  assert.match(readme, /enabled.*boolean.*true/su);
  assert.match(
    readme,
    /convention.*"iso-2145".*"usa-classic".*"spanish-forense".*"iso-2145"/su,
  );
});

test("README documents exact per-document behavior and safe CSS customization", () => {
  for (const value of [
    /\|\s*omitted or `true`\s*\|/u,
    /\|\s*`false`\s*\|/u,
    /\|\s*`"iso-2145"`\s*\|/u,
    /\|\s*`"usa-classic"`\s*\|/u,
    /\|\s*`"spanish-forense"`\s*\|/u,
  ]) {
    assert.match(readme, value, `missing frontmatter value: ${value}`);
  }
  assert.match(
    readme,
    /omitted.*true.*configured convention|true.*omitted.*configured convention/isu,
  );
  assert.match(readme, /path-aware `?TypeError`?/u);
  for (const className of [
    "disable_numbered_headings",
    "numbered_headings_iso_2145",
    "numbered_headings_usa_classic",
    "numbered_headings_spanish_forense",
  ]) {
    assert.ok(
      readme.includes(className),
      `missing generated class: ${className}`,
    );
  }
  assert.match(readme, /\.theme-doc-markdown/u);
  assert.match(readme, /\.main-wrapper/u);
  assert.match(readme, /:has\(\)/u);
  assert.match(readme, /:is\(\)/u);
  assert.match(readme, /modern browser/u);
  assert.doesNotMatch(readme, /```css\s*\nh2::before,/u);
  assert.match(readme, /\.theme-doc-markdown h2::before/u);
  for (const topic of [
    "No numbering",
    "per-document",
    "CSS precedence",
    "Invalid values",
    "Module loading",
    "cache",
  ]) {
    assert.match(readme, new RegExp(topic, "iu"));
  }
  for (const file of [
    "MIGRATION.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
  ]) {
    assert.ok(readme.includes(`](${file})`), `missing README link: ${file}`);
  }
  assert.doesNotMatch(readme, /^## Changelog$/m);
});

test("migration guidance covers the Docusaurus 3 upgrade and module contract", () => {
  for (const requirement of [
    /Node\.js 20\+/u,
    /@docusaurus\/core.*3\.x/u,
    /@docusaurus\/types.*3\.x/u,
    /React.*React DOM.*18 or 19/su,
  ]) {
    assert.match(migration, requirement);
  }
  assert.match(migration, /strict(?:ly)? validated|strict validation/iu);
  assert.match(
    migration,
    /`true`, `false`, `iso-2145`, `usa-classic`, or `spanish-forense`/u,
  );
  assert.match(migration, /CommonJS/u);
  assert.match(migration, /ESM/u);
  assert.match(migration, /default.*named.*remarkFrontmatterToggle/su);
  assert.match(migration, /\.theme-doc-markdown/u);
  assert.match(migration, /\.main-wrapper/u);
  assert.match(migration, /desktop.*mobile.*TOC/isu);
  assert.match(migration, /bare.*override|bare.*selector/isu);
  assert.match(migration, /1\..*2\..*3\./su);
  assert.match(migration, /npm run verify.*contributors/isu);
  assert.match(
    migration,
    /npm run verify.*contributors.*only; package consumers should build and test their own Docusaurus site/isu,
  );
});

test("changelog keeps 2.0.0 as an unreleased release candidate with compact history", () => {
  assert.match(changelog, /^## 2\.0\.0 - Unreleased \(release candidate\)$/m);
  assert.doesNotMatch(
    changelog,
    /2\.0\.0.*(?:published|GitHub Release|^.*tag)/imu,
  );
  for (const topic of [
    "Breaking changes",
    "CommonJS",
    "Scope document",
    "frontmatter",
    "validation",
    "tests",
    "CI",
    "governance",
    "documentation",
    "security",
    "release preparation",
    "1.6.0",
    "1.5.0",
    "1.4.0",
    "1.3.0",
    "1.2.0",
    "1.1.0",
    "1.0.0",
  ]) {
    assert.match(changelog, new RegExp(topic, "iu"));
  }
});

test("contributor guidance uses the complete local verification gate and release boundaries", () => {
  assert.match(contributing, /npm ci/u);
  assert.match(contributing, /npm run verify/u);
  for (const command of [
    "node --test test/options.test.cjs",
    "node --test test/documentation.test.cjs",
    "npm run test:package",
    "npm run test:docusaurus",
    "npm run format",
  ]) {
    assert.ok(
      contributing.includes(command),
      `missing contributor command: ${command}`,
    );
  }
  assert.match(contributing, /CSS.*fixture|fixture.*CSS/isu);
  assert.match(contributing, /generated `?lib`?.*not committed/iu);
  assert.match(contributing, /\[SECURITY\.md\]\(SECURITY\.md\)/u);
  assert.match(
    contributing,
    /do not.*(?:bump|publish|tag|create a Release)/isu,
  );
  assert.match(
    contributing,
    /merged contributions do not authorize a release/iu,
  );
  assert.match(contributing, /maintainer-owned release workflow/iu);
  assert.doesNotMatch(
    contributing,
    /current legacy workflow|release-safety guarantee/iu,
  );
  assert.match(contributing, /tests.*documentation|documentation.*tests/isu);
});

test("package metadata describes the supported public contract without changing exports", () => {
  assert.match(pkg.description, /Docusaurus 3/u);
  for (const keyword of [
    "docusaurus-3",
    "iso-2145",
    "usa-classic",
    "spanish-forense",
    "frontmatter",
    "mdx",
    "toc",
  ]) {
    assert.ok(
      pkg.keywords.includes(keyword),
      `missing package keyword: ${keyword}`,
    );
  }
  assert.equal(pkg.version, "2.0.0");
  assert.deepEqual(pkg.exports["."], {
    import: { types: "./lib/index.d.mts", default: "./lib/index.mjs" },
    require: { types: "./lib/index.d.ts", default: "./lib/index.js" },
  });
});
