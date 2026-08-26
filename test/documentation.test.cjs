const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");

const repositoryRoot = path.resolve(__dirname, "..");
const pkg = require("../package.json");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function assertUnreleasedReleaseCandidate(document) {
  const headingPattern = /^## 2\.0\.0 - Unreleased \(release candidate\)$/m;
  const heading = headingPattern.exec(document);
  assert.ok(heading, "missing the unreleased 2.0.0 release-candidate heading");

  const sectionStart = heading.index + heading[0].length;
  const remainingDocument = document.slice(sectionStart);
  const nextReleaseOffset = remainingDocument.search(/^##\s+/m);
  const section =
    nextReleaseOffset === -1
      ? remainingDocument
      : remainingDocument.slice(0, nextReleaseOffset);
  const explicitNegation =
    "This release candidate is not published, tagged, or a GitHub Release.";
  assert.equal(
    section.split(explicitNegation).length - 1,
    1,
    "2.0.0 must contain the exact explicit release-status negation once",
  );
  const otherStatusText = section.replace(explicitNegation, "");

  for (const statusWording of [
    /\b(?:publish(?:ed|ing)?|publication|tag(?:ged|ging)?)\b/iu,
    /\bGitHub Release\b/iu,
    /\bRelease (?:available|created|published)\b/iu,
  ]) {
    assert.doesNotMatch(
      otherStatusText,
      statusWording,
      `2.0.0 has release-status wording outside its negation: ${statusWording}`,
    );
  }
}

function cssExamples(document) {
  return [
    ...document.matchAll(/^```css[^\n]*\n(?<css>[\s\S]*?)^```\s*$/gimu),
  ].map((match) => match.groups.css);
}

function selectorStructure(selector) {
  const compounds = [[]];
  const combinators = [];

  for (const node of selector.nodes) {
    if (node.type === "combinator") {
      combinators.push(node.value.trim() || " ");
      compounds.push([]);
    } else {
      compounds.at(-1).push(node);
    }
  }

  return { compounds, combinators };
}

function compoundHasClass(compound, className) {
  return compound.some(
    (node) => node.type === "class" && node.value === className,
  );
}

function nodeTargetsHeading(node) {
  if (node.type === "tag") return /^h[2-5]$/iu.test(node.value);
  if (
    node.type !== "pseudo" ||
    ![":is", ":where"].includes(node.value.toLowerCase())
  ) {
    return false;
  }

  return node.nodes.some((nestedSelector) =>
    nestedSelector.nodes.some(nodeTargetsHeading),
  );
}

function compoundTargetsHeadingBefore(compound) {
  const hasBefore = compound.some(
    (node) => node.type === "pseudo" && /^:{1,2}before$/iu.test(node.value),
  );
  return hasBefore && compound.some(nodeTargetsHeading);
}

function nodeTargetsClass(node, className) {
  if (node.type === "class") return node.value === className;
  if (
    node.type !== "pseudo" ||
    ![":is", ":where"].includes(node.value.toLowerCase())
  ) {
    return false;
  }

  return node.nodes.some((nestedSelector) =>
    nestedSelector.nodes.some((nestedNode) =>
      nodeTargetsClass(nestedNode, className),
    ),
  );
}

function compoundTargetsClass(compound, className) {
  return compound.some((node) => nodeTargetsClass(node, className));
}

function hasAncestorPath(combinators, ancestorIndex, targetIndex) {
  return combinators
    .slice(ancestorIndex, targetIndex)
    .every((combinator) => combinator === " " || combinator === ">");
}

function isSharedTocContainer(compound) {
  if (compound.length !== 1) return false;
  const [pseudo] = compound;
  if (pseudo.type !== "pseudo" || pseudo.value.toLowerCase() !== ":is") {
    return false;
  }

  const expectedClasses = ["theme-doc-toc-desktop", "theme-doc-toc-mobile"];
  return (
    pseudo.nodes.length === expectedClasses.length &&
    pseudo.nodes.every((selector, index) => {
      const [node] = selector.nodes;
      return (
        selector.nodes.length === 1 &&
        node.type === "class" &&
        node.value === expectedClasses[index]
      );
    })
  );
}

function assertSelectorScope(selectorNode, documentName) {
  const selector = selectorNode.toString();
  const { compounds, combinators } = selectorStructure(selectorNode);

  compounds.forEach((compound, targetIndex) => {
    if (compoundTargetsHeadingBefore(compound)) {
      const hasDocumentAncestor = compounds.some(
        (candidate, ancestorIndex) =>
          ancestorIndex < targetIndex &&
          compoundHasClass(candidate, "theme-doc-markdown") &&
          hasAncestorPath(combinators, ancestorIndex, targetIndex),
      );
      assert.ok(
        hasDocumentAncestor,
        `${documentName} has a heading pseudo-element outside .theme-doc-markdown: ${selector}`,
      );
    }

    if (compoundTargetsClass(compound, "table-of-contents")) {
      const validTocScope = compounds.some(
        (candidate, mainIndex) =>
          mainIndex < targetIndex &&
          compoundHasClass(candidate, "main-wrapper") &&
          compounds.some(
            (container, containerIndex) =>
              mainIndex < containerIndex &&
              containerIndex < targetIndex &&
              isSharedTocContainer(container) &&
              hasAncestorPath(combinators, mainIndex, containerIndex) &&
              hasAncestorPath(combinators, containerIndex, targetIndex),
          ),
      );
      assert.ok(
        validTocScope,
        `${documentName} has a TOC selector outside the shared Docusaurus containers: ${selector}`,
      );
    }
  });
}

function assertScopedCssExamples(document, documentName) {
  const examples = cssExamples(document);
  assert.ok(examples.length > 0, `${documentName} must contain a CSS example`);

  for (const [index, css] of examples.entries()) {
    const root = postcss.parse(css, {
      from: `${documentName} CSS example ${index + 1}`,
    });

    root.walkRules((rule) => {
      const selectorRoot = selectorParser().astSync(rule.selector);
      for (const selector of selectorRoot.nodes) {
        assertSelectorScope(selector, documentName);
      }
    });
  }
}

function appendCssExample(document, selector) {
  return `${document}\n\n\`\`\`css\n${selector} {\n  color: red;\n}\n\`\`\`\n`;
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
  assertScopedCssExamples(readme, "README");
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
  assertScopedCssExamples(migration, "MIGRATION");
});

test("changelog keeps 2.0.0 as an unreleased release candidate with compact history", () => {
  assertUnreleasedReleaseCandidate(changelog);
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

test("changelog status guard rejects positive release claims throughout the 2.0 section", () => {
  for (const claim of [
    "This release candidate is published.",
    "Version 2.0 is tagged.",
    "Version 2.0 is a GitHub Release.",
    "Published on npm.",
    "Tagged as v2.0.0.",
    "GitHub Release available.",
  ]) {
    const mutated = changelog.replace(
      "See [MIGRATION.md](MIGRATION.md) for upgrade instructions.",
      `${claim}\n\nSee [MIGRATION.md](MIGRATION.md) for upgrade instructions.`,
    );

    assert.throws(
      () => assertUnreleasedReleaseCandidate(mutated),
      { name: "AssertionError" },
      `positive status claim escaped detection: ${claim}`,
    );
  }
});

test("changelog status guard requires the exact explicit release-status negation", () => {
  const mutated = changelog.replace(
    "This release candidate is not published, tagged, or a GitHub Release.",
    "This release candidate remains unreleased.",
  );

  assert.throws(() => assertUnreleasedReleaseCandidate(mutated), {
    name: "AssertionError",
  });
});

test("CSS example guard rejects unsafe heading and TOC selector mutations", () => {
  for (const selector of [
    "h2::before",
    "h3::before",
    "h4::before",
    "h5::before",
    "h2.custom::before",
    "body h3::before",
    ":where(h4)::before",
    ".theme-doc-markdown-other h5::before",
    ".table-of-contents > li::before",
    ".main-wrapper-other :is(.theme-doc-toc-desktop, .theme-doc-toc-mobile) .table-of-contents",
    ".main-wrapper .table-of-contents",
    ".main-wrapper .table-of-contents :is(.theme-doc-toc-desktop, .theme-doc-toc-mobile)",
  ]) {
    for (const [name, document] of [
      ["README", readme],
      ["MIGRATION", migration],
    ]) {
      assert.throws(
        () =>
          assertScopedCssExamples(appendCssExample(document, selector), name),
        { name: "AssertionError" },
        `${name} unsafe selector escaped detection: ${selector}`,
      );
    }
  }
});

test("CSS example guard accepts exact scoped selector controls", () => {
  const safeSelectors = [
    ".theme-doc-markdown h2.custom::before",
    "body .theme-doc-markdown h3::before",
    ".theme-doc-markdown :where(h4)::before",
    ".theme-doc-markdown > h5::before",
    ".main-wrapper :is(.theme-doc-toc-desktop, .theme-doc-toc-mobile) .table-of-contents > li::before",
  ];

  for (const [name, document] of [
    ["README", readme],
    ["MIGRATION", migration],
  ]) {
    const mutated = safeSelectors.reduce(appendCssExample, document);
    assert.doesNotThrow(() => assertScopedCssExamples(mutated, name));
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
  assert.equal(pkg.devDependencies["postcss-selector-parser"], "7.1.5");
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
