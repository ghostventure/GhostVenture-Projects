import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const mobileDist = join(root, "mobile", "dist");
const target = join(root, "dist", "android");
const expoAssetSource = join(mobileDist, "_expo");
const expoAssetTarget = join(root, "dist", "_expo");
const mobileFaviconSource = join(mobileDist, "favicon.ico");
const rootFaviconTarget = join(root, "dist", "favicon.ico");
const apkName = "FoxHub-Android-Debug-0.1.0.apk";
const apkSource = join(root, "release", apkName);
const downloadTarget = join(root, "dist", "downloads");
const apkZipName = `${apkName}.zip`;

if (!existsSync(mobileDist)) {
  throw new Error("mobile/dist is missing. Run npm --prefix mobile run export:web first.");
}

mkdirSync(join(root, "dist"), { recursive: true });
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(mobileDist, target, { recursive: true });

if (existsSync(expoAssetSource)) {
  rmSync(expoAssetTarget, { recursive: true, force: true });
  cpSync(expoAssetSource, expoAssetTarget, { recursive: true });
}

if (existsSync(mobileFaviconSource)) {
  cpSync(mobileFaviconSource, rootFaviconTarget);
}

if (existsSync(apkSource)) {
  rmSync(downloadTarget, { recursive: true, force: true });
  mkdirSync(downloadTarget, { recursive: true });
  execFileSync("zip", ["-j", "-q", join(downloadTarget, apkZipName), apkSource]);
  console.log(`staged Android APK download package at dist/downloads/${apkZipName}`);
}

console.log("staged mobile web app at dist/android");
