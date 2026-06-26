import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, ".firebase", "static-fast", "hosting");
const appDir = path.join(root, ".next", "server", "app");
const nextStaticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");

async function copyIfExists(source, destination) {
  if (!existsSync(source)) {
    return;
  }

  await cp(source, destination, { recursive: true });
}

async function listHtmlFiles(dir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const sourcePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listHtmlFiles(sourcePath, baseDir));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path.relative(baseDir, sourcePath));
    }
  }

  return files;
}

function mapStaticHtmlTarget(sourceName) {
  if (sourceName === "_not-found.html") {
    return "404.html";
  }

  if (sourceName === "_global-error.html") {
    return "500.html";
  }

  return sourceName;
}

if (!existsSync(appDir) || !existsSync(nextStaticDir)) {
  throw new Error("Run npm run build before preparing static hosting.");
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await copyIfExists(publicDir, outDir);
await mkdir(path.join(outDir, "_next"), { recursive: true });
await cp(nextStaticDir, path.join(outDir, "_next", "static"), { recursive: true });

for (const sourceName of await listHtmlFiles(appDir)) {
  const targetName = mapStaticHtmlTarget(sourceName);
  await mkdir(path.dirname(path.join(outDir, targetName)), { recursive: true });
  await copyIfExists(path.join(appDir, sourceName), path.join(outDir, targetName));
}

console.log(`Static hosting prepared at ${outDir}`);
