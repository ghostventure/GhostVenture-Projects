(function () {
  var STORAGE_PREFIX = "cltch_platform_component:";

  function readPrivateNoteRecord(storage, key, fallback) {
    try { var raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (error) { return fallback; }
  }
  function writePrivateNoteDraft(storage, key, draft) {
    try { storage.setItem(key, JSON.stringify(Object.assign({}, draft, { savedAt: Date.now() }))); return true; }
    catch (error) { return false; }
  }
  function clearPrivateNoteDraft(storage, key) {
    try { storage.removeItem(key); return true; } catch (error) { return false; }
  }
  function writeComparedNote(storage, key, draft, expectedRevision) {
    var current = readPrivateNoteRecord(storage, key, { revision: "" }) || { revision: "" };
    if (String(current.revision || "") !== String(expectedRevision || "")) return { status: "conflict", current: current };
    var revision = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var saved = { reason: String(draft.reason || ""), note: String(draft.note || ""), revision: revision, updatedAt: Date.now() };
    try {
      storage.setItem(key, JSON.stringify(saved));
      var confirmed = readPrivateNoteRecord(storage, key, null);
      return confirmed && confirmed.revision === revision ? { status: "saved", current: saved } : { status: "conflict", current: confirmed || current };
    } catch (error) { return { status: "unavailable", current: current }; }
  }
  function savePrivateNoteCompareAndSwap(storage, key, draft, expectedRevision) {
    var locks = window.navigator && window.navigator.locks;
    if (locks && locks.request) return locks.request("cltch-private-note:" + key, { mode: "exclusive" }, function () { return writeComparedNote(storage, key, draft, expectedRevision); });
    return Promise.resolve(writeComparedNote(storage, key, draft, expectedRevision));
  }

  function readState(key, fallback) {
    try {
      var raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeState(key, value) {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) { return false; }
  }

  function normalizeExternalUrl(value) {
    var raw = String(value || "").trim();
    if (!raw || raw.length > 500) return "";
    try {
      var url = new URL(raw);
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return "";
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderChecklist(container, key, items) {
    var state = readState(key, {});
    container.innerHTML = "";
    var list = el("div", "cltch-component-list");
    items.forEach(function (item) {
      var row = el("label", "cltch-check-row");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!state[item.id];
      input.addEventListener("change", function () {
        state[item.id] = input.checked;
        writeState(key, state);
        row.classList.toggle("complete", input.checked);
      });
      row.classList.toggle("complete", input.checked);
      var copy = el("span", "");
      copy.innerHTML = "<strong>" + item.title + "</strong><small>" + item.copy + "</small>";
      row.appendChild(input);
      row.appendChild(copy);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  function scopedBookingKey(name, bookingId) {
    var scope = String(bookingId || "unlinked").slice(0, 128);
    return name + ":" + encodeURIComponent(scope);
  }

  function initBookingAgreement(containerId, bookingId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    renderChecklist(container, scopedBookingKey("booking_agreement", bookingId), [
      { id: "scope", title: "Review event scope", copy: "Check the date, time, role, rate, and setup expectations." },
      { id: "terms", title: "Review booking terms", copy: "Read cancellation, arrival, and payment timing details." },
      { id: "contacts", title: "Check event-day contacts", copy: "Confirm host and performer contact details are available." },
      { id: "rider", title: "Review venue setup", copy: "Check equipment, parking, access, dress code, and venue notes." }
    ]);
  }

  function initStatusTimeline(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var steps = [
      ["requested", "Requested"],
      ["matched", "Matched"],
      ["offered", "Offer Sent"],
      ["accepted", "Accepted"],
      ["confirmed", "Confirmed"],
      ["checked-in", "Checked In"],
      ["completed", "Completed"],
      ["paid", "Paid"]
    ];
    var state = readState("booking_status", { current: "accepted" });
    container.innerHTML = "";
    var rail = el("div", "cltch-status-rail");
    var activeIndex = Math.max(0, steps.findIndex(function (step) { return step[0] === state.current; }));
    steps.forEach(function (step, index) {
      var button = el("button", "cltch-status-step", step[1]);
      button.type = "button";
      button.classList.toggle("done", index < activeIndex);
      button.classList.toggle("active", index === activeIndex);
      button.addEventListener("click", function () {
        state.current = step[0];
        writeState("booking_status", state);
        initStatusTimeline(containerId);
      });
      rail.appendChild(button);
    });
    container.appendChild(rail);
  }

  function initPaymentLifecycle(containerId, bookingId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    renderChecklist(container, scopedBookingKey("payment_lifecycle", bookingId), [
      { id: "method", title: "Payment method captured", copy: "Preferred payout/payment method is present before confirmation." },
      { id: "hold", title: "Funds plan documented", copy: "Manual or provider-backed payment plan is clear for both sides." },
      { id: "release", title: "Release condition set", copy: "Payment release depends on completion, check-in, or host approval." },
      { id: "receipt", title: "Receipt trail ready", copy: "Booking ID, amount, fee, and status can be audited later." }
    ]);
  }

  function initDisputeFlow(containerId, bookingId, userId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var key = STORAGE_PREFIX + scopedBookingKey("dispute_flow", (userId || "local") + ":" + bookingId);
    var storage = null;
    try { storage = window.localStorage; } catch (error) {}
    var draftStorage = null;
    try { draftStorage = window.sessionStorage; } catch (error) {}
    var draftKey = key + ":draft";
    var state = readPrivateNoteRecord(storage, key, { reason: "", note: "", revision: "" }) || { reason: "", note: "", revision: "" };
    var draft = readPrivateNoteRecord(draftStorage, draftKey, null);
    var baseRevision = String(state.revision || "");
    var conflict = null;
    var dirty = !!draft;
    if (draft && draft.baseRevision === baseRevision && draft.reason === state.reason && draft.note === state.note) {
      clearPrivateNoteDraft(draftStorage, draftKey);
      draft = null;
    }
    if (draft && draft.baseRevision !== baseRevision) conflict = { saved: state, draft: draft, observedRevision: baseRevision };
    container.innerHTML = "";
    var form = el("form", "cltch-component-form");
    form.innerHTML = [
      "<label>Reminder category</label>",
      "<select name=\"reason\">",
      "<option value=\"\">Choose a reminder category</option>",
      "<option>No-show</option>",
      "<option>Late arrival</option>",
      "<option>Payment issue</option>",
      "<option>Venue access problem</option>",
      "<option>Scope changed</option>",
      "</select>",
      "<label>Private planning note</label>",
      "<textarea name=\"note\" rows=\"3\" maxlength=\"1000\" placeholder=\"Keep a private reminder for yourself. Do not enter sensitive details.\"></textarea>",
      "<button type=\"submit\">Save Local Note</button>",
      "<p class=\"cltch-component-status\" role=\"status\" aria-live=\"polite\"></p>",
      "<section class=\"cltch-note-conflict\" hidden aria-label=\"Private note versions conflict\"></section>"
    ].join("");
    form.reason.value = draft ? (draft.reason || "") : (state.reason || "");
    form.note.value = draft ? (draft.note || "") : (state.note || "");
    var status = form.querySelector(".cltch-component-status");
    var conflictPanel = form.querySelector(".cltch-note-conflict");
    function renderConflict() {
      if (!conflict) { conflictPanel.hidden = true; conflictPanel.replaceChildren(); return; }
      conflictPanel.hidden = false;
      conflictPanel.replaceChildren();
      var title = el("strong", "", "This browser has two private note versions");
      var savedLabel = el("p", "", "Saved version in this browser");
      var savedText = el("pre", "cltch-note-version", (conflict.saved.reason ? conflict.saved.reason + "\\n" : "") + (conflict.saved.note || ""));
      var draftLabel = el("p", "", "Your unsaved draft in this tab");
      var draftText = el("pre", "cltch-note-version", (conflict.draft.reason ? conflict.draft.reason + "\\n" : "") + (conflict.draft.note || ""));
      var keep = el("button", "", "Keep my draft and replace saved version");
      keep.type = "button";
      var load = el("button", "", "Use saved version");
      load.type = "button";
      keep.addEventListener("click", async function () {
        var result = await savePrivateNoteCompareAndSwap(storage, key, conflict.draft, conflict.observedRevision);
        if (result.status === "saved") {
          state = result.current; baseRevision = result.current.revision; conflict = null;
          dirty = false;
          writePrivateNoteDraft(draftStorage, draftKey, { reason: state.reason, note: state.note, baseRevision: baseRevision });
          status.textContent = "Your choice was saved in this browser only.";
          renderConflict();
        } else {
          conflict = { saved: result.current, draft: conflict.draft, observedRevision: String(result.current?.revision || "") };
          status.textContent = result.status === "unavailable" ? "Browser storage is unavailable; neither note version was replaced." : "The saved note changed again. Compare the versions before choosing.";
          renderConflict();
        }
      });
      load.addEventListener("click", function () {
        var latest = readPrivateNoteRecord(storage, key, { reason: "", note: "", revision: "" }) || { reason: "", note: "", revision: "" };
        state = latest; baseRevision = String(latest.revision || "");
        form.reason.value = latest.reason || ""; form.note.value = latest.note || "";
        clearPrivateNoteDraft(draftStorage, draftKey); conflict = null;
        dirty = false;
        status.textContent = "Using the saved version from this browser. It has not been shared.";
        renderConflict();
      });
      conflictPanel.append(title, savedLabel, savedText, draftLabel, draftText, keep, load);
    }
    function saveDraftLocally() {
      dirty = true;
      var next = { reason: form.reason.value, note: form.note.value, baseRevision: baseRevision };
      if (!writePrivateNoteDraft(draftStorage, draftKey, next)) {
        status.textContent = "Tab storage is unavailable; this draft is only in the open page.";
        return;
      }
      if (conflict) conflict.draft = next;
      else status.textContent = "Draft saved in this tab only; not shared with support or the other participant.";
      renderConflict();
    }
    if (draft && !conflict) status.textContent = "Restored an unsaved draft from this tab after reload. It has not been shared.";
    if (conflict) {
      status.textContent = "This saved note changed in another tab. Compare both local versions before saving.";
      renderConflict();
    }
    form.reason.addEventListener("input", saveDraftLocally);
    form.note.addEventListener("input", saveDraftLocally);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (conflict) {
        status.textContent = "Resolve the two local note versions before saving.";
        return;
      }
      var next = { reason: form.reason.value, note: form.note.value.trim() };
      var result = savePrivateNoteCompareAndSwap(storage, key, next, baseRevision);
      Promise.resolve(result).then(function (saved) {
        if (saved.status === "conflict") {
          conflict = { saved: saved.current, draft: { ...next, baseRevision: baseRevision }, observedRevision: String(saved.current?.revision || "") };
          writePrivateNoteDraft(draftStorage, draftKey, conflict.draft);
          status.textContent = "The saved note changed in another tab. Compare both local versions before saving.";
          renderConflict();
          return;
        }
        if (saved.status !== "saved") {
          status.textContent = "Browser storage is unavailable; neither note version was replaced.";
          return;
        }
        state = saved.current; baseRevision = saved.current.revision;
        writePrivateNoteDraft(draftStorage, draftKey, { reason: next.reason, note: next.note, baseRevision: baseRevision });
        dirty = false;
        status.textContent = "Saved in this browser only; not sent to support or the other booking participant.";
      });
    });
    window.addEventListener("storage", function (event) {
      if (event.key !== key || !event.newValue) return;
      var latest;
      try { latest = JSON.parse(event.newValue); } catch (error) { return; }
      if (String(latest.revision || "") === baseRevision) return;
      if (!dirty) {
        if ((state.reason || "") !== (latest.reason || "") || (state.note || "") !== (latest.note || "")) {
          var previousVersion = { reason: state.reason || "", note: state.note || "", baseRevision: baseRevision };
          writePrivateNoteDraft(draftStorage, draftKey, previousVersion);
          conflict = { saved: latest, draft: previousVersion, observedRevision: String(latest.revision || "") };
          status.textContent = "Another tab saved a different version. Compare the two browser-local copies.";
          renderConflict();
          return;
        }
        state = latest; baseRevision = String(latest.revision || "");
        form.reason.value = latest.reason || ""; form.note.value = latest.note || "";
        status.textContent = "Loaded the latest private note from this browser.";
        return;
      }
      var localDraft = { reason: form.reason.value, note: form.note.value, baseRevision: baseRevision };
      writePrivateNoteDraft(draftStorage, draftKey, localDraft);
      conflict = { saved: latest, draft: localDraft, observedRevision: String(latest.revision || "") };
      status.textContent = "The saved note changed in another tab. Compare both local versions before saving.";
      renderConflict();
    });
    container.appendChild(form);
  }

  function initTrustVerification(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    renderChecklist(container, "trust_verification", [
      { id: "email", title: "Email verified", copy: "Account contact is verified before booking actions." },
      { id: "profile", title: "Profile complete", copy: "Bio, location, skill category, and public-facing details are filled in." },
      { id: "payout", title: "Payout ready", copy: "Payment preference is available before an offer is accepted." },
      { id: "media", title: "Work proof present", copy: "Portfolio, social, EPK, or sample media gives the other side confidence." }
    ]);
  }

  function initPortfolioManager(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var stored = readState("portfolio_manager", []);
    var state = Array.isArray(stored) ? stored.slice(0, 20).map(function (item) {
      var url = item && normalizeExternalUrl(item.url);
      return url ? { url: url, label: String(item.label || "Media link").slice(0, 100) } : null;
    }).filter(Boolean) : [];
    writeState("portfolio_manager", state);
    container.innerHTML = "";
    var form = el("form", "cltch-component-form");
    form.innerHTML = [
      "<label>Portfolio / EPK Link</label>",
      "<input name=\"url\" type=\"url\" maxlength=\"500\" required placeholder=\"https://...\">",
      "<label>Label</label>",
      "<input name=\"label\" type=\"text\" maxlength=\"100\" placeholder=\"Live set, reel, EPK, gallery, social\">",
      "<button type=\"submit\">Add Media Link</button>",
      "<p class=\"cltch-component-status\" role=\"status\" aria-live=\"polite\"></p>"
    ].join("");
    var list = el("div", "cltch-chip-list");
    function renderList() {
      list.innerHTML = "";
      if (!state.length) {
        list.appendChild(el("p", "cltch-component-status", "No media links saved yet."));
        return;
      }
      state.forEach(function (item, index) {
        var chip = el("span", "vault-chip");
        var link = el("a", "", item.label || item.url);
        link.href = normalizeExternalUrl(item.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.referrerPolicy = "no-referrer";
        var remove = el("button", "", "x");
        remove.type = "button";
        remove.setAttribute("aria-label", "Remove " + String(item.label || "portfolio link"));
        remove.addEventListener("click", function () {
          state.splice(index, 1);
          writeState("portfolio_manager", state);
          renderList();
        });
        chip.appendChild(link);
        chip.appendChild(remove);
        list.appendChild(chip);
      });
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var url = normalizeExternalUrl(form.url.value);
      var status = form.querySelector('[role="status"]');
      if (!url) {
        if (status) status.textContent = "Use a valid http or https URL without embedded sign-in credentials.";
        return;
      }
      if (state.some(function (item) { return item.url === url; })) {
        if (status) status.textContent = "That portfolio link is already saved.";
        return;
      }
      if (state.length >= 20) {
        if (status) status.textContent = "You can save up to 20 portfolio links.";
        return;
      }
      state.push({ url: url, label: form.label.value.trim().slice(0, 100) || "Media link" });
      writeState("portfolio_manager", state);
      form.reset();
      if (status) status.textContent = "Portfolio link saved in this browser.";
      renderList();
    });
    container.appendChild(form);
    container.appendChild(list);
    renderList();
  }

  function initOperationsDashboard(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    var cards = [
      ["Open bookings", "Review offers, acceptances, and pending check-ins."],
      ["Payment review", "Watch bookings that need payout confirmation or manual payment notes."],
      ["Trust queue", "Check incomplete profiles, verification requests, and work-proof gaps."],
      ["Support issues", "Track disputes, cancellations, no-shows, and urgent event problems."],
      ["Content review", "Audit uploaded links, profile claims, and public-facing media."],
      ["Platform health", "Confirm auth, Firebase rules, deploy status, and page load checks."]
    ];
    var grid = el("div", "cltch-ops-grid");
    cards.forEach(function (card) {
      var node = el("article", "cltch-ops-card");
      node.innerHTML = "<strong>" + card[0] + "</strong><span>" + card[1] + "</span>";
      grid.appendChild(node);
    });
    container.appendChild(grid);
  }

  window.PlatformComponents = {
    initBookingAgreement: initBookingAgreement,
    initStatusTimeline: initStatusTimeline,
    initPaymentLifecycle: initPaymentLifecycle,
    initDisputeFlow: initDisputeFlow,
    initTrustVerification: initTrustVerification,
    initPortfolioManager: initPortfolioManager,
    initOperationsDashboard: initOperationsDashboard,
    normalizeExternalUrl: normalizeExternalUrl,
    privateNoteConflicts: {
      read: readPrivateNoteRecord,
      saveDraft: writePrivateNoteDraft,
      clearDraft: clearPrivateNoteDraft,
      compareAndSave: savePrivateNoteCompareAndSwap
    }
  };
})();
