(() => {
  const storageKey = "ghost-surfer-preview-settings-v1";
  const page = document.querySelector(".phone-browser");
  const status = document.querySelector("#preview-status");
  const settings = document.querySelector("#preview-settings");
  const settingsToggle = document.querySelector("#settings-toggle");
  const guardToggle = document.querySelector("#guard-toggle");
  const compactToggle = document.querySelector("#compact-toggle");
  const gridToggle = document.querySelector("#grid-toggle");
  const guardIndicator = document.querySelector(".console-head > strong");
  const addressInput = document.querySelector("#address-input");
  const searchInput = document.querySelector("#search-input");

  function announce(message) {
    status.textContent = message;
  }

  function readSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    } catch {
      return {};
    }
  }

  let preferences = readSettings();
  const themes = ["", "theme-violet", "theme-mint"];

  function applyPreferences() {
    page.classList.remove(...themes.filter(Boolean));
    if (themes.includes(preferences.theme)) page.classList.add(preferences.theme);
    page.classList.toggle("compact-preview", Boolean(preferences.compact));
    page.classList.toggle("grid-preview", Boolean(preferences.grid));
    compactToggle.setAttribute("aria-pressed", String(Boolean(preferences.compact)));
    gridToggle.setAttribute("aria-pressed", String(Boolean(preferences.grid)));
    guardToggle.setAttribute("aria-pressed", String(preferences.guard !== false));
    compactToggle.classList.toggle("active", Boolean(preferences.compact));
    gridToggle.classList.toggle("active", Boolean(preferences.grid));
    guardToggle.classList.toggle("active", preferences.guard !== false);
    guardIndicator.textContent = preferences.guard === false ? "OFF" : "DEMO";
  }

  function savePreferences(message) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      announce(message);
    } catch {
      announce("Settings changed for this visit, but this browser did not allow local storage.");
    }
  }

  function openSearch(query) {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "https://www.startpage.com/sp/search";
    form.target = "_blank";
    form.rel = "noopener noreferrer";
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "query";
    field.value = query;
    form.append(field);
    document.body.append(form);
    form.submit();
    form.remove();
  }

  function openAddress(raw) {
    const input = raw.trim();
    if (!input) {
      announce("Enter a web address or search phrase first.");
      return;
    }

    let destination;
    if (/\s/.test(input) || !input.includes(".")) {
      openSearch(input);
      announce("Search sent to Startpage in a new tab. This preview does not proxy or inspect the results.");
      return;
    } else {
      const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
      try {
        destination = new URL(candidate);
      } catch {
        announce("That address could not be read. Enter a full web address or search phrase.");
        return;
      }
      if (!["http:", "https:"].includes(destination.protocol)) {
        announce("For safety, this preview only opens HTTP or HTTPS addresses.");
        return;
      }
    }

    window.open(destination.href, "_blank", "noopener,noreferrer");
    announce("Opened in a new tab. Website behavior and privacy controls are handled by your browser.");
  }

  document.querySelector("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    openSearch(query);
    announce("Search sent to Startpage in a new tab. This preview does not proxy or inspect the results.");
  });

  document.querySelector("#address-form").addEventListener("submit", (event) => {
    event.preventDefault();
    openAddress(addressInput.value);
  });

  settingsToggle.addEventListener("click", () => {
    const expanded = settingsToggle.getAttribute("aria-expanded") === "true";
    settingsToggle.setAttribute("aria-expanded", String(!expanded));
    settings.hidden = expanded;
    if (!expanded) document.querySelector("#theme-toggle").focus();
  });

  compactToggle.addEventListener("click", () => {
    preferences.compact = !preferences.compact;
    applyPreferences();
    savePreferences(`Compact preview ${preferences.compact ? "on" : "off"}. This changes appearance only.`);
  });

  gridToggle.addEventListener("click", () => {
    preferences.grid = !preferences.grid;
    applyPreferences();
    savePreferences(`Grid layout ${preferences.grid ? "on" : "off"}. This changes appearance only.`);
  });

  guardToggle.addEventListener("click", () => {
    preferences.guard = preferences.guard === false;
    applyPreferences();
    savePreferences(`Guard indicator ${preferences.guard ? "on" : "off"}. This preview does not inspect or filter web traffic.`);
  });

  document.querySelector("#theme-toggle").addEventListener("click", () => {
    const current = themes.indexOf(preferences.theme || "");
    preferences.theme = themes[(current + 1) % themes.length];
    applyPreferences();
    savePreferences(`Accent changed to ${preferences.theme.replace("theme-", "") || "blue"}.`);
  });

  function clearPreviewData() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // The page can still reset its current appearance when storage is unavailable.
    }
    preferences = { guard: true };
    applyPreferences();
    document.querySelectorAll("#cookie-choice").forEach((node) => node.remove());
    announce("This preview's saved appearance and demo choices were cleared. Browser history and website cookies were not touched.");
  }

  document.querySelector("#clear-settings").addEventListener("click", clearPreviewData);
  document.querySelector("#clear-preview").addEventListener("click", clearPreviewData);
  document.querySelector("#back-button").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else announce("There is no previous page in this tab.");
  });
  document.querySelector("#nav-back").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else announce("There is no previous page in this tab.");
  });

  function saveCookieDemoChoice(choice) {
    preferences.cookieDemoChoice = choice;
    let choiceNote = document.querySelector("#cookie-choice");
    if (!choiceNote) {
      choiceNote = document.createElement("p");
      choiceNote.id = "cookie-choice";
      choiceNote.className = "preview-status";
      document.querySelector(".sheet-actions").after(choiceNote);
    }
    choiceNote.textContent = `Saved demo choice: ${choice}. No website cookie settings were changed.`;
    savePreferences(`Demo choice “${choice}” saved locally. No website cookie settings were changed.`);
  }
  document.querySelector("#cookie-approve").addEventListener("click", () => saveCookieDemoChoice("approve"));
  document.querySelector("#cookie-decline").addEventListener("click", () => saveCookieDemoChoice("decline"));

  applyPreferences();
  if (["approve", "decline"].includes(preferences.cookieDemoChoice)) {
    const choiceNote = document.createElement("p");
    choiceNote.id = "cookie-choice";
    choiceNote.className = "preview-status";
    choiceNote.textContent = `Saved demo choice: ${preferences.cookieDemoChoice}. No website cookie settings were changed.`;
    document.querySelector(".sheet-actions").after(choiceNote);
  }
})();
