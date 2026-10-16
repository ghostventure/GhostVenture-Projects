import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT, ".tmp", "estatehat-demo-recording");
const FRAME_DIR = path.join(TMP_DIR, "frames");
const AUDIO_PATH = path.join(TMP_DIR, "estatehat-demo.wav");
const CHROME_LOG_PATH = path.join(TMP_DIR, "chromium.log");
const OUTPUT_DIR = path.join(ROOT, "public", "landing", "video");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "estatehat-demo-walkthrough.mp4");
const DEBUG_PORT = 9222;
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 15;
const DURATION_SECONDS = 24;
const URL = "http://127.0.0.1:4173/demo-video.html?autoplay=1&recording=1";
const browserWsArg = process.argv.find((arg) => arg.startsWith("--browser-ws="));
const EXTERNAL_BROWSER_WS = browserWsArg ? browserWsArg.slice("--browser-ws=".length) : "";

const narration = [
  "This EstateHat demo shows the platform as one connected home sale workspace.",
  "It starts on Hat Board, where listings, actions, and guidance stay in the same flow.",
  "Next, buyers and sellers can browse properties without leaving the account shell.",
  "Then the listing step shows where a seller begins the process and prepares the sale.",
  "Messages keep conversation inside the transaction instead of scattering updates across channels.",
  "Finally, documents and next steps bring the deal back to forms, helpers, and closing readiness.",
].join(" ");

async function ensureCleanDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
  await mkdir(dirPath, { recursive: true });
}

function spawnChromium() {
  const profileDir = path.join(TMP_DIR, "chrome-profile");
  const chromeCommand = [
    "/usr/bin/chromium",
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-crash-reporter",
    "--disable-crashpad",
    "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ].join(" ");

  return spawn(
    "/usr/bin/script",
    [
      "-q",
      "-f",
      CHROME_LOG_PATH,
      "-c",
      chromeCommand,
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
    },
  );
}

async function waitForDevToolsUrl(chromium, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (chromium.exitCode !== null) {
      throw new Error(`Chromium exited before opening DevTools (code ${chromium.exitCode})`);
    }
    try {
      const logText = await readFile(CHROME_LOG_PATH, "utf8");
      const match = logText.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        return match[1];
      }
    } catch {
      // Log file may not exist yet during startup.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for Chromium DevTools websocket URL");
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 0;

  const ready = new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (!message.id) return;
    const deferred = pending.get(message.id);
    if (!deferred) return;
    pending.delete(message.id);
    if (message.error) {
      deferred.reject(new Error(message.error.message || "CDP error"));
      return;
    }
    deferred.resolve(message.result);
  });

  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  async function close() {
    for (const deferred of pending.values()) {
      deferred.reject(new Error("CDP socket closed"));
    }
    pending.clear();
    socket.close();
  }

  return { ready, send, close };
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

async function createNarration() {
  console.log("Generating narration...");
  await runCommand("/usr/bin/espeak", ["-s", "158", "-w", AUDIO_PATH, narration]);
}

async function encodeVideo() {
  console.log("Encoding MP4...");
  await runCommand("/usr/bin/ffmpeg", [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    path.join(FRAME_DIR, "frame-%04d.jpg"),
    "-i",
    AUDIO_PATH,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    OUTPUT_PATH,
  ]);
}

async function recordFrames() {
  const chromium = EXTERNAL_BROWSER_WS ? null : spawnChromium();
  console.log(EXTERNAL_BROWSER_WS ? "Attaching to existing Chromium..." : "Starting Chromium capture...");

  try {
    const devToolsUrl = EXTERNAL_BROWSER_WS || (await waitForDevToolsUrl(chromium));
    console.log("DevTools websocket is up.");
    const cdp = createCdpClient(devToolsUrl);
    await cdp.ready;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: WIDTH,
      screenHeight: HEIGHT,
    }, sessionId);
    await cdp.send("Page.setLifecycleEventsEnabled", { enabled: true }, sessionId);
    await cdp.send("Page.navigate", { url: URL }, sessionId);
    await delay(1800);
    console.log("Page loaded. Capturing frames...");

    const totalFrames = FPS * DURATION_SECONDS;
    const frameIntervalMs = Math.round(1000 / FPS);

    for (let index = 0; index < totalFrames; index += 1) {
      const result = await cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 88,
        fromSurface: true,
      }, sessionId);
      const framePath = path.join(FRAME_DIR, `frame-${String(index + 1).padStart(4, "0")}.jpg`);
      await writeFile(framePath, Buffer.from(result.data, "base64"));
      if ((index + 1) % FPS === 0) {
        console.log(`Captured ${index + 1}/${totalFrames} frames`);
      }
      await delay(frameIntervalMs);
    }

    await cdp.close();
  } catch (error) {
    let chromeLog = "";
    if (chromium) {
      try {
        chromeLog = await readFile(CHROME_LOG_PATH, "utf8");
      } catch {
        chromeLog = "";
      }
    }
    throw new Error(`${error.message}\nChromium log:\n${chromeLog}`);
  } finally {
    if (chromium && chromium.exitCode === null) {
      chromium.kill("SIGTERM");
      await new Promise((resolve) => chromium.once("close", resolve));
    }
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await ensureCleanDir(TMP_DIR);
  await mkdir(FRAME_DIR, { recursive: true });

  await createNarration();
  await recordFrames();
  const frames = await readdir(FRAME_DIR);
  if (frames.length < FPS * 10) {
    throw new Error(`Frame capture looks incomplete: only ${frames.length} frames found`);
  }
  console.log(`Captured ${frames.length} frames total.`);
  await encodeVideo();

  const stats = await runCommand("/usr/bin/ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_name,width,height",
    "-of",
    "json",
    OUTPUT_PATH,
  ]);

  await writeFile(path.join(TMP_DIR, "ffprobe.json"), stats.stdout);
  const ffprobe = JSON.parse(await readFile(path.join(TMP_DIR, "ffprobe.json"), "utf8"));
  console.log(JSON.stringify({ output: OUTPUT_PATH, frames: frames.length, ffprobe }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
