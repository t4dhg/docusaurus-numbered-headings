import assert from "node:assert/strict";
import { statSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertSpawnSucceeded,
  resolveNpmInvocation,
} from "./command-utils.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageName = "docusaurus-numbered-headings";
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
const consumerDependencies = [
  "@docusaurus/core@3.10.2",
  "@docusaurus/types@3.10.2",
  "@types/react@18.3.31",
  "@types/react-dom@18.3.7",
  "react@18.3.1",
  "react-dom@18.3.1",
  "typescript@5.9.3",
];
const expectedFiles = [
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "MIGRATION.md",
  "README.md",
  "SECURITY.md",
  "lib/index.d.mts",
  "lib/index.d.ts",
  "lib/index.js",
  "lib/index.mjs",
  "lib/numbered-headings.css",
  "lib/styles/iso-2145-override.css",
  "lib/styles/iso-2145.css",
  "lib/styles/spanish-forense-override.css",
  "lib/styles/spanish-forense.css",
  "lib/styles/usa-classic-override.css",
  "lib/styles/usa-classic.css",
  "package.json",
].sort();
const expectedClientModules = [
  "numbered-headings.css",
  "styles/iso-2145.css",
  "styles/iso-2145-override.css",
  "styles/usa-classic-override.css",
  "styles/spanish-forense-override.css",
];

const temporaryRoot = await mkdtemp(join(tmpdir(), "dnh-package-test-"));
const cacheDir = join(temporaryRoot, "npm-cache");
const packDir = join(temporaryRoot, "pack");

function run(command, args, { cwd = rootDir } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
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

async function installConsumer(name, type, entryFile, entrySource, tarball) {
  const consumerDir = join(temporaryRoot, name);
  await mkdir(consumerDir, { recursive: true });
  await writeJson(join(consumerDir, "package.json"), {
    private: true,
    type,
  });
  runNpm(
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarball,
      ...consumerDependencies,
    ],
    { cwd: consumerDir },
  );
  runNpm(["ls", "--all"], { cwd: consumerDir });
  await writeFile(join(consumerDir, entryFile), entrySource);
  run(process.execPath, [entryFile], { cwd: consumerDir });
  return consumerDir;
}

const commonJsConsumer = `
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const packageApi = require("${packageName}");

assert.equal(typeof packageApi.default, "function");
assert.equal(typeof packageApi.remarkFrontmatterToggle, "function");
const packageRoot = path.dirname(require.resolve("${packageName}/package.json"));
const expected = ${JSON.stringify(expectedClientModules)}.map((file) =>
  path.join(packageRoot, "lib", file),
);
const modules = packageApi.default({}, {}).getClientModules();
assert.deepEqual(modules, expected);
for (const modulePath of modules) assert.equal(fs.existsSync(modulePath), true);
`;

const esmConsumer = `
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import plugin, { remarkFrontmatterToggle } from "${packageName}";

assert.equal(typeof plugin, "function");
assert.equal(typeof remarkFrontmatterToggle, "function");
const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("${packageName}/package.json"));
const expected = ${JSON.stringify(expectedClientModules)}.map((file) =>
  path.join(packageRoot, "lib", file),
);
const modules = plugin({}, {}).getClientModules();
assert.deepEqual(modules, expected);
for (const modulePath of modules) assert.equal(fs.existsSync(modulePath), true);
`;

const commonJsTypescriptConsumer = `
import packageApi = require("${packageName}");
import type { Convention, PluginOptions } from "${packageName}";

const convention: Convention = "usa-classic";
const options = { enabled: true, convention } satisfies PluginOptions;
const plugin = packageApi.default(
  {} as Parameters<typeof packageApi.default>[0],
  options,
);
const transform = packageApi.remarkFrontmatterToggle();

void plugin;
void transform;
`;

function runTypeScript(consumerDir, entryFile) {
  run(
    process.execPath,
    [
      resolve(consumerDir, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      entryFile,
    ],
    { cwd: consumerDir },
  );
}

try {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(packDir, { recursive: true });

  const packOutput = runNpm([
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    packDir,
  ]);
  const packReports = JSON.parse(packOutput);
  assert.equal(packReports.length, 1);
  const [packReport] = packReports;
  assert.deepEqual(
    packReport.files.map(({ path }) => path).sort(),
    expectedFiles,
  );

  const tarball = join(packDir, packReport.filename);
  assert.equal((await stat(tarball)).isFile(), true);

  const commonJsConsumerDir = await installConsumer(
    "commonjs-consumer",
    "commonjs",
    "smoke.cjs",
    commonJsConsumer,
    tarball,
  );
  const moduleConsumerDir = await installConsumer(
    "esm-consumer",
    "module",
    "smoke.mjs",
    esmConsumer,
    tarball,
  );

  await writeFile(
    join(commonJsConsumerDir, "typescript-consumer.cts"),
    commonJsTypescriptConsumer,
  );
  runTypeScript(commonJsConsumerDir, "typescript-consumer.cts");

  await copyFile(
    resolve(rootDir, "test", "fixtures", "typescript-consumer.mts"),
    join(moduleConsumerDir, "typescript-consumer.mts"),
  );
  runTypeScript(moduleConsumerDir, "typescript-consumer.mts");

  const installedDocusaurusTypes = JSON.parse(
    await readFile(
      join(
        moduleConsumerDir,
        "node_modules",
        "@docusaurus",
        "types",
        "package.json",
      ),
      "utf8",
    ),
  );
  assert.equal(installedDocusaurusTypes.version, "3.10.2");

  const installedMetadata = JSON.parse(
    await readFile(
      join(moduleConsumerDir, "node_modules", packageName, "package.json"),
      "utf8",
    ),
  );
  assert.equal(
    installedMetadata.peerDependencies["@docusaurus/types"],
    "^3.0.0",
  );

  console.log("Packed package contract verified.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
