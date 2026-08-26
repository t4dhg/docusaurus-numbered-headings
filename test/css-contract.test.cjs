const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const postcss = require("postcss");

const stylesheetPaths = [
  "src/numbered-headings.css",
  "src/styles/iso-2145.css",
  "src/styles/usa-classic.css",
  "src/styles/spanish-forense.css",
  "src/styles/iso-2145-override.css",
  "src/styles/usa-classic-override.css",
  "src/styles/spanish-forense-override.css",
];

const roots = new Map(
  stylesheetPaths.map((file) => [
    file,
    postcss.parse(
      fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"),
      {
        from: file,
      },
    ),
  ]),
);

const documentRoot = ".theme-doc-markdown";
const tocContainers = ":is(.theme-doc-toc-desktop, .theme-doc-toc-mobile)";
const tocRoot = `.main-wrapper ${tocContainers} .table-of-contents`;

const headingCounters = [
  ["h2", { "counter-increment": "h2counter", "counter-reset": "h3counter" }],
  ["h3", { "counter-increment": "h3counter", "counter-reset": "h4counter" }],
  ["h4", { "counter-increment": "h4counter", "counter-reset": "h5counter" }],
  ["h5", { "counter-increment": "h5counter" }],
];

const tocCounterLevels = [
  ["", { "counter-reset": "toc-h2" }],
  [" > li", { "counter-increment": "toc-h2", "counter-reset": "toc-h3" }],
  [
    " > li > ul > li",
    { "counter-increment": "toc-h3", "counter-reset": "toc-h4" },
  ],
  [
    " > li > ul > li > ul > li",
    { "counter-increment": "toc-h4", "counter-reset": "toc-h5" },
  ],
  [" > li > ul > li > ul > li > ul > li", { "counter-increment": "toc-h5" }],
];

const tocPseudoLevels = [
  " > li::before",
  " > li > ul > li::before",
  " > li > ul > li > ul > li::before",
  " > li > ul > li > ul > li > ul > li::before",
];

const conventions = [
  {
    name: "iso-2145",
    headingContent: [
      'counter(h2counter) ". "',
      'counter(h2counter) "." counter(h3counter) ". "',
      'counter(h2counter) "." counter(h3counter) "." counter(h4counter) ". "',
      'counter(h2counter) "." counter(h3counter) "." counter(h4counter) "." counter(h5counter) ". "',
    ],
    tocContent: [
      'counter(toc-h2) ". "',
      'counter(toc-h2) "." counter(toc-h3) ". "',
      'counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) ". "',
      'counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) "." counter(toc-h5) ". "',
    ],
  },
  {
    name: "usa-classic",
    headingContent: [
      'counter(h2counter, upper-roman) ". "',
      'counter(h3counter, upper-alpha) ". "',
      'counter(h4counter, decimal) ". "',
      'counter(h5counter, lower-alpha) ". "',
    ],
    tocContent: [
      'counter(toc-h2, upper-roman) ". "',
      'counter(toc-h3, upper-alpha) ". "',
      'counter(toc-h4, decimal) ". "',
      'counter(toc-h5, lower-alpha) ". "',
    ],
  },
  {
    name: "spanish-forense",
    headingContent: [
      'counter(h2counter, upper-roman) ". "',
      'counter(h3counter, spanish-ordinal) ".- "',
      'counter(h4counter, decimal) ". "',
      'counter(h5counter, lower-alpha) ". "',
    ],
    tocContent: [
      'counter(toc-h2, upper-roman) ". "',
      'counter(toc-h3, spanish-ordinal) ".- "',
      'counter(toc-h4, decimal) ". "',
      'counter(toc-h5, lower-alpha) ". "',
    ],
  },
];

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function declarationMap(root, selector) {
  const matches = [];
  root.walkRules((rule) => {
    if (rule.selectors.some((candidate) => normalize(candidate) === selector)) {
      matches.push(rule);
    }
  });
  assert.equal(matches.length, 1, `expected one rule for ${selector}`);

  return Object.fromEntries(
    matches[0].nodes
      .filter((node) => node.type === "decl")
      .map((declaration) => [
        declaration.prop,
        normalize(declaration.value) +
          (declaration.important ? " !important" : ""),
      ]),
  );
}

function assertDeclarations(root, selector, expected) {
  assert.deepEqual(declarationMap(root, selector), expected, selector);
}

test("scopes all document and TOC selectors to Docusaurus containers", () => {
  for (const [file, root] of roots) {
    root.walkRules((rule) => {
      for (const rawSelector of rule.selectors) {
        const selector = normalize(rawSelector);
        assert.doesNotMatch(
          selector,
          /^(?:body|:root)(?:$|[\s.:#[(>+~])/u,
          file,
        );
        assert.doesNotMatch(selector, /^h[2-5](?:$|[\s.:#[(>+~])/u, file);
        assert.ok(
          !selector.includes("*"),
          `${file}: broad universal selector ${selector}`,
        );

        if (/(?:^|[\s>+~,(])h[2-5](?=$|[\s.:#[(>+~])/u.test(selector)) {
          assert.ok(
            selector.startsWith(`${documentRoot} `),
            `${file}: unscoped heading selector ${selector}`,
          );
        }

        if (selector.includes(".table-of-contents")) {
          assert.match(
            selector,
            /^\.main-wrapper(?::has\([^)]*\))? :is\(\.theme-doc-toc-desktop, \.theme-doc-toc-mobile\) \.table-of-contents/u,
            `${file}: TOC selector does not cover desktop and mobile ${selector}`,
          );
        }
      }
    });
  }
});

test("preserves base counter setup and both opt-out class spellings", () => {
  const root = roots.get("src/numbered-headings.css");

  assertDeclarations(root, documentRoot, { "counter-reset": "h2counter" });
  for (const [suffix, declarations] of tocCounterLevels) {
    assertDeclarations(root, tocRoot + suffix, declarations);
  }

  for (const level of ["h2", "h3", "h4", "h5"]) {
    assertDeclarations(root, `${documentRoot} ${level}::before`, {
      color: "inherit",
      "font-weight": "inherit",
    });
    assertDeclarations(
      root,
      `${documentRoot} .disable_numbered_headings ${level}::before`,
      { content: "none !important" },
    );
    assertDeclarations(
      root,
      `${documentRoot} .disable-numbered-headings ${level}::before`,
      { display: "none !important" },
    );
  }

  assertDeclarations(root, `${documentRoot} .disable_numbered_headings`, {
    "counter-reset": "h2counter h3counter h4counter h5counter",
  });

  const disabledTocRoot = `.main-wrapper:has(.theme-doc-markdown .disable_numbered_headings) ${tocContainers} .table-of-contents`;
  for (const suffix of tocPseudoLevels) {
    assertDeclarations(root, disabledTocRoot + suffix, {
      content: "none !important",
    });
  }
});

test("preserves TOC link and list layout on desktop and mobile", () => {
  const root = roots.get("src/numbered-headings.css");

  assertDeclarations(root, `${tocRoot} a.table-of-contents__link`, {
    display: "inline !important",
  });
  assertDeclarations(root, `${tocRoot} li`, {
    "list-style": "none",
  });
});

for (const convention of conventions) {
  test(`preserves ${convention.name} heading and TOC counter semantics`, () => {
    const root = roots.get(`src/styles/${convention.name}.css`);

    headingCounters.forEach(([level, declarations], index) => {
      assertDeclarations(root, `${documentRoot} ${level}`, declarations);
      assertDeclarations(root, `${documentRoot} ${level}::before`, {
        content: convention.headingContent[index],
      });
    });

    tocPseudoLevels.forEach((suffix, index) => {
      assertDeclarations(root, tocRoot + suffix, {
        content: convention.tocContent[index],
      });
    });
  });

  test(`gives the ${convention.name} document override narrow precedence`, () => {
    const root = roots.get(`src/styles/${convention.name}-override.css`);
    const overrideClass = `.numbered_headings_${convention.name.replaceAll("-", "_")}`;
    const headingRoot = `${documentRoot} ${overrideClass}`;
    const overrideTocRoot = `.main-wrapper:has(${headingRoot}) ${tocContainers} .table-of-contents`;

    headingCounters.forEach(([level, declarations], index) => {
      assertDeclarations(root, `${headingRoot} ${level}`, declarations);
      assertDeclarations(root, `${headingRoot} ${level}::before`, {
        content: convention.headingContent[index],
      });
    });

    tocPseudoLevels.forEach((suffix, index) => {
      assertDeclarations(root, overrideTocRoot + suffix, {
        content: convention.tocContent[index],
      });
    });
  });
}

test("keeps the Spanish ordinal counter style identical and complete", () => {
  const globalRoot = roots.get("src/styles/spanish-forense.css");
  const overrideRoot = roots.get("src/styles/spanish-forense-override.css");
  const findOrdinal = (root) => {
    const rules = [];
    root.walkAtRules("counter-style", (rule) => {
      if (rule.params === "spanish-ordinal") rules.push(rule);
    });
    assert.equal(rules.length, 1);
    return rules[0];
  };

  const globalOrdinal = findOrdinal(globalRoot);
  const overrideOrdinal = findOrdinal(overrideRoot);
  assert.equal(overrideOrdinal.toString(), globalOrdinal.toString());
  assert.deepEqual(
    Object.fromEntries(
      globalOrdinal.nodes.map((declaration) => [
        declaration.prop,
        normalize(declaration.value),
      ]),
    ),
    {
      system: "fixed",
      symbols:
        '"Primero" "Segundo" "Tercero" "Cuarto" "Quinto" "Sexto" "Séptimo" "Octavo" "Noveno" "Décimo" "Undécimo" "Duodécimo" "Decimotercero" "Decimocuarto" "Decimoquinto" "Decimosexto" "Decimoséptimo" "Decimoctavo" "Decimonoveno" "Vigésimo"',
      suffix: '""',
    },
  );
});
