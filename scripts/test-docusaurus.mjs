import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSpawnSucceeded,
  resolveNpmInvocation,
} from "./command-utils.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureSource = join(rootDir, "test", "fixtures", "docusaurus-site");
const packageName = "docusaurus-numbered-headings";
const packageVersion = "2.0.0";
const npmInvocation = resolveNpmInvocation({
  platform: process.platform,
  nodeExecutable: process.execPath,
  npmExecPath: process.env.npm_execpath,
  isFile: (candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  },
});

const cases = [
  { name: "disabled", env: { DNH_ENABLED: "false" } },
  {
    name: "iso",
    env: { DNH_CONVENTION: "iso-2145" },
    defaultDocumentH3Content: 'counter(h2counter) "." counter(h3counter) ". "',
  },
  {
    name: "usa",
    env: { DNH_CONVENTION: "usa-classic" },
    defaultDocumentH3Content: 'counter(h3counter,upper-alpha) ". "',
  },
  {
    name: "spanish",
    env: { DNH_CONVENTION: "spanish-forense" },
    defaultDocumentH3Content: 'counter(h3counter,spanish-ordinal) ".- "',
  },
];

const documentRoutes = [
  {
    route: "docs/default",
    content: "Default level two",
    wrapper: undefined,
  },
  {
    route: "docs/disabled",
    content: "Disabled level two",
    wrapper: "disable_numbered_headings",
  },
  {
    route: "docs/iso",
    content: "ISO level two",
    wrapper: "numbered_headings_iso_2145",
  },
  {
    route: "docs/usa",
    content: "USA level two",
    wrapper: "numbered_headings_usa_classic",
  },
  {
    route: "docs/spanish",
    content: "Spanish level two",
    wrapper: "numbered_headings_spanish_forense",
  },
];

function run(command, args, { cwd = rootDir, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      NO_UPDATE_NOTIFIER: "true",
      npm_config_cache: cacheDir,
      npm_config_update_notifier: "false",
    },
    shell: false,
  });

  assertSpawnSucceeded(command, args, result);
  return result.stdout;
}

function runNpm(args, options) {
  return run(
    npmInvocation.command,
    [...npmInvocation.prefixArgs, ...args],
    options,
  );
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function readRoute(outputDir, route) {
  return readFile(join(outputDir, route, "index.html"), "utf8");
}

async function findCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return findCssFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
    }),
  );

  return files.flat();
}

async function emittedCss(outputDir) {
  const files = await findCssFiles(outputDir);
  assert.ok(files.length > 0, "expected Docusaurus to emit CSS assets");
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join(
    "\n",
  );
}

async function assertDocumentRoutes(outputDir) {
  for (const { route, content, wrapper } of documentRoutes) {
    const html = await readRoute(outputDir, route);
    assert.match(html, new RegExp(content), `expected ${route} to render`);
    if (wrapper) {
      assert.match(
        html,
        new RegExp(`class=\\"${wrapper}\\"`),
        `expected ${route} wrapper`,
      );
    } else {
      assert.doesNotMatch(
        html,
        /(?:disable_numbered_headings|numbered_headings_(?:iso_2145|usa_classic|spanish_forense))/u,
        `expected ${route} to use the configured default behavior`,
      );
    }
  }
}

async function assertNonDocumentPage(outputDir) {
  const html = await readRoute(outputDir, "");
  assert.match(html, /Non-document level two/u);
  assert.doesNotMatch(
    html,
    /(?:disable_numbered_headings|numbered_headings_(?:iso_2145|usa_classic|spanish_forense))/u,
    "non-doc pages must not receive document wrappers",
  );
}

function assertScopedCss(css) {
  const normalized = css.replace(/\s+/gu, " ").replace(/\s*,\s*/gu, ",");
  assert.match(
    normalized,
    /\.theme-doc-markdown\{counter-reset:h2counter\}/u,
    "expected document counters to remain scoped to document markdown",
  );
  assert.match(
    normalized,
    /\.main-wrapper \.theme-doc-toc-desktop \.table-of-contents,\.main-wrapper \.theme-doc-toc-mobile \.table-of-contents\{counter-reset:toc-h2\}/u,
    "expected shared desktop/mobile TOC counter root",
  );
  assert.doesNotMatch(
    normalized,
    /(?:^|[}])h[2-5]\{[^}]*counter-(?:increment|reset):/u,
    "must not emit a bare heading counter selector",
  );
}

function assertDefaultDocumentConventionCss(testCase, css) {
  const normalized = css.replace(/\s+/gu, " ").replace(/\s*,\s*/gu, ",");
  const content = testCase.defaultDocumentH3Content.replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&",
  );

  assert.match(
    normalized,
    new RegExp(
      `\\.theme-doc-markdown h3(?::|::)before\\{content:${content}\\}`,
      "u",
    ),
    `expected ${testCase.name} global convention content for the unwrapped default document`,
  );
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "dnh-docusaurus-test-"));
const cacheDir = join(temporaryRoot, "npm-cache");
const packDir = join(temporaryRoot, "pack");
const fixtureDir = join(temporaryRoot, "site");

try {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(packDir, { recursive: true });
  runNpm(["run", "build"]);

  const packOutput = runNpm([
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    packDir,
  ]);
  const packReports = JSON.parse(packOutput);
  assert.equal(packReports.length, 1, "expected one packed package");
  const [packReport] = packReports;
  assert.equal(packReport.version, packageVersion);
  const tarball = join(packDir, packReport.filename);
  assert.equal((await stat(tarball)).isFile(), true, "expected npm tarball");

  await cp(fixtureSource, fixtureDir, { recursive: true });
  await writeJson(join(fixtureDir, "package.json"), {
    name: "dnh-docusaurus-fixture",
    private: true,
    dependencies: {
      "@docusaurus/core": "3.10.2",
      "@docusaurus/preset-classic": "3.10.2",
      [packageName]: `file:${tarball}`,
      react: "19.2.8",
      "react-dom": "19.2.8",
    },
  });
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: fixtureDir,
  });

  const installedPackage = JSON.parse(
    await readFile(
      join(fixtureDir, "node_modules", packageName, "package.json"),
      "utf8",
    ),
  );
  assert.equal(installedPackage.version, packageVersion);
  const docusaurusBin = join(
    fixtureDir,
    "node_modules",
    "@docusaurus",
    "core",
    "bin",
    "docusaurus.mjs",
  );
  assert.equal((await stat(docusaurusBin)).isFile(), true);

  for (const testCase of cases) {
    const outputDir = join(temporaryRoot, `build-${testCase.name}`);
    run(process.execPath, [docusaurusBin, "build", "--out-dir", outputDir], {
      cwd: fixtureDir,
      env: testCase.env,
    });

    await assertDocumentRoutes(outputDir);
    await assertNonDocumentPage(outputDir);
    const css = await emittedCss(outputDir);
    if (testCase.name === "disabled") {
      assert.doesNotMatch(
        css,
        /\.theme-doc-markdown\{counter-reset:h2counter\}/u,
        "disabled plugin must not emit numbered-heading CSS",
      );
    } else {
      assertScopedCss(css);
      assertDefaultDocumentConventionCss(testCase, css);
    }
  }

  console.log(
    "Docusaurus packed-package fixture verified: disabled, iso, usa, spanish.",
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
