import { posix, win32 } from "node:path";

const npmCliPattern = /^npm-cli\.(?:c?js|mjs)$/i;

export function resolveNpmInvocation({
  platform,
  nodeExecutable,
  npmExecPath,
  isFile,
}) {
  const pathApi = platform === "win32" ? win32 : posix;

  if (npmExecPath === undefined) {
    if (platform === "win32") {
      throw new Error(
        "[docusaurus-numbered-headings] package verification requires npm_execpath on Windows; refusing to invoke npm.cmd without a shell",
      );
    }
    return { command: "npm", prefixArgs: [] };
  }

  if (
    typeof npmExecPath !== "string" ||
    !pathApi.isAbsolute(npmExecPath) ||
    !npmCliPattern.test(pathApi.basename(npmExecPath)) ||
    !isFile(npmExecPath)
  ) {
    throw new Error(
      "[docusaurus-numbered-headings] package verification requires npm_execpath to identify an existing npm CLI JavaScript file",
    );
  }
  if (
    typeof nodeExecutable !== "string" ||
    !pathApi.isAbsolute(nodeExecutable)
  ) {
    throw new Error(
      "[docusaurus-numbered-headings] package verification requires an absolute Node.js executable path",
    );
  }

  return { command: nodeExecutable, prefixArgs: [npmExecPath] };
}

function commandContext(command, args) {
  return [command, ...args]
    .map((value) => JSON.stringify(String(value)))
    .join(" ");
}

function failureMessage(headline, result) {
  return [headline, result.stdout?.trim(), result.stderr?.trim()]
    .filter(Boolean)
    .join("\n");
}

export function assertSpawnSucceeded(command, args, result) {
  const context = commandContext(command, args);

  if (result.error) {
    throw new Error(
      failureMessage(
        `${context} failed to start: ${result.error.message}`,
        result,
      ),
      { cause: result.error },
    );
  }
  if (result.status !== null) {
    if (result.status === 0) return;
    throw new Error(
      failureMessage(`${context} exited with status ${result.status}`, result),
    );
  }
  if (result.signal !== null) {
    throw new Error(
      failureMessage(
        `${context} terminated by signal ${result.signal}`,
        result,
      ),
    );
  }

  throw new Error(
    failureMessage(
      `${context} ended without an exit status or termination signal`,
      result,
    ),
  );
}
