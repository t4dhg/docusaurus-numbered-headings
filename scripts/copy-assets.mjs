import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(rootDir, "src");
const sourceStylesDir = resolve(sourceDir, "styles");
const libDir = resolve(rootDir, "lib");
const libStylesDir = resolve(libDir, "styles");

await mkdir(libStylesDir, { recursive: true });
await copyFile(
  resolve(sourceDir, "numbered-headings.css"),
  resolve(libDir, "numbered-headings.css"),
);

const styleFiles = (await readdir(sourceStylesDir))
  .filter((file) => file.endsWith(".css"))
  .sort();

await Promise.all(
  styleFiles.map((file) =>
    copyFile(resolve(sourceStylesDir, file), resolve(libStylesDir, file)),
  ),
);
