import { access, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".firebase/static-fast/hosting");
const requiredPages = [
  "index.html", "about.html", "ad-expansion.html", "ai-services.html", "beat-sessions.html",
  "book.html", "contact.html", "dj-services.html", "dmca.html", "faq.html", "fashion.html",
  "legal.html", "membership-sites.html", "models.html", "models/faq.html", "multimedia.html",
  "pc-tech-support.html", "photography.html", "portal.html", "portfolio.html", "privacy.html",
  "services.html", "store.html", "support.html", "tech-development.html", "terms.html",
  "videography.html", "work.html", "404.html", "500.html", "robots.txt", "sitemap.xml"
];
let missing = 0;
for (const file of requiredPages) {
  try {
    await access(path.join(root, file));
  } catch {
    console.error(`Static artifact missing required route or asset: ${file}`);
    missing += 1;
  }
}
try {
  const files = await readdir(path.join(root, "_next", "static"));
  if (!files.length) throw new Error("empty");
} catch {
  console.error("Static artifact is missing Next.js static assets.");
  missing += 1;
}
if (missing) process.exitCode = 1;
else console.log(`Static artifact check passed for ${requiredPages.length} routes/assets and Next.js chunks.`);
