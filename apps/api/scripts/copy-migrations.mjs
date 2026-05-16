import { mkdir, readdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "..", "src", "db", "migrations");
const dstDir = path.resolve(__dirname, "..", "dist", "db", "migrations");

async function main() {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    await copyFile(path.join(srcDir, entry.name), path.join(dstDir, entry.name));
    copied += 1;
  }
  process.stdout.write(`Copied ${copied} migration file(s) to dist/db/migrations.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
