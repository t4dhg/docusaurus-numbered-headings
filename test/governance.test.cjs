const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parse } = require("yaml");

const repositoryRoot = path.resolve(__dirname, "..");
const pkg = require("../package.json");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repositoryRoot, relativePath));
}

function readYaml(relativePath) {
  return parse(read(relativePath));
}

test("keeps one CI workflow with no duplicate build workflow", () => {
  assert.equal(exists(".github/workflows/build.yml"), false);
  assert.equal(exists(".github/workflows/ci.yml"), true);
});

test("parses exact CI triggers, timeouts, install, verification, and quality behavior", () => {
  const ci = readYaml(".github/workflows/ci.yml");

  assert.deepEqual(ci.on, {
    push: { branches: ["master"] },
    pull_request: { branches: ["master"] },
  });
  assert.deepEqual(ci.permissions, { contents: "read" });
  assert.equal(ci.concurrency["cancel-in-progress"], true);
  assert.deepEqual(
    ci.jobs["verify-node"].strategy.matrix["node-version"],
    [20, 22, 24],
  );
  assert.equal(ci.jobs["verify-node"]["timeout-minutes"], 30);
  assert.equal(ci.jobs.quality["timeout-minutes"], 5);
  assert.equal(ci.jobs.quality.needs, "verify-node");
  assert.equal(ci.jobs.quality.if, "${{ always() }}");

  const verificationRuns = ci.jobs["verify-node"].steps
    .filter((step) => step.run)
    .map((step) => step.run);
  assert.deepEqual(verificationRuns, ["npm ci", "npm run verify"]);
  const qualityStep = ci.jobs.quality.steps.at(0);
  assert.deepEqual(qualityStep.env, {
    VERIFY_SUCCEEDED: "${{ needs.verify-node.result == 'success' }}",
  });
  const failedQuality = spawnSync("bash", ["-c", qualityStep.run], {
    encoding: "utf8",
    env: { ...process.env, VERIFY_SUCCEEDED: "false" },
    shell: false,
  });
  assert.notEqual(
    failedQuality.status,
    0,
    "quality must fail on matrix failure",
  );
  const successfulQuality = spawnSync("bash", ["-c", qualityStep.run], {
    encoding: "utf8",
    env: { ...process.env, VERIFY_SUCCEEDED: "true" },
    shell: false,
  });
  assert.equal(successfulQuality.status, 0, successfulQuality.stderr);
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
  const ci = readYaml(".github/workflows/ci.yml");

  assert.equal(ci.name, "CI");
  assert.deepEqual(Object.keys(ci.jobs), ["verify-node", "quality"]);
  assert.equal(ci.jobs.quality.name, "quality");
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

test("governance YAML and pull request template carry their operational schema", () => {
  assert.equal(pkg.devDependencies.yaml, "2.9.0");

  const dependabot = readYaml(".github/dependabot.yml");
  assert.equal(dependabot.version, 2);
  assert.deepEqual(
    dependabot.updates.map((update) => ({
      ecosystem: update["package-ecosystem"],
      directory: update.directory,
      interval: update.schedule.interval,
      target: update["target-branch"],
    })),
    [
      {
        ecosystem: "npm",
        directory: "/",
        interval: "weekly",
        target: "master",
      },
      {
        ecosystem: "github-actions",
        directory: "/",
        interval: "weekly",
        target: "master",
      },
    ],
  );
  assert.deepEqual(dependabot.updates[0].groups["development-non-major"], {
    "dependency-type": "development",
    "update-types": ["minor", "patch"],
  });
  assert.deepEqual(dependabot.updates[0].ignore, [
    {
      "dependency-name": "typescript",
      "update-types": ["version-update:semver-major"],
    },
  ]);

  const bug = readYaml(".github/ISSUE_TEMPLATE/bug.yml");
  const bugFields = bug.body.filter((item) => item.id);
  assert.deepEqual(
    bugFields.map((item) => item.id),
    [
      "package-version",
      "docusaurus-version",
      "node-version",
      "react-version",
      "environment",
      "reproduction",
      "expected",
      "actual",
      "logs",
      "compatibility-impact",
      "release-impact",
    ],
  );
  assert.equal(
    bugFields.every((item) => item.validations?.required === true),
    true,
  );
  assert.match(bug.body[0].attributes.value, /security advisory form/i);

  const feature = readYaml(".github/ISSUE_TEMPLATE/feature.yml");
  const featureFields = feature.body.filter((item) => item.id);
  assert.deepEqual(
    featureFields.map((item) => item.id),
    [
      "problem",
      "proposed-behavior",
      "alternatives",
      "compatibility-impact",
      "documentation-tests",
      "release-impact",
    ],
  );
  assert.equal(
    featureFields.every((item) => item.validations?.required === true),
    true,
  );

  const issueConfig = readYaml(".github/ISSUE_TEMPLATE/config.yml");
  assert.equal(issueConfig.blank_issues_enabled, false);
  assert.deepEqual(
    issueConfig.contact_links.map(({ name, url }) => ({ name, url })),
    [
      {
        name: "Report a security vulnerability",
        url: `${"https://github.com/t4dhg/docusaurus-numbered-headings"}/security/advisories/new`,
      },
      {
        name: "Questions and ideas",
        url: `${"https://github.com/t4dhg/docusaurus-numbered-headings"}/discussions`,
      },
    ],
  );

  const pullRequestTemplate = read(".github/pull_request_template.md");
  assert.deepEqual(
    [...pullRequestTemplate.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    ["Summary", "Verification", "Compatibility and release impact"],
  );
  const checklist = [...pullRequestTemplate.matchAll(/^- \[ \] (.+)$/gm)].map(
    (match) => match[1],
  );
  assert.equal(checklist.length, 7);
  for (const required of [
    /focused automated tests/i,
    /npm run `?verify`?|`npm run verify`/i,
    /documentation/i,
    /CommonJS\/ESM/i,
    /breaking change/i,
    /release impact/i,
    /generated `lib\/` output/i,
  ]) {
    assert.equal(
      checklist.some((item) => required.test(item)),
      true,
    );
  }
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

test("documents the maintainer release sequence and unapplied publishing prerequisites", () => {
  const contributing = read("CONTRIBUTING.md");
  const releaseHeading = contributing.indexOf(
    "## Maintainer release procedure",
  );
  const finalize = contributing.indexOf(
    "Finalize `CHANGELOG.md` and the package version in one reviewed commit",
  );
  const land = contributing.indexOf(
    "Land that reviewed commit on protected `master` after the exact `quality` status check passes",
  );
  const tag = contributing.indexOf(
    "Create and push the prevalidated annotated `vMAJOR.MINOR.PATCH` tag",
  );
  const observe = contributing.indexOf("Observe the complete Release workflow");
  assert.ok(
    releaseHeading >= 0 &&
      releaseHeading < finalize &&
      finalize < land &&
      land < tag &&
      tag < observe,
    "release instructions must preserve the reviewed finalize, land, tag, observe order",
  );
  assert.match(
    contributing,
    /workflow never commits, bumps a version, creates a tag, or pushes a ref/iu,
  );

  const settings = read("docs/REPOSITORY_SETTINGS.md");
  assert.match(settings, /## Proposed protected publishing prerequisites/);
  assert.match(
    settings,
    /environment named exactly `npm-publish`[\s\S]*required reviewer[\s\S]*protected tags matching `v\*`/iu,
  );
  assert.match(
    settings,
    /prevent self-review[\s\S]*prevent administrators? from bypassing/iu,
  );
  const publisherSection = settings
    .split("## Proposed protected publishing prerequisites")[1]
    .split("## Proposed post-publication token retirement")[0];
  const publisherRows = publisherSection
    .split("\n")
    .filter((line) => /^\s*\|/u.test(line) && !/^\s*\|\s*-+/u.test(line))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
  assert.deepEqual(publisherRows, [
    ["npm trusted-publisher field", "Required value"],
    ["npm user or organization", "`t4dhg`"],
    ["Repository", "`docusaurus-numbered-headings`"],
    ["Workflow filename", "`release.yml`"],
    ["Environment", "`npm-publish`"],
    ["Allowed action", "`npm publish`"],
  ]);
  const firstOidcPublication = settings.indexOf(
    "first successful OIDC publication",
  );
  const disallowTraditionalTokens = settings.indexOf(
    "Disallow traditional npm automation tokens",
  );
  const revokeObsoleteTokens = settings.indexOf(
    "Revoke obsolete automation tokens",
  );
  assert.ok(
    firstOidcPublication >= 0 &&
      firstOidcPublication < disallowTraditionalTokens &&
      disallowTraditionalTokens < revokeObsoleteTokens,
    "token retirement must remain gated on a successful OIDC publication",
  );
});

test("parses every current dependency-risk row and its complete mitigation contract", () => {
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
  const rows = risk
    .split("\n")
    .filter((line) =>
      /^\|\s+`[^`]+`\s+\|\s+(?:low|moderate|high|critical)\s+\|/u.test(line),
    )
    .map((line) => {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      assert.equal(cells.length, 6, `unexpected risk row schema: ${line}`);
      return {
        package: cells[0].replaceAll("`", ""),
        severity: cells[1],
        path: cells[2],
        reachability: cells[3],
        fix: cells[4],
        mitigation: cells[5],
      };
    });
  const documentedEntries = rows.map((row) => row.package);

  assert.deepEqual(documentedEntries, expectedEntries);
  for (const row of rows) {
    assert.ok(row.path.length > 0, `${row.package} needs a path`);
    assert.ok(row.reachability.length > 0, `${row.package} needs reachability`);
    assert.ok(row.fix.length > 0, `${row.package} needs fix status`);
    assert.ok(row.mitigation.length > 0, `${row.package} needs mitigation`);
    assert.match(
      row.reachability,
      /absent (?:from the published runtime graph|at package runtime)/i,
    );
  }
  const totals = rows.reduce(
    (counts, row) => ({ ...counts, [row.severity]: counts[row.severity] + 1 }),
    { low: 0, moderate: 0, high: 0, critical: 0 },
  );
  assert.deepEqual(totals, { low: 2, moderate: 8, high: 21, critical: 0 });
  const esbuild = rows.find((row) => row.package === "esbuild");
  assert.match(esbuild.path, /Project development root.*`tsup`.*`esbuild`/i);
  assert.equal(
    rows
      .filter((row) => row.package !== "esbuild")
      .some((row) => /Project development root.*`tsup`/i.test(row.path)),
    false,
  );
  assert.match(risk, /2 low, 8 moderate, 21 high, and 0 critical/);
  assert.match(risk, /npm audit --omit=dev --audit-level=high/);
  assert.match(risk, /zero\s+published-surface vulnerabilities/i);
  assert.match(risk, /proposed `0` additions, `0` changes, and `0` removals/i);
  assert.equal(pkg.dependencies, undefined);
  assert.match(risk, /declares no runtime dependencies/i);
  assert.match(risk, /development\/build vulnerability\s+entries/i);
});
