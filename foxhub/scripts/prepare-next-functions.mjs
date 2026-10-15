import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBuildDir = path.join(repoRoot, ".next");
const functionsNextAppDir = path.join(repoRoot, "functions", "next-app");

if (!existsSync(nextBuildDir)) {
  throw new Error("Missing .next build output. Run `npm run build` before preparing the Functions Next app.");
}

await rm(functionsNextAppDir, { recursive: true, force: true });
await mkdir(functionsNextAppDir, { recursive: true });

await cp(nextBuildDir, path.join(functionsNextAppDir, ".next"), {
  recursive: true,
  filter: (source) => !source.includes(`${path.sep}cache${path.sep}`)
});

const publicDir = path.join(repoRoot, "public");
if (existsSync(publicDir)) {
  await cp(publicDir, path.join(functionsNextAppDir, "public"), { recursive: true });
} else {
  await mkdir(path.join(functionsNextAppDir, "public"), { recursive: true });
}

await cp(path.join(repoRoot, "next.config.js"), path.join(functionsNextAppDir, "next.config.js"));
await writeFile(
  path.join(functionsNextAppDir, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      scripts: {
        start: "next start"
      },
      dependencies: {
        next: "^14.2.35",
        react: "^18.3.1",
        "react-dom": "^18.3.1"
      }
    },
    null,
    2
  ) + "\n"
);

console.log(`Prepared Next app for Firebase Functions at ${path.relative(repoRoot, functionsNextAppDir)}`);
