import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const target = process.argv[2] || "public";
const isUrl = /^https?:\/\//i.test(target);

const requiredPages = [
  "index.html",
  "android-app.html",
  "legal.html",
  "compliance.html",
  "privacy.html",
  "terms.html",
  "license.html",
  "cookies.html",
  "refunds.html",
  "security.html",
  "accessibility.html",
  "acceptable-use.html",
  "copyright.html",
  "notices.html",
  "support.html"
];

const requiredText = {
  "index.html": ["Ghost Surfer", "Trust center", "Release intelligence", "Download ZIP", "Android app preview"],
  "android-app.html": ["android-app.css", "Ghost Surfer Android", "Interactive website preview", "sample cookie choice", "Control Center", "android-app.js"],
  "legal.html": ["Legal and trust documents", "Privacy Policy", "Compliance Overview"],
  "compliance.html": ["Compliance Overview", "Compliance Triggers", "Operational Commitments"],
  "privacy.html": ["Privacy Policy", "Privacy Rights", "Children"],
  "terms.html": ["Terms of Use", "No Anonymity Guarantee", "Acceptable Use"],
  "security.html": ["Security and Privacy Limits", "Verifying Downloads"],
  "support.html": ["Support", "solidartentertainment@gmail.com"]
};

const expectedZipHash = "9de59f30c6074dbd37ab17fa69530dc96b51d1c0ea486aef0b7ec1083f04e5c0";
const expectedExeHash = "fe6699dc1b58c5abba19816f8e570ca747fe342797555df07f2c7105e8954ced";

async function loadText(file) {
  if (!isUrl) {
    const fullPath = path.join(target, file);
    if (!existsSync(fullPath)) throw new Error(`Missing ${fullPath}`);
    return readFileSync(fullPath, "utf8");
  }

  const response = await fetch(`${target.replace(/\/$/, "")}/${file}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${file}`);
  return response.text();
}

function assertIncludes(haystack, needle, file) {
  if (!haystack.includes(needle)) {
    throw new Error(`${file} is missing required text: ${needle}`);
  }
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function checkLocalLinks(root) {
  const htmlFiles = requiredPages.map((page) => path.join(root, page));
  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, "utf8");
    const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const raw = match[1].trim();
      if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(raw)) continue;
      const [filePart, fragment] = raw.split("#", 2);
      if (!filePart && !fragment) continue;
      const relativeFile = decodeURIComponent(filePart.split("?", 1)[0]);
      const targetPath = path.resolve(path.dirname(htmlPath), relativeFile || path.basename(htmlPath));
      const releaseZipIsExternal = relativeFile === "downloads/Ghost-Surfer-Browser-Windows.zip" && !existsSync(targetPath);
      if (!targetPath.startsWith(path.resolve(root) + path.sep) || (!existsSync(targetPath) && !releaseZipIsExternal)) {
        throw new Error(`${path.relative(root, htmlPath)} links to missing local target: ${raw}`);
      }
      if (releaseZipIsExternal) continue;
      if (fragment && targetPath.endsWith(".html")) {
        const targetHtml = readFileSync(targetPath, "utf8");
        const targetIds = targetPath === htmlPath ? ids : new Set([...targetHtml.matchAll(/\bid=["']([^"']+)["']/gi)].map((item) => item[1]));
        if (!targetIds.has(decodeURIComponent(fragment))) {
          throw new Error(`${path.relative(root, htmlPath)} links to missing fragment: ${raw}`);
        }
      }
    }
  }
}

for (const page of requiredPages) {
  const html = await loadText(page);
  assertIncludes(html, "<!doctype html>", page);
  assertIncludes(html, "styles.css", page);
  for (const text of requiredText[page] || []) {
    assertIncludes(html, text, page);
  }
}

const indexHtml = await loadText("index.html");
[
  "downloads/Ghost-Surfer-Browser-Windows.zip",
  "android-app.html",
  "downloads/SHA256SUMS.txt",
  "downloads/CHANGELOG.txt",
  "assets/ghost-surfer-icon.svg",
  "privacy.html",
  "terms.html",
  "security.html",
  "support.html"
].forEach((link) => assertIncludes(indexHtml, link, "index.html"));

const sums = await loadText("downloads/SHA256SUMS.txt");
assertIncludes(sums, expectedZipHash, "downloads/SHA256SUMS.txt");
assertIncludes(sums, expectedExeHash, "downloads/SHA256SUMS.txt");

if (!isUrl) {
  checkLocalLinks(target);
  const zipPath = path.join(target, "downloads/Ghost-Surfer-Browser-Windows.zip");
  if (existsSync(zipPath)) {
    const zipHash = await sha256File(zipPath);
    if (zipHash !== expectedZipHash) {
      throw new Error(`ZIP hash mismatch: expected ${expectedZipHash}, got ${zipHash}`);
    }
    if (statSync(zipPath).size < 100_000_000) {
      throw new Error("ZIP download is unexpectedly small");
    }
  } else {
    console.log("Windows ZIP is hosted outside this source checkout; its published checksum is verified from the manifest.");
  }
}

console.log(`Ghost Surfer smoke check passed for ${target}`);
