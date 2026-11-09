(() => {
  "use strict";

  const chooser = document.getElementById("recommended-download");
  const status = document.getElementById("download-route-status");
  if (!chooser || !status) return;

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
      status.textContent = "Choose your platform below to get its installer.";
      return;
    }

    document.querySelectorAll(".platform-download[data-manager-platform]").forEach((link) => {
      const linkPlatform = link.dataset.managerPlatform;
      const linkInfo = manifest.platforms?.[linkPlatform];
      const candidates = Object.entries(linkInfo?.managerPackages || {});
      const readyManager = candidates.find(([, item]) => item.status === "ready" && /^[a-f0-9]{64}$/i.test(item.sha256 || ""));
      if (!readyManager) {
        link.href = "#download";
        link.setAttribute("aria-disabled", "true");
        link.classList.add("manager-unavailable");
        link.textContent = `${linkInfo?.displayName || "Platform"} Manager is being prepared`;
      } else {
        const [architecture, managerPackage] = readyManager;
        link.href = new URL(managerPackage.url, document.baseURI).href;
        link.removeAttribute("aria-disabled");
        link.classList.remove("manager-unavailable");
        link.textContent = `Download ${linkInfo.displayName} Manager${architecture === "universal" ? "" : ` (${architecture})`}`;
      }
    });

    const target = await detectSystem();
    const platform = target.platform;
    const platformInfo = platform && manifest.platforms?.[platform];
    const managers = platformInfo?.managerPackages || {};
    const manager = managers[target.architecture] || Object.values(managers).find((item) => item.architectures?.includes(target.architecture));
    if (!platformInfo) {
      chooser.textContent = "Choose a platform";
      chooser.href = "#download";
      chooser.removeAttribute("aria-disabled");
      status.textContent = "This device is not supported by the desktop installers. Choose Windows, Linux, or Mac below.";
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

    const managerUrl = new URL(manager.url, document.baseURI).href;
    const managerReady = manager.status === "ready" && /^[a-f0-9]{64}$/i.test(manager.sha256 || "");
    chooser.textContent = managerReady ? `Download ${platformInfo.displayName} Manager` : `${platformInfo.displayName} Manager is being prepared`;
    chooser.href = managerReady ? managerUrl : "#download";
    chooser.toggleAttribute("aria-disabled", !managerReady);
    chooser.dataset.platform = platform;
    status.textContent = managerReady
      ? `Detected ${platformInfo.displayName} (${target.architecture}). Its manager will check this system and choose the newest compatible Ghost Surfer version.`
      : `Detected ${platformInfo.displayName} (${target.architecture}). The manager route is reserved; its verified package is awaiting upload.`;

    document.querySelectorAll(".download-card[data-platform]").forEach((card) => {
      card.classList.toggle("recommended-platform", card.dataset.platform === platform);
    });
  }

  configure();
})();
