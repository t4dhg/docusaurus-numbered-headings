const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { gzipSync } = require("node:zlib");
const { parse } = require("yaml");

const repositoryRoot = path.resolve(__dirname, "..");
const releaseScript = path.join(repositoryRoot, "scripts", "check-release.mjs");
const releaseUtilities = fs.existsSync(releaseScript)
  ? import(pathToFileURL(releaseScript).href)
  : Promise.resolve({});

const packageName = "docusaurus-numbered-headings";
const packageVersion = "2.0.0";
const releaseTag = "v2.0.0";
const releaseCommit = "0123456789abcdef0123456789abcdef01234567";
const repositorySlug = "t4dhg/docusaurus-numbered-headings";
const repositoryUrl = `https://github.com/${repositorySlug}`;
const workflowPath = ".github/workflows/release.yml";
const tarballFilename = `${packageName}-${packageVersion}.tgz`;
const expectedPackageFiles = [
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

function requiredFunction(module, name) {
  assert.equal(
    typeof module[name],
    "function",
    `scripts/check-release.mjs must export ${name}()`,
  );
  return module[name];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    ...options,
  });
  assert.equal(
    result.error,
    undefined,
    result.error ? result.error.message : undefined,
  );
  return result;
}

function runGit(cwd, args, options = {}) {
  const result = run("git", args, { cwd, ...options });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makePreflightRepository() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "dnh-release-preflight-"),
  );
  runGit(directory, ["init", "--initial-branch=master"]);
  runGit(directory, ["config", "user.name", "Release Test"]);
  runGit(directory, ["config", "user.email", "release@example.invalid"]);
  runGit(directory, ["config", "commit.gpgsign", "false"]);
  runGit(directory, ["config", "tag.gpgsign", "false"]);
  writeJson(path.join(directory, "package.json"), {
    name: packageName,
    version: packageVersion,
    repository: {
      type: "git",
      url: `git+${repositoryUrl}.git`,
    },
  });
  runGit(directory, ["add", "package.json"]);
  runGit(directory, ["commit", "-m", "release candidate"]);
  const commit = runGit(directory, ["rev-parse", "HEAD"]);
  runGit(directory, ["tag", "-a", releaseTag, "-m", releaseTag]);
  runGit(directory, ["remote", "add", "origin", repositoryUrl]);
  runGit(directory, ["update-ref", "refs/remotes/origin/master", commit]);

  return {
    directory,
    commit,
    env: {
      GITHUB_EVENT_NAME: "push",
      GITHUB_REPOSITORY: repositorySlug,
      GITHUB_REF: `refs/tags/${releaseTag}`,
      GITHUB_REF_NAME: releaseTag,
      GITHUB_REF_TYPE: "tag",
      GITHUB_SHA: commit,
    },
  };
}

function mutateTarHeader(header) {
  header.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of header) sum += byte;
  const checksum = `${sum.toString(8).padStart(6, "0")}\0 `;
  header.write(checksum, 148, 8, "ascii");
}

function tarEntry(relativePath, content, type = "0") {
  const name = `package/${relativePath}`;
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124, 12);
  header.write("00000000000\0", 136, 12, "ascii");
  header[156] = type.charCodeAt(0);
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  mutateTarHeader(header);
  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, data, padding]);
}

function makeTarball(
  files = expectedPackageFiles,
  packageMetadata = { name: packageName, version: packageVersion },
  extraEntries = [],
) {
  return gzipSync(
    Buffer.concat([
      ...files.map((file) =>
        tarEntry(
          file,
          file === "package.json"
            ? `${JSON.stringify(packageMetadata)}\n`
            : `fixture:${file}\n`,
        ),
      ),
      ...extraEntries,
      Buffer.alloc(1024),
    ]),
    { mtime: 0 },
  );
}

function digest(buffer, algorithm, encoding = "hex") {
  return createHash(algorithm).update(buffer).digest(encoding);
}

function integrity(buffer) {
  return `sha512-${digest(buffer, "sha512", "base64")}`;
}

function packReport(tarball) {
  return {
    id: `${packageName}@${packageVersion}`,
    name: packageName,
    version: packageVersion,
    size: tarball.length,
    unpackedSize: 1234,
    shasum: digest(tarball, "sha1"),
    integrity: integrity(tarball),
    filename: tarballFilename,
    files: expectedPackageFiles.map((file) => ({
      path: file,
      size: Buffer.byteLength(`fixture:${file}\n`),
      mode: 0o644,
    })),
    entryCount: expectedPackageFiles.length,
    bundled: [],
  };
}

function createBundleFixture() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "dnh-release-bundle-"),
  );
  const packDirectory = path.join(directory, "pack");
  const bundleDirectory = path.join(directory, "bundle");
  fs.mkdirSync(packDirectory);
  const tarball = makeTarball();
  const tarballPath = path.join(packDirectory, tarballFilename);
  const reportPath = path.join(directory, "pack-report.json");
  fs.writeFileSync(tarballPath, tarball);
  writeJson(reportPath, [packReport(tarball)]);
  return {
    directory,
    packDirectory,
    bundleDirectory,
    tarball,
    tarballPath,
    reportPath,
  };
}

function metadataFixture(overrides = {}) {
  return {
    name: packageName,
    version: packageVersion,
    "dist-tags": { latest: packageVersion },
    dist: {
      integrity: "sha512-fixture-integrity",
      tarball: `https://registry.npmjs.org/${packageName}/-/${tarballFilename}`,
      attestations: {
        url: `https://registry.npmjs.org/-/npm/v1/attestations/${packageName}@${packageVersion}`,
        provenance: { predicateType: "https://slsa.dev/provenance/v1" },
      },
    },
    ...overrides,
  };
}

function provenanceFixture({ sha512 = "a".repeat(128) } = {}) {
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: `pkg:npm/${packageName}@${packageVersion}`,
        digest: { sha512 },
      },
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType:
          "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            ref: `refs/tags/${releaseTag}`,
            repository: repositoryUrl,
            path: workflowPath,
          },
        },
        internalParameters: {
          github: { event_name: "push" },
        },
        resolvedDependencies: [
          {
            uri: `git+${repositoryUrl}@refs/tags/${releaseTag}`,
            digest: { gitCommit: releaseCommit },
          },
        ],
      },
      runDetails: {
        builder: { id: "https://github.com/actions/runner/github-hosted" },
      },
    },
  };

  return {
    attestations: [
      {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: {
          mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
          dsseEnvelope: {
            payloadType: "application/vnd.in-toto+json",
            payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
            signatures: [{ sig: "fixture" }],
          },
        },
      },
    ],
  };
}

function verifiedTargetFixture({ sha512 = "a".repeat(128) } = {}) {
  return {
    name: packageName,
    version: packageVersion,
    location: `node_modules/${packageName}`,
    registry: "https://registry.npmjs.org/",
    attestations: {
      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
    },
    attestationBundles: provenanceFixture({ sha512 }).attestations,
  };
}

function releaseWorkflow() {
  return parse(
    fs.readFileSync(
      path.join(repositoryRoot, ".github", "workflows", "release.yml"),
      "utf8",
    ),
  );
}

function assertReleaseOrder(workflow) {
  const jobs = workflow.jobs;
  assert.deepEqual(Object.keys(jobs), ["prepare", "publish", "github-release"]);
  assert.equal(jobs.publish.needs, "prepare");
  assert.equal(jobs["github-release"].needs, "publish");

  const publishSteps = jobs.publish.steps.map((step) => step.name);
  const registryState = publishSteps.indexOf("Classify registry version");
  const publish = publishSteps.indexOf("Publish exact tarball");
  const verify = publishSteps.indexOf("Verify published registry artifact");
  assert.ok(registryState >= 0 && registryState < publish);
  assert.ok(publish < verify);
  assert.equal(jobs.publish.steps[publish]["continue-on-error"], true);
  assert.equal(
    jobs.publish.steps[verify].if,
    "success()",
    "registry verification must follow an indeterminate continued publish without overriding failed prerequisite gates",
  );
}

test("accepts only canonical stable SemVer release tags", async () => {
  const module = await releaseUtilities;
  const validateStableTag = requiredFunction(module, "validateStableTag");

  for (const valid of ["v0.0.0", "v1.2.3", "v10.200.3000"]) {
    assert.deepEqual(validateStableTag(valid), {
      tag: valid,
      version: valid.slice(1),
    });
  }
  for (const invalid of [
    "1.2.3",
    "v1.2",
    "v1.2.3.4",
    "v01.2.3",
    "v1.02.3",
    "v1.2.03",
    "v1.2.3-alpha.1",
    "v1.2.3+build",
    "v1.2.3\nnext=value",
    "v1.2.3; touch injected",
  ]) {
    assert.throws(() => validateStableTag(invalid), /canonical stable/i);
  }
});

test("runs subprocess arguments without a shell", async () => {
  const module = await releaseUtilities;
  const runSubprocess = requiredFunction(module, "runSubprocess");
  const injection = "v2.0.0; touch /tmp/not-executed";
  let observed;
  const result = runSubprocess("git", ["rev-parse", injection], {
    spawn(command, args, options) {
      observed = { command, args, options };
      return { status: 0, signal: null, stdout: "ok\n", stderr: "" };
    },
  });

  assert.equal(result.stdout, "ok\n");
  assert.equal(observed.command, "git");
  assert.deepEqual(observed.args, ["rev-parse", injection]);
  assert.equal(observed.options.shell, false);
});

test("validates exact release metadata and ancestry in a disposable Git repository", async (t) => {
  const module = await releaseUtilities;
  const preflightRelease = requiredFunction(module, "preflightRelease");
  const fixture = makePreflightRepository();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));
  const outputFile = path.join(fixture.directory, "github-output");

  const result = preflightRelease({
    cwd: fixture.directory,
    env: fixture.env,
    outputFile,
  });

  assert.deepEqual(result, {
    name: packageName,
    version: packageVersion,
    tag: releaseTag,
    commit: fixture.commit,
  });
  assert.equal(
    fs.readFileSync(outputFile, "utf8"),
    `name=${packageName}\nversion=${packageVersion}\ntag=${releaseTag}\ncommit=${fixture.commit}\n`,
  );
});

test("preflight fails closed for metadata, tag, commit, remote, and ancestry mismatches", async (t) => {
  const module = await releaseUtilities;
  const preflightRelease = requiredFunction(module, "preflightRelease");

  const cases = [
    {
      name: "event",
      mutate(fixture) {
        fixture.env.GITHUB_EVENT_NAME = "workflow_dispatch";
      },
      expected: /push event/i,
    },
    {
      name: "repository",
      mutate(fixture) {
        fixture.env.GITHUB_REPOSITORY = "someone/another-package";
      },
      expected: /repository/i,
    },
    {
      name: "package name",
      mutate(fixture) {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(fixture.directory, "package.json")),
        );
        pkg.name = "another-package";
        writeJson(path.join(fixture.directory, "package.json"), pkg);
      },
      expected: /package name/i,
    },
    {
      name: "tag version",
      mutate(fixture) {
        runGit(fixture.directory, ["tag", "-a", "v2.0.1", "-m", "v2.0.1"]);
        fixture.env.GITHUB_REF = "refs/tags/v2.0.1";
        fixture.env.GITHUB_REF_NAME = "v2.0.1";
      },
      expected: /package version/i,
    },
    {
      name: "event commit",
      mutate(fixture) {
        fixture.env.GITHUB_SHA = "f".repeat(40);
      },
      expected: /event commit|triggering commit/i,
    },
    {
      name: "lightweight tag",
      mutate(fixture) {
        runGit(fixture.directory, ["tag", "-d", releaseTag]);
        runGit(fixture.directory, ["tag", releaseTag, fixture.commit]);
      },
      expected: /annotated|tag object/i,
    },
    {
      name: "origin URL",
      mutate(fixture) {
        runGit(fixture.directory, [
          "remote",
          "set-url",
          "origin",
          "https://github.com/someone/another-package.git",
        ]);
      },
      expected: /origin.*repository|remote/i,
    },
    {
      name: "missing origin master",
      mutate(fixture) {
        runGit(fixture.directory, [
          "update-ref",
          "-d",
          "refs/remotes/origin/master",
        ]);
      },
      expected: /origin\/master/i,
    },
    {
      name: "unrelated origin master",
      mutate(fixture) {
        const tree = runGit(fixture.directory, ["mktree"], { input: "" });
        const unrelated = runGit(fixture.directory, ["commit-tree", tree], {
          input: "unrelated\n",
        });
        runGit(fixture.directory, [
          "update-ref",
          "refs/remotes/origin/master",
          unrelated,
        ]);
      },
      expected: /ancestor|contained/i,
    },
    {
      name: "shallow repository",
      mutate(fixture) {
        fs.writeFileSync(
          path.join(fixture.directory, ".git", "shallow"),
          `${fixture.commit}\n`,
        );
      },
      expected: /shallow/i,
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, () => {
      const fixture = makePreflightRepository();
      try {
        testCase.mutate(fixture);
        const outputFile = path.join(fixture.directory, "github-output");
        assert.throws(
          () =>
            preflightRelease({
              cwd: fixture.directory,
              env: fixture.env,
              outputFile,
            }),
          testCase.expected,
        );
        assert.equal(fs.existsSync(outputFile), false);
      } finally {
        fs.rmSync(fixture.directory, { recursive: true, force: true });
      }
    });
  }
});

test("prepares and revalidates one exact portable release bundle", async (t) => {
  const module = await releaseUtilities;
  const prepareReleaseBundle = requiredFunction(module, "prepareReleaseBundle");
  const validateReleaseBundle = requiredFunction(
    module,
    "validateReleaseBundle",
  );
  const fixture = createBundleFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));

  const manifest = prepareReleaseBundle({
    packReportPath: fixture.reportPath,
    packDirectory: fixture.packDirectory,
    bundleDirectory: fixture.bundleDirectory,
    tag: releaseTag,
    commit: releaseCommit,
    verifierPath: releaseScript,
  });
  const validated = validateReleaseBundle({
    bundleDirectory: fixture.bundleDirectory,
    expectedTag: releaseTag,
    expectedCommit: releaseCommit,
  });

  assert.deepEqual(validated, manifest);
  assert.deepEqual(manifest, {
    schema: 1,
    name: packageName,
    version: packageVersion,
    tag: releaseTag,
    commit: releaseCommit,
    filename: tarballFilename,
    size: fixture.tarball.length,
    integrity: integrity(fixture.tarball),
    sha256: digest(fixture.tarball, "sha256"),
    sha512: digest(fixture.tarball, "sha512"),
    files: expectedPackageFiles,
  });
  assert.deepEqual(
    fs.readdirSync(fixture.bundleDirectory).sort(),
    ["check-release.mjs", "release-manifest.json", tarballFilename].sort(),
  );
  assert.equal(
    fs
      .readFileSync(path.join(fixture.bundleDirectory, tarballFilename))
      .equals(fixture.tarball),
    true,
  );
  assert.equal(path.isAbsolute(manifest.filename), false);
  assert.equal(manifest.files.some(path.isAbsolute), false);
});

test("rejects artifact name, version, allowlist, digest, and manifest corruption", async (t) => {
  const module = await releaseUtilities;
  const prepareReleaseBundle = requiredFunction(module, "prepareReleaseBundle");
  const validateReleaseBundle = requiredFunction(
    module,
    "validateReleaseBundle",
  );

  for (const mutation of [
    { field: "name", value: "another-package", expected: /name/i },
    { field: "version", value: "2.0.1", expected: /version/i },
    { field: "filename", value: "unexpected.tgz", expected: /filename/i },
    { field: "integrity", value: "sha512-wrong", expected: /integrity/i },
  ]) {
    const fixture = createBundleFixture();
    try {
      const report = JSON.parse(fs.readFileSync(fixture.reportPath, "utf8"));
      report[0][mutation.field] = mutation.value;
      writeJson(fixture.reportPath, report);
      assert.throws(
        () =>
          prepareReleaseBundle({
            packReportPath: fixture.reportPath,
            packDirectory: fixture.packDirectory,
            bundleDirectory: fixture.bundleDirectory,
            tag: releaseTag,
            commit: releaseCommit,
            verifierPath: releaseScript,
          }),
        mutation.expected,
      );
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  }

  await t.test("unexpected archive file", () => {
    const fixture = createBundleFixture();
    try {
      const files = [...expectedPackageFiles, "private.txt"];
      const tarball = makeTarball(files);
      fs.writeFileSync(fixture.tarballPath, tarball);
      const report = packReport(tarball);
      report.files = files.map((file) => ({
        path: file,
        size: 1,
        mode: 0o644,
      }));
      report.entryCount = files.length;
      writeJson(fixture.reportPath, [report]);
      assert.throws(
        () =>
          prepareReleaseBundle({
            packReportPath: fixture.reportPath,
            packDirectory: fixture.packDirectory,
            bundleDirectory: fixture.bundleDirectory,
            tag: releaseTag,
            commit: releaseCommit,
            verifierPath: releaseScript,
          }),
        /archive file|allowlist|unexpected/i,
      );
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("tarball bytes changed after preparation", () => {
    const fixture = createBundleFixture();
    try {
      prepareReleaseBundle({
        packReportPath: fixture.reportPath,
        packDirectory: fixture.packDirectory,
        bundleDirectory: fixture.bundleDirectory,
        tag: releaseTag,
        commit: releaseCommit,
        verifierPath: releaseScript,
      });
      fs.appendFileSync(
        path.join(fixture.bundleDirectory, tarballFilename),
        "corruption",
      );
      assert.throws(
        () =>
          validateReleaseBundle({
            bundleDirectory: fixture.bundleDirectory,
            expectedTag: releaseTag,
            expectedCommit: releaseCommit,
          }),
        /size|digest|integrity|tarball/i,
      );
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("manifest allowlist changed", () => {
    const fixture = createBundleFixture();
    try {
      prepareReleaseBundle({
        packReportPath: fixture.reportPath,
        packDirectory: fixture.packDirectory,
        bundleDirectory: fixture.bundleDirectory,
        tag: releaseTag,
        commit: releaseCommit,
        verifierPath: releaseScript,
      });
      const manifestPath = path.join(
        fixture.bundleDirectory,
        "release-manifest.json",
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifest.files.pop();
      writeJson(manifestPath, manifest);
      assert.throws(
        () =>
          validateReleaseBundle({
            bundleDirectory: fixture.bundleDirectory,
            expectedTag: releaseTag,
            expectedCommit: releaseCommit,
          }),
        /file|allowlist|manifest/i,
      );
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  for (const [label, packageMetadata] of [
    ["package.json name", { name: "another-package", version: packageVersion }],
    ["package.json version", { name: packageName, version: "2.0.1" }],
  ]) {
    await t.test(label, () => {
      const fixture = createBundleFixture();
      try {
        const tarball = makeTarball(expectedPackageFiles, packageMetadata);
        fs.writeFileSync(fixture.tarballPath, tarball);
        writeJson(fixture.reportPath, [packReport(tarball)]);
        assert.throws(
          () =>
            prepareReleaseBundle({
              packReportPath: fixture.reportPath,
              packDirectory: fixture.packDirectory,
              bundleDirectory: fixture.bundleDirectory,
              tag: releaseTag,
              commit: releaseCommit,
              verifierPath: releaseScript,
            }),
          /package\.json.*(?:name|version)|(?:name|version).*package\.json/i,
        );
      } finally {
        fs.rmSync(fixture.directory, { recursive: true, force: true });
      }
    });
  }

  await t.test("unsafe directory archive entry", () => {
    const fixture = createBundleFixture();
    try {
      const tarball = makeTarball(
        expectedPackageFiles,
        { name: packageName, version: packageVersion },
        [tarEntry("../private", "", "5")],
      );
      fs.writeFileSync(fixture.tarballPath, tarball);
      writeJson(fixture.reportPath, [packReport(tarball)]);
      assert.throws(
        () =>
          prepareReleaseBundle({
            packReportPath: fixture.reportPath,
            packDirectory: fixture.packDirectory,
            bundleDirectory: fixture.bundleDirectory,
            tag: releaseTag,
            commit: releaseCommit,
            verifierPath: releaseScript,
          }),
        /unsafe|portable|archive path/i,
      );
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("manifest symlink", () => {
    const fixture = createBundleFixture();
    try {
      prepareReleaseBundle({
        packReportPath: fixture.reportPath,
        packDirectory: fixture.packDirectory,
        bundleDirectory: fixture.bundleDirectory,
        tag: releaseTag,
        commit: releaseCommit,
        verifierPath: releaseScript,
      });
      const manifestPath = path.join(
        fixture.bundleDirectory,
        "release-manifest.json",
      );
      const outsideManifest = path.join(
        fixture.directory,
        "outside-manifest.json",
      );
      fs.copyFileSync(manifestPath, outsideManifest);
      fs.unlinkSync(manifestPath);
      fs.symlinkSync(outsideManifest, manifestPath);
      assert.throws(
        () =>
          validateReleaseBundle({
            bundleDirectory: fixture.bundleDirectory,
            expectedTag: releaseTag,
            expectedCommit: releaseCommit,
          }),
        /manifest.*regular file|symbolic link|symlink/i,
      );
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});

test("classifies only an exact npm 404 as missing and exact metadata as existing", async () => {
  const module = await releaseUtilities;
  const classifyRegistryView = requiredFunction(module, "classifyRegistryView");
  const expected = {
    name: packageName,
    version: packageVersion,
    integrity: "sha512-fixture-integrity",
  };
  const missingDetail =
    `The requested resource '${packageName}@${packageVersion}' could not be found or you do not have permission to access it.` +
    "\n\nNote that you can also install from a\ntarball, folder, http url, or git url.";

  const missing = classifyRegistryView(
    {
      status: 1,
      signal: null,
      stdout: JSON.stringify({
        error: {
          code: "E404",
          summary: `No match found for version ${packageVersion}`,
          detail: missingDetail,
        },
      }),
      stderr: "npm error code E404\nnpm error No match found for version\n",
    },
    expected,
  );
  assert.deepEqual(missing, { state: "missing" });

  const wrongMissingResponses = [
    {
      code: "E404",
      summary: `No match found for version ${packageVersion}`,
      detail: `The requested resource '${packageName}@2.0.1' could not be found or you do not have permission to access it.`,
    },
    {
      code: "E404",
      summary: "No match found for version 2.0.1",
      detail: `The requested resource '${packageName}@${packageVersion}' could not be found or you do not have permission to access it.`,
    },
    {
      code: "E404",
      summary: `No match found for version ${packageVersion}`,
      detail: `The requested resource '${packageName}@${packageVersion}' was not found.`,
    },
    {
      code: "E404",
      summary: `No match found for version ${packageVersion}`,
      detail: `${missingDetail}\nUnexpected suffix`,
    },
    {
      code: "E403",
      summary: `No match found for version ${packageVersion}`,
      detail: `The requested resource '${packageName}@${packageVersion}' could not be found or you do not have permission to access it.`,
    },
  ];
  for (const error of wrongMissingResponses) {
    assert.throws(
      () =>
        classifyRegistryView(
          {
            status: 1,
            signal: null,
            stdout: "",
            stderr: JSON.stringify({ error }),
          },
          expected,
        ),
      /npm view|E40[34]|failed|registry/i,
    );
  }

  const metadata = metadataFixture();
  const existing = classifyRegistryView(
    {
      status: 0,
      signal: null,
      stdout: JSON.stringify(metadata),
      stderr: "",
    },
    expected,
  );
  assert.deepEqual(existing, { state: "existing", metadata });
});

test("registry state fails closed on mismatch, malformed data, network errors, signals, and spawn errors", async () => {
  const module = await releaseUtilities;
  const classifyRegistryView = requiredFunction(module, "classifyRegistryView");
  const expected = {
    name: packageName,
    version: packageVersion,
    integrity: "sha512-fixture-integrity",
  };
  const results = [
    {
      result: {
        status: 0,
        signal: null,
        stdout: JSON.stringify(metadataFixture({ version: "2.0.1" })),
        stderr: "",
      },
      expected: /version|mismatch/i,
    },
    {
      result: {
        status: 0,
        signal: null,
        stdout: JSON.stringify(
          metadataFixture({
            dist: {
              ...metadataFixture().dist,
              tarball: `https://example.invalid/${tarballFilename}`,
            },
          }),
        ),
        stderr: "",
      },
      expected: /tarball.*(?:URL|origin|registry)|(?:URL|origin).*tarball/i,
    },
    {
      result: { status: 0, signal: null, stdout: "{", stderr: "" },
      expected: /json|malformed/i,
    },
    {
      result: {
        status: 1,
        signal: null,
        stdout: "",
        stderr: JSON.stringify({
          error: { code: "EAI_AGAIN", summary: "network unavailable" },
        }),
      },
      expected: /EAI_AGAIN|network|registry/i,
    },
    {
      result: { status: null, signal: "SIGTERM", stdout: "", stderr: "" },
      expected: /SIGTERM|signal/i,
    },
    {
      result: {
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        error: Object.assign(new Error("spawn npm ENOENT"), { code: "ENOENT" }),
      },
      expected: /ENOENT|start/i,
    },
  ];

  for (const fixture of results) {
    assert.throws(
      () => classifyRegistryView(fixture.result, expected),
      fixture.expected,
    );
  }
});

test("bounds registry propagation and recovers from an indeterminate publish only after exact verification", async () => {
  const module = await releaseUtilities;
  const pollRegistry = requiredFunction(module, "pollRegistry");
  const observed = [];
  let attempt = 0;
  const result = await pollRegistry({
    attempts: 3,
    delayMs: 17,
    async check() {
      attempt += 1;
      return attempt < 3
        ? { state: "retry", reason: "missing" }
        : { state: "verified" };
    },
    async sleep(delay) {
      observed.push(delay);
    },
  });

  assert.deepEqual(result, { state: "verified" });
  assert.equal(attempt, 3);
  assert.deepEqual(observed, [17, 17]);

  attempt = 0;
  await assert.rejects(
    pollRegistry({
      attempts: 3,
      delayMs: 1,
      async check() {
        attempt += 1;
        return { state: "retry", reason: "network" };
      },
      async sleep() {},
    }),
    /3 attempts|propagation|network/i,
  );
  assert.equal(attempt, 3);
});

test("verifies audit output, installed target, and exact SLSA provenance binding", async () => {
  const module = await releaseUtilities;
  const validateAuditSignatures = requiredFunction(
    module,
    "validateAuditSignatures",
  );
  const validateInstalledTarget = requiredFunction(
    module,
    "validateInstalledTarget",
  );
  const validateProvenance = requiredFunction(module, "validateProvenance");
  const sha512 = "a".repeat(128);
  const metadata = metadataFixture({
    dist: {
      ...metadataFixture().dist,
      integrity: `sha512-${Buffer.from(sha512, "hex").toString("base64")}`,
    },
  });
  const expected = {
    name: packageName,
    version: packageVersion,
    tag: releaseTag,
    commit: releaseCommit,
    repository: repositoryUrl,
    workflow: workflowPath,
    integrity: metadata.dist.integrity,
    sha512,
    tarballUrl: metadata.dist.tarball,
  };
  const lockfile = {
    lockfileVersion: 3,
    packages: {
      [`node_modules/${packageName}`]: {
        version: packageVersion,
        resolved: metadata.dist.tarball,
        integrity: metadata.dist.integrity,
      },
    },
  };

  const verifiedTarget = verifiedTargetFixture({ sha512 });
  assert.equal(
    validateAuditSignatures(
      { invalid: [], missing: [], verified: [verifiedTarget] },
      { name: packageName, version: packageVersion },
    ),
    verifiedTarget,
  );
  assert.doesNotThrow(() => validateInstalledTarget(lockfile, expected));
  assert.doesNotThrow(() =>
    validateProvenance(metadata, verifiedTarget, expected),
  );
});

test("rejects wrong package, version, digest, repository, workflow, tag, commit, and missing SLSA provenance", async () => {
  const module = await releaseUtilities;
  const validateProvenance = requiredFunction(module, "validateProvenance");
  const sha512 = "a".repeat(128);
  const metadata = metadataFixture({
    dist: {
      ...metadataFixture().dist,
      integrity: `sha512-${Buffer.from(sha512, "hex").toString("base64")}`,
    },
  });
  const expected = {
    name: packageName,
    version: packageVersion,
    tag: releaseTag,
    commit: releaseCommit,
    repository: repositoryUrl,
    workflow: workflowPath,
    integrity: metadata.dist.integrity,
    sha512,
    tarballUrl: metadata.dist.tarball,
  };

  const mutations = [
    ["package", (value) => (value.subject[0].name = "pkg:npm/wrong@2.0.0")],
    [
      "version",
      (value) => (value.subject[0].name = `pkg:npm/${packageName}@2.0.1`),
    ],
    ["digest", (value) => (value.subject[0].digest.sha512 = "b".repeat(128))],
    [
      "repository",
      (value) =>
        (value.predicate.buildDefinition.externalParameters.workflow.repository =
          "https://github.com/someone/else"),
    ],
    [
      "workflow",
      (value) =>
        (value.predicate.buildDefinition.externalParameters.workflow.path =
          ".github/workflows/other.yml"),
    ],
    [
      "tag",
      (value) =>
        (value.predicate.buildDefinition.externalParameters.workflow.ref =
          "refs/tags/v2.0.1"),
    ],
    [
      "commit",
      (value) =>
        (value.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit =
          "f".repeat(40)),
    ],
  ];

  for (const [name, mutate] of mutations) {
    const verifiedTarget = verifiedTargetFixture({ sha512 });
    const envelope = verifiedTarget.attestationBundles[0].bundle.dsseEnvelope;
    const statement = JSON.parse(
      Buffer.from(envelope.payload, "base64").toString("utf8"),
    );
    mutate(statement);
    envelope.payload = Buffer.from(JSON.stringify(statement)).toString(
      "base64",
    );
    assert.throws(
      () => validateProvenance(metadata, verifiedTarget, expected),
      new RegExp(name, "i"),
    );
  }

  assert.throws(
    () =>
      validateProvenance(
        metadata,
        { ...verifiedTargetFixture({ sha512 }), attestationBundles: [] },
        expected,
      ),
    /SLSA|provenance/i,
  );
  const noMetadata = structuredClone(metadata);
  delete noMetadata.dist.attestations;
  assert.throws(
    () =>
      validateProvenance(
        noMetadata,
        verifiedTargetFixture({ sha512 }),
        expected,
      ),
    /attestation|provenance/i,
  );
});

test("requires one exact verified npm audit target before decoding attestations", async () => {
  const module = await releaseUtilities;
  const validateAuditSignatures = requiredFunction(
    module,
    "validateAuditSignatures",
  );
  const expected = { name: packageName, version: packageVersion };
  const exact = verifiedTargetFixture();

  for (const audit of [
    { invalid: [], missing: [], verified: [] },
    {
      invalid: [],
      missing: [],
      verified: [{ ...exact, version: "2.0.1" }],
    },
    { invalid: [{ name: packageName }], missing: [], verified: [exact] },
    { invalid: [], missing: [{ name: packageName }], verified: [exact] },
  ]) {
    assert.throws(
      () => validateAuditSignatures(audit, expected),
      /verified target|invalid|missing|version/i,
    );
  }
});

test("validates supplied final-tarball arguments without repacking", async (t) => {
  const module = await releaseUtilities;
  const resolveSuppliedTarball = requiredFunction(
    module,
    "resolveSuppliedTarball",
  );
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "dnh-tarball-input-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const tarballPath = path.join(directory, tarballFilename);
  fs.writeFileSync(tarballPath, makeTarball());
  let packCalls = 0;

  assert.equal(
    resolveSuppliedTarball(["--tarball", tarballPath], {
      expectedName: packageName,
      expectedVersion: packageVersion,
      pack() {
        packCalls += 1;
      },
    }),
    tarballPath,
  );
  assert.equal(packCalls, 0);
  assert.throws(
    () =>
      resolveSuppliedTarball(
        ["--tarball", path.join(directory, "missing", tarballFilename)],
        {
          expectedName: packageName,
          expectedVersion: packageVersion,
          pack() {},
        },
      ),
    /missing|regular file/i,
  );
  const wrong = path.join(directory, "wrong-2.0.0.tgz");
  fs.writeFileSync(wrong, makeTarball());
  assert.throws(
    () =>
      resolveSuppliedTarball(["--tarball", wrong], {
        expectedName: packageName,
        expectedVersion: packageVersion,
        pack() {},
      }),
    /filename/i,
  );
  assert.throws(
    () =>
      resolveSuppliedTarball(["--tarball", tarballPath, "unexpected"], {
        expectedName: packageName,
        expectedVersion: packageVersion,
        pack() {},
      }),
    /arguments|usage/i,
  );
});

test("test-package supplied mode installs the exact tarball without invoking npm pack", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dnh-no-repack-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const setupEnvironment = {
    ...process.env,
    npm_config_cache: path.join(directory, "npm-cache"),
    npm_config_update_notifier: "false",
  };
  const build = run("npm", ["run", "build"], {
    cwd: repositoryRoot,
    env: setupEnvironment,
  });
  assert.equal(build.status, 0, build.stderr);
  const packed = run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", directory],
    { cwd: repositoryRoot, env: setupEnvironment },
  );
  assert.equal(packed.status, 0, packed.stderr);
  const [report] = JSON.parse(packed.stdout);
  const tarball = path.join(directory, report.filename);
  const fakeDirectory = path.join(directory, "fake-npm");
  fs.mkdirSync(fakeDirectory);
  const fakeNpm = path.join(fakeDirectory, "npm-cli.js");
  const logFile = path.join(directory, "npm-commands.log");
  fs.writeFileSync(
    fakeNpm,
    `const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify(args) + "\\n");
if (args[0] === "pack") process.exit(91);
if (args[0] === "ls") process.exit(0);
if (args[0] !== "install") process.exit(92);
const tarball = args.find((arg) => arg.endsWith(".tgz"));
const extracted = fs.mkdtempSync(path.join(os.tmpdir(), "dnh-fake-install-"));
const unpack = spawnSync("tar", ["-xzf", tarball, "-C", extracted], { shell: false, stdio: "inherit" });
if (unpack.status !== 0) process.exit(unpack.status || 93);
const modules = path.join(process.cwd(), "node_modules");
fs.mkdirSync(modules, { recursive: true });
fs.cpSync(path.join(extracted, "package"), path.join(modules, process.env.FAKE_PACKAGE_NAME), { recursive: true });
for (const dependency of ["typescript", "@docusaurus", "react", "react-dom"]) {
  const target = path.join(process.env.FAKE_ROOT_MODULES, dependency);
  const link = path.join(modules, dependency);
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, "junction");
}
const rootTypes = path.join(process.env.FAKE_ROOT_MODULES, "@types");
const consumerTypes = path.join(modules, "@types");
fs.mkdirSync(consumerTypes, { recursive: true });
for (const dependency of fs.readdirSync(rootTypes)) {
  fs.symlinkSync(
    path.join(rootTypes, dependency),
    path.join(consumerTypes, dependency),
    "junction",
  );
}
const reactGlobal = path.join(consumerTypes, "react-global");
fs.mkdirSync(reactGlobal);
fs.writeFileSync(
  path.join(reactGlobal, "index.d.ts"),
  \`import type { JSX as ReactJSX } from "react";
declare global {
  namespace JSX {
    interface Element extends ReactJSX.Element {}
    interface ElementClass extends ReactJSX.ElementClass {}
    interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
  }
}
\`,
);
fs.rmSync(extracted, { recursive: true, force: true });
`,
  );
  const { npm_execpath: ignoredNpmExecPath, ...baseEnvironment } = process.env;
  void ignoredNpmExecPath;
  const result = run(
    process.execPath,
    [
      path.join(repositoryRoot, "scripts", "test-package.mjs"),
      "--tarball",
      tarball,
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...baseEnvironment,
        npm_execpath: fakeNpm,
        FAKE_NPM_LOG: logFile,
        FAKE_PACKAGE_NAME: packageName,
        FAKE_ROOT_MODULES: path.join(repositoryRoot, "node_modules"),
      },
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const commands = fs
    .readFileSync(logFile, "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(
    commands.some((args) => args[0] === "pack"),
    false,
  );
  assert.equal(commands.filter((args) => args[0] === "install").length, 2);
  for (const args of commands.filter((entry) => entry[0] === "install")) {
    assert.ok(args.includes(tarball));
  }
});

test("registry-state CLI uses fake npm to distinguish missing, exact match, and network failure", async (t) => {
  const module = await releaseUtilities;
  const prepareReleaseBundle = requiredFunction(module, "prepareReleaseBundle");
  const fixture = createBundleFixture();
  t.after(() => fs.rmSync(fixture.directory, { recursive: true, force: true }));
  const manifest = prepareReleaseBundle({
    packReportPath: fixture.reportPath,
    packDirectory: fixture.packDirectory,
    bundleDirectory: fixture.bundleDirectory,
    tag: releaseTag,
    commit: releaseCommit,
    verifierPath: releaseScript,
  });
  const fakeBin = path.join(fixture.directory, "fake-bin");
  fs.mkdirSync(fakeBin);
  const fakeNpm = path.join(fakeBin, "npm");
  fs.writeFileSync(
    fakeNpm,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify(args) + "\\n");
if (args[0] === "view") {
  if (args[2] === "dist-tags") {
    process.stdout.write(JSON.stringify({ latest: process.env.FAKE_LATEST }));
    process.exit(0);
  }
  if (process.env.FAKE_NPM_MODE === "missing") {
    process.stderr.write("npm error code E404\\nnpm error No match found for version\\n");
    process.stdout.write(JSON.stringify({ error: { code: "E404", summary: "No match found for version " + process.env.FAKE_VERSION, detail: "The requested resource '" + process.env.FAKE_SPEC + "' could not be found or you do not have permission to access it.\\n\\nNote that you can also install from a\\ntarball, folder, http url, or git url." } }));
    process.exit(1);
  }
  if (process.env.FAKE_NPM_MODE === "network") {
    process.stderr.write(JSON.stringify({ error: { code: "EAI_AGAIN", summary: "network unavailable" } }));
    process.exit(1);
  }
  process.stdout.write(process.env.FAKE_METADATA_JSON);
  process.exit(0);
}
if (args[0] === "pack") {
  const destination = args[args.indexOf("--pack-destination") + 1];
  const filename = process.env.FAKE_PACK_FILENAME || path.basename(process.env.FAKE_TARBALL);
  const target = path.join(destination, filename);
  fs.copyFileSync(process.env.FAKE_TARBALL, target);
  const bytes = fs.readFileSync(target);
  process.stdout.write(JSON.stringify([{ name: process.env.FAKE_NAME, version: process.env.FAKE_VERSION, filename: path.basename(target), integrity: process.env.FAKE_INTEGRITY, size: bytes.length }]));
  process.exit(0);
}
process.stderr.write("unexpected fake npm command: " + args.join(" "));
process.exit(2);
`,
  );
  fs.chmodSync(fakeNpm, 0o755);
  const logFile = path.join(fixture.directory, "fake-npm.log");
  const baseEnv = {
    ...process.env,
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
    FAKE_NPM_LOG: logFile,
    FAKE_SPEC: `${packageName}@${packageVersion}`,
    FAKE_NAME: packageName,
    FAKE_VERSION: packageVersion,
    FAKE_TARBALL: fixture.tarballPath,
    FAKE_INTEGRITY: manifest.integrity,
    FAKE_METADATA_JSON: JSON.stringify({
      name: packageName,
      version: packageVersion,
      dist: {
        integrity: manifest.integrity,
        tarball: `https://registry.npmjs.org/${packageName}/-/${tarballFilename}`,
      },
    }),
  };

  for (const [mode, expectedState, latest] of [
    ["missing", "missing", "1.6.0"],
    ["match", "match", packageVersion],
  ]) {
    const outputFile = path.join(fixture.directory, `${mode}-output`);
    const result = run(
      process.execPath,
      [
        releaseScript,
        "registry-state",
        "--bundle",
        fixture.bundleDirectory,
        "--output-file",
        outputFile,
      ],
      { env: { ...baseEnv, FAKE_NPM_MODE: mode, FAKE_LATEST: latest } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(outputFile, "utf8"),
      `registry_state=${expectedState}\n`,
    );
  }

  const networkOutput = path.join(fixture.directory, "network-output");
  const network = run(
    process.execPath,
    [
      releaseScript,
      "registry-state",
      "--bundle",
      fixture.bundleDirectory,
      "--output-file",
      networkOutput,
    ],
    {
      env: {
        ...baseEnv,
        FAKE_NPM_MODE: "network",
        FAKE_LATEST: "1.6.0",
      },
    },
  );
  assert.notEqual(network.status, 0);
  assert.equal(fs.existsSync(networkOutput), false);
  assert.match(network.stderr, /EAI_AGAIN|network|registry/i);

  const rollbackOutput = path.join(fixture.directory, "rollback-output");
  const rollback = run(
    process.execPath,
    [
      releaseScript,
      "registry-state",
      "--bundle",
      fixture.bundleDirectory,
      "--output-file",
      rollbackOutput,
    ],
    {
      env: {
        ...baseEnv,
        FAKE_NPM_MODE: "missing",
        FAKE_LATEST: "2.0.1",
      },
    },
  );
  assert.notEqual(rollback.status, 0);
  assert.equal(fs.existsSync(rollbackOutput), false);
  assert.match(rollback.stderr, /latest|rollback|newer/i);

  const wrongFilenameOutput = path.join(
    fixture.directory,
    "wrong-filename-output",
  );
  const wrongFilename = run(
    process.execPath,
    [
      releaseScript,
      "registry-state",
      "--bundle",
      fixture.bundleDirectory,
      "--output-file",
      wrongFilenameOutput,
    ],
    {
      env: {
        ...baseEnv,
        FAKE_NPM_MODE: "match",
        FAKE_LATEST: packageVersion,
        FAKE_PACK_FILENAME: "unexpected.tgz",
      },
    },
  );
  assert.notEqual(wrongFilename.status, 0);
  assert.equal(fs.existsSync(wrongFilenameOutput), false);
  assert.match(wrongFilename.stderr, /filename|name|version/i);

  const invocations = fs
    .readFileSync(logFile, "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  for (const args of invocations) {
    assert.ok(args.includes("--registry"));
    assert.ok(args.includes("https://registry.npmjs.org"));
  }
});

test("workflow uses three least-privilege jobs and immutable official actions", () => {
  const workflow = releaseWorkflow();
  const workflowSource = fs.readFileSync(
    path.join(repositoryRoot, ".github", "workflows", "release.yml"),
    "utf8",
  );
  assert.deepEqual(workflow.on, { push: { tags: ["v*"] } });
  assert.equal(workflow.workflow_dispatch, undefined);
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.match(workflow.concurrency.group, /\$\{\{ github\.ref \}\}/u);
  assertReleaseOrder(workflow);

  const { prepare, publish, "github-release": githubRelease } = workflow.jobs;
  assert.deepEqual(workflow.permissions, {});
  assert.equal(prepare["runs-on"], "ubuntu-latest");
  assert.deepEqual(prepare.permissions, { contents: "read" });
  assert.ok(Number.isInteger(prepare["timeout-minutes"]));
  assert.equal(publish.environment, "npm-publish");
  assert.deepEqual(publish.permissions, { "id-token": "write" });
  assert.deepEqual(publish.concurrency, {
    group: "npm-publish-docusaurus-numbered-headings",
    "cancel-in-progress": false,
  });
  assert.equal(githubRelease["runs-on"], "ubuntu-latest");
  assert.deepEqual(githubRelease.permissions, { contents: "write" });

  const uses = Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .filter((step) => step.uses)
    .map((step) => step.uses);
  assert.deepEqual(uses, [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  ]);
  for (const use of uses) assert.match(use, /@[0-9a-f]{40}$/u);
  for (const pin of [
    ["3d3c42e5aac5ba805825da76410c181273ba90b1", "v7.0.1"],
    ["820762786026740c76f36085b0efc47a31fe5020", "v7.0.0"],
    ["043fb46d1a93c77aae656e7c1c64a875d1fc6a0a", "v7.0.1"],
    ["3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c", "v8.0.1"],
  ]) {
    assert.match(workflowSource, new RegExp(`@${pin[0]} # ${pin[1]}`, "u"));
  }

  const checkout = prepare.steps.find((step) =>
    step.uses?.startsWith("actions/checkout@"),
  );
  assert.deepEqual(checkout.with, {
    "persist-credentials": false,
    "fetch-depth": 0,
  });
  const prepareSetupNode = prepare.steps.find((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  const publishSetupNode = publish.steps.find((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  const setupNodes = [prepareSetupNode, publishSetupNode];
  for (const setupNode of setupNodes) {
    assert.equal(String(setupNode.with["node-version"]), "24");
    assert.equal(setupNode.with["package-manager-cache"], false);
  }
  assert.equal(
    prepareSetupNode.with["registry-url"],
    "https://registry.npmjs.org",
  );
  assert.equal(publishSetupNode.with["registry-url"], undefined);

  const upload = prepare.steps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  assert.equal(upload.id, "upload");
  assert.deepEqual(upload.with, {
    name: "verified-release-bundle",
    path: "${{ runner.temp }}/dnh-release-bundle/*",
    "if-no-files-found": "error",
    "retention-days": 1,
    "compression-level": 0,
    overwrite: false,
    "include-hidden-files": false,
  });
  assert.deepEqual(prepare.outputs, {
    artifact_id: "${{ steps.upload.outputs.artifact-id }}",
    artifact_digest: "${{ steps.upload.outputs.artifact-digest }}",
    manifest_sha256: "${{ steps.seal.outputs.manifest_sha256 }}",
    verifier_sha256: "${{ steps.seal.outputs.verifier_sha256 }}",
    name: "${{ steps.preflight.outputs.name }}",
    version: "${{ steps.preflight.outputs.version }}",
    tag: "${{ steps.preflight.outputs.tag }}",
    commit: "${{ steps.preflight.outputs.commit }}",
  });
  const validateUploadedArtifact = prepare.steps.find(
    (step) => step.name === "Validate uploaded artifact identity",
  );
  assert.match(
    validateUploadedArtifact.run,
    /"\$ARTIFACT_DIGEST" =~ \^\[0-9a-f\]\{64\}\$/u,
  );
  assert.doesNotMatch(validateUploadedArtifact.run, /sha256:/u);
  const download = publish.steps.find((step) =>
    step.uses?.startsWith("actions/download-artifact@"),
  );
  assert.equal(
    download.with["artifact-ids"],
    "${{ needs.prepare.outputs.artifact_id }}",
  );
  assert.equal(download.with["digest-mismatch"], "error");
  assert.equal(download.with.name, undefined);
  assert.equal(download.with["merge-multiple"], true);

  const seal = prepare.steps.find(
    (step) => step.name === "Seal release bundle identity",
  );
  assert.equal(seal.id, "seal");
  assert.match(
    seal.run,
    /sha256sum "\$BUNDLE_DIRECTORY\/release-manifest\.json"/u,
  );
  assert.match(seal.run, /sha256sum "\$BUNDLE_DIRECTORY\/check-release\.mjs"/u);

  const bind = publish.steps.find(
    (step) => step.name === "Bind downloaded bundle identity",
  );
  assert.deepEqual(bind.env, {
    BUNDLE_DIRECTORY: "${{ runner.temp }}/dnh-release-bundle",
    EXPECTED_ARTIFACT_DIGEST: "${{ needs.prepare.outputs.artifact_digest }}",
    EXPECTED_MANIFEST_SHA256: "${{ needs.prepare.outputs.manifest_sha256 }}",
    EXPECTED_VERIFIER_SHA256: "${{ needs.prepare.outputs.verifier_sha256 }}",
  });
  assert.match(
    bind.run,
    /sha256sum "\$BUNDLE_DIRECTORY\/release-manifest\.json"/u,
  );
  assert.match(bind.run, /sha256sum "\$BUNDLE_DIRECTORY\/check-release\.mjs"/u);
  assert.match(
    bind.run,
    /test "\$manifest_sha256" = "\$EXPECTED_MANIFEST_SHA256"/u,
  );
  assert.match(
    bind.run,
    /test "\$verifier_sha256" = "\$EXPECTED_VERIFIER_SHA256"/u,
  );
  assert.match(
    bind.run,
    /"\$EXPECTED_ARTIFACT_DIGEST" =~ \^\[0-9a-f\]\{64\}\$/u,
  );
  assert.doesNotMatch(bind.run, /sha256:/u);

  const staticPreflight = prepare.steps.find(
    (step) => step.name === "Validate tag and protected-branch ancestry",
  );
  assert.deepEqual(staticPreflight.env, {
    RELEASE_REPOSITORY: "${{ github.repository }}",
    RELEASE_TAG: "${{ github.ref_name }}",
    RELEASE_SHA: "${{ github.sha }}",
  });
  assert.match(
    staticPreflight.run,
    /test "\$RELEASE_REPOSITORY" = "t4dhg\/docusaurus-numbered-headings"/u,
  );
  assert.match(
    staticPreflight.run,
    /origin_url="\$\(git remote get-url origin\)"/u,
  );
  assert.match(
    staticPreflight.run,
    /test "\$origin_url" = "https:\/\/github\.com\/t4dhg\/docusaurus-numbered-headings"/u,
  );
  assert.match(
    staticPreflight.run,
    /test "\$\(git rev-parse --is-shallow-repository\)" = "false"/u,
  );
  const originValidation = staticPreflight.run.indexOf(
    'origin_url="$(git remote get-url origin)"',
  );
  const fetchMaster = staticPreflight.run.indexOf(
    "git fetch --no-tags origin refs/heads/master:refs/remotes/origin/master",
  );
  assert.ok(originValidation >= 0 && originValidation < fetchMaster);
  assert.match(
    staticPreflight.run,
    /git fetch --no-tags origin refs\/heads\/master:refs\/remotes\/origin\/master/u,
  );
  assert.match(
    staticPreflight.run,
    /git rev-parse --verify "\$\{RELEASE_TAG\}\^\{commit\}"/u,
  );
  assert.match(
    staticPreflight.run,
    /git cat-file -t "refs\/tags\/\$RELEASE_TAG"/u,
  );
  assert.match(
    staticPreflight.run,
    /git rev-parse --verify "\$\{RELEASE_SHA\}\^\{commit\}"/u,
  );
  assert.match(
    staticPreflight.run,
    /git merge-base --is-ancestor "\$tag_commit" refs\/remotes\/origin\/master/u,
  );
});

test("workflow validates before scripts, publishes exact bytes fail-closed, and releases only after registry proof", () => {
  const workflow = releaseWorkflow();
  const verifierSource = fs.readFileSync(releaseScript, "utf8");
  assertReleaseOrder(workflow);
  const serialized = JSON.stringify(workflow);
  assert.doesNotMatch(
    serialized,
    /NPM_TOKEN|NODE_AUTH_TOKEN|_authToken|secrets\.|npm\s+version|git\s+(?:push|tag|update-ref)|actions\/create-release/iu,
  );
  for (const step of Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .filter(
      (step) =>
        step.run &&
        /\bnpm\s+(?:install|ci|pack|publish|view|audit)\b/u.test(step.run),
    )) {
    assert.match(
      step.run,
      /--registry(?:=|\s+)https:\/\/registry\.npmjs\.org/u,
      `${step.name} must bind the public registry explicitly`,
    );
  }

  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) {
      if (step.run) {
        assert.doesNotMatch(
          step.run,
          /\$\{\{/u,
          `${step.name} interpolates a GitHub expression into run source`,
        );
      }
    }
  }

  const prepareNames = workflow.jobs.prepare.steps.map((step) => step.name);
  assert.ok(
    prepareNames.indexOf("Validate tag and protected-branch ancestry") <
      prepareNames.indexOf("Validate release metadata"),
  );
  assert.ok(
    prepareNames.indexOf("Validate release metadata") <
      prepareNames.indexOf("Install exact npm CLI"),
  );
  assert.ok(
    prepareNames.indexOf("Verify package") <
      prepareNames.indexOf("Pack final artifact"),
  );
  assert.ok(
    prepareNames.indexOf("Pack final artifact") <
      prepareNames.indexOf("Test exact final artifact"),
  );

  const publishStep = workflow.jobs.publish.steps.find(
    (step) => step.name === "Publish exact tarball",
  );
  assert.equal(
    publishStep.if,
    "steps.registry.outputs.registry_state == 'missing'",
  );
  assert.match(
    publishStep.run,
    /npm publish .*\.tgz"? --ignore-scripts --access public --tag latest --provenance/u,
  );
  assert.match(
    verifierSource,
    /"install",[\s\S]*"--ignore-scripts",[\s\S]*"--omit=peer",[\s\S]*"--save-exact",[\s\S]*"--no-audit",[\s\S]*"--no-fund",[\s\S]*"--registry",[\s\S]*npmRegistryOrigin/u,
  );
  assert.match(
    verifierSource,
    /"audit",[\s\S]*"signatures",[\s\S]*"--json",[\s\S]*"--include-attestations",[\s\S]*"--registry",[\s\S]*npmRegistryOrigin/u,
  );
  const releaseScriptStep = workflow.jobs["github-release"].steps.find(
    (step) => step.name === "Create or verify GitHub Release",
  );
  assert.match(
    releaseScriptStep.run,
    /gh release create .*--verify-tag.*--generate-notes/u,
  );

  const brokenPublicationOrder = structuredClone(workflow);
  brokenPublicationOrder.jobs.publish.steps.reverse();
  assert.throws(() => assertReleaseOrder(brokenPublicationOrder));
  const brokenReleaseOrder = structuredClone(workflow);
  brokenReleaseOrder.jobs["github-release"].needs = "prepare";
  assert.throws(() => assertReleaseOrder(brokenReleaseOrder));
});

test("GitHub Release shell accepts only missing or exact existing state with fake gh", () => {
  const workflow = releaseWorkflow();
  const releaseStep = workflow.jobs?.["github-release"]?.steps?.find(
    (step) => step.name === "Create or verify GitHub Release",
  );
  assert.equal(typeof releaseStep?.run, "string");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dnh-fake-gh-"));
  try {
    const fakeGh = path.join(directory, "gh");
    const logFile = path.join(directory, "gh.log");
    fs.writeFileSync(
      fakeGh,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "api") {
  if (process.env.FAKE_GH_MODE === "network") {
    process.stderr.write("network unavailable\\n");
    process.exit(1);
  }
  const exact = process.env.FAKE_GH_MODE === "exact";
  const unexpected = process.env.FAKE_GH_MODE === "unexpected";
  process.stdout.write("HTTP/2 " + (exact || unexpected ? "200" : "404") + " fixture\\n\\n");
  if (exact) process.stdout.write("v2.0.0\\tv2.0.0\\tfalse\\tfalse\\n");
  if (unexpected) process.stdout.write("v2.0.0\\tv2.0.0\\ttrue\\tfalse\\n");
  process.exit(exact || unexpected ? 0 : 1);
}
if (args[0] === "release" && args[1] === "create") {
  fs.appendFileSync(process.env.FAKE_GH_LOG, "create\\n");
  process.exit(process.env.FAKE_GH_CREATE_STATUS === "failure" ? 1 : 0);
}
if (args[0] === "release" && args[1] === "view") {
  process.stdout.write("v2.0.0\\tv2.0.0\\tfalse\\tfalse\\n");
  process.exit(0);
}
process.exit(2);
`,
    );
    fs.chmodSync(fakeGh, 0o755);
    const baseEnv = {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH}`,
      RELEASE_TAG: releaseTag,
      RELEASE_REPOSITORY: repositorySlug,
      GH_TOKEN: "fixture",
      FAKE_GH_LOG: logFile,
    };

    const missing = run("bash", ["-euo", "pipefail", "-c", releaseStep.run], {
      cwd: directory,
      env: { ...baseEnv, FAKE_GH_MODE: "missing" },
    });
    assert.equal(missing.status, 0, missing.stderr);
    assert.equal(fs.readFileSync(logFile, "utf8"), "create\n");

    fs.writeFileSync(logFile, "");
    const indeterminateCreate = run(
      "bash",
      ["-euo", "pipefail", "-c", releaseStep.run],
      {
        cwd: directory,
        env: {
          ...baseEnv,
          FAKE_GH_MODE: "missing",
          FAKE_GH_CREATE_STATUS: "failure",
        },
      },
    );
    assert.equal(indeterminateCreate.status, 0, indeterminateCreate.stderr);
    assert.equal(fs.readFileSync(logFile, "utf8"), "create\n");

    fs.writeFileSync(logFile, "");
    const exact = run("bash", ["-euo", "pipefail", "-c", releaseStep.run], {
      cwd: directory,
      env: { ...baseEnv, FAKE_GH_MODE: "exact" },
    });
    assert.equal(exact.status, 0, exact.stderr);
    assert.equal(fs.readFileSync(logFile, "utf8"), "");

    const unexpected = run(
      "bash",
      ["-euo", "pipefail", "-c", releaseStep.run],
      { cwd: directory, env: { ...baseEnv, FAKE_GH_MODE: "unexpected" } },
    );
    assert.notEqual(unexpected.status, 0);
    assert.equal(fs.readFileSync(logFile, "utf8"), "");

    const network = run("bash", ["-euo", "pipefail", "-c", releaseStep.run], {
      cwd: directory,
      env: { ...baseEnv, FAKE_GH_MODE: "network" },
    });
    assert.notEqual(network.status, 0);
    assert.equal(fs.readFileSync(logFile, "utf8"), "");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
