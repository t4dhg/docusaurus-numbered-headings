const test = require("node:test");
const assert = require("node:assert/strict");

const commandUtilities = import("../scripts/command-utils.mjs");

function spawnResult(overrides) {
  return {
    pid: 123,
    output: [null, "", ""],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    error: undefined,
    ...overrides,
  };
}

test("uses Node and the npm CLI JavaScript file on Windows", async () => {
  const { resolveNpmInvocation } = await commandUtilities;
  const nodeExecutable = String.raw`C:\Program Files\nodejs\node.exe`;
  const npmExecPath = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`;

  const invocation = resolveNpmInvocation({
    platform: "win32",
    nodeExecutable,
    npmExecPath,
    isFile: (candidate) => candidate === npmExecPath,
  });

  assert.deepEqual(invocation, {
    command: nodeExecutable,
    prefixArgs: [npmExecPath],
  });
  assert.equal(invocation.command.toLowerCase().endsWith(".cmd"), false);
});

test("uses direct npm invocation as the POSIX fallback", async () => {
  const { resolveNpmInvocation } = await commandUtilities;

  const invocation = resolveNpmInvocation({
    platform: "linux",
    nodeExecutable: "/usr/bin/node",
    npmExecPath: undefined,
    isFile: () => false,
  });

  assert.deepEqual(invocation, { command: "npm", prefixArgs: [] });
});

test("fails closed when Windows has no npm CLI JavaScript path", async () => {
  const { resolveNpmInvocation } = await commandUtilities;

  assert.throws(
    () =>
      resolveNpmInvocation({
        platform: "win32",
        nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
        npmExecPath: undefined,
        isFile: () => false,
      }),
    /requires npm_execpath on Windows; refusing to invoke npm\.cmd without a shell/,
  );
});

test("rejects a Windows command shim as npm_execpath", async () => {
  const { resolveNpmInvocation } = await commandUtilities;

  assert.throws(
    () =>
      resolveNpmInvocation({
        platform: "win32",
        nodeExecutable: String.raw`C:\Program Files\nodejs\node.exe`,
        npmExecPath: String.raw`C:\Program Files\nodejs\npm.cmd`,
        isFile: () => true,
      }),
    /requires npm_execpath to identify an existing npm CLI JavaScript file/,
  );
});

test("rejects an npm CLI JavaScript path that is not a file", async () => {
  const { resolveNpmInvocation } = await commandUtilities;

  assert.throws(
    () =>
      resolveNpmInvocation({
        platform: "linux",
        nodeExecutable: "/usr/bin/node",
        npmExecPath: "/usr/lib/node_modules/npm/bin/npm-cli.js",
        isFile: () => false,
      }),
    /requires npm_execpath to identify an existing npm CLI JavaScript file/,
  );
});

test("reports a nonzero exit status with command context", async () => {
  const { assertSpawnSucceeded } = await commandUtilities;

  assert.throws(
    () =>
      assertSpawnSucceeded(
        "/usr/bin/node",
        ["script with spaces.mjs", "pack"],
        spawnResult({ status: 2, stdout: "partial output" }),
      ),
    /"\/usr\/bin\/node" "script with spaces\.mjs" "pack" exited with status 2\npartial output/,
  );
});

test("reports termination by signal separately from exit status", async () => {
  const { assertSpawnSucceeded } = await commandUtilities;

  assert.throws(
    () =>
      assertSpawnSucceeded(
        "/usr/bin/node",
        ["script.mjs"],
        spawnResult({ status: null, signal: "SIGTERM" }),
      ),
    /terminated by signal SIGTERM/,
  );
});

test("wraps spawn errors with command context", async () => {
  const { assertSpawnSucceeded } = await commandUtilities;
  const spawnError = Object.assign(new Error("spawn npm ENOENT"), {
    code: "ENOENT",
  });

  assert.throws(
    () =>
      assertSpawnSucceeded(
        "npm",
        ["pack"],
        spawnResult({ status: null, error: spawnError }),
      ),
    (error) => {
      assert.match(error.message, /"npm" "pack" failed to start/);
      assert.match(error.message, /spawn npm ENOENT/);
      assert.equal(error.cause, spawnError);
      return true;
    },
  );
});
