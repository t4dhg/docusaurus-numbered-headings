import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const libDir = resolve(rootDir, "lib");

await rm(libDir, { recursive: true, force: true });
