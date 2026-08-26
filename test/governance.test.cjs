const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repositoryRoot, relativePath));
}

test("keeps one CI workflow with no duplicate build workflow", () => {
  assert.equal(exists(".github/workflows/build.yml"), false);
  assert.equal(exists(".github/workflows/ci.yml"), true);
});

test("runs the fail-fast verification gate on exactly Node 20, 22, and 24", () => {
  const ci = read(".github/workflows/ci.yml");

  assert.match(ci, /node-version:\s*\[20, 22, 24\]/);
  assert.match(ci, /run:\s*npm run verify(?:\s|$)/);
  assert.doesNotMatch(ci, /node-version:\s*(?:16|18)(?:\.x)?\b/);
  assert.doesNotMatch(ci, /npm test\s*\|\|\s*echo/);
});

test("pins every CI action to the reviewed commit", () => {
  const ciFiles = [".github/workflows/build.yml", ".github/workflows/ci.yml"]
    .filter(exists)
    .map(read)
    .join("\n");
  const uses = [...ciFiles.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map(
    (match) => match[1],
  );

  assert.deepEqual(uses, [
    "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  ]);
});

test("exposes a stable quality aggregate for branch protection", () => {
  const ci = read(".github/workflows/ci.yml");

  assert.match(ci, /^name:\s*CI$/m);
  assert.match(ci, /^permissions:\s*\n\s+contents:\s*read$/m);
  assert.match(ci, /cancel-in-progress:\s*true/);
  assert.match(ci, /^\s{2}verify-node:$/m);
  assert.match(ci, /^\s{2}quality:$/m);
  assert.match(ci, /if:\s*\$\{\{ always\(\) \}\}/);
  assert.match(ci, /needs:\s*verify-node/);
  assert.match(ci, /needs\.verify-node\.result\s*==\s*'success'/);
});

test("provides the complete source-controlled governance surface", () => {
  const required = [
    ".github/dependabot.yml",
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/ISSUE_TEMPLATE/feature.yml",
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/pull_request_template.md",
    "docs/REPOSITORY_SETTINGS.md",
    "docs/DEPENDENCY_RISK.md",
  ];

  assert.deepEqual(
    required.filter((relativePath) => !exists(relativePath)),
    [],
  );
});

test("publishes private security reporting and 2.x support", () => {
  const security = read("SECURITY.md");

  assert.match(security, /\| 2\.x\s+\|[^\n]*:white_check_mark:/);
  assert.match(security, /\| 1\.x\s+\|[^\n]*:x:/);
  assert.match(
    security,
    /https:\/\/github\.com\/t4dhg\/docusaurus-numbered-headings\/security\/advisories\/new/,
  );
  assert.doesNotMatch(security, /your-email@example\.com|within 48 hours/i);
});

test("marks repository settings as an unapplied proposal", () => {
  const settings = exists("docs/REPOSITORY_SETTINGS.md")
    ? read("docs/REPOSITORY_SETTINGS.md")
    : "";

  assert.match(
    settings,
    /^# Repository settings\n\n> \*\*Proposed — not yet applied\.\*\*/,
  );
  assert.match(settings, /re-verify the live repository state/i);
  assert.match(settings, /`quality`/);
  assert.match(settings, /`refs\/heads\/master`/);
  assert.match(settings, /`refs\/tags\/v\*`/);
});

test("enumerates every current full-audit entry separately from the release gate", () => {
  const risk = exists("docs/DEPENDENCY_RISK.md")
    ? read("docs/DEPENDENCY_RISK.md")
    : "";
  const expectedEntries = [
    "@docusaurus/bundler",
    "@docusaurus/core",
    "@docusaurus/mdx-loader",
    "@docusaurus/plugin-content-blog",
    "@docusaurus/plugin-content-docs",
    "@docusaurus/plugin-content-pages",
    "@docusaurus/plugin-css-cascade-layers",
    "@docusaurus/plugin-debug",
    "@docusaurus/plugin-google-analytics",
    "@docusaurus/plugin-google-gtag",
    "@docusaurus/plugin-google-tag-manager",
    "@docusaurus/plugin-sitemap",
    "@docusaurus/plugin-svgr",
    "@docusaurus/preset-classic",
    "@docusaurus/theme-classic",
    "@docusaurus/theme-common",
    "@docusaurus/theme-search-algolia",
    "ajv",
    "copy-webpack-plugin",
    "css-minimizer-webpack-plugin",
    "esbuild",
    "fast-uri",
    "image-size",
    "lodash",
    "serialize-javascript",
    "sockjs",
    "terser-webpack-plugin",
    "uuid",
    "webpack",
    "webpack-dev-server",
    "ws",
  ];
  const documentedEntries = [
    ...risk.matchAll(/^\|\s+`([^`]+)`\s+\|\s+(?:low|moderate|high)\s+\|/gm),
  ].map((match) => match[1]);

  assert.deepEqual(documentedEntries, expectedEntries);
  assert.match(risk, /2 low, 8 moderate, 21 high, and 0 critical/);
  assert.match(risk, /npm audit --omit=dev --audit-level=high/);
  assert.match(risk, /zero\s+published-surface vulnerabilities/i);
});
