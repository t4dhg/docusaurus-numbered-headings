const test = require("node:test");
const assert = require("node:assert/strict");

const { remarkFrontmatterToggle } = require("../lib/index.js");

function transform(children, frontMatter, path) {
  const tree = { type: "root", children };
  const file = { data: { frontMatter } };
  if (path !== undefined) file.path = path;

  remarkFrontmatterToggle()(tree, file);
  return tree;
}

test("leaves the document unchanged when numbered_headings is omitted or true", () => {
  const children = [{ type: "heading", depth: 2, children: [] }];

  assert.deepEqual(transform(children, {}), { type: "root", children });
  assert.deepEqual(transform(children, { numbered_headings: true }), {
    type: "root",
    children,
  });
});

const classByValue = new Map([
  [false, "disable_numbered_headings"],
  ["iso-2145", "numbered_headings_iso_2145"],
  ["usa-classic", "numbered_headings_usa_classic"],
  ["spanish-forense", "numbered_headings_spanish_forense"],
]);

for (const [value, className] of classByValue) {
  test(`wraps renderable children once for ${JSON.stringify(value)}`, () => {
    const yaml = { type: "yaml", value: "title: Example" };
    const esm = { type: "mdxjsEsm", value: "export const answer = 42" };
    const toml = { type: "toml", value: 'title = "Example"' };
    const heading = { type: "heading", depth: 2, children: [] };
    const paragraph = { type: "paragraph", children: [] };

    const tree = transform([yaml, heading, esm, paragraph, toml], {
      numbered_headings: value,
    });

    assert.deepEqual(tree, {
      type: "root",
      children: [
        yaml,
        esm,
        toml,
        {
          type: "mdxJsxFlowElement",
          name: "div",
          attributes: [
            {
              type: "mdxJsxAttribute",
              name: "className",
              value: className,
            },
          ],
          children: [heading, paragraph],
        },
      ],
    });
  });
}

const invalidValues = [
  [undefined, "undefined"],
  [null, "null"],
  [7, "7"],
  [["iso-2145"], '["iso-2145"]'],
  [{ convention: "iso-2145" }, '{"convention":"iso-2145"}'],
  ["legal", '"legal"'],
];

for (const [value, received] of invalidValues) {
  test(`rejects present invalid numbered_headings value ${received}`, () => {
    assert.throws(
      () =>
        transform(
          [{ type: "paragraph", children: [] }],
          { numbered_headings: value },
          "docs/example.mdx",
        ),
      {
        name: "TypeError",
        message:
          '[docusaurus-numbered-headings] frontmatter "numbered_headings" in docs/example.mdx must be true, false, iso-2145, usa-classic, or spanish-forense; received ' +
          received,
      },
    );
  });
}

test("reports invalid frontmatter without a path when none is available", () => {
  assert.throws(() => transform([], { numbered_headings: "legal" }), {
    name: "TypeError",
    message:
      '[docusaurus-numbered-headings] frontmatter "numbered_headings" must be true, false, iso-2145, usa-classic, or spanish-forense; received "legal"',
  });
});
