import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const releasePackageName = "docusaurus-numbered-headings";
export const releaseRepository = "t4dhg/docusaurus-numbered-headings";
export const releaseRepositoryUrl = `https://github.com/${releaseRepository}`;
export const releaseWorkflowPath = ".github/workflows/release.yml";
export const releaseManifestFilename = "release-manifest.json";
export const releaseVerifierFilename = "check-release.mjs";
export const expectedPackageFiles = [
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

const shaPattern = /^[0-9a-f]{40}$/u;
const digestPattern = /^[0-9a-f]{128}$/u;
const integrityPattern = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;
const stableTagPattern =
  /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const npmRegistryOrigin = "https://registry.npmjs.org";
const slsaPredicateType = "https://slsa.dev/provenance/v1";
const statementType = "https://in-toto.io/Statement/v1";
const workflowBuildType =
  "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const githubHostedBuilder = "https://github.com/actions/runner/github-hosted";
const modulePath = fileURLToPath(import.meta.url);

function fail(message, { retryable = false, cause } = {}) {
  const error = new Error(`[release-check] ${message}`, cause ? { cause } : {});
  error.retryable = retryable;
  throw error;
}

function assertString(value, label, pattern) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a nonempty string`);
  }
  if (pattern && !pattern.test(value)) fail(`${label} is invalid: ${value}`);
  return value;
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(`${label} must be a JSON object`);
  }
  return value;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is malformed JSON`, { cause: error });
  }
}

function exactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} has unexpected schema keys: ${actual.join(", ")}`);
  }
}

function exactArray(actual, expected, label) {
  if (
    !Array.isArray(actual) ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    fail(`${label} does not match the reviewed allowlist`);
  }
}

function digest(buffer, algorithm, encoding = "hex") {
  return createHash(algorithm).update(buffer).digest(encoding);
}

function sha512Integrity(buffer) {
  return `sha512-${digest(buffer, "sha512", "base64")}`;
}

function atomicWrite(file, contents) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = join(
    dirname(file),
    `.${basename(file)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    writeFileSync(temporary, contents, { flag: "wx" });
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

function atomicCopy(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = join(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    copyFileSync(source, temporary);
    renameSync(temporary, destination);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

function appendOutputs(outputFile, values) {
  assertString(outputFile, "GitHub output file");
  const lines = Object.entries(values).map(([key, value]) => {
    assertString(key, "output name", /^[a-z_]+$/u);
    assertString(value, `output ${key}`, /^[A-Za-z0-9._@/+:-]+$/u);
    return `${key}=${value}`;
  });
  appendFileSync(outputFile, `${lines.join("\n")}\n`, { encoding: "utf8" });
}

export function validateStableTag(tag) {
  assertString(tag, "release tag");
  const match = stableTagPattern.exec(tag);
  if (!match)
    fail(`release tag must be canonical stable vMAJOR.MINOR.PATCH: ${tag}`);
  return { tag, version: tag.slice(1) };
}

function compareStableVersions(left, right) {
  const leftParts = validateStableTag(`v${left}`)
    .version.split(".")
    .map(BigInt);
  const rightParts = validateStableTag(`v${right}`)
    .version.split(".")
    .map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

export function runSubprocess(command, args, options = {}) {
  assertString(command, "subprocess command");
  if (
    !Array.isArray(args) ||
    args.some((argument) => typeof argument !== "string")
  ) {
    fail("subprocess arguments must be a string array");
  }
  const { spawn = spawnSync, ...spawnOptions } = options;
  const result = spawn(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    ...spawnOptions,
  });
  if (!result || typeof result !== "object")
    fail(`${command} returned no result`);
  return result;
}

function commandFailure(command, args, result, { retryable = false } = {}) {
  const context = [command, ...args]
    .map((value) => JSON.stringify(value))
    .join(" ");
  const detail = [result.stdout, result.stderr]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .join("\n");
  if (result.error) {
    fail(
      `${context} failed to start: ${result.error.message}${detail ? `\n${detail}` : ""}`,
      {
        retryable,
        cause: result.error,
      },
    );
  }
  if (result.signal) {
    fail(
      `${context} terminated by signal ${result.signal}${detail ? `\n${detail}` : ""}`,
      {
        retryable,
      },
    );
  }
  fail(
    `${context} exited with status ${String(result.status)}${detail ? `\n${detail}` : ""}`,
    {
      retryable,
    },
  );
}

function runChecked(command, args, options) {
  const result = runSubprocess(command, args, options);
  if (result.error || result.signal || result.status !== 0) {
    commandFailure(command, args, result);
  }
  return result.stdout;
}

function canonicalRepositoryUrl(value) {
  return value === releaseRepositoryUrl ||
    value === `${releaseRepositoryUrl}.git` ||
    value === `git+${releaseRepositoryUrl}.git` ||
    value === `git@github.com:${releaseRepository}.git`
    ? releaseRepositoryUrl
    : undefined;
}

export function preflightRelease({ cwd, env, outputFile } = {}) {
  assertString(cwd, "repository working directory");
  assertPlainObject(env, "release environment");
  if (env.GITHUB_EVENT_NAME !== "push") fail("release requires a push event");
  if (env.GITHUB_REPOSITORY !== releaseRepository) {
    fail(`release repository mismatch: ${String(env.GITHUB_REPOSITORY)}`);
  }
  if (env.GITHUB_REF_TYPE !== "tag") fail("release ref type must be tag");
  const { tag, version } = validateStableTag(env.GITHUB_REF_NAME);
  if (env.GITHUB_REF !== `refs/tags/${tag}`) fail("release tag/ref mismatch");
  const eventCommit = assertString(env.GITHUB_SHA, "event commit", shaPattern);

  const packagePath = join(cwd, "package.json");
  const pkg = assertPlainObject(
    parseJson(readFileSync(packagePath, "utf8"), "package.json"),
    "package.json",
  );
  if (pkg.name !== releasePackageName)
    fail(`package name mismatch: ${String(pkg.name)}`);
  if (pkg.version !== version) {
    fail(`package version ${String(pkg.version)} does not match tag ${tag}`);
  }
  const packageRepository =
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  if (canonicalRepositoryUrl(packageRepository) !== releaseRepositoryUrl) {
    fail("package repository metadata does not match the approved repository");
  }

  const originUrl = runChecked("git", ["remote", "get-url", "origin"], {
    cwd,
  }).trim();
  if (canonicalRepositoryUrl(originUrl) !== releaseRepositoryUrl) {
    fail("origin remote does not match the approved repository");
  }
  const shallow = runChecked("git", ["rev-parse", "--is-shallow-repository"], {
    cwd,
  }).trim();
  if (shallow !== "false")
    fail("release preflight refuses a shallow repository");

  let tagType;
  try {
    tagType = runChecked("git", ["cat-file", "-t", `refs/tags/${tag}`], {
      cwd,
    }).trim();
  } catch (error) {
    fail(`release tag is not an annotated tag object: ${tag}`, {
      cause: error,
    });
  }
  if (tagType !== "tag") fail("release tag must be an annotated tag object");

  const tagCommit = runChecked(
    "git",
    ["rev-parse", "--verify", `${tag}^{commit}`],
    { cwd },
  ).trim();
  let peeledEventCommit;
  try {
    peeledEventCommit = runChecked(
      "git",
      ["rev-parse", "--verify", `${eventCommit}^{commit}`],
      { cwd },
    ).trim();
  } catch (error) {
    fail(`event commit cannot be resolved: ${eventCommit}`, { cause: error });
  }
  if (tagCommit !== peeledEventCommit || tagCommit !== eventCommit) {
    fail("triggering tag commit does not equal the event commit");
  }

  let remoteMaster;
  try {
    remoteMaster = runChecked(
      "git",
      ["rev-parse", "--verify", "refs/remotes/origin/master^{commit}"],
      { cwd },
    ).trim();
  } catch (error) {
    fail("freshly fetched origin/master is missing", { cause: error });
  }
  const ancestry = runSubprocess(
    "git",
    ["merge-base", "--is-ancestor", tagCommit, remoteMaster],
    { cwd },
  );
  if (ancestry.error || ancestry.signal || ancestry.status !== 0) {
    if (!ancestry.error && !ancestry.signal && ancestry.status === 1) {
      fail("tag commit is not contained in origin/master ancestry");
    }
    commandFailure(
      "git",
      ["merge-base", "--is-ancestor", tagCommit, remoteMaster],
      ancestry,
    );
  }

  const result = {
    name: releasePackageName,
    version,
    tag,
    commit: eventCommit,
  };
  if (outputFile) appendOutputs(outputFile, result);
  return result;
}

function parseOctal(header, start, length, label) {
  const text = header
    .subarray(start, start + length)
    .toString("ascii")
    .replace(/\0.*$/u, "")
    .trim();
  if (!/^[0-7]+$/u.test(text)) fail(`tar ${label} is malformed`);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0)
    fail(`tar ${label} is invalid`);
  return value;
}

function tarName(header) {
  const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, "");
  const prefix = header
    .subarray(345, 500)
    .toString("utf8")
    .replace(/\0.*$/u, "");
  return prefix ? `${prefix}/${name}` : name;
}

function validateTarHeaderChecksum(header) {
  const expected = parseOctal(header, 148, 8, "header checksum");
  const copy = Buffer.from(header);
  copy.fill(0x20, 148, 156);
  let actual = 0;
  for (const byte of copy) actual += byte;
  if (actual !== expected) fail("tar header checksum mismatch");
}

function validateTarPath(name, { directory = false } = {}) {
  const normalized = directory && name.endsWith("/") ? name.slice(0, -1) : name;
  if (
    !normalized.startsWith("package/") ||
    normalized.includes("\\") ||
    normalized.includes("\0")
  ) {
    fail(`tar archive path is unsafe: ${name}`);
  }
  const relative = normalized.slice("package/".length);
  if (
    !relative ||
    isAbsolute(relative) ||
    relative.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    fail(`tar archive path is not portable: ${name}`);
  }
  return relative;
}

function inspectTarball(buffer) {
  if (!Buffer.isBuffer(buffer)) fail("tarball must be supplied as bytes");
  let archive;
  try {
    archive = gunzipSync(buffer);
  } catch (error) {
    fail("tarball is not a valid gzip archive", { cause: error });
  }
  const contents = new Map();
  const seenPaths = new Set();
  let offset = 0;
  let terminated = false;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) {
      terminated = true;
      break;
    }
    validateTarHeaderChecksum(header);
    const size = parseOctal(header, 124, 12, "entry size");
    const type = header[156] === 0 ? "0" : String.fromCharCode(header[156]);
    const name = tarName(header);
    if (offset + size > archive.length) fail(`tar entry is truncated: ${name}`);
    if (type === "0") {
      const relative = validateTarPath(name);
      if (seenPaths.has(relative))
        fail(`tar archive contains a duplicate path: ${relative}`);
      seenPaths.add(relative);
      contents.set(
        relative,
        Buffer.from(archive.subarray(offset, offset + size)),
      );
    } else if (type === "5") {
      const relative = validateTarPath(name, { directory: true });
      if (size !== 0) fail(`tar directory entry has content: ${name}`);
      if (seenPaths.has(relative))
        fail(`tar archive contains a duplicate path: ${relative}`);
      seenPaths.add(relative);
    } else {
      fail(`tar archive contains unsupported entry type ${type}: ${name}`);
    }
    offset += Math.ceil(size / 512) * 512;
  }
  if (!terminated) fail("tar archive has no terminating zero block");
  return { files: [...contents.keys()].sort(), contents };
}

export function listTarballFiles(buffer) {
  return inspectTarball(buffer).files;
}

export function validateTarballContract(
  buffer,
  { expectedName, expectedVersion },
) {
  assertString(expectedName, "expected tarball package name");
  assertString(expectedVersion, "expected tarball package version");
  const stable = validateStableTag(`v${expectedVersion}`);
  if (stable.version !== expectedVersion)
    fail("expected tarball package version is not canonical");
  const archive = inspectTarball(buffer);
  exactArray(
    archive.files,
    expectedPackageFiles,
    "tarball archive file allowlist",
  );
  const packageJsonBytes = archive.contents.get("package.json");
  if (!packageJsonBytes) fail("tarball package.json is missing");
  const packageJson = assertPlainObject(
    parseJson(packageJsonBytes.toString("utf8"), "tarball package.json"),
    "tarball package.json",
  );
  if (packageJson.name !== expectedName)
    fail("tarball package.json name mismatch");
  if (packageJson.version !== expectedVersion)
    fail("tarball package.json version mismatch");
  return archive.files;
}

function validatePackReport(report, tarball) {
  if (!Array.isArray(report) || report.length !== 1) {
    fail("npm pack report must describe exactly one artifact");
  }
  const packed = assertPlainObject(report[0], "npm pack report entry");
  if (packed.name !== releasePackageName)
    fail("npm pack package name mismatch");
  const { version } = validateStableTag(`v${String(packed.version)}`);
  if (packed.version !== version)
    fail("npm pack package version is not canonical");
  const expectedFilename = `${releasePackageName}-${version}.tgz`;
  if (packed.filename !== expectedFilename)
    fail("npm pack filename/version mismatch");
  if (packed.size !== tarball.length)
    fail("npm pack reported size does not match tarball bytes");
  const actualIntegrity = sha512Integrity(tarball);
  if (packed.integrity !== actualIntegrity)
    fail("npm pack integrity does not match tarball bytes");
  if (!Array.isArray(packed.files)) fail("npm pack report has no file list");
  const reportFiles = packed.files.map((entry) => entry?.path).sort();
  exactArray(
    reportFiles,
    expectedPackageFiles,
    "npm pack archive file allowlist",
  );
  if (
    packed.entryCount !== undefined &&
    packed.entryCount !== expectedPackageFiles.length
  ) {
    fail("npm pack entry count does not match the archive allowlist");
  }
  validateTarballContract(tarball, {
    expectedName: releasePackageName,
    expectedVersion: version,
  });
  return { packed, version, expectedFilename, actualIntegrity };
}

function validateManifest(manifest, { expectedTag, expectedCommit } = {}) {
  exactKeys(
    manifest,
    [
      "schema",
      "name",
      "version",
      "tag",
      "commit",
      "filename",
      "size",
      "integrity",
      "sha256",
      "sha512",
      "files",
    ],
    "release manifest",
  );
  if (manifest.schema !== 1) fail("release manifest schema must be 1");
  if (manifest.name !== releasePackageName)
    fail("release manifest package name mismatch");
  const { tag, version } = validateStableTag(manifest.tag);
  if (manifest.version !== version)
    fail("release manifest tag/version mismatch");
  if (expectedTag !== undefined && tag !== expectedTag)
    fail("release manifest tag mismatch");
  assertString(manifest.commit, "release manifest commit", shaPattern);
  if (expectedCommit !== undefined && manifest.commit !== expectedCommit) {
    fail("release manifest commit mismatch");
  }
  const expectedFilename = `${releasePackageName}-${version}.tgz`;
  if (
    manifest.filename !== expectedFilename ||
    basename(manifest.filename) !== manifest.filename
  ) {
    fail("release manifest filename is not the expected basename");
  }
  if (!Number.isSafeInteger(manifest.size) || manifest.size <= 0) {
    fail("release manifest size is invalid");
  }
  assertString(
    manifest.integrity,
    "release manifest integrity",
    integrityPattern,
  );
  assertString(manifest.sha256, "release manifest SHA-256", /^[0-9a-f]{64}$/u);
  assertString(manifest.sha512, "release manifest SHA-512", digestPattern);
  exactArray(
    manifest.files,
    expectedPackageFiles,
    "release manifest file allowlist",
  );
  if (
    manifest.files.some((file) => isAbsolute(file) || basename(file) === "")
  ) {
    fail("release manifest contains a nonportable file path");
  }
  return manifest;
}

export function prepareReleaseBundle({
  packReportPath,
  packDirectory,
  bundleDirectory,
  tag,
  commit,
  verifierPath = modulePath,
}) {
  const stable = validateStableTag(tag);
  assertString(commit, "release commit", shaPattern);
  if (existsSync(bundleDirectory))
    fail("release bundle directory already exists");
  const report = parseJson(
    readFileSync(packReportPath, "utf8"),
    "npm pack report",
  );
  if (!Array.isArray(report) || report.length !== 1) {
    fail("npm pack report must describe exactly one artifact");
  }
  if (report[0]?.name !== releasePackageName)
    fail("npm pack package name mismatch");
  if (report[0]?.version !== stable.version) {
    fail("npm pack package version does not match the release tag");
  }
  const reportedFilename = report[0]?.filename;
  if (
    typeof reportedFilename !== "string" ||
    basename(reportedFilename) !== reportedFilename
  ) {
    fail("npm pack filename must be a basename");
  }
  if (reportedFilename !== `${releasePackageName}-${stable.version}.tgz`) {
    fail("npm pack filename/version mismatch");
  }
  const tarballPath = join(packDirectory, reportedFilename);
  const tarballStat = lstatSync(tarballPath);
  if (!tarballStat.isFile() || tarballStat.isSymbolicLink()) {
    fail("npm pack tarball must be a regular file");
  }
  const tarball = readFileSync(tarballPath);
  const validated = validatePackReport(report, tarball);
  if (validated.version !== stable.version)
    fail("npm pack version does not match release tag");
  if (basename(verifierPath) !== releaseVerifierFilename) {
    fail("release verifier must use the reviewed basename");
  }

  const manifest = {
    schema: 1,
    name: releasePackageName,
    version: stable.version,
    tag: stable.tag,
    commit,
    filename: validated.expectedFilename,
    size: tarball.length,
    integrity: validated.actualIntegrity,
    sha256: digest(tarball, "sha256"),
    sha512: digest(tarball, "sha512"),
    files: expectedPackageFiles,
  };
  validateManifest(manifest, { expectedTag: tag, expectedCommit: commit });

  mkdirSync(bundleDirectory, { recursive: false });
  try {
    atomicCopy(tarballPath, join(bundleDirectory, manifest.filename));
    atomicCopy(verifierPath, join(bundleDirectory, releaseVerifierFilename));
    atomicWrite(
      join(bundleDirectory, releaseManifestFilename),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return validateReleaseBundle({
      bundleDirectory,
      expectedTag: tag,
      expectedCommit: commit,
    });
  } catch (error) {
    rmSync(bundleDirectory, { recursive: true, force: true });
    throw error;
  }
}

export function validateReleaseBundle({
  bundleDirectory,
  expectedTag,
  expectedCommit,
}) {
  const entries = readdirSync(bundleDirectory).sort();
  const manifestPath = join(bundleDirectory, releaseManifestFilename);
  const manifestStat = lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    fail("release manifest must be a regular file");
  }
  const manifest = validateManifest(
    parseJson(readFileSync(manifestPath, "utf8"), "release manifest"),
    { expectedTag, expectedCommit },
  );
  exactArray(
    entries,
    [
      releaseVerifierFilename,
      releaseManifestFilename,
      manifest.filename,
    ].sort(),
    "release bundle entries",
  );
  const tarballPath = join(bundleDirectory, manifest.filename);
  const tarballStat = lstatSync(tarballPath);
  if (!tarballStat.isFile() || tarballStat.isSymbolicLink()) {
    fail("release tarball must be a regular file");
  }
  const verifierStat = lstatSync(
    join(bundleDirectory, releaseVerifierFilename),
  );
  if (!verifierStat.isFile() || verifierStat.isSymbolicLink()) {
    fail("release verifier must be a regular file");
  }
  const tarball = readFileSync(tarballPath);
  if (tarball.length !== manifest.size) fail("release tarball size mismatch");
  if (sha512Integrity(tarball) !== manifest.integrity)
    fail("release tarball integrity mismatch");
  if (digest(tarball, "sha256") !== manifest.sha256)
    fail("release tarball SHA-256 mismatch");
  if (digest(tarball, "sha512") !== manifest.sha512)
    fail("release tarball SHA-512 mismatch");
  const archiveFiles = validateTarballContract(tarball, {
    expectedName: manifest.name,
    expectedVersion: manifest.version,
  });
  exactArray(archiveFiles, manifest.files, "release tarball file allowlist");
  return manifest;
}

export function resolveSuppliedTarball(
  args,
  { expectedName, expectedVersion, pack, lstat = lstatSync } = {},
) {
  if (!Array.isArray(args)) fail("tarball arguments must be an array");
  if (args.length === 0) {
    if (typeof pack !== "function")
      fail("default package verification requires a pack function");
    return pack();
  }
  if (args.length !== 2 || args[0] !== "--tarball") {
    fail("usage: test-package.mjs [--tarball <exact-package.tgz>]");
  }
  assertString(expectedName, "expected package name");
  assertString(expectedVersion, "expected package version");
  const supplied = resolve(args[1]);
  const expectedFilename = `${expectedName}-${expectedVersion}.tgz`;
  if (basename(supplied) !== expectedFilename) {
    fail(`supplied tarball filename must be ${expectedFilename}`);
  }
  let details;
  try {
    details = lstat(supplied);
  } catch (error) {
    fail(`supplied tarball is missing: ${expectedFilename}`, { cause: error });
  }
  if (!details.isFile() || details.isSymbolicLink()) {
    fail("supplied tarball must be a regular file");
  }
  return supplied;
}

function npmErrorObject(result) {
  for (const candidate of [result.stderr, result.stdout]) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.error) return parsed.error;
    } catch {
      // The caller retains the original command output for the final error.
    }
  }
  return undefined;
}

function registryErrorIsRetryable(errorCode) {
  return /^(?:EAI_AGAIN|ECONNRESET|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|EHOSTUNREACH)$/u.test(
    String(errorCode),
  );
}

function expectedRegistryTarballUrl(name, version) {
  return `${npmRegistryOrigin}/${name}/-/${name}-${version}.tgz`;
}

export function classifyRegistryView(result, expected) {
  assertPlainObject(result, "npm view result");
  assertPlainObject(expected, "expected registry metadata");
  if (result.error || result.signal) {
    commandFailure(
      "npm",
      ["view", `${expected.name}@${expected.version}`],
      result,
      {
        retryable: Boolean(result.error),
      },
    );
  }
  if (result.status === 0) {
    const metadata = assertPlainObject(
      parseJson(result.stdout, "npm view response"),
      "npm view response",
    );
    if (metadata.name !== expected.name) fail("registry package name mismatch");
    if (metadata.version !== expected.version)
      fail("registry package version mismatch");
    if (metadata.dist?.integrity !== expected.integrity)
      fail("registry integrity mismatch");
    if (
      metadata.dist?.tarball !==
      expectedRegistryTarballUrl(expected.name, expected.version)
    ) {
      fail("registry tarball URL does not match the public npm registry");
    }
    return { state: "existing", metadata };
  }
  const npmError = npmErrorObject(result);
  const spec = `${expected.name}@${expected.version}`;
  const missingSummary = `No match found for version ${expected.version}`;
  const missingDetail =
    `The requested resource '${spec}' could not be found or you do not have permission to access it.` +
    "\n\nNote that you can also install from a\ntarball, folder, http url, or git url.";
  if (
    result.status === 1 &&
    npmError?.code === "E404" &&
    npmError.summary === missingSummary &&
    npmError.detail === missingDetail
  ) {
    return { state: "missing" };
  }
  const code = npmError?.code;
  commandFailure("npm", ["view", spec], result, {
    retryable: registryErrorIsRetryable(code),
  });
}

export function validateRegistryTarball(
  registryTarballPath,
  preparedTarballPath,
  manifest,
) {
  validateManifest(manifest);
  const registryBytes = readFileSync(registryTarballPath);
  const preparedBytes = readFileSync(preparedTarballPath);
  if (!registryBytes.equals(preparedBytes))
    fail("registry tarball is not byte-for-byte identical");
  if (registryBytes.length !== manifest.size)
    fail("registry tarball size mismatch");
  if (sha512Integrity(registryBytes) !== manifest.integrity) {
    fail("registry tarball integrity mismatch");
  }
  if (digest(registryBytes, "sha512") !== manifest.sha512) {
    fail("registry tarball SHA-512 mismatch");
  }
  return true;
}

export async function pollRegistry({ attempts, delayMs, check, sleep }) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60) {
    fail("registry polling attempts must be between 1 and 60");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
    fail("registry polling delay must be between 0 and 60000 milliseconds");
  }
  if (typeof check !== "function" || typeof sleep !== "function") {
    fail("registry polling requires check and sleep functions");
  }
  let lastReason = "not yet available";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await check(attempt);
    if (result?.state === "verified") return result;
    if (result?.state !== "retry")
      fail("registry check returned an invalid state");
    lastReason = result.reason || lastReason;
    if (attempt < attempts) await sleep(delayMs);
  }
  fail(
    `registry propagation did not verify after ${attempts} attempts: ${lastReason}`,
  );
}

export function validateAuditSignatures(audit, expected) {
  assertPlainObject(audit, "npm audit signatures response");
  assertPlainObject(expected, "expected npm audit target");
  if (
    !Array.isArray(audit.invalid) ||
    !Array.isArray(audit.missing) ||
    !Array.isArray(audit.verified)
  ) {
    fail(
      "npm audit signatures response must contain invalid, missing, and verified arrays",
    );
  }
  if (audit.invalid.length !== 0)
    fail("npm audit signatures reported invalid entries");
  if (audit.missing.length !== 0)
    fail("npm audit signatures reported missing entries");
  const targets = audit.verified.filter(
    (entry) =>
      entry?.name === expected.name && entry?.version === expected.version,
  );
  if (targets.length !== 1)
    fail("npm audit signatures has no exact verified target entry");
  const target = assertPlainObject(targets[0], "verified target entry");
  if (target.location !== `node_modules/${expected.name}`) {
    fail("verified target location mismatch");
  }
  if (target.registry !== `${npmRegistryOrigin}/`) {
    fail("verified target registry mismatch");
  }
  if (target.attestations?.provenance?.predicateType !== slsaPredicateType) {
    fail("verified target provenance metadata mismatch");
  }
  if (!Array.isArray(target.attestationBundles)) {
    fail("verified target has no attestation bundles");
  }
  return target;
}

export function validateInstalledTarget(lockfile, expected) {
  assertPlainObject(lockfile, "installed package lockfile");
  assertPlainObject(expected, "expected installed target");
  const entry = lockfile.packages?.[`node_modules/${expected.name}`];
  assertPlainObject(entry, "installed target entry");
  if (entry.version !== expected.version)
    fail("installed target version mismatch");
  if (entry.resolved !== expected.tarballUrl)
    fail("installed target tarball URL mismatch");
  if (entry.integrity !== expected.integrity)
    fail("installed target integrity mismatch");
  return true;
}

function decodeSlsaStatement(verifiedTarget) {
  assertPlainObject(verifiedTarget, "verified npm audit target");
  if (!Array.isArray(verifiedTarget.attestationBundles)) {
    fail("verified npm audit target has no attestation bundles");
  }
  const candidates = verifiedTarget.attestationBundles.filter(
    (entry) => entry?.predicateType === slsaPredicateType,
  );
  if (candidates.length !== 1)
    fail("expected exactly one SLSA provenance bundle");
  const envelope = candidates[0]?.bundle?.dsseEnvelope;
  assertPlainObject(envelope, "SLSA DSSE envelope");
  if (envelope.payloadType !== "application/vnd.in-toto+json") {
    fail("SLSA DSSE payload type mismatch");
  }
  assertString(envelope.payload, "SLSA DSSE payload");
  let decoded;
  try {
    decoded = Buffer.from(envelope.payload, "base64").toString("utf8");
  } catch (error) {
    fail("SLSA DSSE payload is not base64", { cause: error });
  }
  return assertPlainObject(
    parseJson(decoded, "SLSA DSSE statement"),
    "SLSA statement",
  );
}

function requireField(condition, field) {
  if (!condition) fail(`SLSA provenance ${field} mismatch`);
}

export function validateProvenance(metadata, verifiedTarget, expected) {
  assertPlainObject(metadata, "registry metadata");
  assertPlainObject(expected, "expected provenance binding");
  requireField(
    metadata.dist?.attestations?.provenance?.predicateType ===
      slsaPredicateType,
    "attestation metadata",
  );
  requireField(
    verifiedTarget.attestations?.provenance?.predicateType ===
      slsaPredicateType,
    "verified target attestation metadata",
  );
  const statement = decodeSlsaStatement(verifiedTarget);
  requireField(statement._type === statementType, "statement type");
  requireField(statement.predicateType === slsaPredicateType, "predicate type");
  const subject = Array.isArray(statement.subject)
    ? statement.subject.find(
        (entry) =>
          entry?.name === `pkg:npm/${expected.name}@${expected.version}`,
      )
    : undefined;
  requireField(Boolean(subject), "package or version subject");
  requireField(subject.digest?.sha512 === expected.sha512, "digest");

  const definition = statement.predicate?.buildDefinition;
  requireField(definition?.buildType === workflowBuildType, "build type");
  const workflow = definition?.externalParameters?.workflow;
  requireField(workflow?.repository === expected.repository, "repository");
  requireField(workflow?.path === expected.workflow, "workflow");
  requireField(workflow?.ref === `refs/tags/${expected.tag}`, "tag");
  requireField(
    definition?.internalParameters?.github?.event_name === "push",
    "event",
  );
  const dependency = Array.isArray(definition?.resolvedDependencies)
    ? definition.resolvedDependencies.find(
        (entry) =>
          entry?.uri === `git+${expected.repository}@refs/tags/${expected.tag}`,
      )
    : undefined;
  requireField(Boolean(dependency), "tag dependency");
  requireField(dependency.digest?.gitCommit === expected.commit, "commit");
  requireField(
    statement.predicate?.runDetails?.builder?.id === githubHostedBuilder,
    "GitHub-hosted builder",
  );
  return statement;
}

function parseOptions(args, allowed) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!allowed.includes(option) || value === undefined) {
      fail(`unexpected command arguments: ${args.join(" ")}`);
    }
    if (values[option] !== undefined)
      fail(`duplicate command option: ${option}`);
    values[option] = value;
  }
  return values;
}

function validatePackDownloadReport(result, expected, downloadDirectory) {
  if (result.error || result.signal || result.status !== 0) {
    commandFailure(
      "npm",
      ["pack", `${expected.name}@${expected.version}`],
      result,
      {
        retryable:
          registryErrorIsRetryable(npmErrorObject(result)?.code) ||
          npmErrorObject(result)?.code === "E404",
      },
    );
  }
  const report = parseJson(result.stdout, "npm registry pack response");
  if (!Array.isArray(report) || report.length !== 1) {
    fail("npm registry pack must return exactly one artifact");
  }
  const entry = report[0];
  if (entry.name !== expected.name || entry.version !== expected.version) {
    fail("npm registry pack name/version mismatch");
  }
  if (entry.integrity !== expected.integrity)
    fail("npm registry pack integrity mismatch");
  const expectedFilename = `${expected.name}-${expected.version}.tgz`;
  if (
    entry.filename !== expectedFilename ||
    basename(entry.filename) !== entry.filename
  ) {
    fail("npm registry pack filename does not match the package version");
  }
  return join(downloadDirectory, entry.filename);
}

function npmView(expected) {
  const args = [
    "view",
    `${expected.name}@${expected.version}`,
    "--json",
    "--registry",
    npmRegistryOrigin,
  ];
  const result = runSubprocess("npm", args);
  return classifyRegistryView(result, expected);
}

function downloadRegistryTarball(expected, directory) {
  const args = [
    "pack",
    `${expected.name}@${expected.version}`,
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    directory,
    "--registry",
    npmRegistryOrigin,
  ];
  return validatePackDownloadReport(
    runSubprocess("npm", args),
    expected,
    directory,
  );
}

function registryStateCommand(options) {
  const bundleDirectory = resolve(options["--bundle"]);
  const outputFile = resolve(options["--output-file"]);
  const manifest = validateReleaseBundle({ bundleDirectory });
  const expected = {
    name: manifest.name,
    version: manifest.version,
    integrity: manifest.integrity,
  };
  const tags = readDistTags(manifest.name);
  const state = npmView(expected);
  if (state.state === "missing") {
    if (compareStableVersions(tags.latest, manifest.version) >= 0) {
      fail(
        `refusing to publish ${manifest.version} because dist-tags.latest is not older: ${tags.latest}`,
      );
    }
    appendOutputs(outputFile, { registry_state: "missing" });
    return;
  }
  if (tags.latest !== manifest.version) {
    fail("existing exact version does not match dist-tags.latest");
  }
  const temporary = mkdtempSync(join(tmpdir(), "dnh-registry-state-"));
  try {
    const downloaded = downloadRegistryTarball(expected, temporary);
    validateRegistryTarball(
      downloaded,
      join(bundleDirectory, manifest.filename),
      manifest,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  appendOutputs(outputFile, { registry_state: "match" });
}

function parseDistTags(result) {
  if (result.error || result.signal || result.status !== 0) {
    commandFailure(
      "npm",
      [
        "view",
        releasePackageName,
        "dist-tags",
        "--json",
        "--registry",
        npmRegistryOrigin,
      ],
      result,
      { retryable: registryErrorIsRetryable(npmErrorObject(result)?.code) },
    );
  }
  const parsed = assertPlainObject(
    parseJson(result.stdout, "npm dist-tags response"),
    "npm dist-tags response",
  );
  const tags = parsed["dist-tags"] ?? parsed;
  assertPlainObject(tags, "npm dist-tags");
  validateStableTag(`v${String(tags.latest)}`);
  return tags;
}

function readDistTags(name) {
  const args = [
    "view",
    name,
    "dist-tags",
    "--json",
    "--registry",
    npmRegistryOrigin,
  ];
  return parseDistTags(runSubprocess("npm", args));
}

async function verifyRegistryOnce(bundleDirectory, manifest) {
  const expected = {
    name: manifest.name,
    version: manifest.version,
    integrity: manifest.integrity,
  };
  const viewed = npmView(expected);
  if (viewed.state === "missing")
    return { state: "retry", reason: "version is missing" };
  const metadata = viewed.metadata;
  const tags = readDistTags(manifest.name);
  if (tags.latest !== manifest.version)
    fail("registry dist-tags.latest mismatch");
  if (
    metadata.dist?.attestations?.provenance?.predicateType !== slsaPredicateType
  ) {
    return {
      state: "retry",
      reason: "provenance metadata is not yet available",
    };
  }

  const temporary = mkdtempSync(join(tmpdir(), "dnh-registry-verify-"));
  try {
    const downloaded = downloadRegistryTarball(expected, temporary);
    validateRegistryTarball(
      downloaded,
      join(bundleDirectory, manifest.filename),
      manifest,
    );
    const consumer = join(temporary, "consumer");
    mkdirSync(consumer);
    atomicWrite(
      join(consumer, "package.json"),
      `${JSON.stringify({ name: "release-verification", private: true }, null, 2)}\n`,
    );
    const installArgs = [
      "install",
      "--ignore-scripts",
      "--omit=peer",
      "--save-exact",
      "--no-audit",
      "--no-fund",
      `${manifest.name}@${manifest.version}`,
      "--registry",
      npmRegistryOrigin,
    ];
    runChecked("npm", installArgs, { cwd: consumer });
    const lockfile = parseJson(
      readFileSync(join(consumer, "package-lock.json"), "utf8"),
      "fresh install lockfile",
    );
    const provenanceExpected = {
      name: manifest.name,
      version: manifest.version,
      tag: manifest.tag,
      commit: manifest.commit,
      repository: releaseRepositoryUrl,
      workflow: releaseWorkflowPath,
      integrity: manifest.integrity,
      sha512: manifest.sha512,
      tarballUrl: metadata.dist.tarball,
    };
    validateInstalledTarget(lockfile, provenanceExpected);
    const auditArgs = [
      "audit",
      "signatures",
      "--json",
      "--include-attestations",
      "--registry",
      npmRegistryOrigin,
    ];
    const auditResult = runSubprocess("npm", auditArgs, { cwd: consumer });
    if (auditResult.error || auditResult.signal || auditResult.status !== 0) {
      commandFailure("npm", auditArgs, auditResult, {
        retryable: registryErrorIsRetryable(npmErrorObject(auditResult)?.code),
      });
    }
    const verifiedTarget = validateAuditSignatures(
      parseJson(auditResult.stdout, "npm audit signatures response"),
      expected,
    );
    validateProvenance(metadata, verifiedTarget, provenanceExpected);
    return { state: "verified" };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

async function verifyRegistryCommand(options) {
  const bundleDirectory = resolve(options["--bundle"]);
  const manifest = validateReleaseBundle({ bundleDirectory });
  const attempts = Number(options["--attempts"] ?? "12");
  const delayMs = Number(options["--delay-ms"] ?? "5000");
  await pollRegistry({
    attempts,
    delayMs,
    async check() {
      try {
        return await verifyRegistryOnce(bundleDirectory, manifest);
      } catch (error) {
        if (error.retryable) return { state: "retry", reason: error.message };
        throw error;
      }
    },
    sleep(delay) {
      return new Promise((resolveSleep) => setTimeout(resolveSleep, delay));
    },
  });
}

async function main(args) {
  const [mode, ...rest] = args;
  if (mode === "preflight") {
    if (rest.length !== 0) fail("preflight takes no arguments");
    preflightRelease({
      cwd: process.cwd(),
      env: process.env,
      outputFile: process.env.GITHUB_OUTPUT,
    });
    return;
  }
  if (mode === "prepare") {
    const options = parseOptions(rest, [
      "--pack-report",
      "--pack-directory",
      "--bundle",
      "--tag",
      "--commit",
    ]);
    prepareReleaseBundle({
      packReportPath: resolve(options["--pack-report"]),
      packDirectory: resolve(options["--pack-directory"]),
      bundleDirectory: resolve(options["--bundle"]),
      tag: options["--tag"],
      commit: options["--commit"],
    });
    return;
  }
  if (mode === "validate-bundle") {
    const options = parseOptions(rest, ["--bundle", "--tag", "--commit"]);
    validateReleaseBundle({
      bundleDirectory: resolve(options["--bundle"]),
      expectedTag: options["--tag"],
      expectedCommit: options["--commit"],
    });
    return;
  }
  if (mode === "registry-state") {
    const options = parseOptions(rest, ["--bundle", "--output-file"]);
    registryStateCommand(options);
    return;
  }
  if (mode === "verify-registry") {
    const options = parseOptions(rest, [
      "--bundle",
      "--attempts",
      "--delay-ms",
    ]);
    await verifyRegistryCommand(options);
    return;
  }
  fail(
    "usage: check-release.mjs <preflight|prepare|validate-bundle|registry-state|verify-registry>",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
