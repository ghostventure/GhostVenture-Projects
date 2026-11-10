(() => {
  "use strict";

  const chooser = document.getElementById("recommended-download");
  const status = document.getElementById("download-route-status");
  if (!chooser || !status) return;

  const validSha256 = (value) => /^[a-f0-9]{64}$/i.test(value || "");

  async function managerPackageAvailable(managerPackage) {
    if (managerPackage?.status !== "ready" || !validSha256(managerPackage.sha256)) return false;
    try {
      const url = new URL(managerPackage.url, document.baseURI);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/downloads/managers/")) return false;
      const response = await fetch(url.href, { method: "HEAD", cache: "no-store" });
      const length = Number(response.headers.get("Content-Length") || 0);
      return response.ok && (!length || length > 0);
    } catch (_error) {
      return false;
    }
  }

  async function detectSystem() {
    const userAgent = navigator.userAgent || "";
    const platform = navigator.userAgentData?.platform || navigator.platform || userAgent;
    let architecture = "";

    if (navigator.userAgentData?.getHighEntropyValues) {
      try {
        const hints = await navigator.userAgentData.getHighEntropyValues(["architecture", "bitness"]);
        const hintedArchitecture = (hints.architecture || "").toLowerCase();
        if (hintedArchitecture.includes("arm")) architecture = "arm64";
        else if (hintedArchitecture === "x86" && (hints.bitness === "64" || /Win64|x64|WOW64/i.test(userAgent))) architecture = "x86_64";
        else if (hintedArchitecture === "x86") architecture = "x86";
      } catch (_error) {
        // Fall back to the user-agent platform tokens where high-entropy hints are unavailable.
      }
    }

    // iPadOS can report itself as a Mac when requesting desktop websites.
    if (/iPad|iPhone|iPod/i.test(userAgent) || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1)) {
      return { platform: null, architecture: "" };
    }
    if (/Android/i.test(userAgent)) return { platform: null, architecture: "" };
    if (/Windows/i.test(platform)) {
      if (!architecture) architecture = /Win64|x64|WOW64/i.test(userAgent) ? "x86_64" : "";
      return { platform: "windows", architecture };
    }
    if (/Mac/i.test(platform)) return { platform: "macos", architecture: "universal" };
    if (/Linux|X11/i.test(platform)) {
      if (!architecture) {
        if (/aarch64|arm64/i.test(userAgent)) architecture = "arm64";
        else if (/x86_64|amd64/i.test(userAgent)) architecture = "x86_64";
      }
      return { platform: "linux", architecture };
    }
    return { platform: null, architecture: "" };
  }

  async function configure() {
    let manifest;
    try {
      const response = await fetch("downloads/installer-manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
      manifest = await response.json();
    } catch (_error) {
      status.textContent = "Device detection is unavailable right now. Choose a platform below to find its installation manager.";
      return;
    }

    const target = await detectSystem();
    const platformLinks = [...document.querySelectorAll(".platform-download[data-manager-platform]")];
    await Promise.all(platformLinks.map(async (link) => {
      const linkPlatform = link.dataset.managerPlatform;
      const linkInfo = manifest.platforms?.[linkPlatform];
      const managers = linkInfo?.managerPackages || {};
      const desiredArchitecture = linkPlatform === target.platform
        ? target.architecture
        : (managers.universal ? "universal" : "x86_64");
      const readyManager = managers[desiredArchitecture]
        ? [desiredArchitecture, managers[desiredArchitecture]]
        : Object.entries(managers).find(([, item]) => item.architectures?.includes(desiredArchitecture));
      const isAvailable = readyManager && await managerPackageAvailable(readyManager[1]);
      if (!isAvailable) {
        link.href = "#download";
        link.setAttribute("aria-disabled", "true");
        link.classList.add("manager-unavailable");
        link.textContent = readyManager
          ? `${linkInfo?.displayName || "Platform"} Manager is being prepared`
          : `No ${linkInfo?.displayName || "platform"} manager for this architecture`;
      } else {
        const [architecture, managerPackage] = readyManager;
        link.href = new URL(managerPackage.url, document.baseURI).href;
        link.removeAttribute("aria-disabled");
        link.classList.remove("manager-unavailable");
        link.textContent = `Download ${linkInfo.displayName} Manager${architecture === "universal" ? "" : ` (${architecture})`}`;
      }
    }));

    const platform = target.platform;
    const platformInfo = platform && manifest.platforms?.[platform];
    const managers = platformInfo?.managerPackages || {};
    const manager = managers[target.architecture] || Object.values(managers).find((item) => item.architectures?.includes(target.architecture));
    if (!platformInfo) {
      chooser.textContent = "Choose an installation manager";
      chooser.href = "#download";
      chooser.removeAttribute("aria-disabled");
      status.textContent = "The site could not identify a supported desktop platform. Choose Windows, Linux, or Mac below.";
      return;
    }
    if (!manager) {
      chooser.textContent = `No ${platformInfo.displayName} manager for this device`;
      chooser.href = "#download";
      chooser.setAttribute("aria-disabled", "true");
      status.textContent = target.architecture
        ? `No ${platformInfo.displayName} installation manager is published for ${target.architecture}.`
        : `The ${platformInfo.displayName} architecture could not be identified, so the site cannot safely choose a manager.`;
      return;
    }

    const managerReady = await managerPackageAvailable(manager);
    const managerUrl = new URL(manager.url, document.baseURI).href;
    chooser.textContent = managerReady ? `Download ${platformInfo.displayName} Manager` : `${platformInfo.displayName} Manager is being prepared`;
    chooser.href = managerReady ? managerUrl : "#download";
    chooser.toggleAttribute("aria-disabled", !managerReady);
    chooser.dataset.platform = platform;
    status.textContent = managerReady
      ? `Detected ${platformInfo.displayName} (${target.architecture}). Download and open its manager; it checks this system, verifies the package, and installs the newest compatible browser version.`
      : `Detected ${platformInfo.displayName} (${target.architecture}). Its manager download will be available when the verified manager bundle is published.`;

    document.querySelectorAll(".download-card[data-platform]").forEach((card) => {
      card.classList.toggle("recommended-platform", card.dataset.platform === platform);
    });
  }

  configure();
})();
