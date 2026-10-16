import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-crash-reporter",
    "--disable-dev-shm-usage",
    "--user-data-dir=/tmp/estatehat-puppeteer-profile",
  ],
});

const page = await browser.newPage();
page.on("console", (msg) => console.log("console:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("pageerror:", err.message));
page.on("requestfailed", (req) => console.log("requestfailed:", req.url(), req.failure()?.errorText));

await page.goto("http://127.0.0.1:4173/demo.html", { waitUntil: "networkidle2", timeout: 30000 });
console.log("title:", await page.title());
console.log("body:", await page.$eval("body", (el) => el.innerText.slice(0, 1000)));
await page.screenshot({ path: "/tmp/estatehat-demo-puppeteer.png", fullPage: true });

await browser.close();
