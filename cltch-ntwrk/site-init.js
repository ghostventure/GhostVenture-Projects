(function () {
  var THEME_KEY = "cltch_theme_v1";
  var A11Y_KEY = "cltch_access_prefs_v1";
  var VISIT_HISTORY_KEY = "cltch_recent_pages_v1";
  var MAX_VISIT_HISTORY = 8;

  function getSavedTheme() {
    try {
      return window.localStorage.getItem(THEME_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function preferredTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme, persist) {
    var mode = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, mode);
      } catch (error) {}
    }
    var toggle = document.getElementById("cltchThemeToggle");
    if (toggle) {
      toggle.textContent = mode === "dark" ? "Light Mode" : "Dark Mode";
      toggle.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
      toggle.dataset.theme = mode;
    }
  }

	  applyTheme(getSavedTheme() || preferredTheme(), false);

	  function runWhenIdle(callback) {
	    if (typeof window.requestIdleCallback === "function") {
	      window.requestIdleCallback(callback, { timeout: 1200 });
	      return;
	    }
	    window.setTimeout(callback, 0);
	  }

  function getPageLabel(path) {
    var file = String(path || "").split("/").pop() || "index.html";
    var map = {
      "index.html": "Home",
      "auth.html": "Sign In",
      "host.html": "Host Workspace",
      "host-profile.html": "Host Profile",
      "musician-profile.html": "Performer Profile",
      "musician-matched-gigs.html": "Matched Gigs",
      "gig-radar.html": "Gig Radar",
      "booking.html": "Booking",
      "faq.html": "FAQ",
      "support.html": "Support"
    };
    return map[file] || file.replace(/\.html$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function getRecentPageActions(limit) {
    try {
      var raw = window.localStorage.getItem(VISIT_HISTORY_KEY) || "[]";
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list
        .filter(function (item) {
          return item && item.href && item.href !== pageName();
        })
        .slice(0, limit || 3)
        .map(function (item) {
          return {
            href: item.href,
            label: "Resume " + (item.label || getPageLabel(item.href)),
            hint: "Continue where you left off"
          };
        });
    } catch (error) {
      return [];
    }
  }

  function rememberPageVisit() {
    var current = pageName();
    if (!current) return;
    if (current === "404.html") return;
    try {
      var existing = JSON.parse(window.localStorage.getItem(VISIT_HISTORY_KEY) || "[]");
      if (!Array.isArray(existing)) existing = [];
      var updated = [{ href: current, label: getPageLabel(current), at: Date.now() }]
        .concat(existing.filter(function (item) { return item && item.href !== current; }))
        .slice(0, MAX_VISIT_HISTORY);
      window.localStorage.setItem(VISIT_HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {}
  }

	  runWhenIdle(rememberPageVisit);

  var quickPalette = document.createElement("div");
  quickPalette.id = "cltchQuickPalette";
  quickPalette.hidden = true;
  quickPalette.innerHTML = [
    '<div class="quick-palette-inner">',
      '<div class="quick-palette-headrow">',
        '<div class="quick-palette-head">Quick Jump</div>',
        '<button type="button" class="quick-palette-close" aria-label="Close quick jump">Close</button>',
      '</div>',
      '<div class="quick-palette-sub">Shift + Q for recent pages and key actions</div>',
      '<input id="cltchQuickPaletteSearch" class="quick-palette-search" type="search" placeholder="Filter actions">',
      '<div id="cltchQuickPaletteList"></div>',
    '</div>'
  ].join("");
  document.body.appendChild(quickPalette);

  var quickPaletteSearch = null;
  var quickPaletteClose = null;

  function closeQuickPalette() {
    quickPalette.hidden = true;
  }

  function openQuickPalette() {
    refreshQuickPalette();
    quickPalette.hidden = false;
    quickPaletteSearch = quickPaletteSearch || document.getElementById("cltchQuickPaletteSearch");
    if (quickPaletteSearch) {
      quickPaletteSearch.value = "";
      window.setTimeout(function () {
        quickPaletteSearch.focus();
      }, 20);
    }
    filterQuickPalette("");
  }

  function toggleQuickPalette() {
    if (quickPalette.hidden) openQuickPalette();
    else closeQuickPalette();
  }

  function refreshQuickPalette() {
    var listEl = document.getElementById("cltchQuickPaletteList");
    if (!listEl) return;
    var actions = dedupeActions(getRecentPageActions(5).concat(defaultHubActionsFromPage()));
    listEl.innerHTML = "";
    if (!actions.length) {
      listEl.textContent = "No recent actions yet.";
      return;
    }
    actions.forEach(function (action) {
      var item = document.createElement("a");
      var href = safeInternalHref(action.href);
      item.setAttribute("href", href || "#");
      item.setAttribute("data-palette-item", "true");
      item.setAttribute("data-label", action.label || "");
      item.className = "quick-palette-item";
      item.innerHTML = "<span>" + escapeHtml(action.label || "Open") + "</span><small>" + escapeHtml(action.hint || "Open now") + "</small>";
      item.addEventListener("click", function (event) {
        if (!href || href === "#") {
          event.preventDefault();
          return;
        }
        closeQuickPalette();
      });
      listEl.appendChild(item);
    });
    setPaletteActiveItem(0);
  }

  function filterQuickPalette(query) {
    var q = String(query || "").trim().toLowerCase();
    var items = quickPalette.querySelectorAll("[data-palette-item='true']");
    var shown = 0;
    items.forEach(function (item) {
      var label = (item.getAttribute("data-label") || item.textContent || "").toLowerCase();
      var visible = !q || label.indexOf(q) !== -1;
      item.hidden = !visible;
      if (visible) shown++;
    });
    if (shown > 0) setPaletteActiveItem(0);
    else paletteActiveIndex = -1;
  }

  document.addEventListener("keydown", function (event) {
    if (event.shiftKey && event.code === "KeyQ") {
      event.preventDefault();
      if (document.getElementById("cltchPalette")) {
        if (document.getElementById("cltchPalette").classList.contains("open")) closeDexterityPalette();
        else openDexterityPalette();
        return;
      }
      toggleQuickPalette();
    } else if (event.key === "Escape") {
      closeQuickPalette();
    }
  });

  function pageName() {
    var path = (window.location.pathname || "/").split("/").pop() || "index.html";
    return path;
  }

  function safeInternalHref(value) {
    var href = String(value || "").trim();
    if (!href) return "";
    if (/[\r\n\t]/.test(href)) return "";
    if (href.charAt(0) === "#") return href;
    if (href.indexOf("//") === 0) return "";
    if (/^(?:javascript|data|vbscript):/i.test(href)) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return "";
    return href;
  }

  var paletteActiveIndex = -1;

  function getVisiblePaletteItems() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-palette-item]"))
      .filter(function (item) {
        if (item.hidden) return false;
        var quickRoot = item.closest("#cltchQuickPalette");
        if (quickRoot && quickRoot.hidden) return false;
        var dexterityRoot = item.closest("#cltchPalette");
        if (dexterityRoot && !dexterityRoot.classList.contains("open")) return false;
        return true;
      });
  }

  function setPaletteActiveItem(index) {
    var items = getVisiblePaletteItems();
    if (!items.length) {
      paletteActiveIndex = -1;
      return;
    }
    var bounded = Math.min(items.length - 1, Math.max(0, Number(index) || 0));
    paletteActiveIndex = bounded;
    items.forEach(function (item, idx) {
      item.classList.toggle("active", idx === bounded);
    });
    var active = items[bounded];
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }

  quickPaletteSearch = document.getElementById("cltchQuickPaletteSearch");
  quickPaletteClose = quickPalette.querySelector(".quick-palette-close");
  if (quickPaletteSearch) {
    quickPaletteSearch.addEventListener("input", function () {
      filterQuickPalette(quickPaletteSearch.value);
    });
    quickPaletteSearch.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteActiveItem(paletteActiveIndex < 0 ? 0 : paletteActiveIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteActiveItem(paletteActiveIndex < 0 ? 0 : paletteActiveIndex - 1);
      } else if (event.key === "Enter") {
        var items = getVisiblePaletteItems();
        var active = items[paletteActiveIndex] || items[0];
        if (!active) return;
        event.preventDefault();
        active.click();
      }
    });
  }
  if (quickPaletteClose) {
    quickPaletteClose.addEventListener("click", closeQuickPalette);
  }

  function dedupeActions(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (item) {
      if (!item || !item.label || !item.href) return;
      var key = String(item.href).trim() + "::" + String(item.label).trim().toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function defaultHubActionsFromPage() {
    var actions = [];
    document.querySelectorAll(".workspace-tabs .workspace-tab, header nav a, .command-link").forEach(function (el) {
      var href = el.getAttribute("href");
      var label = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (!href || !label) return;
      if (/sign out/i.test(label)) return;
      actions.push({ href: href, label: label, hint: "Open now" });
    });
    return dedupeActions(actions);
  }

  function getHubConfig() {
    var page = pageName();
    var map = {
      "host.html": {
        title: "Request Talent Now",
        subtitle: "Post the need, send it to nearby available performers, and move the first solid match into a live booking.",
        primary: [
          { href: "#gigForm", label: "Request Talent", hint: "Tell CLTCH who you need, where, when, and for how much" },
          { href: "#gigList", label: "Track Live Requests", hint: "Watch open, accepted, cancelled, and review jobs" },
          { href: "host-profile.html", label: "Set Venue Details", hint: "Make the dispatch ready before performers accept" }
        ],
        micro: [
          { href: "#hostQueueShortcuts", label: "Request queue" },
          { href: "#hostChecklist", label: "Dispatch checklist" },
          { href: "support.html", label: "Problem with a booking" }
        ]
      },
      "host-profile.html": {
        title: "Host Dispatch Setup",
        subtitle: "Finish the venue, payment, safety, and contact details performers need before accepting.",
        primary: [
          { href: "#profileForm", label: "Complete Venue Setup", hint: "Save venue, contact, pay, and house details" },
          { href: "host.html", label: "Request Talent", hint: "Open the dispatch request screen" },
          { href: "booking.html", label: "Open Live Booking", hint: "Inspect status, messages, and check-in" }
        ],
        micro: [
          { href: "#profileCompletionText", label: "Readiness check" },
          { href: "support.html", label: "Setup help" }
        ]
      },
      "musician-profile.html": {
        title: "Performer Availability Setup",
        subtitle: "Set your city, category, rate, radius, proof, and payout so CLTCH can send the right requests.",
        primary: [
          { href: "#profileForm", label: "Set My Availability", hint: "Keep category, city, radius, and rate ready" },
          { href: "musician-matched-gigs.html", label: "Open Accepted Jobs", hint: "Manage confirmed and upcoming bookings" },
          { href: "gig-radar.html", label: "Go Available", hint: "See nearby live requests" }
        ],
        micro: [
          { href: "#profileDashboard", label: "Dispatch profile" },
          { href: "#dashTier", label: "Trust tier" },
          { href: "support.html", label: "Problem with a booking" }
        ]
      },
      "musician-matched-gigs.html": {
        title: "Accepted Jobs",
        subtitle: "Handle live and upcoming bookings like active dispatches, not a passive job board.",
        primary: [
          { href: "#upcomingList", label: "Today And Upcoming", hint: "See booked events first" },
          { href: "#gigList", label: "Live Request Queue", hint: "Accept, pass, or review opportunities" },
          { href: "gig-radar.html", label: "Find Nearby Requests", hint: "Open the on-demand radar" }
        ],
        micro: [
          { href: "#queueControlsBar", label: "Tonight / weekend filters" },
          { href: "#reviewsSection", label: "Review history" },
          { href: "support.html", label: "Problem with a booking" }
        ]
      },
      "gig-radar.html": {
        title: "Nearby Live Requests",
        subtitle: "This is the performer side of dispatch: nearby needs, fit reasons, pay, timing, and one fast decision.",
        primary: [
          { href: "#gigList", label: "See Requests Near Me", hint: "Sort by fit, time, pay, and distance" },
          { href: "#upcomingList", label: "Accepted Jobs", hint: "Keep your active schedule clear" },
          { href: "musician-profile.html", label: "Set Availability", hint: "Improve dispatch fit and request quality" }
        ],
        micro: [
          { href: "#queueControlsBar", label: "Tonight / weekend filters" },
          { href: "#reviewsSection", label: "Review history" },
          { href: "support.html", label: "Problem with a request" }
        ]
      },
      "auth.html": {
        title: "Enter Dispatch",
        subtitle: "Hosts request talent. Performers go available. CLTCH moves the booking.",
        primary: [
          { href: "auth.html", label: "Sign In", hint: "Use your existing account" },
          { href: "auth.html?tab=signup", label: "Create Account", hint: "Choose host, performer, or both" },
          { href: "faq.html", label: "How Dispatch Works", hint: "Understand request, match, accept, and payout" }
        ],
        micro: [
          { href: "support.html", label: "Contact support" }
        ]
      }
    };

    if (map[page]) return map[page];

    var fallback = defaultHubActionsFromPage();
    return {
      title: "CLTCH Dispatch",
      subtitle: "Request talent, go available, accept the match, complete the booking, then close payout and review.",
      primary: fallback.slice(0, 3),
      micro: fallback.slice(3, 12)
    };
  }

  function openHubAction(href) {
    var safeHref = safeInternalHref(href);
    if (!safeHref) return;
    if (safeHref.charAt(0) === "#") {
      var target = document.querySelector(safeHref);
      if (!target) return;
      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (typeof target.focus === "function") {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
      return;
    }
    window.location.href = safeHref;
  }

  function initFeatureHub() {
    if (document.getElementById("cltchFeatureHub")) return;
    var main = markMainContent();
    if (!main) return;
    if (pageName() === "support.html") return;

    var config = getHubConfig();
    if (!config || !config.primary || !config.primary.length) return;

    var navActions = defaultHubActionsFromPage();
    var primaryHrefs = {};
    config.primary.forEach(function (item) {
      primaryHrefs[item.href] = true;
    });
    var mergedMicro = dedupeActions(
      (config.micro || [])
        .concat(getRecentPageActions(3))
        .concat(navActions.filter(function (item) {
          return !primaryHrefs[item.href];
        }))
    );

    var hub = document.createElement("section");
    hub.className = "cltch-feature-hub cltch-dispatch-hub";
    hub.id = "cltchFeatureHub";
    hub.innerHTML =
      '<div class="cltch-feature-hub-top">' +
        '<div class="cltch-feature-hub-title">' + escapeHtml(config.title || "Quick Start") + "</div>" +
        '<p class="cltch-feature-hub-sub">' + escapeHtml(config.subtitle || "Choose one major action, then open more tools if needed.") + "</p>" +
      "</div>" +
      '<div class="cltch-dispatch-flow" aria-label="CLTCH dispatch flow">' +
        ["Request", "Match", "Accept", "Arrive", "Complete", "Pay + Review"].map(function (step, index) {
          return '<span class="cltch-dispatch-step' + (index < 3 ? " active" : "") + '">' + escapeHtml(step) + "</span>";
        }).join("") +
      "</div>" +
      '<div class="cltch-feature-grid">' +
        config.primary.slice(0, 4).map(function (item) {
          return '<button type="button" class="cltch-feature-primary" data-feature-href="' + escapeHtml(item.href) + '">' +
            '<span class="cltch-feature-label">' + escapeHtml(item.label) + "</span>" +
            '<span class="cltch-feature-hint">' + escapeHtml(item.hint || "Open") + "</span>" +
          "</button>";
        }).join("") +
      "</div>" +
      (mergedMicro.length ? (
        '<details class="cltch-feature-more">' +
          '<summary class="cltch-feature-more-toggle">More tools</summary>' +
          '<div class="cltch-feature-more-grid">' +
            mergedMicro.slice(0, 10).map(function (item) {
              return '<button type="button" class="cltch-feature-micro" data-feature-href="' + escapeHtml(item.href) + '">' + escapeHtml(item.label) + "</button>";
            }).join("") +
          "</div>" +
        "</details>"
      ) : "");

    main.insertBefore(hub, main.firstChild);

    hub.querySelectorAll("[data-feature-href]").forEach(function (el) {
      el.addEventListener("click", function () {
        openHubAction(el.getAttribute("data-feature-href"));
      });
    });
  }

  function initGuidedGrouping() {
    var ids = ["noticesBar", "checklistBar", "bookingGuideBar"];
    var blocks = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (blocks.length < 2) return;
    if (document.getElementById("cltchGuidedSections")) return;

    var first = blocks[0];
    var parent = first.parentNode;
    if (!parent) return;

    var details = document.createElement("details");
    details.className = "cltch-guided-sections";
    details.id = "cltchGuidedSections";

    var summary = document.createElement("summary");
    summary.className = "cltch-guided-sections-toggle";
    summary.textContent = "Guided Help And Notices";
    details.appendChild(summary);

    var body = document.createElement("div");
    body.className = "cltch-guided-sections-body";
    details.appendChild(body);

    parent.insertBefore(details, first);
    blocks.forEach(function (block) {
      block.classList.add("cltch-guided-section-item");
      block.style.marginTop = "10px";
      body.appendChild(block);
    });
  }

  function initBrandTagline() {
    var logo = document.querySelector("header .logo");
    if (!logo || document.querySelector(".cltch-brand-tagline")) return;
    var tagline = document.createElement("span");
    tagline.className = "cltch-brand-tagline";
    tagline.textContent = "Like a ride-share app but for gigs. A Gig-share app";
    logo.insertAdjacentElement("afterend", tagline);
  }

  function initThemeToggle() {
    var nav = document.querySelector("header nav");
    if (!nav || document.getElementById("cltchThemeToggle")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.id = "cltchThemeToggle";
    button.className = "cltch-theme-toggle";
    button.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark", true);
      showDexterityToast("Theme switched to " + (current === "dark" ? "light" : "dark") + " mode", 1800);
    });
    nav.insertBefore(button, nav.firstChild || null);
    applyTheme(document.documentElement.getAttribute("data-theme") || "light", false);
  }

  function getAssistantConfig() {
    var page = pageName();
    var commonAction = { href: "support.html", label: "Support" };
    var configs = {
      "auth.html": {
        title: "Quick Help",
        subtitle: "Sign in or create your account",
        copy: "Use Sign Up if you are new. If email links do not show up, check spam or junk before trying again.",
        nextLabel: "Fastest path",
        nextSteps: [
          "Choose Sign Up if you are new or Sign In if you already made an account.",
          "Verify your email before expecting protected access.",
          "After sign-in, the site routes you into the right host or performer flow."
        ],
        actions: [
          { href: "auth.html", label: "Sign In" },
          { href: "auth.html?tab=signup", label: "Sign Up" },
          { href: "faq.html", label: "FAQ" }
        ],
        topics: [
          { label: "New Here", q: "I forgot what to do", a: "New users start on Sign Up. Existing users use Sign In. Password accounts must verify email before protected access." },
          { label: "No Email", q: "I did not get the email", a: "Wait a minute, then check spam or junk. If needed, use the reset or verification path again from auth." },
          { label: "Performer Path", q: "I am a performer", a: "After sign-in, you will land in My Matched Gigs if your profile already exists. Otherwise, complete My Profile first." },
          { label: "Host Path", q: "I am a host", a: "Finish your host profile once, then you can move into the Host workspace and post gigs without guessing where to go next." }
        ]
      },
      "host.html": {
        title: "Host Help",
        subtitle: "Post, book, review",
        copy: "The fastest host flow is: post a gig, wait for acceptance, then leave a review after the event.",
        nextLabel: "Host flow",
        nextSteps: [
          "Post the date, time, location, performer type, and pay.",
          "Watch your queue for the first accepted performer.",
          "Use booking details and leave a review after the event."
        ],
        actions: [
          { href: "#gigForm", label: "Post Gig" },
          { href: "host-profile.html", label: "Edit Profile" },
          commonAction
        ],
        topics: [
          { label: "Book Fast", q: "How do I book someone", a: "Post a clear gig with date, location, pay, and performer type. Accepted gigs show in your queue automatically." },
          { label: "Performer Info", q: "Where do I find performer details", a: "Use View Booking Details or View Performer Profile from your host gig queue." },
          { label: "Cancel Job", q: "Can I cancel the gig", a: "Yes. Cancel Gig removes it from the live booking flow. You can reopen it later if plans change." },
          { label: "After Event", q: "What should I do after the gig", a: "Leave a review. That closes the loop and improves trust across the platform." }
        ]
      },
      "host-profile.html": {
        title: "Host Profile Help",
        subtitle: "Venue and payout setup",
        copy: "Finish your host profile once, then use the host dashboard to post and manage gigs.",
        nextLabel: "Setup order",
        nextSteps: [
          "Add venue basics so performers know who is booking them.",
          "Add location and contact details that support the gig flow.",
          "Save, then return to Host to post your first gig."
        ],
        actions: [
          { href: "#profileForm", label: "Profile Form" },
          { href: "host.html", label: "Host Dashboard" },
          commonAction
        ],
        topics: [
          { label: "Why It Matters", q: "Why fill this out", a: "This tells performers who you are, where you are, and how booking and payout should work." },
          { label: "Payout", q: "Do I need payout now", a: "It is better to add it now so the booking flow feels ready later, even if payments are not active yet." },
          { label: "After Save", q: "What happens after save", a: "You return to the host dashboard and can start posting gigs." }
        ]
      },
      "musician-profile.html": {
        title: "Performer Help",
        subtitle: "Profile, availability, payout",
        copy: "Your profile is what hosts use to decide whether to trust and book you. Keep style, payout, and availability current.",
        nextLabel: "Best order",
        nextSteps: [
          "Fill in your performer basics and style first.",
          "Turn on availability and keep your dates current.",
          "Save your payout method so hosts see a ready account."
        ],
        actions: [
          { href: "musician-matched-gigs.html", label: "My Matched Gigs" },
          { href: "gig-radar.html", label: "Gig Radar" },
          commonAction
        ],
        topics: [
          { label: "Fill First", q: "What should I fill in first", a: "Start with name, location, performer type, styles, and payout method. That gets you visible faster." },
          { label: "Where Gigs Go", q: "Where do gigs show up", a: "Matched opportunities live in My Matched Gigs and incoming opportunities live in Gig Radar." },
          { label: "Business Class", q: "What is Business Class", a: "Business Class is a profile-level trust icon. It is only available to Senior tier and above, and it does not activate itself just because you press the button." },
          { label: "Draft Safety", q: "What if I leave this page", a: "Your local draft is preserved while you work, and the page warns before leaving with unsaved changes." }
        ]
      },
      "musician-matched-gigs.html": {
        title: "Matched Gigs Help",
        subtitle: "Review and manage upcoming matches",
        copy: "This page is for the gigs already matched to you. Use it to review, approve, or cancel future bookings.",
        nextLabel: "On this page",
        nextSteps: [
          "Review the matched or accepted booking.",
          "Open the details if you need the full event view.",
          "Approve, cancel, or check in when the timing is right."
        ],
        actions: [
          { href: "gig-radar.html", label: "Gig Radar" },
          { href: "musician-profile.html", label: "My Profile" },
          commonAction
        ],
        topics: [
          { label: "Purpose", q: "What is this page for", a: "It holds your matched and accepted gig flow in one place so you do not have to dig through the whole dashboard." },
          { label: "Cancel", q: "How do I cancel", a: "Use Cancel Booking on future accepted gigs if you cannot make the date." },
          { label: "Check In", q: "When can I check in", a: "Check In appears within the two-hour window before the event start time so the host knows you are on track." },
          { label: "Calendar", q: "Where is the calendar", a: "Your availability and booked-date view still live in My Profile." }
        ]
      },
      "gig-radar.html": {
        title: "Gig Radar Help",
        subtitle: "Look for incoming gigs",
        copy: "Gig Radar is the incoming opportunity feed. Use it when you want to move fast on open gigs that fit your style and dates.",
        nextLabel: "How to use it",
        nextSteps: [
          "Scan the strongest fit first.",
          "Open details or accept the gig you want.",
          "Keep your profile and availability honest so the feed stays clean."
        ],
        actions: [
          { href: "musician-matched-gigs.html", label: "My Matched Gigs" },
          { href: "musician-profile.html", label: "My Profile" },
          commonAction
        ],
        topics: [
          { label: "Radar vs Matched", q: "What is the difference", a: "Gig Radar is the incoming feed. My Matched Gigs is the organized list of your matched or accepted work." },
          { label: "Improve Matches", q: "How do I improve matches", a: "Keep your profile, availability, and performer type accurate so the system can filter better." },
          { label: "Nothing Showing", q: "What if nothing shows", a: "An empty list can simply mean there are no current open gigs that fit your profile yet." },
          { label: "Saved Gigs", q: "Why save a gig", a: "Saved gigs let you keep an eye on strong opportunities without losing them while you compare timing and fit." }
        ]
      },
      "booking.html": {
        title: "Booking Help",
        subtitle: "One booking at a time",
        copy: "This page shows the current gig details, timeline, and the next action tied to that booking.",
        nextLabel: "Booking rhythm",
        nextSteps: [
          "Check the locked booking details first.",
          "Use the message thread if you need event-specific clarification.",
          "After the event day passes, the thread locks and the booking moves into review territory."
        ],
        actions: [
          { href: "host.html", label: "Host Dashboard" },
          { href: "musician-matched-gigs.html", label: "Performer Gigs" },
          commonAction
        ],
        topics: [
          { label: "What This Is", q: "What am I looking at", a: "This is the dedicated booking page for one gig, so you can inspect details without searching through cards." },
          { label: "Messages", q: "Who can message here", a: "Only the host and the assigned performer on this booking can use the thread, and replies lock the following day." },
          { label: "Performer Route", q: "I am a performer", a: "Use Performer Gigs to return to your matched or accepted work list." },
          { label: "Host Route", q: "I am a host", a: "Use Host Dashboard to get back to your queue and review actions." }
        ]
      }
    };

    return configs[page] || {
      title: "Quick Help",
      subtitle: "Need a nudge?",
      copy: "Use the main navigation to move between the core CLTCH pages. If a page feels stuck, Support is the safest next stop.",
      nextLabel: "Start here",
      nextSteps: [
        "Use the page tabs or top navigation first.",
        "If you are signed out, start with auth.",
        "If the page still feels unclear, open FAQ or Support."
      ],
      actions: [
        { href: "index.html", label: "Home" },
        { href: "faq.html", label: "FAQ" },
        commonAction
      ],
      topics: [
        { label: "Start", q: "Where do I start", a: "If you are signed out, start with auth. If signed in, use the header links or workspace tabs first." },
        { label: "Get Help", q: "Where do I get help", a: "Support and FAQ are the fastest places to recover if you are unsure what page you need." }
      ]
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function assistantTopicStorageKey(page) {
    return "cltch_assistant_topic_v2:" + page;
  }

  function initAssistant() {
    if (document.getElementById("cltchAssistant")) return;
    if (pageName() === "support.html") return;

    var config = getAssistantConfig();
    var page = pageName();
    var wrap = document.createElement("section");
    wrap.className = "cltch-assistant";
    wrap.id = "cltchAssistant";

    var stored = "";
    try {
      stored = window.localStorage.getItem("cltch_assistant_state_v1") || "";
    } catch (error) {}
    var compactViewport = window.matchMedia && window.matchMedia("(max-width: 860px), (max-height: 760px)").matches;
    if (stored === "closed" || (compactViewport && stored !== "open")) wrap.classList.add("hidden");

    var topics = Array.isArray(config.topics) ? config.topics : [];
    var rememberedTopic = "";
    try {
      rememberedTopic = window.localStorage.getItem(assistantTopicStorageKey(page)) || "";
    } catch (error) {}
    var activeIndex = topics.findIndex(function (item) {
      return item && item.label === rememberedTopic;
    });
    if (activeIndex < 0) activeIndex = 0;
    var activeTopic = topics[activeIndex] || { label: "Help", q: "Need help?", a: config.copy };

    wrap.innerHTML =
      '<div class="cltch-assistant-head">' +
        '<div>' +
          '<div class="cltch-assistant-title">' + escapeHtml(config.title) + '</div>' +
          '<div class="cltch-assistant-sub">' + escapeHtml(config.subtitle) + '</div>' +
        '</div>' +
        '<button type="button" class="cltch-assistant-toggle" id="cltchAssistantToggle">Hide</button>' +
      '</div>' +
      '<div class="cltch-assistant-body">' +
        '<div class="cltch-assistant-copy">' + escapeHtml(config.copy) + '</div>' +
        '<div class="cltch-assistant-next">' +
          '<div class="cltch-assistant-label">' + escapeHtml(config.nextLabel || "Next move") + '</div>' +
          '<ol class="cltch-assistant-steps">' +
            (config.nextSteps || []).map(function (step) {
              return "<li>" + escapeHtml(step) + "</li>";
            }).join("") +
          '</ol>' +
        '</div>' +
        '<div class="cltch-assistant-actions">' +
          config.actions.map(function (item) {
            return '<a class="cltch-assistant-chip" href="' + item.href + '">' + escapeHtml(item.label) + '</a>';
          }).join("") +
        '</div>' +
        '<div class="cltch-assistant-label">Quick questions</div>' +
        '<div class="cltch-assistant-topics">' +
          topics.map(function (item, index) {
            return '<button type="button" class="cltch-assistant-topic' + (index === activeIndex ? " active" : "") + '" data-assistant-topic="' + index + '">' + escapeHtml(item.label) + '</button>';
          }).join("") +
        '</div>' +
        '<div class="cltch-assistant-list">' +
          '<div class="cltch-assistant-item cltch-assistant-item-active">' +
            '<div class="cltch-assistant-q" id="cltchAssistantQuestion">' + escapeHtml(activeTopic.q) + '</div>' +
            '<div class="cltch-assistant-a" id="cltchAssistantAnswer">' + escapeHtml(activeTopic.a) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);

    var toggle = document.getElementById("cltchAssistantToggle");
    if (!toggle) return;
    function syncLabel() {
      toggle.textContent = wrap.classList.contains("hidden") ? "Help" : "Hide";
    }
    toggle.addEventListener("click", function () {
      wrap.classList.toggle("hidden");
      try {
        window.localStorage.setItem("cltch_assistant_state_v1", wrap.classList.contains("hidden") ? "closed" : "open");
      } catch (error) {}
      syncLabel();
    });
    syncLabel();

    var question = document.getElementById("cltchAssistantQuestion");
    var answer = document.getElementById("cltchAssistantAnswer");
    wrap.querySelectorAll("[data-assistant-topic]").forEach(function (button) {
      button.addEventListener("click", function () {
        var topic = topics[Number(button.getAttribute("data-assistant-topic"))];
        if (!topic || !question || !answer) return;
        question.textContent = topic.q;
        answer.textContent = topic.a;
        wrap.querySelectorAll("[data-assistant-topic]").forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
        try {
          window.localStorage.setItem(assistantTopicStorageKey(page), topic.label);
        } catch (error) {}
      });
    });
  }

  function markMainContent() {
    var main = document.querySelector("main");
    if (!main) return null;
    if (!main.id) main.id = "mainContent";
    main.setAttribute("tabindex", "-1");
    return main;
  }

  function initSkipLink() {
    var main = markMainContent();
    if (!main || document.querySelector(".cltch-skip-link")) return;
    var link = document.createElement("a");
    link.className = "cltch-skip-link";
    link.href = "#mainContent";
    link.textContent = "Skip to content";
    document.body.appendChild(link);
  }

  function showDexterityToast(message, duration) {
    if (!message) return;
    var toast = document.getElementById("cltchDexterityToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cltchDexterityToast";
      toast.className = "cltch-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(showDexterityToast._timer);
    showDexterityToast._timer = window.setTimeout(function () {
      toast.classList.remove("visible");
    }, duration || 2400);
  }

  function getA11yPrefs() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(A11Y_KEY) || "{}");
      return {
        scale: stored.scale === "lg" || stored.scale === "xl" ? stored.scale : "md",
        contrast: stored.contrast === "high" ? "high" : "normal"
      };
    } catch (error) {
      return { scale: "md", contrast: "normal" };
    }
  }

  function applyA11yPrefs(prefs, persist) {
    var next = prefs || getA11yPrefs();
    document.documentElement.setAttribute("data-text-scale", next.scale || "md");
    document.documentElement.setAttribute("data-contrast", next.contrast || "normal");
    if (persist) {
      try {
        window.localStorage.setItem(A11Y_KEY, JSON.stringify(next));
      } catch (error) {}
    }
  }

  function setA11yScale(scale) {
    var prefs = getA11yPrefs();
    prefs.scale = scale === "xl" || scale === "lg" ? scale : "md";
    applyA11yPrefs(prefs, true);
    showDexterityToast("Text size: " + (prefs.scale === "md" ? "default" : prefs.scale.toUpperCase()), 1800);
    syncA11yPanelState();
  }

  function toggleA11yContrast() {
    var prefs = getA11yPrefs();
    prefs.contrast = prefs.contrast === "high" ? "normal" : "high";
    applyA11yPrefs(prefs, true);
    showDexterityToast("Contrast: " + (prefs.contrast === "high" ? "high" : "normal"), 1800);
    syncA11yPanelState();
  }

  function resetA11yPrefs() {
    var prefs = { scale: "md", contrast: "normal" };
    applyA11yPrefs(prefs, true);
    showDexterityToast("Accessibility options reset", 1800);
    syncA11yPanelState();
  }

  function syncA11yPanelState() {
    var panel = document.getElementById("cltchAccessPanel");
    if (!panel) return;
    var prefs = getA11yPrefs();
    panel.querySelectorAll("[data-a11y-scale]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-a11y-scale") === prefs.scale);
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    });
    var contrastBtn = panel.querySelector("[data-a11y-contrast]");
    if (contrastBtn) {
      contrastBtn.classList.toggle("active", prefs.contrast === "high");
      contrastBtn.setAttribute("aria-pressed", prefs.contrast === "high" ? "true" : "false");
      contrastBtn.textContent = prefs.contrast === "high" ? "High Contrast: On" : "High Contrast: Off";
    }
  }

  var a11yOpener = null;

  function openA11yPanel() {
    var panel = document.getElementById("cltchAccessPanel");
    if (!panel) return;
    if (!panel.classList.contains("open")) a11yOpener = document.activeElement;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    syncA11yPanelState();
    var firstControl = panel.querySelector("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
    if (firstControl) firstControl.focus();
  }

  function closeA11yPanel() {
    var panel = document.getElementById("cltchAccessPanel");
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    if (a11yOpener && a11yOpener.isConnected && typeof a11yOpener.focus === "function") a11yOpener.focus();
    a11yOpener = null;
  }

  function initA11yPanel() {
    applyA11yPrefs(getA11yPrefs(), false);
    if (document.getElementById("cltchAccessPanel")) return;
    var panel = document.createElement("section");
    panel.id = "cltchAccessPanel";
    panel.className = "cltch-access-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML =
      '<div class="cltch-access-scrim" data-access-close="true"></div>' +
      '<div class="cltch-access-card" role="dialog" aria-modal="true" aria-labelledby="cltchAccessTitle">' +
        '<div class="cltch-access-head">' +
          '<div class="cltch-access-title" id="cltchAccessTitle">Accessibility</div>' +
          '<button type="button" class="cltch-access-close" data-access-close="true">Close</button>' +
        '</div>' +
        '<div class="cltch-access-body">' +
          '<div class="cltch-access-label">Text size</div>' +
          '<div class="cltch-access-row">' +
            '<button type="button" class="cltch-access-btn" data-a11y-scale="md" aria-pressed="false">Default</button>' +
            '<button type="button" class="cltch-access-btn" data-a11y-scale="lg" aria-pressed="false">Large</button>' +
            '<button type="button" class="cltch-access-btn" data-a11y-scale="xl" aria-pressed="false">XL</button>' +
          '</div>' +
          '<div class="cltch-access-row">' +
            '<button type="button" class="cltch-access-btn" data-a11y-contrast="true" aria-pressed="false">High Contrast: Off</button>' +
            '<button type="button" class="cltch-access-btn" data-a11y-reset="true">Reset</button>' +
          '</div>' +
        '</div>' +
      "</div>";
    document.body.appendChild(panel);

    panel.querySelectorAll("[data-access-close='true']").forEach(function (el) {
      el.addEventListener("click", closeA11yPanel);
    });

    panel.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || !panel.classList.contains("open")) return;
      var controls = Array.prototype.slice.call(panel.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"))
        .filter(function (control) { return control.getAttribute("aria-hidden") !== "true" && control.offsetParent !== null; });
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      var first = controls[0];
      var last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });

    panel.querySelectorAll("[data-a11y-scale]").forEach(function (button) {
      button.addEventListener("click", function () {
        setA11yScale(button.getAttribute("data-a11y-scale"));
      });
    });
    var contrastBtn = panel.querySelector("[data-a11y-contrast]");
    if (contrastBtn) contrastBtn.addEventListener("click", toggleA11yContrast);
    var resetBtn = panel.querySelector("[data-a11y-reset]");
    if (resetBtn) resetBtn.addEventListener("click", resetA11yPrefs);

    syncA11yPanelState();
  }

  function collectPaletteEntries() {
    var entries = [];
    var selectors = [
      ".workspace-tabs .workspace-tab",
      "header nav a",
      ".command-link",
      ".cltch-assistant-chip"
    ];

    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        var href = el.getAttribute("href");
        var label = (el.textContent || "").trim().replace(/\s+/g, " ");
        if (!href || !label) return;
        if (/sign out/i.test(label)) return;
        if (entries.some(function (item) { return item.href === href || item.label === label; })) return;
        entries.push({ type: "link", href: href, label: label });
      });
    });

    document.querySelectorAll("button, [role='button']").forEach(function (el) {
      if (el.closest("#cltchPalette, #cltchAssistant, #cltchAccessPanel, #cltchQuickDock")) return;
      var labelSource = el.matches("[data-feature-href]") ? el.querySelector(".cltch-feature-label") : null;
      var text = ((labelSource && labelSource.textContent) || el.textContent || "").trim().replace(/\s+/g, " ");
      if (!text || text.length > 48) return;
      if (el.disabled || el.hidden) return;
      if (/hide|help|top|light mode|dark mode|close|reset|default|large|xl/i.test(text)) return;
      if (entries.some(function (item) { return item.label === text; })) return;
      entries.push({ type: "button", label: text, element: el });
    });

    var main = markMainContent();
    if (main) {
      entries.unshift({ type: "jump", label: "Main Content", element: main });
    }
    return entries.slice(0, 14);
  }

  function openDexterityPalette() {
    var root = document.getElementById("cltchPalette");
    if (!root) return;
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    var search = document.getElementById("cltchPaletteSearch");
    if (search) {
      search.value = "";
      filterDexterityPalette("");
      window.setTimeout(function () {
        search.focus();
        search.select && search.select();
      }, 30);
    }
  }

  function closeDexterityPalette() {
    var root = document.getElementById("cltchPalette");
    if (!root) return;
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
  }

  function filterDexterityPalette(query) {
    var items = document.querySelectorAll("[data-palette-item]");
    var q = String(query || "").trim().toLowerCase();
    var shown = 0;
    items.forEach(function (item) {
      var text = (item.getAttribute("data-label") || "").toLowerCase();
      var visible = !q || text.indexOf(q) !== -1;
      item.hidden = !visible;
      if (visible) shown++;
    });
    var empty = document.getElementById("cltchPaletteEmpty");
    if (empty) empty.hidden = shown > 0;
    if (shown > 0) setPaletteActiveItem(0);
    else paletteActiveIndex = -1;
  }

  function initDexterityPalette() {
    if (document.getElementById("cltchPalette")) return;
    var entries = collectPaletteEntries();
    if (!entries.length) return;

    var root = document.createElement("section");
    root.className = "cltch-palette";
    root.id = "cltchPalette";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<div class="cltch-palette-scrim" data-palette-close="true"></div>' +
      '<div class="cltch-palette-card" role="dialog" aria-modal="true" aria-label="Quick navigation">' +
        '<div class="cltch-palette-head">' +
          '<div>' +
            '<div class="cltch-palette-title">Quick Jump</div>' +
            '<div class="cltch-palette-sub">Move faster through CLTCH.NTWRK</div>' +
          '</div>' +
          '<button type="button" class="cltch-palette-close" data-palette-close="true">Close</button>' +
        '</div>' +
        '<div class="cltch-palette-searchwrap">' +
          '<input id="cltchPaletteSearch" class="cltch-palette-search" type="search" placeholder="Search pages, tabs, or actions">' +
        '</div>' +
        '<div class="cltch-palette-list">' +
          entries.map(function (entry, index) {
            return '<button type="button" class="cltch-palette-item" data-palette-item="true" data-palette-index="' + index + '" data-label="' + escapeHtml(entry.label) + '">' +
              '<span class="cltch-palette-itemlabel">' + escapeHtml(entry.label) + '</span>' +
              '<span class="cltch-palette-itemmeta">' + (entry.type === "link" ? "Open" : "Go") + '</span>' +
            '</button>';
          }).join("") +
          '<div class="cltch-palette-empty" id="cltchPaletteEmpty" hidden>No matching page or action.</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    root.querySelectorAll("[data-palette-close='true']").forEach(function (el) {
      el.addEventListener("click", closeDexterityPalette);
    });

    var search = document.getElementById("cltchPaletteSearch");
    if (search) {
      search.addEventListener("input", function () {
        filterDexterityPalette(search.value);
      });
      search.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setPaletteActiveItem((paletteActiveIndex < 0 ? 0 : paletteActiveIndex + 1));
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setPaletteActiveItem((paletteActiveIndex < 0 ? 0 : paletteActiveIndex - 1));
          return;
        }
        if (event.key === "Enter") {
          var items = getVisiblePaletteItems();
          var active = items[paletteActiveIndex] || items[0];
          if (!active) return;
          event.preventDefault();
          active.click();
        }
      });
    }

    root.querySelectorAll("[data-palette-item]").forEach(function (button) {
      button.addEventListener("click", function () {
        var entry = entries[Number(button.getAttribute("data-palette-index"))];
        if (!entry) return;
        closeDexterityPalette();
        if (entry.type === "link" && entry.href) {
          window.location.href = entry.href;
          return;
        }
        if (entry.element && typeof entry.element.click === "function") {
          entry.element.click();
          showDexterityToast("Quick action: " + entry.label, 1800);
          return;
        }
        if (entry.element && typeof entry.element.focus === "function") {
          entry.element.focus();
        }
      });
      button.addEventListener("mouseenter", function () {
        var visible = getVisiblePaletteItems();
        var idx = visible.indexOf(button);
        if (idx >= 0) setPaletteActiveItem(idx);
      });
    });

    filterDexterityPalette("");
  }

  function initQuickDock() {
    if (document.getElementById("cltchQuickDock")) return;
    var config = getHubConfig();
    var candidates = dedupeActions((config && config.primary ? config.primary : []).concat(defaultHubActionsFromPage()));

    var dock = document.createElement("div");
    dock.className = "cltch-quickdock";
    dock.id = "cltchQuickDock";

    var homeLink = document.createElement("a");
    homeLink.className = "cltch-quickbtn";
    homeLink.href = "index.html";
    homeLink.textContent = "Home";
    dock.appendChild(homeLink);

    var paletteButton = document.createElement("button");
    paletteButton.type = "button";
    paletteButton.className = "cltch-quickbtn";
    paletteButton.textContent = "Quick Find";
    paletteButton.addEventListener("click", function () {
      openDexterityPalette();
    });
    dock.appendChild(paletteButton);

    var componentsButton = document.createElement("button");
    componentsButton.type = "button";
    componentsButton.className = "cltch-quickbtn";
    componentsButton.textContent = "Feature Concepts";
    componentsButton.addEventListener("click", function () {
      openComponentLibrary();
    });
    dock.appendChild(componentsButton);

    var accessButton = document.createElement("button");
    accessButton.type = "button";
    accessButton.className = "cltch-quickbtn";
    accessButton.textContent = "Accessibility";
    accessButton.addEventListener("click", function () {
      openA11yPanel();
    });
    dock.appendChild(accessButton);

    var installButton = document.createElement("button");
    installButton.type = "button";
    installButton.className = "cltch-quickbtn";
    installButton.id = "cltchInstallAppButton";
    installButton.textContent = "Install App";
    installButton.addEventListener("click", showInstallInstructions);
    if ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true) {
      installButton.textContent = "App Installed";
      installButton.disabled = true;
    }
    dock.appendChild(installButton);

    candidates.slice(0, 2).forEach(function (item, index) {
      var action = document.createElement("button");
      action.type = "button";
      action.className = "cltch-quickbtn";
      if (index === 0) action.dataset.kind = "primary";
      action.textContent = item.label;
      action.addEventListener("click", function () {
        openHubAction(item.href);
      });
      dock.appendChild(action);
    });

    var status = document.createElement("div");
    status.className = "cltch-status-pill";
    status.id = "cltchStatusPill";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Checking status...";
    dock.appendChild(status);

    document.body.appendChild(dock);
  }

  var deferredInstallPrompt = null;

  function initAppInstall() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      var button = document.getElementById("cltchInstallAppButton");
      if (button) button.textContent = "Install CLTCH";
    });
    window.addEventListener("appinstalled", function () {
      deferredInstallPrompt = null;
      var button = document.getElementById("cltchInstallAppButton");
      if (button) {
        button.textContent = "App Installed";
        button.disabled = true;
      }
    });
  }

  async function showInstallInstructions() {
    if (deferredInstallPrompt) {
      var installEvent = deferredInstallPrompt;
      installEvent.prompt();
      var choice = await installEvent.userChoice.catch(function () { return { outcome: "unknown" }; });
      deferredInstallPrompt = null;
      var installButton = document.getElementById("cltchInstallAppButton");
      if (installButton && choice && choice.outcome === "accepted") {
        installButton.textContent = "App Installed";
        installButton.disabled = true;
      }
      return;
    }
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    var message = isIOS
      ? "To install CLTCH.NTWRK, open the Share menu in Safari and choose Add to Home Screen."
      : "Use your browser menu and choose Install app or Add to Home Screen when that option is available.";
    var dialog = document.getElementById("cltchInstallHelp");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "cltchInstallHelp";
      dialog.setAttribute("aria-labelledby", "cltchInstallHelpTitle");
      dialog.innerHTML = '<form method="dialog"><h2 id="cltchInstallHelpTitle">Install CLTCH.NTWRK</h2><p></p><button type="submit">Close</button></form>';
      document.body.appendChild(dialog);
    }
    dialog.querySelector("p").textContent = message;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else window.alert(message);
  }

  function refreshConnectionStatus() {
    var pill = document.getElementById("cltchStatusPill");
    if (!pill) return;
    var isOnline = navigator.onLine !== false;
    var secure = window.location.protocol === "https:";
    var label = isOnline ? "Active" : "Offline";
    if (isOnline && !secure && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      label = "Active (Non-SSL)";
    }
    pill.textContent = label;
    pill.classList.toggle("offline", !isOnline);
    pill.classList.toggle("warn", isOnline && !secure && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1");
  }

  function initConnectionStatus() {
    refreshConnectionStatus();
    window.addEventListener("online", function () {
      refreshConnectionStatus();
      showDexterityToast("Connection restored", 1600);
    });
    window.addEventListener("offline", function () {
      refreshConnectionStatus();
      showDexterityToast("You are offline", 2200);
    });
  }

  function initDexterityShortcuts() {
    if (window.__cltchDexterityInit) return;
    window.__cltchDexterityInit = true;
    document.body.classList.add("cltch-dexterity");

    document.addEventListener("keydown", function (event) {
      var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      var isTyping = tag === "input" || tag === "textarea" || tag === "select" || (event.target && event.target.isContentEditable);

        if ((event.ctrlKey || event.metaKey) && !event.altKey && String(event.key).toLowerCase() === "k") {
        if (event.repeat) return;
        event.preventDefault();
        if (document.getElementById("cltchPalette")?.classList.contains("open")) {
          closeDexterityPalette();
        } else {
          openDexterityPalette();
        }
        return;
      }

      if (event.key === "/" && !isTyping) {
        if (event.repeat) return;
        var search = document.querySelector('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
        if (search) {
          event.preventDefault();
          search.focus();
          search.select && search.select();
          showDexterityToast("Search focused");
        } else {
          event.preventDefault();
          openDexterityPalette();
        }
        return;
      }

      if (event.key === "Escape") {
        if (document.getElementById("cltchPalette")?.classList.contains("open")) {
          closeDexterityPalette();
          return;
        }
        if (document.getElementById("cltchAccessPanel")?.classList.contains("open")) {
          closeA11yPanel();
          return;
        }
        if (isTyping && event.target && typeof event.target.blur === "function") {
          event.target.blur();
        }
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["1", "2", "3"].includes(event.key)) return;
      if (event.repeat) return;

      var targets = Array.prototype.slice.call(document.querySelectorAll(".workspace-tabs .workspace-tab, header nav a"))
        .filter(function (el) {
          var href = el.getAttribute("href");
          var text = (el.textContent || "").trim();
          return href && !/sign out/i.test(text);
        });

      var target = targets[Number(event.key) - 1];
      if (!target) return;
      event.preventDefault();
      target.click();
      showDexterityToast("Quick nav: " + (target.textContent || "").trim(), 1800);
    });

  }

  function initRuntimeSecurityHardening() {
    document.querySelectorAll("a[href]").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (!safeInternalHref(href) && !/^https:\/\/[^/\s?#]+/i.test(String(href || "").trim())) {
        link.removeAttribute("href");
        link.setAttribute("role", "link");
        link.setAttribute("aria-disabled", "true");
      }
    });

    document.querySelectorAll("a[target='_blank']").forEach(function (link) {
      var currentRel = link.getAttribute("rel") || "";
      var relTokens = currentRel.split(/\s+/).filter(Boolean);
      if (relTokens.indexOf("noopener") === -1) relTokens.push("noopener");
      if (relTokens.indexOf("noreferrer") === -1) relTokens.push("noreferrer");
      link.setAttribute("rel", relTokens.join(" ").trim());
    });
  }

  function readJsonStorage(key, fallback) {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(key) || "");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

	  function getCltchComponentRegistry() {
	    var registry = [
      { order: 1, id: "host-command-dashboard", category: "Host / Venue", name: "Host Command Dashboard", route: "host.html", mechanic: "Centralizes host next actions, queue health, profile readiness, and booking status." },
      { order: 2, id: "gig-post-wizard", category: "Host / Venue", name: "Gig Post Wizard", route: "host.html#gigForm", mechanic: "Guides hosts through date, time, pay, location, performer type, and policy basics." },
      { order: 3, id: "draft-gig-autosave", category: "Host / Venue", name: "Draft Gig Autosave", route: "host.html#gigForm", mechanic: "Keeps unfinished gig posts recoverable before submission." },
      { order: 4, id: "gig-duplicate-repost", category: "Host / Venue", name: "Gig Duplicate/Repost Tool", route: "host.html#gigList", mechanic: "Turns older gigs into fast reusable templates for repeat events." },
      { order: 5, id: "venue-profile-completion", category: "Host / Venue", name: "Venue Profile Completion Meter", route: "host-profile.html#profileForm", mechanic: "Shows missing host identity, venue, contact, and payout fields." },
      { order: 6, id: "event-capacity-checker", category: "Host / Venue", name: "Event Capacity Checker", route: "host.html#gigForm", mechanic: "Flags missing attendance, venue capacity, and load-in constraints." },
      { order: 7, id: "budget-range-helper", category: "Host / Venue", name: "Budget Range Helper", route: "host.html#gigForm", mechanic: "Helps hosts compare posted pay against common performer rates." },
      { order: 8, id: "talent-requirement-checklist", category: "Host / Venue", name: "Talent Requirement Checklist", route: "host.html#gigForm", mechanic: "Collects performer type, genre/style, gear expectations, and timing needs." },
      { order: 9, id: "booking-timeline-view", category: "Host / Venue", name: "Booking Timeline View", route: "booking.html", mechanic: "Shows post, match, accept, check-in, event, review, and closeout steps." },
      { order: 10, id: "host-calendar-conflict-detector", category: "Host / Venue", name: "Host Calendar Conflict Detector", route: "host.html#gigForm", mechanic: "Warns when a host posts overlapping events or duplicate dates." },
      { order: 11, id: "performer-shortlist-board", category: "Host / Venue", name: "Performer Shortlist Board", route: "host.html#gigList", mechanic: "Lets hosts keep a short list of performers before booking." },
      { order: 12, id: "performer-comparison-tray", category: "Host / Venue", name: "Performer Comparison Tray", route: "host.html#gigList", mechanic: "Compares performer type, rating, availability, and response context." },
      { order: 13, id: "invite-performer-to-gig", category: "Host / Venue", name: "Invite Performer To Gig Tool", route: "host.html#gigList", mechanic: "Creates a direct invitation path from an open gig to a performer." },
      { order: 14, id: "host-saved-performers", category: "Host / Venue", name: "Host Saved Performers List", route: "host.html#gigList", mechanic: "Persists favorite performers for repeat bookings and future matching." },
      { order: 15, id: "host-response-time-score", category: "Host / Venue", name: "Host Response-Time Score", route: "host.html#hostQueueShortcuts", mechanic: "Grades how quickly hosts respond to accepted, pending, and review items." },
      { order: 16, id: "venue-trust-badges", category: "Host / Venue", name: "Venue Trust Badge Panel", route: "host-profile.html", mechanic: "Explains host verification, review, payout, and compliance trust signals." },
      { order: 17, id: "event-cancellation-workflow", category: "Host / Venue", name: "Event Cancellation Workflow", route: "host.html#gigList", mechanic: "Structures cancellation reason, notice, performer status, and queue cleanup." },
      { order: 18, id: "reopen-canceled-gig-flow", category: "Host / Venue", name: "Reopen Canceled Gig Flow", route: "host.html#gigList", mechanic: "Returns canceled gigs to clean open status without stale accepted performer data." },
      { order: 19, id: "host-payment-readiness", category: "Host / Venue", name: "Host Payout/Payment Readiness Card", route: "host-profile.html", mechanic: "Shows whether host checkout setup and preferred payment method are ready." },
      { order: 20, id: "host-booking-analytics", category: "Host / Venue", name: "Host Booking Analytics Summary", route: "host.html", mechanic: "Summarizes posted, open, accepted, cancelled, and completed gig activity." },
      { order: 21, id: "performer-command-dashboard", category: "Performer", name: "Performer Command Dashboard", route: "musician-matched-gigs.html", mechanic: "Centralizes performer matches, accepted gigs, profile readiness, and next actions." },
      { order: 22, id: "performer-profile-completion", category: "Performer", name: "Performer Profile Completion Meter", route: "musician-profile.html#profileForm", mechanic: "Tracks identity, location, style, media, availability, payout, and verification readiness." },
      { order: 23, id: "gig-match-score-card", category: "Performer", name: "Gig Match Score Card", route: "gig-radar.html#gigList", mechanic: "Shows why a gig fits using type, style, pay, distance, and availability." },
      { order: 24, id: "matched-gigs-inbox", category: "Performer", name: "Matched Gigs Inbox", route: "musician-matched-gigs.html#gigList", mechanic: "Collects actionable performer opportunities and accepted booking cards." },
      { order: 25, id: "saved-gigs-board", category: "Performer", name: "Saved Gigs Board", route: "gig-radar.html", mechanic: "Stores gigs performers want to revisit before responding." },
      { order: 26, id: "performer-availability-calendar", category: "Performer", name: "Performer Availability Calendar", route: "musician-profile.html#profileForm", mechanic: "Lets performers maintain available dates and blocked booking windows." },
      { order: 27, id: "availability-conflict-detector", category: "Performer", name: "Availability Conflict Detector", route: "gig-radar.html", mechanic: "Flags gigs that overlap accepted dates or blocked availability." },
      { order: 28, id: "performer-booking-timeline", category: "Performer", name: "Performer Booking Timeline", route: "booking.html", mechanic: "Shows performer-facing accepted, reminder, check-in, event, and review milestones." },
      { order: 29, id: "performer-check-in-card", category: "Performer", name: "Performer Check-In Card", route: "booking.html", mechanic: "Surfaces event-day check-in when the performer is inside the valid window." },
      { order: 30, id: "performer-cancellation-workflow", category: "Performer", name: "Performer Cancellation Workflow", route: "musician-matched-gigs.html#upcomingList", mechanic: "Structures performer cancellation for future accepted gigs." },
      { order: 31, id: "performer-tier-ladder", category: "Performer", name: "Performer Tier Ladder", route: "musician-profile.html#dashTier", mechanic: "Explains Junior, Senior, Rising Star, Sensei, GOAT, and Masterclass progression." },
      { order: 32, id: "business-class-eligibility", category: "Performer", name: "Business Class Eligibility Card", route: "musician-profile.html", mechanic: "Shows whether the performer qualifies for Business Class request flow." },
      { order: 33, id: "performer-review-snapshot", category: "Performer", name: "Performer Review Snapshot", route: "musician-matched-gigs.html#reviewsSection", mechanic: "Summarizes reviews, rating quality, and reputation movement." },
      { order: 34, id: "performer-media-kit-uploader", category: "Performer", name: "Performer Media Kit Uploader", route: "musician-profile.html#profileForm", mechanic: "Gives performers a clear area for portfolio, samples, and promotional media." },
      { order: 35, id: "performer-setlist-portfolio", category: "Performer", name: "Performer Setlist/Profile Portfolio", route: "musician-profile.html#profileForm", mechanic: "Stores setlist, repertoire, styles, gallery, and profile presentation details." },
      { order: 36, id: "performer-rate-card", category: "Performer", name: "Performer Rate Card", route: "musician-profile.html#profileForm", mechanic: "Captures preferred rate expectations for better host/performer fit." },
      { order: 37, id: "travel-radius-settings", category: "Performer", name: "Travel Radius Settings", route: "musician-profile.html#profileForm", mechanic: "Controls how far performers want gig recommendations to reach." },
      { order: 38, id: "preferred-gig-type-selector", category: "Performer", name: "Preferred Gig Type Selector", route: "musician-profile.html#profileForm", mechanic: "Lets performers prioritize weddings, clubs, private events, corporate, and other formats." },
      { order: 39, id: "gig-response-templates", category: "Performer", name: "Gig Response Templates", route: "musician-matched-gigs.html", mechanic: "Provides reusable accept, decline, and clarification responses." },
      { order: 40, id: "performer-earnings-summary", category: "Performer", name: "Performer Earnings Summary", route: "musician-profile.html", mechanic: "Summarizes estimated and historical performer booking earnings." },
      { order: 41, id: "gig-radar-map-list-toggle", category: "Matching / Discovery", name: "Gig Radar Map/List Toggle", route: "gig-radar.html", mechanic: "Switches incoming opportunities between geographic and card-based browsing." },
      { order: 42, id: "smart-match-explanation-chips", category: "Matching / Discovery", name: "Smart Match Explanation Chips", route: "gig-radar.html#gigList", mechanic: "Explains match reasons in compact chips on every opportunity." },
      { order: 43, id: "best-match-sort", category: "Matching / Discovery", name: "Best Match Sort", route: "gig-radar.html#queueControlsBar", mechanic: "Prioritizes fit quality over raw date order." },
      { order: 44, id: "soonest-gig-sort", category: "Matching / Discovery", name: "Soonest Gig Sort", route: "gig-radar.html#queueControlsBar", mechanic: "Sorts open opportunities by event time urgency." },
      { order: 45, id: "highest-pay-sort", category: "Matching / Discovery", name: "Highest Pay Sort", route: "gig-radar.html#queueControlsBar", mechanic: "Sorts opportunities by posted pay value." },
      { order: 46, id: "distance-based-sorting", category: "Matching / Discovery", name: "Distance-Based Sorting", route: "gig-radar.html#queueControlsBar", mechanic: "Prioritizes nearby gigs when location data exists." },
      { order: 47, id: "genre-style-matching", category: "Matching / Discovery", name: "Genre/Style Matching", route: "gig-radar.html", mechanic: "Matches performer style tags against host gig requirements." },
      { order: 48, id: "performer-type-matching", category: "Matching / Discovery", name: "Performer Type Matching", route: "gig-radar.html", mechanic: "Aligns musician, DJ, photographer, cinematographer, and model opportunities." },
      { order: 49, id: "host-preference-matching", category: "Matching / Discovery", name: "Host Preference Matching", route: "host.html", mechanic: "Learns host preferences from posted gigs, shortlists, and booking outcomes." },
      { order: 50, id: "urgent-gig-boost", category: "Matching / Discovery", name: "Urgent Gig Boost", route: "gig-radar.html", mechanic: "Highlights gigs that need a fast response." },
      { order: 51, id: "last-minute-availability-boost", category: "Matching / Discovery", name: "Last-Minute Availability Boost", route: "gig-radar.html", mechanic: "Raises priority for performers with near-term open availability." },
      { order: 52, id: "saved-search-alerts", category: "Matching / Discovery", name: "Saved Search Alerts", route: "gig-radar.html#queueControlsBar", mechanic: "Stores search/filter combinations and alerts when matching gigs appear." },
      { order: 53, id: "nearby-gig-notifications", category: "Matching / Discovery", name: "Nearby Gig Notifications", route: "gig-radar.html", mechanic: "Surfaces nearby opportunities inside the current gig feed." },
      { order: 54, id: "gig-recommendation-carousel", category: "Matching / Discovery", name: "Gig Recommendation Carousel", route: "gig-radar.html", mechanic: "Shows adjacent opportunities without forcing a full search restart." },
      { order: 55, id: "similar-gigs-module", category: "Matching / Discovery", name: "Similar Gigs Module", route: "gig-radar.html", mechanic: "Finds gigs similar to a selected opportunity." },
      { order: 56, id: "performer-recommendation-carousel", category: "Matching / Discovery", name: "Performer Recommendation Carousel", route: "host.html#gigList", mechanic: "Shows likely performers for open host gigs." },
      { order: 57, id: "search-command-palette", category: "Matching / Discovery", name: "Search Command Palette", route: "index.html", mechanic: "Extends quick jump with searchable platform actions and pages." },
      { order: 58, id: "filter-drawer", category: "Matching / Discovery", name: "Filter Drawer", route: "gig-radar.html#queueControlsBar", mechanic: "Groups search, sort, status, type, and pay filters in one control surface." },
      { order: 59, id: "match-quality-meter", category: "Matching / Discovery", name: "Match Quality Meter", route: "gig-radar.html", mechanic: "Grades opportunity fit so performers can prioritize quickly." },
      { order: 60, id: "decline-reason-learning-loop", category: "Matching / Discovery", name: "Decline Reason Learning Loop", route: "musician-matched-gigs.html", mechanic: "Uses pass/decline reasons to improve future recommendations." },
      { order: 61, id: "booking-detail-room", category: "Booking / Communication", name: "Booking Detail Room", route: "booking.html", mechanic: "Creates a single room for each event's details, actions, and timeline." },
      { order: 62, id: "private-booking-thread", category: "Booking / Communication", name: "Private Booking Thread", route: "booking.html", mechanic: "Keeps host and assigned performer conversation tied to a booking." },
      { order: 63, id: "host-performer-message-panel", category: "Booking / Communication", name: "Host-To-Performer Message Panel", route: "booking.html", mechanic: "Provides event-specific communication without leaving the booking room." },
      { order: 64, id: "booking-attachment-vault", category: "Booking / Communication", name: "Booking Attachment Vault", route: "booking.html", mechanic: "Stores flyers, riders, contracts, receipts, and other event documents." },
      { order: 65, id: "rider-details-checklist", category: "Booking / Communication", name: "Rider/Details Checklist", route: "booking.html", mechanic: "Tracks sound, load-in, parking, set length, and event requirements." },
      { order: 66, id: "load-in-time-tracker", category: "Booking / Communication", name: "Load-In Time Tracker", route: "booking.html", mechanic: "Highlights call time, load-in time, performance time, and event close." },
      { order: 67, id: "event-day-checklist", category: "Booking / Communication", name: "Event-Day Checklist", route: "booking.html", mechanic: "Turns event-day requirements into checkable tasks." },
      { order: 68, id: "confirmation-receipt-card", category: "Booking / Communication", name: "Confirmation Receipt Card", route: "booking.html", mechanic: "Shows accepted performer, gig terms, posted pay, and current status." },
      { order: 69, id: "booking-status-badges", category: "Booking / Communication", name: "Booking Status Badges", route: "booking.html", mechanic: "Makes open, accepted, cancelled, reviewed, and completed states readable." },
      { order: 70, id: "booking-audit-timeline", category: "Booking / Communication", name: "Booking Audit Timeline", route: "booking.html", mechanic: "Logs booking changes, messages, check-ins, cancellations, and review events." },
      { order: 71, id: "shared-booking-notes", category: "Booking / Communication", name: "Shared Booking Notes", route: "booking.html", mechanic: "Stores event-specific private notes and handoff details." },
      { order: 72, id: "change-request-workflow", category: "Booking / Communication", name: "Change Request Workflow", route: "booking.html", mechanic: "Structures requests for time, pay, location, or performer requirement changes." },
      { order: 73, id: "counter-offer-flow", category: "Booking / Communication", name: "Counter-Offer Flow", route: "booking.html", mechanic: "Allows structured negotiation without losing the original gig terms." },
      { order: 74, id: "booking-reminder-system", category: "Booking / Communication", name: "Booking Reminder System", route: "booking.html", mechanic: "Creates reminders for confirmation, load-in, check-in, and review." },
      { order: 75, id: "post-event-followup-card", category: "Booking / Communication", name: "Post-Event Follow-Up Card", route: "booking.html", mechanic: "Prompts review, payment closeout, and rebooking after the event." },
      { order: 76, id: "platform-fee-disclosure", category: "Payments / Business", name: "Platform Fee Disclosure Card", route: "terms.html", mechanic: "Explains platform fee expectations in plain language." },
      { order: 77, id: "payment-method-priority", category: "Payments / Business", name: "Payment Method Priority Card", route: "host-profile.html", mechanic: "Shows Apple Pay, Google Pay, and card priority messaging." },
      { order: 78, id: "apple-pay-readiness", category: "Payments / Business", name: "Apple Pay Readiness Panel", route: "host-profile.html", mechanic: "Surfaces Apple Pay as preferred payment readiness path." },
      { order: 79, id: "google-pay-readiness", category: "Payments / Business", name: "Google Pay Readiness Panel", route: "host-profile.html", mechanic: "Surfaces Google Pay as the secondary preferred payment path." },
      { order: 80, id: "stripe-connect-readiness", category: "Payments / Business", name: "Stripe Connect Readiness Panel", route: "musician-profile.html", mechanic: "Shows whether future automated payout rails are ready to activate." },
      { order: 81, id: "performer-payout-checklist", category: "Payments / Business", name: "Performer Payout Setup Checklist", route: "musician-profile.html", mechanic: "Tracks performer payout setup, preferred method, and missing payment fields." },
      { order: 82, id: "host-checkout-checklist", category: "Payments / Business", name: "Host Checkout Readiness Checklist", route: "host-profile.html", mechanic: "Tracks host checkout setup and payment readiness." },
      { order: 83, id: "payment-hold-status", category: "Payments / Business", name: "Payment Hold Status Card", route: "booking.html", mechanic: "Explains whether a booking payment is ready, held, or awaiting review." },
      { order: 84, id: "refund-cancellation-policy", category: "Payments / Business", name: "Refund/Cancellation Policy Card", route: "terms.html", mechanic: "Keeps cancellation and refund guidance close to booking and legal paths." },
      { order: 85, id: "invoice-receipt-generator", category: "Payments / Business", name: "Invoice/Receipt Generator", route: "booking.html", mechanic: "Generates a simple event receipt or invoice record for the booking." },
      { order: 86, id: "earnings-payout-history", category: "Payments / Business", name: "Earnings Payout History", route: "musician-profile.html", mechanic: "Shows payout and earnings history for performers." },
      { order: 87, id: "tax-document-checklist", category: "Payments / Business", name: "Tax Document Checklist", route: "musician-profile.html", mechanic: "Tracks required tax and payout documents." },
      { order: 88, id: "subscription-status-card", category: "Payments / Business", name: "Subscription Status Card", route: "musician-profile.html", mechanic: "Shows Business Class or future subscription state." },
      { order: 89, id: "business-class-billing", category: "Payments / Business", name: "Business Class Billing Panel", route: "musician-profile.html", mechanic: "Explains monthly billing state for eligible Business Class performers." },
      { order: 90, id: "dispute-payment-workflow", category: "Payments / Business", name: "Dispute Payment Workflow", route: "booking.html", mechanic: "Routes payment disagreements into review and resolution." },
      { order: 91, id: "age-gate-minor-safety", category: "Trust / Safety / Compliance", name: "Age-Gate / Minor-Safety Notice", route: "terms.html", mechanic: "Surfaces children/minor safety expectations and age restrictions." },
      { order: 92, id: "performer-verification-checklist", category: "Trust / Safety / Compliance", name: "Performer Verification Checklist", route: "musician-profile.html", mechanic: "Tracks performer identity, payout, safety, and profile verification items." },
      { order: 93, id: "host-verification-checklist", category: "Trust / Safety / Compliance", name: "Host Verification Checklist", route: "host-profile.html", mechanic: "Tracks venue, host identity, payment, and policy readiness." },
      { order: 94, id: "report-user-gig-flow", category: "Trust / Safety / Compliance", name: "Report User/Gig Flow", route: "support.html", mechanic: "Routes unsafe users, suspicious gigs, or booking issues into support." },
      { order: 95, id: "block-user-flow", category: "Trust / Safety / Compliance", name: "Block User Flow", route: "support.html", mechanic: "Gives users a clear safety action when contact should stop." },
      { order: 96, id: "safety-incident-intake", category: "Trust / Safety / Compliance", name: "Safety Incident Intake", route: "support.html", mechanic: "Collects safety incident context, severity, and support routing." },
      { order: 97, id: "gig-policy-compliance", category: "Trust / Safety / Compliance", name: "Gig Policy Compliance Checklist", route: "host.html#gigForm", mechanic: "Prompts hosts to consider lawful, safe, complete gig details before posting." },
      { order: 98, id: "local-law-awareness", category: "Trust / Safety / Compliance", name: "Local Law Awareness Panel", route: "faq.html", mechanic: "Points users to location-dependent rules that may affect events and bookings." },
      { order: 99, id: "dmca-content-report", category: "Trust / Safety / Compliance", name: "DMCA/Content Report Shortcut", route: "dmca.html", mechanic: "Provides fast routing for copyright and content complaints." },
      { order: 100, id: "legal-compliance-update-center", category: "Trust / Safety / Compliance", name: "Legal/Compliance Update Center", route: "boilerplates.html", mechanic: "Keeps policy, legal, and compliance update surfaces discoverable." },
      { order: 101, id: "loaded-talent-shortlist-board", category: "Loaded Kit / Components", name: "Talent Shortlist Board", route: "host.html#gigList", mechanic: "Gives hosts private performer lists for weddings, clubs, shoots, events, backup slots, and repeat bookings." },
      { order: 102, id: "loaded-gig-invite-room", category: "Loaded Kit / Components", name: "Gig Invite Room", route: "booking.html", mechanic: "Creates a direct invite surface so hosts can invite selected performers instead of only posting open gigs." },
      { order: 103, id: "loaded-event-day-command-center", category: "Loaded Kit / Components", name: "Event Day Command Center", route: "booking.html", mechanic: "Turns same-day bookings into a focused room for arrival, check-in, location, setup, contact, and issue controls." },
      { order: 104, id: "loaded-performer-promo-card", category: "Loaded Kit / Components", name: "Performer Promo Card", route: "performer-view.html", mechanic: "Creates a shareable performer mini-card with category, city, rate, style, reviews, and booking action." },
      { order: 105, id: "loaded-host-venue-card", category: "Loaded Kit / Components", name: "Host Venue Card", route: "host-profile.html", mechanic: "Creates a public venue card with event type, venue style, pay reliability, safety notes, and booking history." },
      { order: 106, id: "loaded-no-surprise-pay-box", category: "Loaded Kit / Components", name: "No-Surprise Pay Box", route: "booking.html", mechanic: "Shows gross pay, fees, payout estimate, payout timing, payment method, and cancellation rule before commitment." },
      { order: 107, id: "loaded-rider-builder", category: "Loaded Kit / Components", name: "Rider Builder", route: "musician-profile.html#profileForm", mechanic: "Lets performers capture sound, power, stage, lighting, load-in, parking, and special setup needs." },
      { order: 108, id: "loaded-venue-readiness-builder", category: "Loaded Kit / Components", name: "Venue Readiness Builder", route: "host-profile.html", mechanic: "Lets hosts capture contact person, event schedule, gear available, parking, load-in, and house rules." },
      { order: 109, id: "loaded-backup-performer-pool", category: "Loaded Kit / Components", name: "Backup Performer Pool", route: "gig-radar.html", mechanic: "Maintains a pool of available backups who can step in when a booking falls through." },
      { order: 110, id: "loaded-booking-confidence-meter", category: "Loaded Kit / Components", name: "Booking Confidence Meter", route: "booking.html", mechanic: "Scores whether date, pay, location, performer, messages, check-in, and review path are clear." },
      { order: 111, id: "loaded-travel-radius-control", category: "Loaded Kit / Components", name: "Travel Radius Control", route: "musician-profile.html#profileForm", mechanic: "Lets performers set normal travel range and a temporary last-minute override." },
      { order: 112, id: "loaded-availability-pulse", category: "Loaded Kit / Components", name: "Availability Pulse", route: "musician-matched-gigs.html", mechanic: "Adds a simple status signal for available tonight, available this weekend, open to last-minute, unavailable, or travel only." },
      { order: 113, id: "loaded-gig-fit-explainer", category: "Loaded Kit / Components", name: "Gig Fit Explainer", route: "gig-radar.html#gigList", mechanic: "Explains why a performer is seeing a gig or why a host is seeing a performer in plain language." },
      { order: 114, id: "loaded-cancellation-room", category: "Loaded Kit / Components", name: "Cancellation Room", route: "booking.html", mechanic: "Structures cancellation reason, replacement suggestions, policy reminder, and support escalation." },
      { order: 115, id: "loaded-dispute-intake-panel", category: "Loaded Kit / Components", name: "Dispute Intake Panel", route: "support.html", mechanic: "Collects pay problems, no-shows, safety issues, wrong details, and review disputes in one guided panel." },
      { order: 116, id: "loaded-first-to-accept-invite-timer", category: "Loaded Kit / Mechanics", name: "First-To-Accept Invite Timer", route: "booking.html", mechanic: "Lets hosts invite multiple performers while the first valid acceptance wins inside a visible timer." },
      { order: 117, id: "loaded-backup-auto-suggest", category: "Loaded Kit / Mechanics", name: "Backup Auto-Suggest", route: "booking.html", mechanic: "Suggests nearby available backups by category, rating, and date when a performer cancels." },
      { order: 118, id: "loaded-readiness-gate", category: "Loaded Kit / Mechanics", name: "Readiness Gate", route: "booking.html", mechanic: "Keeps a booking from reading as ready until pay, location, setup notes, and contact person are filled out." },
      { order: 119, id: "loaded-event-day-check-in-window", category: "Loaded Kit / Mechanics", name: "Event-Day Check-In Window", route: "booking.html", mechanic: "Opens check-in only during the allowed window before event start." },
      { order: 120, id: "loaded-payout-clarity-gate", category: "Loaded Kit / Mechanics", name: "Payout Clarity Gate", route: "booking.html", mechanic: "Requires payout timing and cancellation terms to be visible before a performer accepts." },
      { order: 121, id: "loaded-last-minute-boost", category: "Loaded Kit / Mechanics", name: "Last-Minute Boost", route: "gig-radar.html", mechanic: "Boosts urgent gigs to performers who marked themselves available tonight or this weekend." },
      { order: 122, id: "loaded-trust-based-visibility", category: "Loaded Kit / Mechanics", name: "Trust-Based Visibility", route: "gig-radar.html", mechanic: "Increases invite and shortlist visibility for higher-trust performers and reliable hosts." },
      { order: 123, id: "loaded-profile-strength-unlocks", category: "Loaded Kit / Mechanics", name: "Profile Strength Unlocks", route: "musician-profile.html#profileForm", mechanic: "Unlocks more exposure after media, rate, city, availability, and payout details are complete." },
      { order: 124, id: "loaded-host-reliability-signal", category: "Loaded Kit / Mechanics", name: "Host Reliability Signal", route: "host-profile.html", mechanic: "Improves host visibility by rewarding on-time pay, completed reviews, and lower cancellation behavior." },
      { order: 125, id: "loaded-smart-rebook-memory", category: "Loaded Kit / Mechanics", name: "Smart Rebook Memory", route: "host.html#gigList", mechanic: "Remembers prior setup, rate, venue, and performer preferences for repeat bookings." },
      { order: 126, id: "loaded-rider-conflict-warning", category: "Loaded Kit / Mechanics", name: "Rider Conflict Warning", route: "booking.html", mechanic: "Warns when performer setup needs do not match what the host says the venue provides." },
      { order: 127, id: "loaded-travel-fit-warning", category: "Loaded Kit / Mechanics", name: "Travel Fit Warning", route: "gig-radar.html", mechanic: "Warns before acceptance when a gig is outside the performer's normal radius." },
      { order: 128, id: "loaded-no-show-escalation", category: "Loaded Kit / Mechanics", name: "No-Show Escalation", route: "booking.html", mechanic: "Opens backup suggestions and issue reporting if check-in fails near event time." },
      { order: 129, id: "loaded-mutual-review-lock", category: "Loaded Kit / Mechanics", name: "Mutual Review Lock", route: "booking.html", mechanic: "Unlocks reviews after the event window closes so both sides can leave fair feedback." },
      { order: 130, id: "loaded-safe-contact-rule", category: "Loaded Kit / Mechanics", name: "Safe Contact Rule", route: "booking.html", mechanic: "Keeps booking contact details locked until a booking is accepted." },
      { order: 131, id: "loaded-start-here-picker", category: "Loaded Kit / UX/UI Features", name: "Start Here Picker", route: "index.html", mechanic: "Gives users a plain front-door choice: I need talent, I need a gig, I need to manage today, or I need help." },
      { order: 132, id: "loaded-tonight-weekend-filter", category: "Loaded Kit / UX/UI Features", name: "Tonight / Weekend Filter", route: "gig-radar.html#queueControlsBar", mechanic: "Adds fast filters for urgent booking behavior and near-term performer availability." },
      { order: 133, id: "loaded-booking-health-chips", category: "Loaded Kit / UX/UI Features", name: "Booking Health Chips", route: "booking.html", mechanic: "Shows compact chips such as Pay clear, Location ready, Setup missing, Check-in open, and Review needed." },
      { order: 134, id: "loaded-one-screen-booking-summary", category: "Loaded Kit / UX/UI Features", name: "One-Screen Booking Summary", route: "booking.html", mechanic: "Lets both sides understand the whole booking in about 30 seconds." },
      { order: 135, id: "loaded-performer-card-stack", category: "Loaded Kit / UX/UI Features", name: "Performer Card Stack", route: "host.html#gigList", mechanic: "Lets hosts swipe or tap through matched performers with shortlist and invite actions." },
      { order: 136, id: "loaded-host-posting-wizard", category: "Loaded Kit / UX/UI Features", name: "Host Posting Wizard", route: "host.html#gigForm", mechanic: "Turns gig posting into a guided one-question-at-a-time flow." },
      { order: 137, id: "loaded-accept-gig-confirmation-sheet", category: "Loaded Kit / UX/UI Features", name: "Accept Gig Confirmation Sheet", route: "gig-radar.html#gigList", mechanic: "Shows date, time, location, pay, setup, cancellation rule, and payout method before accepting." },
      { order: 138, id: "loaded-event-day-action-footer", category: "Loaded Kit / UX/UI Features", name: "Event-Day Action Footer", route: "booking.html", mechanic: "Groups Message, Check in, Location, and Problem actions inside the booking page without pinning tiles to the viewport." },
      { order: 139, id: "loaded-setup-notes-drawer", category: "Loaded Kit / UX/UI Features", name: "Setup Notes Drawer", route: "booking.html", mechanic: "Provides a collapsible rider and venue details panel for booking setup notes." },
      { order: 140, id: "loaded-trust-snapshot-strip", category: "Loaded Kit / UX/UI Features", name: "Trust Snapshot Strip", route: "performer-view.html", mechanic: "Shows plain trust badges for verified, reviewed, completed gigs, fast replies, Business Class, and safety reporting." },
      { order: 141, id: "loaded-shortlist-tray", category: "Loaded Kit / UX/UI Features", name: "Shortlist Tray", route: "host.html#gigList", mechanic: "Groups saved performers in the host workspace while hosts browse and compare talent." },
      { order: 142, id: "loaded-invite-status-timeline", category: "Loaded Kit / UX/UI Features", name: "Invite Status Timeline", route: "booking.html", mechanic: "Shows invite states such as invited, viewed, accepted, expired, and declined." },
      { order: 143, id: "loaded-gig-fit-reasons", category: "Loaded Kit / UX/UI Features", name: "Gig Fit Reasons", route: "gig-radar.html#gigList", mechanic: "Shows clear reasons like near your city, matches your category, open on this date, and pay meets your rate." },
      { order: 144, id: "loaded-empty-state-action-cards", category: "Loaded Kit / UX/UI Features", name: "Empty-State Action Cards", route: "index.html", mechanic: "Replaces blank states with direct actions such as add availability, post first gig, or save first performer." },
      { order: 145, id: "loaded-payment-plain-english-tooltip", category: "Loaded Kit / UX/UI Features", name: "Payment Plain-English Tooltip", route: "booking.html", mechanic: "Explains fees, holds, net payout, and payout timing in simple words." }
	    ];
	    return registry;
	  }

  function openComponentRoute(component) {
    if (!component || !component.route) return;
    openHubAction(component.route);
  }

  function openComponentLibrary() {
    initComponentLibrary();
    var root = document.getElementById("cltchComponentLibrary");
    if (!root) return;
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    refreshComponentLibrary();
    var search = document.getElementById("cltchComponentSearch");
    if (search) {
      window.setTimeout(function () { search.focus(); }, 40);
    }
  }

  function closeComponentLibrary() {
    var root = document.getElementById("cltchComponentLibrary");
    if (!root) return;
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
  }

  function refreshComponentLibrary() {
    var root = document.getElementById("cltchComponentLibrary");
    if (!root) return;
    var registry = getCltchComponentRegistry();
    var category = root.getAttribute("data-category") || "All";
    var query = String((document.getElementById("cltchComponentSearch") || {}).value || "").trim().toLowerCase();
    var categories = ["All"].concat(Array.from(new Set(registry.map(function (item) { return item.category; }))));
    var tabs = root.querySelector("#cltchComponentCategories");
    var list = root.querySelector("#cltchComponentList");
    var summary = root.querySelector("#cltchComponentSummary");
    if (summary) summary.textContent = registry.length.toLocaleString() + " proposed concepts · 0 active integrations";
    if (tabs) {
      tabs.innerHTML = categories.map(function (cat) {
        var count = cat === "All" ? registry.length : registry.filter(function (item) { return item.category === cat; }).length;
        return '<button type="button" class="cltch-component-tab' + (cat === category ? " active" : "") + '" data-component-category="' + escapeHtml(cat) + '"><strong>' + escapeHtml(cat) + '</strong><span>' + count + '</span></button>';
      }).join("");
      tabs.querySelectorAll("[data-component-category]").forEach(function (button) {
        button.addEventListener("click", function () {
          root.setAttribute("data-category", button.getAttribute("data-component-category") || "All");
          refreshComponentLibrary();
        });
      });
    }
    var filtered = registry.filter(function (item) {
      if (category !== "All" && item.category !== category) return false;
      if (!query) return true;
      return [item.name, item.category, item.mechanic, item.route, item.id].join(" ").toLowerCase().indexOf(query) !== -1;
    });
	    if (list) {
	      var visible = filtered.slice(0, 120);
	      list.innerHTML = visible.map(function (item) {
	        return '<article class="cltch-component-row">' +
          '<div class="cltch-component-number">' + String(item.order).padStart(2, "0") + '</div>' +
          '<div><strong>' + escapeHtml(item.name) + '</strong><p>' + escapeHtml(item.mechanic) + '</p><span>' + escapeHtml(item.category) + ' · ' + escapeHtml(item.route) + '</span></div>' +
          '<div class="cltch-component-actions">' +
	            '<span class="cltch-pill">Proposed concept</span>' +
	            '<button type="button" class="cltch-exp-chip" data-component-open="' + escapeHtml(item.id) + '">Open related page</button>' +
	          '</div>' +
	        '</article>';
	      }).join("") + (filtered.length > visible.length ? '<div class="cltch-exp-note">Showing first ' + visible.length.toLocaleString() + ' of ' + filtered.length.toLocaleString() + ' matching components. Use search or category filters to narrow the list.</div>' : "") || '<div class="cltch-exp-note">No matching components.</div>';
      list.querySelectorAll("[data-component-open]").forEach(function (button) {
        button.addEventListener("click", function () {
          openComponentRoute(registry.find(function (item) { return item.id === button.getAttribute("data-component-open"); }));
        });
      });
    }
  }

  function initComponentLibrary() {
    if (document.getElementById("cltchComponentLibrary")) return;
    var root = document.createElement("section");
    root.id = "cltchComponentLibrary";
    root.className = "cltch-component-library";
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("data-category", "All");
    root.innerHTML =
      '<div class="cltch-component-scrim" data-component-close="true"></div>' +
      '<div class="cltch-component-card" role="dialog" aria-modal="true" aria-label="CLTCH feature concepts">' +
        '<div class="cltch-component-head">' +
        '<div><div class="cltch-component-title">CLTCH Feature Concepts</div><div class="cltch-component-sub" id="cltchComponentSummary">Proposed ideas; none are active integrations.</div></div>' +
          '<button type="button" class="cltch-access-close" data-component-close="true">Close</button>' +
        '</div>' +
        '<div class="cltch-component-body">' +
          '<div class="cltch-component-toolbar"><input id="cltchComponentSearch" type="search" aria-label="Search proposed feature concepts" placeholder="Search dispatch, request, nearby talent, event day, payout, safety, or booking concepts"></div>' +
          '<div class="cltch-component-categories" id="cltchComponentCategories"></div>' +
          '<div class="cltch-component-list" id="cltchComponentList"></div>' +
          '<p class="cltch-exp-note">These entries describe ideas for future work. “Open related page” only opens an existing page; it does not enable the proposed behavior.</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelectorAll("[data-component-close='true']").forEach(function (el) {
      el.addEventListener("click", closeComponentLibrary);
    });
    var search = root.querySelector("#cltchComponentSearch");
    if (search) search.addEventListener("input", refreshComponentLibrary);
    refreshComponentLibrary();
  }

  function initSavedSearchAndAlerts() {
    var searchInput = document.getElementById("gigSearchInput");
    var filterRow = document.getElementById("gigFilterRow");
    var sortSelect = document.getElementById("gigSortSelect");
    var mount = document.getElementById("queueControlsBar");
    if (!searchInput || !filterRow || !mount) return;
    if (document.getElementById("cltchSavedSearchCard")) return;

    var storageKey = "cltch_saved_searches_v1:" + pageName();
    var alertKey = "cltch_match_alerts_v1:" + pageName();
    var data = readJsonStorage(storageKey, { presets: [] });
    if (!Array.isArray(data.presets)) data.presets = [];

    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSavedSearchCard";
    card.innerHTML =
      '<div class="cltch-exp-head">' +
        '<div class="cltch-exp-title">Saved Search + Alerts</div>' +
        '<label class="cltch-exp-row" style="margin:0;font-size:12px;"><input id="cltchMatchAlertsToggle" type="checkbox"> Match alerts</label>' +
      "</div>" +
      '<div class="cltch-exp-row">' +
        '<input id="cltchPresetName" type="text" maxlength="30" placeholder="Preset name" style="min-height:38px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchPresetSave" class="cltch-exp-chip">Save Current</button>' +
      "</div>" +
      '<div class="cltch-exp-row" style="margin-top:8px;">' +
        '<select id="cltchPresetSelect" style="min-height:38px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);min-width:180px;"></select>' +
        '<button type="button" id="cltchPresetApply" class="cltch-exp-chip">Apply</button>' +
        '<button type="button" id="cltchPresetDelete" class="cltch-exp-chip">Delete</button>' +
      "</div>" +
      '<div class="cltch-exp-row" style="margin-top:8px;">' +
        '<button type="button" id="cltchPresetExport" class="cltch-exp-chip">Export Presets</button>' +
        '<button type="button" id="cltchPresetImport" class="cltch-exp-chip">Import Presets</button>' +
        '<input type="file" id="cltchPresetFile" accept="application/json,.json" hidden>' +
      "</div>" +
      '<div class="cltch-exp-note" id="cltchSavedSearchNote" style="margin-top:8px;">Save common filters and replay them instantly.</div>';
    mount.insertAdjacentElement("afterend", card);

    var presetName = card.querySelector("#cltchPresetName");
    var presetSelect = card.querySelector("#cltchPresetSelect");
    var alertsToggle = card.querySelector("#cltchMatchAlertsToggle");
    var note = card.querySelector("#cltchSavedSearchNote");
    if (alertsToggle) alertsToggle.checked = window.localStorage.getItem(alertKey) === "on";

    function readState() {
      var activeFilterEl = filterRow.querySelector("[data-filter].active");
      return {
        search: (searchInput.value || "").trim().slice(0, 200),
        filter: activeFilterEl ? activeFilterEl.getAttribute("data-filter") : "all",
        sort: sortSelect ? sortSelect.value || "best" : "best"
      };
    }

    function applyState(state) {
      if (!state || typeof state !== "object") return;
      searchInput.value = state.search || "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      var chip = filterRow.querySelector("[data-filter='" + String(state.filter || "all") + "']");
      if (chip) chip.click();
      if (sortSelect && state.sort) {
        sortSelect.value = state.sort;
        sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    function renderSelect() {
      var html = '<option value="">Saved presets</option>' +
        data.presets.map(function (item, idx) {
          return '<option value="' + idx + '">' + escapeHtml(item.name || ("Preset " + (idx + 1))) + "</option>";
        }).join("");
      presetSelect.innerHTML = html;
    }

    renderSelect();

    card.querySelector("#cltchPresetSave").addEventListener("click", function () {
      var name = (presetName.value || "").trim().slice(0, 30);
      if (!name) {
        showDexterityToast("Add a preset name first", 1400);
        return;
      }
      data.presets = data.presets.filter(function (item) { return item.name !== name; });
      data.presets.unshift({ name: name, state: readState() });
      data.presets = data.presets.slice(0, 8);
      writeJsonStorage(storageKey, data);
      renderSelect();
      presetSelect.value = "0";
      presetName.value = "";
      note.textContent = "Preset saved. Apply it from the dropdown any time.";
    });

    card.querySelector("#cltchPresetApply").addEventListener("click", function () {
      var idx = Number(presetSelect.value);
      if (!Number.isFinite(idx) || !data.presets[idx]) return;
      applyState(data.presets[idx].state);
      note.textContent = "Applied " + data.presets[idx].name + ".";
    });

    card.querySelector("#cltchPresetDelete").addEventListener("click", function () {
      var idx = Number(presetSelect.value);
      if (!Number.isFinite(idx) || !data.presets[idx]) return;
      data.presets.splice(idx, 1);
      writeJsonStorage(storageKey, data);
      renderSelect();
      note.textContent = "Preset removed.";
    });

    card.querySelector("#cltchPresetExport").addEventListener("click", function () {
      var payload = {
        version: 1,
        page: pageName(),
        exportedAt: new Date().toISOString(),
        presets: data.presets.slice(0, 8)
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "cltch-search-presets.json";
      link.click();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      note.textContent = "Exported " + payload.presets.length + " local search preset(s).";
    });

    var presetFile = card.querySelector("#cltchPresetFile");
    card.querySelector("#cltchPresetImport").addEventListener("click", function () {
      presetFile.click();
    });
    presetFile.addEventListener("change", async function () {
      var file = presetFile.files && presetFile.files[0];
      presetFile.value = "";
      if (!file) return;
      if (file.size > 65536) {
        note.textContent = "Import rejected: file must be 64 KB or smaller.";
        return;
      }
      try {
        var parsed = JSON.parse(await file.text());
        if (parsed.version !== 1 || parsed.page !== pageName() || !Array.isArray(parsed.presets)) throw new Error("wrong format or page");
        var valid = parsed.presets.slice(0, 8).filter(function (item) {
          if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 30 || !item.state || typeof item.state !== "object") return false;
          var filters = Array.from(filterRow.querySelectorAll("[data-filter]"));
          var filterValid = filters.some(function (el) { return el.getAttribute("data-filter") === item.state.filter; });
          var sortValid = !sortSelect || Array.from(sortSelect.options).some(function (option) { return option.value === item.state.sort; });
          return typeof item.state.search === "string" && item.state.search.length <= 200 && filterValid && sortValid;
        });
        if (!valid.length) throw new Error("no valid presets");
        var importedCount = 0;
        var seenNames = new Set();
        var merged = [];
        valid.concat(data.presets).forEach(function (item, index) {
          var name = item.name.trim();
          var key = name.toLowerCase();
          if (seenNames.has(key) || merged.length >= 8) return;
          seenNames.add(key);
          merged.push({ name: name, state: { search: item.state.search, filter: item.state.filter, sort: item.state.sort } });
          if (index < valid.length) importedCount += 1;
        });
        data.presets = merged;
        writeJsonStorage(storageKey, data);
        renderSelect();
        note.textContent = "Imported or updated " + importedCount + " preset(s).";
      } catch (error) {
        note.textContent = "Import rejected: choose a valid CLTCH preset file for this page.";
      }
    });

    alertsToggle?.addEventListener("change", function () {
      window.localStorage.setItem(alertKey, alertsToggle.checked ? "on" : "off");
      if (alertsToggle.checked && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(function () {});
      }
    });

    var badge = document.getElementById("newBadge");
    if (!badge) return;
    var previousCount = Number((badge.textContent || "").match(/\d+/)?.[0] || 0);
    var observer = new MutationObserver(function () {
      var nextCount = Number((badge.textContent || "").match(/\d+/)?.[0] || 0);
      var enabled = window.localStorage.getItem(alertKey) === "on";
      if (enabled && nextCount > previousCount) {
        var message = nextCount + " live matches available now.";
        if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
          new Notification("CLTCH.NTWRK Match Alert", { body: message });
        } else {
          showDexterityToast(message, 1800);
        }
      }
      previousCount = nextCount;
    });
    observer.observe(badge, { childList: true, subtree: true, characterData: true });
  }

  function initGigCardEnhancements() {
    var gigList = document.getElementById("gigList");
    if (!gigList) return;
    var storageKey = "cltch_counter_offers_v1:" + pageName();
    var counterData = readJsonStorage(storageKey, {});

    function persistCounterData() {
      writeJsonStorage(storageKey, counterData);
    }

    function openCounterOffer(gigId) {
      var current = counterData[gigId] || {};
      var pay = window.prompt("Counter pay (e.g. $300 flat)", current.pay || "");
      if (pay === null) return;
      var time = window.prompt("Counter start time (optional)", current.time || "");
      if (time === null) return;
      var note = window.prompt("Counter note to host (optional)", current.note || "");
      if (note === null) return;
      counterData[gigId] = {
        pay: String(pay || "").trim(),
        time: String(time || "").trim(),
        note: String(note || "").trim(),
        updatedAt: Date.now()
      };
      persistCounterData();
      showDexterityToast("Counter-offer draft saved for this gig", 1900);
    }

    function estimateDays(text) {
      var value = String(text || "");
      if (/today/i.test(value)) return 0;
      if (/tomorrow/i.test(value)) return 1;
      var m = value.match(/in\s+(\d+)\s+days/i);
      if (m) return Number(m[1]);
      return null;
    }

    function augmentCards() {
      gigList.querySelectorAll(".gig-card").forEach(function (card) {
        if (card.dataset.cltchEnhanced === "true") return;
        card.dataset.cltchEnhanced = "true";

        var gigId = (card.id || "").replace(/^gig-/, "").trim();
        var actions = card.querySelector(".actions");
        if (actions && gigId && !actions.querySelector(".cltch-counter-btn")) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cltch-counter-btn";
          btn.textContent = "Counter";
          btn.addEventListener("click", function () {
            openCounterOffer(gigId);
          });
          actions.appendChild(btn);
        }

        var top = card.querySelector(".gig-topline, .gig-meta");
        var metaDate = card.querySelector(".gig-meta span");
        var days = estimateDays(metaDate?.textContent || "");
        if (top && Number.isFinite(days) && days <= 7 && !top.querySelector(".cltch-urgency-chip")) {
          var chip = document.createElement("span");
          chip.className = "cltch-urgency-chip";
          chip.textContent = days <= 1 ? "SLA: Respond now" : ("SLA: " + days + "d");
          top.appendChild(chip);
        }
      });
    }

    augmentCards();
    var observer = new MutationObserver(augmentCards);
    observer.observe(gigList, { childList: true, subtree: true });
  }

  function initHostPostingReadiness() {
    var form = document.getElementById("gigForm");
    if (!form || document.getElementById("cltchHostGateCard")) return;

    var container = document.createElement("section");
    container.className = "cltch-exp-card";
    container.id = "cltchHostGateCard";
    container.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Posting Readiness</div></div>' +
      '<div class="cltch-exp-note" id="cltchGateStatus">Advisory checklist only. It does not block publishing or grant account access.</div>' +
      '<div class="cltch-exp-grid" style="margin-top:8px;">' +
        '<div class="cltch-exp-chip" id="cltchGateScore">Score: 0/6</div>' +
        '<div class="cltch-exp-chip" id="cltchGateSla">SLA: Unknown</div>' +
        '<div class="cltch-exp-chip" id="cltchGateLead">Lead: Unknown</div>' +
        '<div class="cltch-exp-chip" id="cltchGateReady">Not Ready</div>' +
      '</div>';
    form.parentNode.insertBefore(container, form);

    var fields = {
      venue: document.getElementById("venue"),
      date: document.getElementById("date"),
      time: document.getElementById("time"),
      location: document.getElementById("location"),
      genre: document.getElementById("genre"),
      pay: document.getElementById("pay"),
      skillNeed: document.getElementById("skillNeed")
    };

    function updateGate() {
      var score = 0;
      ["venue", "date", "time", "location", "genre", "pay"].forEach(function (id) {
        if (fields[id] && String(fields[id].value || "").trim()) score += 1;
      });
      var skillBoost = String(fields.skillNeed?.value || "").trim().length >= 6;
      if (skillBoost) score += 1;
      var scoreTarget = 7;
      var dateVal = String(fields.date?.value || "");
      var daysOut = 999;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        daysOut = Math.round((new Date(dateVal) - new Date()) / 86400000);
      }

      document.getElementById("cltchGateScore").textContent = "Score: " + score + "/" + scoreTarget;
      document.getElementById("cltchGateLead").textContent = Number.isFinite(daysOut) && daysOut < 999 ? ("Lead: " + Math.max(daysOut, 0) + "d") : "Lead: Unknown";
      document.getElementById("cltchGateSla").textContent = daysOut <= 1 ? "SLA: Immediate" : (daysOut <= 3 ? "SLA: Fast" : "SLA: Standard");
      document.getElementById("cltchGateReady").textContent = score >= 6 ? "Ready" : "Not Ready";
      var status = document.getElementById("cltchGateStatus");
      if (score >= 6) {
        status.textContent = daysOut <= 1
          ? "High urgency posting. Publish and monitor responses closely."
          : "Strong posting quality. You are ready to publish.";
      } else {
        status.textContent = "Add missing details (venue/date/time/location/genre/pay) for better matching confidence.";
      }
    }

    Object.keys(fields).forEach(function (key) {
      fields[key]?.addEventListener("input", updateGate);
      fields[key]?.addEventListener("change", updateGate);
    });
    updateGate();

  }

  function initBookingExperienceTools() {
    var actions = document.getElementById("bookingActions");
    var whenEl = document.getElementById("whenValue");
    var whereEl = document.getElementById("whereValue");
    var titleEl = document.getElementById("bookingTitle");
    var main = document.querySelector("main.container");
    if (!actions || !whenEl || !whereEl || !titleEl || !main) return;
    if (document.getElementById("cltchBookingTools")) return;

    var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
    var checklistKey = "cltch_booking_checklist_v1:" + bookingId;
    var docsKey = "cltch_booking_docs_v1:" + bookingId;
    var recapKey = "cltch_booking_recap_v1:" + bookingId;

    function buildIcs() {
      var title = (titleEl.textContent || "CLTCH Booking").trim();
      var when = (whenEl.textContent || "").trim();
      var where = (whereEl.textContent || "").trim();
      var match = when.match(/(\d{4}-\d{2}-\d{2})\s*@\s*([0-9:]+\s*[AP]M)/i);
      if (!match) return null;
      var date = match[1];
      var time = match[2];
      var dateObj = new Date(date + " " + time);
      if (!Number.isFinite(dateObj.getTime())) return null;
      var end = new Date(dateObj.getTime() + (2 * 60 * 60 * 1000));
      function fmt(d) {
        return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
      }
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CLTCH.NTWRK//Experience//EN",
        "BEGIN:VEVENT",
        "UID:cltch-" + bookingId + "-" + Date.now(),
        "DTSTAMP:" + fmt(new Date()),
        "DTSTART:" + fmt(dateObj),
        "DTEND:" + fmt(end),
        "SUMMARY:" + title.replace(/\r?\n/g, " "),
        "LOCATION:" + where.replace(/\r?\n/g, " "),
        "DESCRIPTION:CLTCH booking timeline and run-of-show",
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");
    }

    var tools = document.createElement("section");
    tools.className = "cltch-exp-card";
    tools.id = "cltchBookingTools";
    tools.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Booking Experience Tools</div></div>' +
      '<div class="cltch-exp-row">' +
        '<button type="button" id="cltchExportIcsBtn" class="cltch-exp-chip">Export Calendar (.ics)</button>' +
        '<button type="button" id="cltchCopyBriefBtn" class="cltch-exp-chip">Copy Booking Brief</button>' +
        '<button type="button" id="cltchRebookBtn" class="cltch-exp-chip">Rebook Draft</button>' +
      '</div>' +
      '<div style="margin-top:12px;" class="cltch-exp-note">Run-of-show checklist</div>' +
      '<div class="cltch-doc-list" id="cltchBookingChecklist"></div>' +
      '<div style="margin-top:12px;" class="cltch-exp-note">Docs Vault (MVP)</div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;"><input id="cltchDocName" type="text" maxlength="40" placeholder="Doc label" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><input id="cltchDocUrl" type="url" placeholder="https://..." style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><button type="button" id="cltchDocAdd" class="cltch-exp-chip">Add</button></div>' +
      '<div class="cltch-doc-list" id="cltchDocList"></div>' +
      '<div style="margin-top:12px;" class="cltch-exp-note">Post-gig recap</div>' +
      '<textarea id="cltchRecapInput" maxlength="500" placeholder="Capture highlights, issues, and rebook notes." style="width:100%;min-height:84px;margin-top:6px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);padding:10px;"></textarea>';
    main.appendChild(tools);

    document.getElementById("cltchExportIcsBtn").addEventListener("click", function () {
      var ics = buildIcs();
      if (!ics) {
        showDexterityToast("Booking time is not ready yet", 1600);
        return;
      }
      var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "cltch-booking-" + bookingId + ".ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    document.getElementById("cltchCopyBriefBtn").addEventListener("click", function () {
      var brief = [
        "Booking: " + (titleEl.textContent || "—"),
        "When: " + (whenEl.textContent || "—"),
        "Where: " + (whereEl.textContent || "—")
      ].join("\n");
      navigator.clipboard?.writeText(brief).then(function () {
        showDexterityToast("Booking brief copied", 1400);
      }).catch(function () {
        showDexterityToast("Copy unavailable on this browser", 1600);
      });
    });

    document.getElementById("cltchRebookBtn").addEventListener("click", function () {
      var draft = {
        venue: String(titleEl.textContent || "").trim(),
        when: String(whenEl.textContent || "").trim(),
        where: String(whereEl.textContent || "").trim(),
        createdAt: Date.now()
      };
      writeJsonStorage("cltch_rebook_draft_v1", draft);
      window.location.href = "host.html";
    });

    var checklistItems = [
      "Confirm arrival window",
      "Confirm contact person",
      "Confirm equipment/setup",
      "Confirm payout details",
      "Send final recap"
    ];
    var checklistState = readJsonStorage(checklistKey, { done: {} });
    if (!checklistState.done || typeof checklistState.done !== "object") checklistState.done = {};
    var checklistEl = document.getElementById("cltchBookingChecklist");
    function renderChecklist() {
      checklistEl.innerHTML = checklistItems.map(function (label, idx) {
        var checked = !!checklistState.done[idx];
        return '<label class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(label) + '</span><input type="checkbox" data-check-item="' + idx + '"' + (checked ? " checked" : "") + "></label>";
      }).join("");
      checklistEl.querySelectorAll("[data-check-item]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var idx = cb.getAttribute("data-check-item");
          checklistState.done[idx] = cb.checked;
          writeJsonStorage(checklistKey, checklistState);
        });
      });
    }
    renderChecklist();

    var docs = readJsonStorage(docsKey, { items: [] });
    if (!Array.isArray(docs.items)) docs.items = [];
    var docName = document.getElementById("cltchDocName");
    var docUrl = document.getElementById("cltchDocUrl");
    var docListEl = document.getElementById("cltchDocList");
    function renderDocs() {
      if (!docs.items.length) {
        docListEl.innerHTML = '<div class="cltch-exp-note">No docs saved yet.</div>';
        return;
      }
      docListEl.innerHTML = docs.items.map(function (item, idx) {
        return '<div class="cltch-doc-item"><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--cltch-accent);text-decoration:none;">' + escapeHtml(item.name) + '</a><button type="button" class="cltch-exp-chip" data-doc-remove="' + idx + '">Remove</button></div>';
      }).join("");
      docListEl.querySelectorAll("[data-doc-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-doc-remove"));
          if (!Number.isFinite(idx)) return;
          docs.items.splice(idx, 1);
          writeJsonStorage(docsKey, docs);
          renderDocs();
        });
      });
    }
    document.getElementById("cltchDocAdd").addEventListener("click", function () {
      var name = String(docName.value || "").trim();
      var url = String(docUrl.value || "").trim();
      if (!name || !/^https?:\/\/\S+$/i.test(url)) {
        showDexterityToast("Enter a valid doc label and URL", 1600);
        return;
      }
      docs.items.unshift({ name: name.slice(0, 40), url: url });
      docs.items = docs.items.slice(0, 12);
      writeJsonStorage(docsKey, docs);
      docName.value = "";
      docUrl.value = "";
      renderDocs();
    });
    renderDocs();

    var recapInput = document.getElementById("cltchRecapInput");
    recapInput.value = window.localStorage.getItem(recapKey) || "";
    recapInput.addEventListener("input", function () {
      window.localStorage.setItem(recapKey, String(recapInput.value || "").slice(0, 500));
    });
  }

  function initTrustMetricsCards() {
    if (document.getElementById("cltchTrustMetrics")) return;
    var hostOpen = document.getElementById("hostStatOpen");
    var hostAccepted = document.getElementById("hostStatAccepted");
    var hostCancelled = document.getElementById("hostStatCancelled");
    var metricAcceptance = document.getElementById("metricAcceptanceRate");
    var metricLiveMatches = document.getElementById("metricLiveMatches");
    if (!hostOpen && !metricAcceptance) return;

    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchTrustMetrics";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Trust + Quality Snapshot</div></div>' +
      '<div class="cltch-exp-grid">' +
        '<div class="cltch-exp-chip" id="cltchTrustReliability">Reliability: —</div>' +
        '<div class="cltch-exp-chip" id="cltchTrustConversion">Conversion: —</div>' +
        '<div class="cltch-exp-chip" id="cltchTrustRisk">Risk: —</div>' +
        '<div class="cltch-exp-chip" id="cltchTrustSignal">Signal: —</div>' +
      '</div>';

    if (hostOpen) {
      var mount = document.querySelector(".ops-panel");
      if (mount) mount.insertAdjacentElement("afterend", card);
    } else {
      var mountPerf = document.getElementById("analyticsPanel");
      if (mountPerf) mountPerf.insertAdjacentElement("afterend", card);
    }

    function update() {
      if (hostOpen) {
        var open = Number(hostOpen.textContent || 0);
        var accepted = Number(hostAccepted?.textContent || 0);
        var cancelled = Number(hostCancelled?.textContent || 0);
        var total = open + accepted + cancelled;
        var reliability = total > 0 ? Math.round((accepted / total) * 100) : 0;
        var risk = total > 0 ? Math.round((cancelled / total) * 100) : 0;
        document.getElementById("cltchTrustReliability").textContent = "Reliability: " + reliability + "%";
        document.getElementById("cltchTrustConversion").textContent = "Booked: " + accepted;
        document.getElementById("cltchTrustRisk").textContent = "Cancel risk: " + risk + "%";
        document.getElementById("cltchTrustSignal").textContent = open > 0 ? "Signal: Active queue" : "Signal: Post now";
      } else {
        var acceptanceRate = Number((metricAcceptance?.textContent || "0").replace(/[^0-9]/g, "")) || 0;
        var live = Number(metricLiveMatches?.textContent || 0);
        document.getElementById("cltchTrustReliability").textContent = "Acceptance: " + acceptanceRate + "%";
        document.getElementById("cltchTrustConversion").textContent = "Live matches: " + live;
        document.getElementById("cltchTrustRisk").textContent = live > 0 ? "Risk: Competition high" : "Risk: Low";
        document.getElementById("cltchTrustSignal").textContent = live > 0 ? "Signal: Respond fast" : "Signal: Tune profile";
      }
    }
    update();
    window.setInterval(update, 2500);
  }

  function initOnboardingWizard() {
    var page = pageName();
    var map = {
      "auth.html": ["Create account", "Verify email", "Pick role", "Open workspace"],
      "host-profile.html": ["Venue basics", "Contact + location", "Payout setup", "Save and post first gig"],
      "musician-profile.html": ["Identity + style", "Availability", "Payout setup", "Open radar and accept a gig"]
    };
    if (!map[page] || document.getElementById("cltchOnboardingWizard")) return;
    var main = markMainContent();
    if (!main) return;
    var steps = map[page];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchOnboardingWizard";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Quick Onboarding Wizard</div></div>' +
      '<div class="cltch-doc-list">' + steps.map(function (step, idx) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + (idx + 1) + ". " + escapeHtml(step) + "</span></div>";
      }).join("") + "</div>";
    main.insertBefore(card, main.firstChild);
  }

  function parseUsdFromText(text) {
    var m = String(text || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    if (!m) return 0;
    var n = Number(m[1]);
    return Number.isFinite(n) ? n : 0;
  }

  function extractIsoDate(text) {
    var m = String(text || "").match(/\b(\d{4}-\d{2}-\d{2})\b/);
    return m ? m[1] : "";
  }

  function csvEscape(value) {
    var text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, rows) {
    if (!rows || !rows.length) return;
    var csv = rows.map(function (row) {
      return row.map(csvEscape).join(",");
    }).join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function initPayoutEstimatorAndTemplates() {
    var form = document.getElementById("gigForm");
    var payInput = document.getElementById("pay");
    var performerType = document.getElementById("performerType");
    var notes = document.getElementById("notes");
    if (!form || !payInput || document.getElementById("cltchPayoutEstimator")) return;

    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPayoutEstimator";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Net Payout + Event Templates</div></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchGrossPay">$0</div><div class="cltch-metric-label">Gross</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchFeesPay">$0</div><div class="cltch-metric-label">Fees (2%)</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchNetPay">$0</div><div class="cltch-metric-label">Estimated Net</div></div>' +
      "</div>" +
      '<div class="cltch-exp-row" style="margin-top:10px;">' +
        '<select id="cltchTemplateSelect" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
          '<option value="">Auto-fill template</option>' +
          '<option value="lounge">Lounge Set</option>' +
          '<option value="festival">Festival Slot</option>' +
          '<option value="private">Private Event</option>' +
          '<option value="content">Content Shoot</option>' +
        '</select>' +
        '<button type="button" id="cltchApplyTemplateBtn" class="cltch-exp-chip">Apply</button>' +
      "</div>" +
      '<div class="cltch-exp-note" id="cltchPayoutNote" style="margin-top:8px;">Use templates to prefill stronger booking notes.</div>';
    form.parentNode.insertBefore(card, form);

    function fmt(num) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(num || 0);
    }

    function updateEstimator() {
      var gross = parseUsdFromText(payInput.value);
      var fee = Number((gross * 0.02).toFixed(2));
      var net = Number((gross - fee).toFixed(2));
      document.getElementById("cltchGrossPay").textContent = fmt(gross);
      document.getElementById("cltchFeesPay").textContent = fmt(fee);
      document.getElementById("cltchNetPay").textContent = fmt(net);
    }

    payInput.addEventListener("input", updateEstimator);
    updateEstimator();

    document.getElementById("cltchApplyTemplateBtn").addEventListener("click", function () {
      var template = document.getElementById("cltchTemplateSelect").value;
      if (!template) return;
      var type = performerType?.value || "any";
      var templates = {
        lounge: "Set length: 2 x 45 min. Arrival: 60 min early. Dress: smart-casual. Provide compact setup.",
        festival: "Set length: 35-50 min. Arrival: 90 min early. Stage manager check-in required.",
        private: "Set length: flexible. Arrival: 45 min early. Keep volume/event tone adaptable.",
        content: "Shot list + timing window required. Arrival: 30 min early. Confirm gear and delivery format."
      };
      var next = templates[template] || "";
      if (type === "dj" && template === "lounge") next += " Bring controller + backup cables.";
      if (type === "photographer" && template === "content") next += " Include lighting plan and backup media.";
      if (notes) {
        notes.value = notes.value ? (notes.value + "\n" + next) : next;
        notes.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.getElementById("cltchPayoutNote").textContent = "Template applied to notes.";
    });
  }

  function initTravelFeasibilityCheck() {
    var form = document.getElementById("gigForm");
    var dateInput = document.getElementById("date");
    var timeInput = document.getElementById("time");
    var locationInput = document.getElementById("location");
    if (!form || !dateInput || !timeInput || !locationInput || document.getElementById("cltchTravelCheck")) return;

    var box = document.createElement("div");
    box.className = "cltch-exp-card";
    box.id = "cltchTravelCheck";
    box.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Travel + Time Feasibility</div></div>' +
      '<div class="cltch-exp-note" id="cltchTravelNote">Set date/time/location to evaluate sequencing risk.</div>';
    form.parentNode.insertBefore(box, form);

    function toMinutes(timeText) {
      var m = String(timeText || "").match(/(\d{1,2}):(\d{2})/);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    }

    function evaluate() {
      var date = dateInput.value;
      var mins = toMinutes(timeInput.value);
      var location = String(locationInput.value || "").trim().toLowerCase();
      if (!date || mins == null || !location) return;
      var conflicts = 0;
      document.querySelectorAll("#gigList .gig-card .gig-meta").forEach(function (meta) {
        var text = meta.textContent || "";
        var otherDate = extractIsoDate(text);
        if (otherDate !== date) return;
        var otherMinutes = toMinutes(text);
        if (otherMinutes == null) return;
        if (Math.abs(otherMinutes - mins) < 120) conflicts += 1;
      });
      var note = document.getElementById("cltchTravelNote");
      if (conflicts > 0) {
        note.textContent = "Potential overlap risk: " + conflicts + " nearby-time gig(s) on this date.";
      } else {
        note.textContent = "Feasibility check looks clear from current queue timing.";
      }
    }

    dateInput.addEventListener("change", evaluate);
    timeInput.addEventListener("change", evaluate);
    locationInput.addEventListener("input", evaluate);
    evaluate();
  }

  function initPerformerInsights() {
    var reviewsList = document.getElementById("myReviewsList");
    var radarList = document.getElementById("gigList");
    if (!reviewsList && !radarList) return;
    if (document.getElementById("cltchPerformerInsights")) return;
    var mount = document.getElementById("analyticsPanel") || document.querySelector("main.container");
    if (!mount) return;

    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPerformerInsights";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Performer Insights</div></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchRepScore">—</div><div class="cltch-metric-label">Reputation</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchRepeatScore">—</div><div class="cltch-metric-label">Repeat Score</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchLiveSla">—</div><div class="cltch-metric-label">SLA</div></div>' +
      "</div>" +
      '<div class="cltch-exp-note" style="margin-top:10px;">Availability heatmap</div>' +
      '<div class="cltch-heatmap" id="cltchAvailHeat"></div>' +
      '<div class="cltch-exp-note" style="margin-top:10px;">Reputation timeline</div>' +
      '<div class="cltch-timeline" id="cltchRepTimeline"></div>' +
      '<div class="cltch-exp-note" style="margin-top:10px;" id="cltchWhyMatch">Why-matched inspector updates with your live queue.</div>';
    mount.insertAdjacentElement("afterend", card);

    function gradeToScore(g) {
      var map = { AA: 7, A: 6, B: 5, C: 4, D: 3, F: 2, N: 1 };
      return map[g] || 0;
    }

    function update() {
      var grades = [];
      document.querySelectorAll("#myReviewsList .review-grade-pill, #myReviewsList [class*='grade']").forEach(function (el) {
        var g = String(el.textContent || "").trim().toUpperCase();
        if (/^(AA|A|B|C|D|F|N)$/.test(g)) grades.push(g);
      });
      var avg = grades.length ? grades.map(gradeToScore).reduce(function (a, b) { return a + b; }, 0) / grades.length : 0;
      document.getElementById("cltchRepScore").textContent = grades.length ? (Math.round(avg * 10) / 10 + "/7") : "No data";

      var venues = {};
      document.querySelectorAll("#upcomingList .booked-venue, #matchedQueueList .venue").forEach(function (el) {
        var name = String(el.textContent || "").trim();
        if (!name) return;
        venues[name] = (venues[name] || 0) + 1;
      });
      var topRepeat = Object.keys(venues).sort(function (a, b) { return venues[b] - venues[a]; })[0];
      document.getElementById("cltchRepeatScore").textContent = topRepeat ? (venues[topRepeat] + "x " + topRepeat.slice(0, 10)) : "New";

      var urgent = 0;
      document.querySelectorAll("#gigList .cltch-urgency-chip").forEach(function () { urgent += 1; });
      document.getElementById("cltchLiveSla").textContent = urgent ? (urgent + " urgent") : "Normal";

      var weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
      document.querySelectorAll("#upcomingList .booked-date-block, #gigList .gig-meta").forEach(function (el) {
        var date = extractIsoDate(el.textContent || "");
        if (!date) return;
        var d = new Date(date);
        if (!Number.isFinite(d.getTime())) return;
        weekdayCounts[d.getDay()] += 1;
      });
      var heat = document.getElementById("cltchAvailHeat");
      var labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      var max = Math.max.apply(null, weekdayCounts.concat([1]));
      heat.innerHTML = labels.map(function (label, idx) {
        var level = weekdayCounts[idx] >= (max * 0.7) ? 3 : (weekdayCounts[idx] >= (max * 0.35) ? 2 : 1);
        return '<div class="cltch-heat-cell" data-level="' + level + '">' + label + "<br>" + weekdayCounts[idx] + "</div>";
      }).join("");

      var timeline = document.getElementById("cltchRepTimeline");
      if (!grades.length) {
        timeline.innerHTML = '<div class="cltch-exp-note">Timeline appears after review history builds.</div>';
      } else {
        timeline.innerHTML = grades.slice(0, 12).map(function (g) {
          var pct = Math.max(8, Math.round((gradeToScore(g) / 7) * 100));
          return '<div><div class="cltch-exp-note" style="margin-bottom:4px;">' + g + '</div><div class="cltch-timeline-bar"><div class="cltch-timeline-fill" style="width:' + pct + '%;"></div></div></div>';
        }).join("");
      }

      var reasonCount = 0;
      document.querySelectorAll("#gigList .match-detail, #gigList [style*='font-size:11px']").forEach(function (el) {
        if (String(el.textContent || "").trim()) reasonCount += 1;
      });
      document.getElementById("cltchWhyMatch").textContent = reasonCount
        ? ("Why-matched inspector: " + reasonCount + " active reason signals detected.")
        : "Why-matched inspector updates with your live queue.";
    }
    update();
    var obs = new MutationObserver(update);
    (radarList || reviewsList)?.parentNode && obs.observe((radarList || reviewsList).parentNode, { childList: true, subtree: true });
  }

  function initBookingOpsExtensions() {
    var bookingTools = document.getElementById("cltchBookingTools");
    if (!bookingTools || document.getElementById("cltchBookingOpsExt")) return;
    var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
    var incidentKey = "cltch_incidents_v1:" + bookingId;
    var negoKey = "cltch_negotiation_v1:" + bookingId;

    var ext = document.createElement("div");
    ext.className = "cltch-exp-card";
    ext.id = "cltchBookingOpsExt";
    ext.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Negotiation + Incident Flow</div></div>' +
      '<div class="cltch-exp-row">' +
        '<input id="cltchNegoPay" type="text" placeholder="Counter pay" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchNegoTime" type="text" placeholder="Counter time" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchSaveNego" class="cltch-exp-chip">Save Negotiation</button>' +
      "</div>" +
      '<div class="cltch-exp-note" id="cltchNegoStatus" style="margin-top:8px;">No negotiation draft yet.</div>' +
      '<div class="cltch-exp-row" style="margin-top:10px;">' +
        '<select id="cltchIncidentSeverity" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value=\"low\">Low</option><option value=\"medium\">Medium</option><option value=\"high\">High</option></select>' +
        '<input id="cltchIncidentNote" type="text" maxlength="140" placeholder="Incident summary" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchReportIncident" class="cltch-exp-chip">Report Incident</button>' +
      "</div>" +
      '<div class="cltch-doc-list" id="cltchIncidentList"></div>';
    bookingTools.insertAdjacentElement("afterend", ext);

    var nego = readJsonStorage(negoKey, {});
    if (nego.pay) document.getElementById("cltchNegoPay").value = nego.pay;
    if (nego.time) document.getElementById("cltchNegoTime").value = nego.time;
    if (nego.updatedAt) {
      document.getElementById("cltchNegoStatus").textContent = "Negotiation draft saved.";
    }
    document.getElementById("cltchSaveNego").addEventListener("click", function () {
      var next = {
        pay: String(document.getElementById("cltchNegoPay").value || "").trim(),
        time: String(document.getElementById("cltchNegoTime").value || "").trim(),
        updatedAt: Date.now()
      };
      writeJsonStorage(negoKey, next);
      document.getElementById("cltchNegoStatus").textContent = "Negotiation draft saved (MVP local thread).";
    });

    var incidents = readJsonStorage(incidentKey, { items: [] });
    if (!Array.isArray(incidents.items)) incidents.items = [];
    function renderIncidents() {
      var list = document.getElementById("cltchIncidentList");
      if (!incidents.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No incident reports filed.</div>';
        return;
      }
      list.innerHTML = incidents.items.map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">[' + escapeHtml(it.severity) + "] " + escapeHtml(it.note) + '</span><span class="cltch-exp-note">' + new Date(it.at).toLocaleString() + "</span></div>";
      }).join("");
    }
    document.getElementById("cltchReportIncident").addEventListener("click", function () {
      var severity = document.getElementById("cltchIncidentSeverity").value || "low";
      var note = String(document.getElementById("cltchIncidentNote").value || "").trim();
      if (!note) return;
      incidents.items.unshift({ severity: severity, note: note.slice(0, 140), at: Date.now() });
      incidents.items = incidents.items.slice(0, 20);
      writeJsonStorage(incidentKey, incidents);
      document.getElementById("cltchIncidentNote").value = "";
      renderIncidents();
      showDexterityToast("Incident report saved", 1500);
    });
    renderIncidents();
  }

  function initOfferExpirationAndCancelGuard() {
    var form = document.getElementById("gigForm");
    if (form && !document.getElementById("cltchOfferTtl")) {
      var group = document.createElement("div");
      group.className = "form-group";
      group.innerHTML =
        '<label>Offer Expiration (TTL)</label>' +
        '<select id="cltchOfferTtl" name="offerExpiryHours">' +
          '<option value="0">No auto-expiration</option>' +
          '<option value="6">6 hours</option>' +
          '<option value="12">12 hours</option>' +
          '<option value="24">24 hours</option>' +
          '<option value="48">48 hours</option>' +
        '</select>' +
        '<div class="cltch-exp-note">Expired open offers are automatically treated as stale.</div>';
      form.insertBefore(group, form.querySelector("button[type='submit']"));
    }

    document.addEventListener("click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!btn) return;
      var text = String(btn.textContent || "").toLowerCase();
      if (text.indexOf("cancel gig") === -1 && text.indexOf("cancel booking") === -1) return;
      var reason = window.prompt("Cancellation reason (required for audit):", "");
      if (reason == null) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!String(reason).trim()) {
        event.preventDefault();
        event.stopPropagation();
        showDexterityToast("Please add a cancellation reason", 1500);
        return;
      }
      try {
        window.localStorage.setItem("cltch_last_cancel_reason_v1", String(reason).trim().slice(0, 160));
      } catch (error) {}
    }, true);
  }

  function initCrossRoleSwitchAndSessionRecovery() {
    var modeSwitch = document.getElementById("modeSwitch");
    if (modeSwitch && !document.getElementById("cltchRoleSwitch")) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "cltchRoleSwitch";
      btn.className = "cltch-theme-toggle";
      btn.style.marginLeft = "8px";
      btn.textContent = "Switch Role";
      btn.addEventListener("click", function () {
        var active = modeSwitch.querySelector(".mode-btn.active,[aria-pressed='true'],[data-mode]");
        var mode = active?.getAttribute("data-mode") || "host";
        var next = mode === "host" ? "musician" : "host";
        var target = modeSwitch.querySelector('[data-mode="' + next + '"]');
        target?.click();
      });
      modeSwitch.parentNode?.insertBefore(btn, modeSwitch.nextSibling);
    }

    var recoveryKey = "cltch_session_recovery_v1:" + pageName();
    try {
      var payload = {
        at: Date.now(),
        y: window.scrollY || 0,
        search: document.querySelector('input[type="search"]')?.value || ""
      };
      writeJsonStorage(recoveryKey, payload);
    } catch (error) {}

    if (document.getElementById("cltchSessionRecovery")) return;
    var rec = readJsonStorage(recoveryKey, null);
    if (!rec || !Number.isFinite(rec.at) || Date.now() - rec.at > (2 * 60 * 60 * 1000)) return;
    if ((window.scrollY || 0) > 40) return;

    var bar = document.createElement("div");
    bar.id = "cltchSessionRecovery";
    bar.className = "cltch-toast visible";
    bar.style.bottom = "calc(72px + var(--cltch-safe-bottom))";
    bar.style.pointerEvents = "auto";
    bar.innerHTML = 'Restore last session state?<button type="button" class="cltch-exp-chip" id="cltchRestoreSessionBtn" style="margin-left:8px;">Restore</button>';
    document.body.appendChild(bar);
    document.getElementById("cltchRestoreSessionBtn").addEventListener("click", function () {
      window.scrollTo({ top: Number(rec.y) || 0, behavior: "smooth" });
      var search = document.querySelector('input[type="search"]');
      if (search && rec.search) {
        search.value = rec.search;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      bar.remove();
    });
    window.setTimeout(function () { bar.remove(); }, 8000);
  }

  function initGuidedEmptyStatesAndExport() {
    var gigList = document.getElementById("gigList");
    if (gigList) {
      var applyEmptyActions = function () {
        gigList.querySelectorAll(".empty, .queue-empty, .empty-sm").forEach(function (empty) {
          if (empty.querySelector("[data-empty-action]")) return;
          var row = document.createElement("div");
          row.className = "cltch-exp-row";
          row.style.marginTop = "8px";
          var actions = [
            { label: "Complete Profile", href: "musician-profile.html" },
            { label: "Open Support", href: "support.html" }
          ];
          if (pageName() === "host.html") actions[0] = { label: "Post First Gig", href: "#gigForm" };
          actions.forEach(function (action) {
            var a = document.createElement("a");
            a.setAttribute("data-empty-action", "true");
            a.className = "cltch-exp-chip";
            a.href = action.href;
            a.textContent = action.label;
            row.appendChild(a);
          });
          empty.appendChild(row);
        });
      };
      applyEmptyActions();
      new MutationObserver(applyEmptyActions).observe(gigList, { childList: true, subtree: true });
    }

    if (document.getElementById("cltchExportAnalytics")) return;
    var hostStats = document.getElementById("hostStatOpen");
    var perfStats = document.getElementById("metricLiveMatches");
    if (!hostStats && !perfStats) return;
    var mount = hostStats ? document.querySelector(".ops-panel") : document.getElementById("analyticsPanel");
    if (!mount) return;
    var wrap = document.createElement("div");
    wrap.className = "cltch-exp-row";
    wrap.style.marginTop = "10px";
    wrap.id = "cltchExportAnalytics";
    wrap.innerHTML = '<button type="button" class="cltch-exp-chip" id="cltchExportCsvBtn">Export Analytics CSV</button>';
    mount.appendChild(wrap);
    document.getElementById("cltchExportCsvBtn").addEventListener("click", function () {
      var rows = [["metric", "value", "timestamp"]];
      if (hostStats) {
        [
          ["open", document.getElementById("hostStatOpen")?.textContent || "0"],
          ["accepted", document.getElementById("hostStatAccepted")?.textContent || "0"],
          ["pending_review", document.getElementById("hostStatPendingReview")?.textContent || "0"],
          ["cancelled", document.getElementById("hostStatCancelled")?.textContent || "0"],
          ["this_week", document.getElementById("hostStatThisWeek")?.textContent || "0"],
          ["avg_pay", document.getElementById("hostStatAvgPay")?.textContent || "$0"]
        ].forEach(function (entry) { rows.push([entry[0], entry[1], new Date().toISOString()]); });
      } else {
        [
          ["live_matches", document.getElementById("metricLiveMatches")?.textContent || "0"],
          ["avg_match", document.getElementById("metricAvgMatch")?.textContent || "0%"],
          ["acceptance_rate", document.getElementById("metricAcceptanceRate")?.textContent || "0%"],
          ["accepted_count", document.getElementById("metricAcceptedCount")?.textContent || "0"],
          ["passed_count", document.getElementById("metricPassedCount")?.textContent || "0"],
          ["upcoming_earnings", document.getElementById("metricUpcomingEarnings")?.textContent || "$0"]
        ].forEach(function (entry) { rows.push([entry[0], entry[1], new Date().toISOString()]); });
      }
      downloadCsv("cltch-analytics-" + pageName().replace(".html", "") + ".csv", rows);
    });
  }

  function inferRoleFromPage() {
    var page = pageName();
    if (/^host/.test(page)) return "host";
    if (/^(gig-radar|musician|performer-view)/.test(page)) return "performer";
    if (/^booking/.test(page)) return "booking";
    return "general";
  }

  function readInbox() {
    var key = "cltch_notification_center_v1";
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    return data;
  }

  function writeInbox(data) {
    writeJsonStorage("cltch_notification_center_v1", data);
  }

  function pushInboxItem(item) {
    if (!item) return;
    var data = readInbox();
    data.items.unshift({
      role: item.role || inferRoleFromPage(),
      level: item.level || "info",
      title: String(item.title || "Update"),
      body: String(item.body || ""),
      at: Date.now()
    });
    data.items = data.items.slice(0, 60);
    writeInbox(data);
  }

  function initNotificationCenter() {
    if (document.getElementById("cltchNotificationCenter")) return;
    var main = markMainContent();
    if (!main) return;
    var role = inferRoleFromPage();
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchNotificationCenter";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Notification Center</div><button type="button" id="cltchInboxClear" class="cltch-exp-chip">Clear</button></div>' +
      '<div class="cltch-inbox" id="cltchInboxList"></div>';
    main.insertBefore(card, main.firstChild);

    function render() {
      var data = readInbox();
      var list = card.querySelector("#cltchInboxList");
      var items = data.items.filter(function (it) {
        return it.role === role || it.role === "general";
      }).slice(0, 8);
      if (!items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No new notifications.</div>';
        return;
      }
      list.innerHTML = items.map(function (it) {
        var when = new Date(it.at).toLocaleTimeString();
        var level = it.level === "warn" ? "warn" : "ok";
        return '<div class="cltch-inbox-item"><div class="cltch-inbox-top"><strong style="font-size:12px;">' + escapeHtml(it.title) + '</strong><span class="cltch-pill ' + level + '">' + escapeHtml(it.level) + "</span></div><div class=\"cltch-exp-note\">" + escapeHtml(it.body) + "</div><div class=\"cltch-exp-note\">" + when + "</div></div>";
      }).join("");
    }
    render();
    card.querySelector("#cltchInboxClear").addEventListener("click", function () {
      var data = readInbox();
      data.items = data.items.filter(function (it) { return it.role !== role; });
      writeInbox(data);
      render();
    });
  }

  function initWaitlistAutofillAndRepricing() {
    if (pageName() !== "host.html" || document.getElementById("cltchHostOps2")) return;
    var mount = document.querySelector(".ops-panel");
    var list = document.getElementById("gigList");
    if (!mount || !list) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchHostOps2";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Waitlist + Smart Repricing</div></div>' +
      '<div class="cltch-exp-note" id="cltchWaitlistNote">Scanning queue…</div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;"><button type="button" id="cltchInviteNextBtn" class="cltch-exp-chip">Generate Waitlist Invite</button><button type="button" id="cltchRepriceBtn" class="cltch-exp-chip">Apply Repricing Hint</button></div>';
    mount.insertAdjacentElement("afterend", card);

    function evaluate() {
      var open = Number(document.getElementById("hostStatOpen")?.textContent || 0);
      var accepted = Number(document.getElementById("hostStatAccepted")?.textContent || 0);
      var avgPay = parseUsdFromText(document.getElementById("hostStatAvgPay")?.textContent || "$0");
      var note = card.querySelector("#cltchWaitlistNote");
      if (open > 0 && accepted === 0) {
        note.textContent = "Low conversion detected. Consider +10% pay for faster fill.";
      } else if (accepted > 0) {
        note.textContent = "Queue healthy. Keep pay near current average " + avgPay.toFixed(0) + ".";
      } else {
        note.textContent = "Post your first gig to build waitlist and pricing signals.";
      }
    }
    evaluate();
    new MutationObserver(evaluate).observe(list, { childList: true, subtree: true });

    card.querySelector("#cltchInviteNextBtn").addEventListener("click", function () {
      var message = "CLTCH waitlist invite: your profile fits a newly reopened host opportunity. Reply in-app to secure the slot.";
      navigator.clipboard?.writeText(message).then(function () {
        pushInboxItem({ role: "host", level: "ok", title: "Waitlist invite draft ready", body: "Invite copied to clipboard." });
        showDexterityToast("Waitlist invite copied", 1500);
      }).catch(function () {});
    });

    card.querySelector("#cltchRepriceBtn").addEventListener("click", function () {
      var pay = document.getElementById("pay");
      if (!pay) return;
      var current = parseUsdFromText(pay.value);
      if (!current) return;
      var next = Math.round(current * 1.1);
      pay.value = "$" + next + " flat";
      pay.dispatchEvent(new Event("input", { bubbles: true }));
      pushInboxItem({ role: "host", level: "ok", title: "Repricing suggestion applied", body: "Pay updated to $" + next + " for faster fill." });
    });
  }

  function initDisputeAndIdentityBadges() {
    var bookingPage = pageName() === "booking.html";
    var nav = document.querySelector("header nav");
    if (nav && !document.getElementById("cltchIdentityBadge")) {
      var badge = document.createElement("span");
      badge.id = "cltchIdentityBadge";
      badge.className = "cltch-pill ok";
      badge.textContent = "Identity: Standard";
      nav.appendChild(badge);
      var text = document.body.textContent || "";
      if (/verified|business class|reviewed/i.test(text)) badge.textContent = "Identity: Verified";
    }
    if (!bookingPage || document.getElementById("cltchDisputeCard")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchDisputeCard";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Dispute Workflow</div></div>' +
      '<div class="cltch-exp-row"><select id="cltchDisputeType" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="payment">Payment</option><option value="conduct">Conduct</option><option value="scope">Scope mismatch</option></select><input id="cltchDisputeNote" type="text" maxlength="140" placeholder="Dispute summary" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><button type="button" id="cltchDisputeSubmit" class="cltch-exp-chip">Submit</button></div>' +
      '<div class="cltch-doc-list" id="cltchDisputeList"></div>';
    main.appendChild(card);
    var key = "cltch_disputes_v1:" + (new URL(window.location.href).searchParams.get("id") || "default");
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    function render() {
      var list = card.querySelector("#cltchDisputeList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No disputes filed.</div>';
        return;
      }
      list.innerHTML = data.items.map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.type) + ": " + escapeHtml(it.note) + '</span><span class="cltch-pill warn">Open</span></div>';
      }).join("");
    }
    card.querySelector("#cltchDisputeSubmit").addEventListener("click", function () {
      var type = card.querySelector("#cltchDisputeType").value;
      var note = String(card.querySelector("#cltchDisputeNote").value || "").trim();
      if (!note) return;
      data.items.unshift({ type: type, note: note, at: Date.now() });
      data.items = data.items.slice(0, 20);
      writeJsonStorage(key, data);
      card.querySelector("#cltchDisputeNote").value = "";
      render();
      pushInboxItem({ role: "booking", level: "warn", title: "Dispute submitted", body: type + " issue filed for booking review." });
    });
    render();
  }

  function initPortfolioAndVenueQuality() {
    var page = pageName();
    if ((page === "musician-profile.html" || page === "performer-view.html") && !document.getElementById("cltchPortfolioCard")) {
      var mount = document.getElementById("profileForm") || document.querySelector("main.container");
      if (mount) {
        var card = document.createElement("section");
        card.className = "cltch-exp-card";
        card.id = "cltchPortfolioCard";
        card.innerHTML =
          '<div class="cltch-exp-head"><div class="cltch-exp-title">Portfolio Highlights</div></div>' +
          '<div class="cltch-exp-row"><input id="cltchPortfolioUrl" type="url" placeholder="https://portfolio-item" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><button type="button" id="cltchPortfolioAdd" class="cltch-exp-chip">Add</button></div>' +
          '<div class="cltch-carousel" id="cltchPortfolioCarousel"></div>';
        mount.insertAdjacentElement("beforebegin", card);
        var key = "cltch_portfolio_highlights_v1";
        var data = readJsonStorage(key, { items: [] });
        if (!Array.isArray(data.items)) data.items = [];
        function render() {
          var el = card.querySelector("#cltchPortfolioCarousel");
          if (!data.items.length) {
            el.innerHTML = '<div class="cltch-carousel-item">Add highlights to showcase your best work.</div>';
            return;
          }
          el.innerHTML = data.items.map(function (url, idx) {
            return '<a class="cltch-carousel-item" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Highlight ' + (idx + 1) + "</a>";
          }).join("");
        }
        card.querySelector("#cltchPortfolioAdd").addEventListener("click", function () {
          var url = String(card.querySelector("#cltchPortfolioUrl").value || "").trim();
          if (!/^https?:\/\/\S+$/i.test(url)) return;
          data.items.unshift(url);
          data.items = data.items.slice(0, 6);
          writeJsonStorage(key, data);
          card.querySelector("#cltchPortfolioUrl").value = "";
          render();
        });
        render();
      }
    }

    if (page === "host-profile.html" && !document.getElementById("cltchVenueQuality")) {
      var form = document.getElementById("profileForm");
      if (!form) return;
      var quality = document.createElement("section");
      quality.className = "cltch-exp-card";
      quality.id = "cltchVenueQuality";
      quality.innerHTML =
        '<div class="cltch-exp-head"><div class="cltch-exp-title">Venue Quality Score</div></div>' +
        '<div class="cltch-mini-grid">' +
          '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchVenueScore">0%</div><div class="cltch-metric-label">Readiness</div></div>' +
          '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchVenueTrust">Low</div><div class="cltch-metric-label">Trust</div></div>' +
          '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchVenueFix">—</div><div class="cltch-metric-label">Next fix</div></div>' +
        '</div>';
      form.insertAdjacentElement("beforebegin", quality);
      function update() {
        var fields = ["venueName", "city", "state", "zipCode", "website", "payMethod"];
        var done = 0;
        var missing = [];
        fields.forEach(function (id) {
          var el = document.getElementById(id);
          var ok = !!(el && String(el.value || "").trim());
          if (ok) done += 1;
          else missing.push(id);
        });
        var score = Math.round((done / fields.length) * 100);
        document.getElementById("cltchVenueScore").textContent = score + "%";
        document.getElementById("cltchVenueTrust").textContent = score >= 80 ? "High" : (score >= 50 ? "Medium" : "Low");
        document.getElementById("cltchVenueFix").textContent = missing[0] || "Complete";
      }
      form.addEventListener("input", update);
      form.addEventListener("change", update);
      update();
    }
  }

  function initBookingReadinessAndReminders() {
    if (pageName() !== "booking.html" || document.getElementById("cltchBookingReady")) return;
    var main = document.querySelector("main.container");
    var when = document.getElementById("whenValue");
    if (!main || !when) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchBookingReady";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Booking Readiness + Reminders</div></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchReadyPct">0%</div><div class="cltch-metric-label">Readiness</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchReadySla">—</div><div class="cltch-metric-label">SLA</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchReminderSet">No</div><div class="cltch-metric-label">Reminders</div></div>' +
      '</div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;"><button type="button" id="cltchSetReminders" class="cltch-exp-chip">Set Reminder Cadence</button></div>' +
      '<div class="cltch-exp-note" id="cltchReadyNote" style="margin-top:8px;">Checking booking preparation.</div>';
    main.appendChild(card);

    function computeSlaDays() {
      var date = extractIsoDate(when.textContent || "");
      if (!date) return 999;
      return Math.round((new Date(date) - new Date()) / 86400000);
    }

    function update() {
      var checks = [
        !!String(document.getElementById("venueValue")?.textContent || "").trim(),
        !!String(document.getElementById("hostValue")?.textContent || "").trim(),
        !!String(document.getElementById("performerValue")?.textContent || "").trim(),
        !!String(document.getElementById("payValue")?.textContent || "").trim(),
        !!String(document.getElementById("statusValue")?.textContent || "").trim()
      ];
      var score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      var days = computeSlaDays();
      document.getElementById("cltchReadyPct").textContent = score + "%";
      document.getElementById("cltchReadySla").textContent = days <= 1 ? "Immediate" : (days <= 3 ? days + "d fast" : days + "d");
      document.getElementById("cltchReadyNote").textContent = score >= 80 ? "Booking readiness is strong." : "Add missing booking details to reduce day-of risk.";
    }
    update();
    new MutationObserver(update).observe(main, { childList: true, subtree: true });

    card.querySelector("#cltchSetReminders").addEventListener("click", function () {
      var reminderKey = "cltch_reminders_v1:" + (new URL(window.location.href).searchParams.get("id") || "default");
      writeJsonStorage(reminderKey, { setAt: Date.now(), cadence: ["24h", "2h", "check-in", "post-gig"] });
      document.getElementById("cltchReminderSet").textContent = "Yes";
      pushInboxItem({ role: "booking", level: "ok", title: "Reminder cadence scheduled", body: "24h / 2h / check-in / post-gig reminders configured." });
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(function () {});
    });
  }

  function initFavoritesAndBatchPosting() {
    var page = pageName();
    if (!document.getElementById("cltchFavoritesCard")) {
      var main = markMainContent();
      if (main) {
        var card = document.createElement("section");
        card.className = "cltch-exp-card";
        card.id = "cltchFavoritesCard";
        card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Favorites</div></div><div class="cltch-doc-list" id="cltchFavoritesList"></div>';
        main.appendChild(card);
        var key = "cltch_favorites_v1";
        var data = readJsonStorage(key, { items: [] });
        if (!Array.isArray(data.items)) data.items = [];
        function render() {
          var list = card.querySelector("#cltchFavoritesList");
          if (!data.items.length) {
            list.innerHTML = '<div class="cltch-exp-note">No favorites saved yet.</div>';
            return;
          }
          list.innerHTML = data.items.map(function (it, idx) {
            return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.label) + '</span><button type="button" class="cltch-exp-chip" data-fav-remove="' + idx + '">Remove</button></div>';
          }).join("");
          list.querySelectorAll("[data-fav-remove]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var idx = Number(btn.getAttribute("data-fav-remove"));
              if (!Number.isFinite(idx)) return;
              data.items.splice(idx, 1);
              writeJsonStorage(key, data);
              render();
            });
          });
        }
        render();
        document.addEventListener("click", function (event) {
          var link = event.target && event.target.closest ? event.target.closest("a[href*='performer-view'], a[href*='booking.html'], .venue") : null;
          if (!link) return;
          var label = String(link.textContent || "").trim();
          if (!label || data.items.some(function (it) { return it.label === label; })) return;
          data.items.unshift({ label: label, at: Date.now() });
          data.items = data.items.slice(0, 30);
          writeJsonStorage(key, data);
          render();
        }, true);
      }
    }

    if (page === "host.html" && !document.getElementById("cltchBatchPosting")) {
      var form = document.getElementById("gigForm");
      if (!form) return;
      var batch = document.createElement("section");
      batch.className = "cltch-exp-card";
      batch.id = "cltchBatchPosting";
      batch.innerHTML =
        '<div class="cltch-exp-head"><div class="cltch-exp-title">Multi-Event Batch Planner</div></div>' +
        '<div class="cltch-exp-row"><input id="cltchBatchCount" type="number" min="1" max="12" value="4" style="min-height:36px;width:90px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><select id="cltchBatchCadence" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="7">Weekly</option><option value="14">Biweekly</option><option value="30">Monthly</option></select><button type="button" id="cltchBatchGenerate" class="cltch-exp-chip">Generate Plan</button></div>' +
        '<div class="cltch-doc-list" id="cltchBatchList"></div>';
      form.parentNode.insertBefore(batch, form);
      batch.querySelector("#cltchBatchGenerate").addEventListener("click", function () {
        var dateInput = document.getElementById("date");
        var start = dateInput?.value;
        if (!start) {
          showDexterityToast("Pick a base date first", 1400);
          return;
        }
        var count = Math.min(12, Math.max(1, Number(batch.querySelector("#cltchBatchCount").value || 4)));
        var step = Number(batch.querySelector("#cltchBatchCadence").value || 7);
        var startDate = new Date(start);
        var items = [];
        for (var i = 0; i < count; i += 1) {
          var d = new Date(startDate);
          d.setDate(d.getDate() + (i * step));
          items.push(d.toISOString().slice(0, 10));
        }
        batch.querySelector("#cltchBatchList").innerHTML = items.map(function (d, idx) {
          return '<div class="cltch-doc-item"><span style="font-size:12px;">Event ' + (idx + 1) + ": " + d + '</span></div>';
        }).join("");
        pushInboxItem({ role: "host", level: "ok", title: "Batch schedule generated", body: count + " planned dates created." });
      });
    }
  }

  function initAvailabilityImportAndFacets() {
    var page = pageName();
    if (page === "musician-profile.html" && !document.getElementById("cltchAvailabilityImport")) {
      var form = document.getElementById("profileForm");
      if (form) {
        var importCard = document.createElement("section");
        importCard.className = "cltch-exp-card";
        importCard.id = "cltchAvailabilityImport";
        importCard.innerHTML =
          '<div class="cltch-exp-head"><div class="cltch-exp-title">Availability Import</div></div>' +
          '<textarea id="cltchAvailInput" placeholder="Paste YYYY-MM-DD dates, one per line." style="width:100%;min-height:90px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);padding:10px;"></textarea>' +
          '<div class="cltch-exp-row" style="margin-top:8px;"><button type="button" id="cltchAvailImportBtn" class="cltch-exp-chip">Import Blackout Dates</button></div>' +
          '<div class="cltch-exp-note" id="cltchAvailImportNote" style="margin-top:8px;">No import yet.</div>';
        form.insertAdjacentElement("beforebegin", importCard);
        importCard.querySelector("#cltchAvailImportBtn").addEventListener("click", function () {
          var lines = String(importCard.querySelector("#cltchAvailInput").value || "").split(/\r?\n/);
          var valid = lines.map(function (x) { return x.trim(); }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); });
          writeJsonStorage("cltch_availability_import_v1", { dates: valid.slice(0, 120), at: Date.now() });
          importCard.querySelector("#cltchAvailImportNote").textContent = "Imported " + valid.length + " blackout dates (MVP local store).";
        });
      }
    }

    var searchInput = document.getElementById("gigSearchInput");
    var gigList = document.getElementById("gigList");
    if (searchInput && gigList && !document.getElementById("cltchAdvancedFacets")) {
      var wrap = document.createElement("section");
      wrap.className = "cltch-exp-card";
      wrap.id = "cltchAdvancedFacets";
      wrap.innerHTML =
        '<div class="cltch-exp-head"><div class="cltch-exp-title">Advanced Facets</div></div>' +
        '<div class="cltch-exp-row"><input id="cltchMinPayFacet" type="number" min="0" placeholder="Min pay" style="min-height:36px;width:120px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><select id="cltchDateFacet" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="all">Any date</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option></select><button type="button" id="cltchApplyFacets" class="cltch-exp-chip">Apply</button></div>';
      var anchor = document.getElementById("cltchSavedSearchCard") || document.getElementById("queueControlsBar");
      anchor?.insertAdjacentElement("afterend", wrap);
      wrap.querySelector("#cltchApplyFacets").addEventListener("click", function () {
        var minPay = Number(wrap.querySelector("#cltchMinPayFacet").value || 0);
        var days = wrap.querySelector("#cltchDateFacet").value;
        gigList.querySelectorAll(".gig-card").forEach(function (card) {
          var text = card.textContent || "";
          var pay = parseUsdFromText(text);
          var date = extractIsoDate(text);
          var visible = pay >= minPay;
          if (visible && days !== "all" && date) {
            var diff = Math.round((new Date(date) - new Date()) / 86400000);
            visible = diff >= 0 && diff <= Number(days);
          }
          card.style.display = visible ? "" : "none";
        });
      });
    }
  }

  function initAdminTuningAndFraudSignals() {
    var isAdmin = new URL(window.location.href).searchParams.get("admin") === "1";
    if (isAdmin && !document.getElementById("cltchTuningPanel")) {
      var main = markMainContent();
      if (main) {
        var panel = document.createElement("section");
        panel.className = "cltch-exp-card";
        panel.id = "cltchTuningPanel";
        panel.innerHTML =
          '<div class="cltch-exp-head"><div class="cltch-exp-title">A/B Match Tuning (Admin)</div></div>' +
          '<div class="cltch-exp-row"><label class="cltch-exp-note">Min match % <input id="cltchTuneMinMatch" type="range" min="60" max="95" value="78"></label><span id="cltchTuneMinMatchVal" class="cltch-exp-chip">78</span></div>' +
          '<div class="cltch-exp-row"><button type="button" id="cltchTuneSave" class="cltch-exp-chip">Save Variant</button></div>';
        main.insertBefore(panel, main.firstChild);
        var slider = panel.querySelector("#cltchTuneMinMatch");
        var out = panel.querySelector("#cltchTuneMinMatchVal");
        slider.addEventListener("input", function () { out.textContent = String(slider.value); });
        panel.querySelector("#cltchTuneSave").addEventListener("click", function () {
          writeJsonStorage("cltch_ab_tuning_v1", { minMatch: Number(slider.value), at: Date.now() });
          pushInboxItem({ role: "general", level: "ok", title: "A/B variant saved", body: "Min match set to " + slider.value + "%." });
        });
      }
    }

    if (document.getElementById("cltchFraudWatch")) return;
    var inputs = Array.prototype.slice.call(document.querySelectorAll("textarea, input[type='text']"));
    if (!inputs.length) return;
    var watch = document.createElement("div");
    watch.id = "cltchFraudWatch";
    watch.className = "cltch-toast";
    document.body.appendChild(watch);
    var risky = /(wire|cashapp|zelle|crypto|gift card|password|login link|telegram|whatsapp|off-platform)/i;
    inputs.forEach(function (el) {
      el.addEventListener("input", function () {
        var text = String(el.value || "");
        if (!risky.test(text)) return;
        watch.textContent = "Anomaly warning: possible risky payment/account language detected.";
        watch.classList.add("visible");
        pushInboxItem({ role: inferRoleFromPage(), level: "warn", title: "Fraud signal detected", body: "Review message content before sharing details." });
        window.setTimeout(function () { watch.classList.remove("visible"); }, 2400);
      });
    });
  }

  function initLocalizationLayer() {
    if (document.getElementById("cltchLocaleCard")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_locale_prefs_v1";
    var prefs = readJsonStorage(key, {
      locale: navigator.language || "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchLocaleCard";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Localization</div></div>' +
      '<div class="cltch-exp-row"><input id="cltchLocaleInput" type="text" value="' + escapeHtml(prefs.locale) + '" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><input id="cltchTzInput" type="text" value="' + escapeHtml(prefs.timezone) + '" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><button type="button" id="cltchLocaleSave" class="cltch-exp-chip">Apply</button></div>' +
      '<div class="cltch-exp-note" id="cltchLocalePreview" style="margin-top:8px;"></div>';
    main.appendChild(card);
    function updatePreview() {
      var now = new Date();
      var locale = card.querySelector("#cltchLocaleInput").value || "en-US";
      var tz = card.querySelector("#cltchTzInput").value || "UTC";
      try {
        var stamp = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(now);
        card.querySelector("#cltchLocalePreview").textContent = "Preview: " + stamp;
      } catch (error) {
        card.querySelector("#cltchLocalePreview").textContent = "Invalid locale/timezone format.";
      }
    }
    updatePreview();
    card.querySelector("#cltchLocaleSave").addEventListener("click", function () {
      var locale = card.querySelector("#cltchLocaleInput").value || "en-US";
      var tz = card.querySelector("#cltchTzInput").value || "UTC";
      writeJsonStorage(key, { locale: locale, timezone: tz, at: Date.now() });
      document.documentElement.setAttribute("lang", locale.split("-")[0] || "en");
      updatePreview();
      pushInboxItem({ role: "general", level: "ok", title: "Localization updated", body: locale + " / " + tz });
    });
  }

  function initReputationReliabilityGraph() {
    var page = pageName();
    var performerPage = /^(gig-radar|musician-dashboard|musician-matched-gigs)\.html$/.test(page);
    var hostPage = page === "host.html";
    if (!performerPage && !hostPage) return;
    if (document.getElementById("cltchReputationGraph")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchReputationGraph";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Reputation + Reliability</div></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchRelScore">0</div><div class="cltch-metric-label">Reliability</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchResponseScore">0m</div><div class="cltch-metric-label">Response Time</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchNoShowScore">0%</div><div class="cltch-metric-label">No-show Risk</div></div>' +
      '</div>' +
      '<div class="cltch-bar-stack" style="margin-top:10px;">' +
        '<div class="cltch-bar-row"><span class="cltch-exp-note">Completed</span><div class="cltch-bar-track"><div id="cltchRepCompleted" class="cltch-bar-fill"></div></div></div>' +
        '<div class="cltch-bar-row"><span class="cltch-exp-note">Late cancel</span><div class="cltch-bar-track"><div id="cltchRepLateCancel" class="cltch-bar-fill warn"></div></div></div>' +
        '<div class="cltch-bar-row"><span class="cltch-exp-note">Host confidence</span><div class="cltch-bar-track"><div id="cltchRepConfidence" class="cltch-bar-fill ok"></div></div></div>' +
      '</div>';
    var anchor = document.getElementById("cltchTrustMetrics") || document.getElementById("analyticsPanel");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function update() {
      var accepted = Number(document.getElementById(hostPage ? "hostStatAccepted" : "metricAcceptedCount")?.textContent || 0);
      var open = Number(document.getElementById(hostPage ? "hostStatOpen" : "metricLiveMatches")?.textContent || 0);
      var cancelled = Number(document.getElementById(hostPage ? "hostStatCancelled" : "metricPassedCount")?.textContent || 0);
      var completed = Math.max(accepted - cancelled, 0);
      var total = Math.max(accepted + open + cancelled, 1);
      var reliability = Math.max(40, Math.min(99, Math.round((completed / total) * 100) + 40));
      var noShowRisk = Math.max(1, Math.min(45, Math.round((cancelled / total) * 100)));
      var responseMins = Math.max(2, 25 - Math.round((accepted / total) * 18));
      var confidence = Math.max(20, Math.min(96, Math.round((accepted / Math.max(1, open + accepted)) * 100)));
      document.getElementById("cltchRelScore").textContent = reliability + "%";
      document.getElementById("cltchResponseScore").textContent = responseMins + "m";
      document.getElementById("cltchNoShowScore").textContent = noShowRisk + "%";
      document.getElementById("cltchRepCompleted").style.width = Math.round((completed / total) * 100) + "%";
      document.getElementById("cltchRepLateCancel").style.width = Math.min(100, noShowRisk * 2) + "%";
      document.getElementById("cltchRepConfidence").style.width = confidence + "%";
      writeJsonStorage("cltch_reputation_snapshot_v2:" + page, {
        reliability: reliability,
        responseMins: responseMins,
        noShowRisk: noShowRisk,
        confidence: confidence,
        at: Date.now()
      });
    }
    update();
    var watch = document.getElementById("gigList") || main;
    new MutationObserver(update).observe(watch, { childList: true, subtree: true, characterData: true });
  }

  function initNegotiationRoomRealtime() {
    if (pageName() !== "booking.html" || document.getElementById("cltchNegotiationRoom")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
    var key = "cltch_nego_room_v2:" + bookingId;
    var data = readJsonStorage(key, { thread: [] });
    if (!Array.isArray(data.thread)) data.thread = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchNegotiationRoom";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Negotiation Room</div><div class="cltch-exp-chip" id="cltchRoomStatus">Live</div></div>' +
      '<div class="cltch-chat" id="cltchNegoThread"></div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;">' +
        '<input id="cltchNegoAmount" type="text" placeholder="Offer amount" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchNegoMessage" type="text" maxlength="140" placeholder="Message" style="min-height:36px;flex:1;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
      '</div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;">' +
        '<select id="cltchNegoExpiry" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="2">2h expiry</option><option value="6">6h expiry</option><option value="24">24h expiry</option></select>' +
        '<button type="button" id="cltchNegoSend" class="cltch-exp-chip">Send Counter</button>' +
        '<button type="button" id="cltchNegoAccept" class="cltch-exp-chip">Accept Latest</button>' +
      '</div>';
    var anchor = document.getElementById("cltchBookingOpsExt") || document.getElementById("cltchBookingTools");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function render() {
      var thread = card.querySelector("#cltchNegoThread");
      if (!data.thread.length) {
        thread.innerHTML = '<div class="cltch-exp-note">No offers yet. Start with a counter offer.</div>';
        return;
      }
      thread.innerHTML = data.thread.slice(0, 20).map(function (item) {
        var expireAt = item.expireAt || 0;
        var expired = expireAt && Date.now() > expireAt;
        var state = expired ? "Expired" : (item.state || "Open");
        return '<div class="cltch-chat-item">' +
          '<div class="cltch-chat-top"><strong style="font-size:12px;">' + escapeHtml(item.amount || "Offer") + '</strong><span class="cltch-pill ' + (expired ? "warn" : "ok") + '">' + state + "</span></div>" +
          '<div class="cltch-exp-note">' + escapeHtml(item.message || "") + "</div>" +
          '<div class="cltch-exp-note">' + new Date(item.at).toLocaleString() + "</div>" +
          "</div>";
      }).join("");
    }

    function save() {
      writeJsonStorage(key, data);
      render();
    }

    card.querySelector("#cltchNegoSend").addEventListener("click", function () {
      var amount = String(card.querySelector("#cltchNegoAmount").value || "").trim();
      var message = String(card.querySelector("#cltchNegoMessage").value || "").trim();
      var hours = Number(card.querySelector("#cltchNegoExpiry").value || 2);
      if (!amount && !message) return;
      data.thread.unshift({
        amount: amount || "Counter",
        message: message || "Counter update",
        at: Date.now(),
        expireAt: Date.now() + (hours * 3600000),
        state: "Open"
      });
      data.thread = data.thread.slice(0, 30);
      card.querySelector("#cltchNegoAmount").value = "";
      card.querySelector("#cltchNegoMessage").value = "";
      save();
      pushInboxItem({ role: "booking", level: "ok", title: "Counter offer sent", body: "Negotiation room updated." });
    });

    card.querySelector("#cltchNegoAccept").addEventListener("click", function () {
      if (!data.thread.length) return;
      data.thread[0].state = "Accepted";
      save();
      showDexterityToast("Latest offer accepted", 1400);
    });

    window.addEventListener("storage", function (event) {
      if (event.key !== key) return;
      data = readJsonStorage(key, { thread: [] });
      if (!Array.isArray(data.thread)) data.thread = [];
      render();
    });

    window.setInterval(render, 60000);
    render();
  }

  function initSmartMatchingEngineV2() {
    if (!/^(gig-radar|musician-dashboard|musician-matched-gigs)\.html$/.test(pageName()) || document.getElementById("cltchMatchV2")) return;
    var gigList = document.getElementById("gigList");
    if (!gigList) return;
    var controls = document.createElement("section");
    controls.className = "cltch-exp-card";
    controls.id = "cltchMatchV2";
    controls.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Smart Matching Engine V2</div><button type="button" id="cltchApplyMatchV2" class="cltch-exp-chip">Re-rank</button></div>' +
      '<div class="cltch-exp-row">' +
        '<label class="cltch-exp-note">Style <input id="cltchWStyle" type="range" min="1" max="5" value="4"></label>' +
        '<label class="cltch-exp-note">Distance <input id="cltchWDistance" type="range" min="1" max="5" value="3"></label>' +
        '<label class="cltch-exp-note">Budget <input id="cltchWBudget" type="range" min="1" max="5" value="5"></label>' +
      '</div>' +
      '<div class="cltch-exp-row">' +
        '<label class="cltch-exp-note">Venue quality <input id="cltchWVenue" type="range" min="1" max="5" value="3"></label>' +
        '<label class="cltch-exp-note">Past success <input id="cltchWCollab" type="range" min="1" max="5" value="2"></label>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchWhyMatchV2">Click a gig card to view why it ranked that way.</div>';
    var anchor = document.getElementById("cltchAdvancedFacets") || document.getElementById("queueControlsBar");
    if (anchor) anchor.insertAdjacentElement("afterend", controls);
    else gigList.insertAdjacentElement("beforebegin", controls);

    function scoreCard(card, w) {
      var text = (card.textContent || "").toLowerCase();
      var pay = parseUsdFromText(text);
      var matchPct = Number((text.match(/(\d+)\s*%/) || [])[1] || 70);
      var style = /jazz|dj|acoustic|r&b|hip hop|pop|latin/.test(text) ? 85 : 60;
      var distance = /mi|miles|near|local/.test(text) ? 75 : 55;
      var budget = Math.max(40, Math.min(98, Math.round((pay / 20) || 50)));
      var venue = /festival|hotel|club|wedding|corporate/.test(text) ? 80 : 58;
      var collab = /repeat|rebook|returning|favorite/.test(text) ? 90 : 52;
      var weighted = (
        (style * w.style) +
        (distance * w.distance) +
        (budget * w.budget) +
        (venue * w.venue) +
        (collab * w.collab) +
        (matchPct * 2)
      ) / (w.style + w.distance + w.budget + w.venue + w.collab + 2);
      return {
        score: Math.round(weighted),
        reasons: [
          "Style fit " + style + "%",
          "Distance fit " + distance + "%",
          "Budget fit " + budget + "%",
          "Venue signal " + venue + "%",
          "Collab signal " + collab + "%"
        ]
      };
    }

    function rerank() {
      var w = {
        style: Number(controls.querySelector("#cltchWStyle").value || 4),
        distance: Number(controls.querySelector("#cltchWDistance").value || 3),
        budget: Number(controls.querySelector("#cltchWBudget").value || 5),
        venue: Number(controls.querySelector("#cltchWVenue").value || 3),
        collab: Number(controls.querySelector("#cltchWCollab").value || 2)
      };
      var cards = Array.prototype.slice.call(gigList.querySelectorAll(".gig-card"));
      var ranked = cards.map(function (card) {
        var s = scoreCard(card, w);
        card.dataset.matchV2Score = String(s.score);
        card.dataset.matchV2Reason = s.reasons.join(" | ");
        return { card: card, score: s.score };
      });
      ranked.sort(function (a, b) { return b.score - a.score; });
      ranked.forEach(function (entry) { gigList.appendChild(entry.card); });
      controls.querySelector("#cltchWhyMatchV2").textContent = "Re-ranked " + ranked.length + " gigs using V2 weights.";
      writeJsonStorage("cltch_match_weights_v2", { w: w, at: Date.now() });
    }

    controls.querySelector("#cltchApplyMatchV2").addEventListener("click", rerank);
    gigList.addEventListener("click", function (event) {
      var card = event.target && event.target.closest ? event.target.closest(".gig-card") : null;
      if (!card) return;
      var score = Number(card.dataset.matchV2Score || 0);
      var reasons = card.dataset.matchV2Reason || "Run re-rank for detailed explanation.";
      controls.querySelector("#cltchWhyMatchV2").textContent = "Why this match (" + score + "%): " + reasons;
    });

    var saved = readJsonStorage("cltch_match_weights_v2", null);
    if (saved && saved.w) {
      controls.querySelector("#cltchWStyle").value = String(saved.w.style || 4);
      controls.querySelector("#cltchWDistance").value = String(saved.w.distance || 3);
      controls.querySelector("#cltchWBudget").value = String(saved.w.budget || 5);
      controls.querySelector("#cltchWVenue").value = String(saved.w.venue || 3);
      controls.querySelector("#cltchWCollab").value = String(saved.w.collab || 2);
    }
    rerank();
  }

  function initEarningsAndTaxCenter() {
    var page = pageName();
    if (!/^(gig-radar|musician-dashboard|musician-matched-gigs|host\.html)$/.test(page) || document.getElementById("cltchEarningsTaxCenter")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchEarningsTaxCenter";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Earnings + Tax Center</div><button type="button" id="cltchTaxExport" class="cltch-exp-chip">Export Tax CSV</button></div>' +
      '<div class="cltch-exp-row">' +
        '<label class="cltch-exp-note">Tax rate % <input id="cltchTaxRateInput" type="number" min="0" max="55" value="24" style="width:70px;min-height:34px;padding:0 6px;border-radius:8px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></label>' +
        '<label class="cltch-exp-note">Fee % <input id="cltchFeeRateInput" type="number" min="0" max="25" value="8" style="width:70px;min-height:34px;padding:0 6px;border-radius:8px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></label>' +
        '<button type="button" id="cltchTaxRecalc" class="cltch-exp-chip">Recalc</button>' +
      '</div>' +
      '<div class="cltch-mini-grid" style="margin-top:8px;">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchGrossForecast">$0</div><div class="cltch-metric-label">Gross</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchNetForecast">$0</div><div class="cltch-metric-label">Net</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchTaxReserve">$0</div><div class="cltch-metric-label">Tax reserve</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchEarningsNote" style="margin-top:8px;">Forecast updates from your live queue stats.</div>';
    var anchor = document.getElementById("cltchTrustMetrics") || document.getElementById("analyticsPanel");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function estimateGross() {
      var fromStats = parseUsdFromText(document.getElementById("metricUpcomingEarnings")?.textContent || "")
        || parseUsdFromText(document.getElementById("hostStatAvgPay")?.textContent || "");
      var accepted = Number(document.getElementById("metricAcceptedCount")?.textContent || document.getElementById("hostStatAccepted")?.textContent || 1);
      return Math.max(0, Math.round((fromStats || 250) * Math.max(1, accepted)));
    }

    function recalc() {
      var gross = estimateGross();
      var taxRate = Math.max(0, Math.min(55, Number(card.querySelector("#cltchTaxRateInput").value || 24)));
      var feeRate = Math.max(0, Math.min(25, Number(card.querySelector("#cltchFeeRateInput").value || 8)));
      var fees = Math.round(gross * (feeRate / 100));
      var tax = Math.round((gross - fees) * (taxRate / 100));
      var net = Math.max(0, gross - fees - tax);
      document.getElementById("cltchGrossForecast").textContent = "$" + gross.toLocaleString();
      document.getElementById("cltchNetForecast").textContent = "$" + net.toLocaleString();
      document.getElementById("cltchTaxReserve").textContent = "$" + tax.toLocaleString();
      document.getElementById("cltchEarningsNote").textContent = "Assumes " + feeRate + "% platform fees and " + taxRate + "% reserve.";
      writeJsonStorage("cltch_earnings_tax_center_v1", { gross: gross, net: net, tax: tax, feeRate: feeRate, taxRate: taxRate, at: Date.now() });
    }
    card.querySelector("#cltchTaxRecalc").addEventListener("click", recalc);
    card.querySelector("#cltchTaxExport").addEventListener("click", function () {
      var snap = readJsonStorage("cltch_earnings_tax_center_v1", null);
      if (!snap) return;
      downloadCsv("cltch-tax-forecast.csv", [
        ["metric", "value", "timestamp"],
        ["gross", String(snap.gross || 0), new Date().toISOString()],
        ["net", String(snap.net || 0), new Date().toISOString()],
        ["tax_reserve", String(snap.tax || 0), new Date().toISOString()],
        ["tax_rate", String(snap.taxRate || 0), new Date().toISOString()],
        ["fee_rate", String(snap.feeRate || 0), new Date().toISOString()]
      ]);
    });
    recalc();
  }

  function initAvailabilityIntelligence() {
    var page = pageName();
    if (!/^(musician-profile|host|booking)\.html$/.test(page) || document.getElementById("cltchAvailabilityIntel")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchAvailabilityIntel";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Availability Intelligence</div><button type="button" id="cltchAvailabilityScan" class="cltch-exp-chip">Scan Conflicts</button></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchAvailConflicts">0</div><div class="cltch-metric-label">Conflicts</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchAvailHolds">0</div><div class="cltch-metric-label">Holds</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchAvailWindow">-</div><div class="cltch-metric-label">Best window</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchAvailAdvice" style="margin-top:8px;">Run scan to detect cross-booking conflicts.</div>';
    var anchor = document.getElementById("cltchAvailabilityImport") || document.getElementById("profileForm");
    if (anchor) anchor.insertAdjacentElement("beforebegin", card);
    else main.appendChild(card);

    function scan() {
      var blocked = readJsonStorage("cltch_availability_import_v1", { dates: [] });
      var blockedDates = new Set(Array.isArray(blocked.dates) ? blocked.dates : []);
      var conflict = 0;
      var hold = 0;
      document.querySelectorAll("#gigList .gig-card, .booking-card, [data-booking-id]").forEach(function (el) {
        var d = extractIsoDate(el.textContent || "");
        if (!d) return;
        if (blockedDates.has(d)) conflict += 1;
        else hold += 1;
      });
      var dateInput = document.getElementById("date");
      if (dateInput && dateInput.value && blockedDates.has(dateInput.value)) conflict += 1;
      var nextFree = new Date();
      var guard = 0;
      while (blockedDates.has(nextFree.toISOString().slice(0, 10)) && guard < 45) {
        nextFree.setDate(nextFree.getDate() + 1);
        guard += 1;
      }
      document.getElementById("cltchAvailConflicts").textContent = String(conflict);
      document.getElementById("cltchAvailHolds").textContent = String(hold);
      document.getElementById("cltchAvailWindow").textContent = nextFree.toISOString().slice(5, 10);
      document.getElementById("cltchAvailAdvice").textContent = conflict
        ? ("Conflicts detected. Next open slot is " + nextFree.toISOString().slice(0, 10) + ".")
        : "No conflicts detected. Calendar is healthy.";
      writeJsonStorage("cltch_availability_scan_v1", { conflict: conflict, hold: hold, nextFree: nextFree.toISOString().slice(0, 10), at: Date.now() });
    }
    card.querySelector("#cltchAvailabilityScan").addEventListener("click", scan);
    scan();
  }

  function initTeamModeLite() {
    if (pageName() !== "host.html" || document.getElementById("cltchTeamLite")) return;
    var form = document.getElementById("gigForm");
    if (!form) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchTeamLite";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Team Mode Lite</div><span class="cltch-pill ok">Small Venue</span></div>' +
      '<div class="cltch-exp-note">Lightweight manager/assistant placeholders only. No full multi-role workflow yet.</div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;">' +
        '<input id="cltchManagerContact" type="email" placeholder="Manager email (optional)" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchAssistantContact" type="email" placeholder="Assistant email (optional)" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchTeamLiteSave" class="cltch-exp-chip">Save</button>' +
      '</div>';
    form.insertAdjacentElement("beforebegin", card);
    var key = "cltch_team_mode_lite_v1";
    var data = readJsonStorage(key, {});
    card.querySelector("#cltchManagerContact").value = data.manager || "";
    card.querySelector("#cltchAssistantContact").value = data.assistant || "";
    card.querySelector("#cltchTeamLiteSave").addEventListener("click", function () {
      writeJsonStorage(key, {
        manager: String(card.querySelector("#cltchManagerContact").value || "").trim(),
        assistant: String(card.querySelector("#cltchAssistantContact").value || "").trim(),
        at: Date.now()
      });
      showDexterityToast("Team lite contacts saved", 1400);
    });
  }

  function initVenueIntelligenceLayer() {
    var page = pageName();
    if (!/^(host-profile|booking|host)\.html$/.test(page) || document.getElementById("cltchVenueIntel")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchVenueIntel";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Venue Intelligence</div></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchVenuePayReliability">0%</div><div class="cltch-metric-label">Payout reliability</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchVenueCancelRisk">0%</div><div class="cltch-metric-label">Cancel risk</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchVenueRebookRate">0%</div><div class="cltch-metric-label">Rebook rate</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchVenueIntelNote" style="margin-top:8px;">Collecting local venue signals.</div>';
    var anchor = document.getElementById("cltchVenueQuality") || document.getElementById("profileForm") || document.getElementById("cltchBookingReady");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);
    function update() {
      var accepted = Number(document.getElementById("hostStatAccepted")?.textContent || 0);
      var cancelled = Number(document.getElementById("hostStatCancelled")?.textContent || 0);
      var disputes = (readJsonStorage("cltch_disputes_v1:default", { items: [] }).items || []).length;
      var incidents = (readJsonStorage("cltch_incidents_v1:default", []).length || 0);
      var payReliability = Math.max(45, 96 - (disputes * 6) - (incidents * 4));
      var cancelRisk = Math.min(70, Math.round((cancelled / Math.max(1, accepted + cancelled)) * 100) + (disputes * 4));
      var rebookRate = Math.max(10, Math.min(95, Math.round((accepted / Math.max(1, accepted + cancelled)) * 100)));
      document.getElementById("cltchVenuePayReliability").textContent = payReliability + "%";
      document.getElementById("cltchVenueCancelRisk").textContent = cancelRisk + "%";
      document.getElementById("cltchVenueRebookRate").textContent = rebookRate + "%";
      document.getElementById("cltchVenueIntelNote").textContent = cancelRisk > 30
        ? "Risk elevated. Tighten offer terms and confirmation windows."
        : "Venue risk within normal range.";
    }
    update();
  }

  function initMobileCreatorToolkit() {
    if (pageName() !== "host.html" || document.getElementById("cltchMobileToolkit")) return;
    var form = document.getElementById("gigForm");
    if (!form) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchMobileToolkit";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Mobile Creator Toolkit</div><button type="button" id="cltchQuickDraftSave" class="cltch-exp-chip">Save Offline Draft</button></div>' +
      '<div class="cltch-exp-row">' +
        '<button type="button" class="cltch-exp-chip" data-quick-template="jazz">Jazz Night</button>' +
        '<button type="button" class="cltch-exp-chip" data-quick-template="dj">DJ Set</button>' +
        '<button type="button" class="cltch-exp-chip" data-quick-template="acoustic">Acoustic Session</button>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchMobileToolkitNote" style="margin-top:8px;">Use templates for rapid posting on small screens.</div>';
    form.insertAdjacentElement("beforebegin", card);
    var templates = {
      jazz: { genre: "Jazz", pay: "$300 flat", duration: "3h" },
      dj: { genre: "DJ", pay: "$250 flat", duration: "4h" },
      acoustic: { genre: "Acoustic", pay: "$180 flat", duration: "2h" }
    };
    card.querySelectorAll("[data-quick-template]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tpl = templates[btn.getAttribute("data-quick-template")] || null;
        if (!tpl) return;
        if (document.getElementById("genre")) document.getElementById("genre").value = tpl.genre;
        if (document.getElementById("pay")) document.getElementById("pay").value = tpl.pay;
        if (document.getElementById("duration")) document.getElementById("duration").value = tpl.duration;
        card.querySelector("#cltchMobileToolkitNote").textContent = "Template applied: " + tpl.genre + ".";
      });
    });
    card.querySelector("#cltchQuickDraftSave").addEventListener("click", function () {
      var draft = {
        venue: String(document.getElementById("venueName")?.value || ""),
        date: String(document.getElementById("date")?.value || ""),
        time: String(document.getElementById("time")?.value || ""),
        genre: String(document.getElementById("genre")?.value || ""),
        pay: String(document.getElementById("pay")?.value || ""),
        at: Date.now()
      };
      writeJsonStorage("cltch_mobile_quick_draft_v1", draft);
      card.querySelector("#cltchMobileToolkitNote").textContent = navigator.onLine
        ? "Draft saved. You are online."
        : "Draft queued offline. It can be posted once back online.";
      if (!navigator.onLine) pushInboxItem({ role: "host", level: "warn", title: "Offline draft queued", body: "Posting will resume once online." });
    });
    window.addEventListener("online", function () {
      var draft = readJsonStorage("cltch_mobile_quick_draft_v1", null);
      if (!draft) return;
      pushInboxItem({ role: "host", level: "ok", title: "Back online", body: "Offline draft ready to publish." });
    });
  }

  function initSafetyCompliancePack() {
    if (document.getElementById("cltchSafetyPack")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSafetyPack";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Safety + Compliance</div></div>' +
      '<div class="cltch-exp-row">' +
        '<label class="cltch-exp-note"><input id="cltchKycToggle" type="checkbox"> KYC reviewed</label>' +
        '<label class="cltch-exp-note"><input id="cltchAgeGateToggle" type="checkbox"> 21+ event gate</label>' +
        '<label class="cltch-exp-note"><input id="cltchModerationToggle" type="checkbox"> Moderation queue</label>' +
      '</div>' +
      '<div class="cltch-exp-row" style="margin-top:8px;">' +
        '<input id="cltchSafetyIncidentText" type="text" maxlength="140" placeholder="Incident detail" style="min-height:36px;flex:1;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchSafetyIncidentAdd" class="cltch-exp-chip">Log</button>' +
      '</div>' +
      '<div class="cltch-doc-list" id="cltchSafetyIncidentList"></div>';
    main.appendChild(card);
    var key = "cltch_safety_pack_v1";
    var state = readJsonStorage(key, { kyc: false, ageGate: false, moderation: false, incidents: [] });
    if (!Array.isArray(state.incidents)) state.incidents = [];
    card.querySelector("#cltchKycToggle").checked = !!state.kyc;
    card.querySelector("#cltchAgeGateToggle").checked = !!state.ageGate;
    card.querySelector("#cltchModerationToggle").checked = !!state.moderation;
    function render() {
      var list = card.querySelector("#cltchSafetyIncidentList");
      if (!state.incidents.length) {
        list.innerHTML = '<div class="cltch-exp-note">No incidents logged.</div>';
        return;
      }
      list.innerHTML = state.incidents.map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.note) + '</span><span class="cltch-exp-note">' + new Date(it.at).toLocaleDateString() + "</span></div>";
      }).join("");
    }
    function save() {
      state.kyc = card.querySelector("#cltchKycToggle").checked;
      state.ageGate = card.querySelector("#cltchAgeGateToggle").checked;
      state.moderation = card.querySelector("#cltchModerationToggle").checked;
      writeJsonStorage(key, state);
    }
    card.querySelector("#cltchKycToggle").addEventListener("change", save);
    card.querySelector("#cltchAgeGateToggle").addEventListener("change", save);
    card.querySelector("#cltchModerationToggle").addEventListener("change", save);
    card.querySelector("#cltchSafetyIncidentAdd").addEventListener("click", function () {
      var note = String(card.querySelector("#cltchSafetyIncidentText").value || "").trim();
      if (!note) return;
      state.incidents.unshift({ note: note, at: Date.now() });
      state.incidents = state.incidents.slice(0, 20);
      card.querySelector("#cltchSafetyIncidentText").value = "";
      save();
      render();
      pushInboxItem({ role: inferRoleFromPage(), level: "warn", title: "Safety incident logged", body: "Review and follow compliance process." });
    });
    render();
  }

  function initGrowthLoops() {
    if (document.getElementById("cltchGrowthLoops")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchGrowthLoops";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Growth Loops</div><button type="button" id="cltchGenerateReferral" class="cltch-exp-chip">Generate Referral</button></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchStreakCount">0</div><div class="cltch-metric-label">Activity streak</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchMilestoneCount">0/3</div><div class="cltch-metric-label">Milestones</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchReferralCount">0</div><div class="cltch-metric-label">Referrals</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchMissionLine" style="margin-top:8px;">Mission: complete profile + respond to 3 matches today.</div>' +
      '<div class="cltch-doc-list" id="cltchReferralList"></div>';
    main.appendChild(card);
    var key = "cltch_growth_loops_v1";
    var data = readJsonStorage(key, { streak: 0, milestones: 0, referrals: [] });
    if (!Array.isArray(data.referrals)) data.referrals = [];
    var today = new Date().toISOString().slice(0, 10);
    if (data.lastSeen !== today) {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      data.streak = data.lastSeen === yesterday ? (Number(data.streak || 0) + 1) : 1;
      data.lastSeen = today;
      writeJsonStorage(key, data);
    }
    function render() {
      var referralList = card.querySelector("#cltchReferralList");
      document.getElementById("cltchStreakCount").textContent = String(data.streak || 0);
      data.milestones = Math.min(3, Math.max(0, Math.round((Number(data.streak || 0) / 3))));
      document.getElementById("cltchMilestoneCount").textContent = data.milestones + "/3";
      document.getElementById("cltchReferralCount").textContent = String(data.referrals.length || 0);
      document.getElementById("cltchMissionLine").textContent = data.streak >= 5
        ? "Mission: keep streak and unlock seasonal challenge."
        : "Mission: maintain daily activity to boost visibility.";
      if (!data.referrals.length) {
        referralList.innerHTML = '<div class="cltch-exp-note">No referral codes generated yet.</div>';
        return;
      }
      referralList.innerHTML = data.referrals.slice(0, 6).map(function (code) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(code) + '</span><span class="cltch-pill ok">Active</span></div>';
      }).join("");
    }
    card.querySelector("#cltchGenerateReferral").addEventListener("click", function () {
      var code = "CLTCH-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      data.referrals.unshift(code);
      data.referrals = data.referrals.slice(0, 20);
      writeJsonStorage(key, data);
      render();
      navigator.clipboard?.writeText(code).catch(function () {});
      pushInboxItem({ role: "general", level: "ok", title: "Referral generated", body: "Code copied: " + code });
    });
    render();
  }

  function initSlaEnforcementEngine() {
    var page = pageName();
    if (!/^(host|booking)\.html$/.test(page) || document.getElementById("cltchSlaEngine")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSlaEngine";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">SLA Enforcement Engine</div><button type="button" id="cltchSlaRun" class="cltch-exp-chip">Run Check</button></div>' +
      '<div class="cltch-exp-row">' +
        '<label class="cltch-exp-note">Response SLA <select id="cltchSlaHours" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="1">1h</option><option value="3">3h</option><option value="6" selected>6h</option><option value="12">12h</option><option value="24">24h</option></select></label>' +
        '<label class="cltch-exp-note"><input id="cltchSlaAutoExpire" type="checkbox" checked> Auto-expire stale offers</label>' +
      '</div>' +
      '<div class="cltch-mini-grid" style="margin-top:8px;">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchSlaPending">0</div><div class="cltch-metric-label">Pending SLA</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchSlaBreaches">0</div><div class="cltch-metric-label">Breaches</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchSlaStatus">On time</div><div class="cltch-metric-label">Status</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchSlaNote" style="margin-top:8px;">SLA monitoring ready.</div>';
    var anchor = document.getElementById("hostQueueSummary") || document.getElementById("cltchBookingReady") || document.getElementById("bookingActions");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function runCheck() {
      var thresholdHours = Number(card.querySelector("#cltchSlaHours").value || 6);
      var autoExpire = !!card.querySelector("#cltchSlaAutoExpire").checked;
      var pending = 0;
      var breaches = 0;
      var now = Date.now();
      var checkItems = [];
      var offers = readJsonStorage("cltch_negotiation_v1:default", null);
      if (offers && offers.at) checkItems.push(offers.at);
      var room = readJsonStorage("cltch_nego_room_v2:default", { thread: [] });
      if (Array.isArray(room.thread)) {
        room.thread.forEach(function (t) {
          if (t && t.at) checkItems.push(t.at);
          if (t && t.expireAt && now > t.expireAt) breaches += 1;
        });
      }
      var inbox = readInbox();
      inbox.items.slice(0, 20).forEach(function (it) {
        if (it && it.at) checkItems.push(it.at);
      });
      checkItems.forEach(function (stamp) {
        var ageHours = (now - stamp) / 3600000;
        if (ageHours < thresholdHours) pending += 1;
        else breaches += 1;
      });
      document.getElementById("cltchSlaPending").textContent = String(pending);
      document.getElementById("cltchSlaBreaches").textContent = String(breaches);
      document.getElementById("cltchSlaStatus").textContent = breaches ? "At risk" : "On time";
      var note = breaches
        ? (breaches + " item(s) exceeded " + thresholdHours + "h SLA.")
        : "All tracked items are inside SLA window.";
      if (autoExpire && breaches > 0) {
        note += " Stale offers flagged for expiry.";
        pushInboxItem({ role: inferRoleFromPage(), level: "warn", title: "SLA breach detected", body: breaches + " stale items flagged." });
      }
      document.getElementById("cltchSlaNote").textContent = note;
      writeJsonStorage("cltch_sla_engine_v1", {
        thresholdHours: thresholdHours,
        pending: pending,
        breaches: breaches,
        autoExpire: autoExpire,
        at: now
      });
    }
    card.querySelector("#cltchSlaRun").addEventListener("click", runCheck);
    runCheck();
  }

  function initUnifiedActivityTimeline() {
    if (document.getElementById("cltchActivityTimeline")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchActivityTimeline";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Unified Activity Timeline</div><button type="button" id="cltchTimelineRefresh" class="cltch-exp-chip">Refresh</button></div>' +
      '<div class="cltch-timeline-feed" id="cltchTimelineFeed"></div>';
    var anchor = document.getElementById("cltchNotificationCenter") || main.firstChild;
    if (anchor && anchor !== card) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function collect() {
      var events = [];
      var inbox = readInbox();
      if (Array.isArray(inbox.items)) {
        inbox.items.forEach(function (it) {
          events.push({
            at: Number(it.at || 0),
            type: "Notification",
            detail: String(it.title || "Update") + (it.body ? " - " + String(it.body) : "")
          });
        });
      }
      var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
      var room = readJsonStorage("cltch_nego_room_v2:" + bookingId, { thread: [] });
      if (Array.isArray(room.thread)) {
        room.thread.forEach(function (item) {
          events.push({
            at: Number(item.at || 0),
            type: "Negotiation",
            detail: String(item.amount || "Counter") + (item.message ? " - " + String(item.message) : "")
          });
        });
      }
      var disputes = readJsonStorage("cltch_disputes_v1:" + bookingId, { items: [] });
      if (Array.isArray(disputes.items)) {
        disputes.items.forEach(function (d) {
          events.push({
            at: Number(d.at || 0),
            type: "Dispute",
            detail: String(d.type || "issue") + ": " + String(d.note || "")
          });
        });
      }
      var incidents = readJsonStorage("cltch_safety_pack_v1", { incidents: [] });
      if (Array.isArray(incidents.incidents)) {
        incidents.incidents.forEach(function (it) {
          events.push({
            at: Number(it.at || 0),
            type: "Safety",
            detail: String(it.note || "Incident logged")
          });
        });
      }
      var growth = readJsonStorage("cltch_growth_loops_v1", { referrals: [] });
      if (Array.isArray(growth.referrals)) {
        growth.referrals.slice(0, 6).forEach(function (code, idx) {
          events.push({
            at: Date.now() - ((idx + 1) * 60000),
            type: "Referral",
            detail: "Referral active: " + String(code)
          });
        });
      }
      return events.filter(function (e) { return e.at > 0; }).sort(function (a, b) { return b.at - a.at; }).slice(0, 25);
    }

    function render() {
      var events = collect();
      var feed = card.querySelector("#cltchTimelineFeed");
      if (!events.length) {
        feed.innerHTML = '<div class="cltch-exp-note">No activity yet.</div>';
        return;
      }
      feed.innerHTML = events.map(function (e) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;"><strong>' + escapeHtml(e.type) + ':</strong> ' + escapeHtml(e.detail) + '</span><span class="cltch-exp-note">' + new Date(e.at).toLocaleString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchTimelineRefresh").addEventListener("click", render);
    render();
  }

  function initRouteTimeLogisticsEngine() {
    var page = pageName();
    if (!/^(host|booking)\.html$/.test(page) || document.getElementById("cltchRouteLogistics")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchRouteLogistics";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Route + Time Logistics</div><button type="button" id="cltchRouteCalc" class="cltch-exp-chip">Estimate</button></div>' +
      '<div class="cltch-exp-row">' +
        '<input id="cltchRouteMiles" type="number" min="0" placeholder="Miles" style="min-height:36px;width:100px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchSetupMins" type="number" min="0" placeholder="Setup min" style="min-height:36px;width:120px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchTearMins" type="number" min="0" placeholder="Teardown min" style="min-height:36px;width:130px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
      '</div>' +
      '<div class="cltch-mini-grid" style="margin-top:8px;">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchDriveTime">0m</div><div class="cltch-metric-label">Drive</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchBufferTime">0m</div><div class="cltch-metric-label">Buffer</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchDepartureTime">--:--</div><div class="cltch-metric-label">Depart by</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchRouteNote" style="margin-top:8px;">Enter miles and buffers to calculate arrival safety window.</div>';
    var anchor = document.getElementById("cltchTravelCheck") || document.getElementById("cltchBookingReady");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function estimate() {
      var miles = Number(card.querySelector("#cltchRouteMiles").value || 0);
      var setup = Number(card.querySelector("#cltchSetupMins").value || 30);
      var tear = Number(card.querySelector("#cltchTearMins").value || 20);
      var drive = Math.round((miles / 35) * 60);
      var totalBuffer = Math.max(0, setup + tear);
      var whenText = String(document.getElementById("whenValue")?.textContent || document.getElementById("time")?.value || "");
      var timeMatch = whenText.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
      var now = new Date();
      var eventTime = new Date(now);
      if (timeMatch) {
        var h = Number(timeMatch[1] || 0);
        var m = Number(timeMatch[2] || 0);
        var mer = (timeMatch[3] || "").toUpperCase();
        if (mer === "PM" && h < 12) h += 12;
        if (mer === "AM" && h === 12) h = 0;
        eventTime.setHours(h, m, 0, 0);
      } else {
        eventTime.setHours(now.getHours() + 2, 0, 0, 0);
      }
      var depart = new Date(eventTime.getTime() - ((drive + setup) * 60000));
      document.getElementById("cltchDriveTime").textContent = drive + "m";
      document.getElementById("cltchBufferTime").textContent = totalBuffer + "m";
      document.getElementById("cltchDepartureTime").textContent = depart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      document.getElementById("cltchRouteNote").textContent = drive > 90
        ? "Long route detected. Consider earlier load-in or backup performer."
        : "Route timing looks feasible with current buffers.";
      writeJsonStorage("cltch_route_logistics_v1", {
        miles: miles,
        driveMins: drive,
        setupMins: setup,
        tearMins: tear,
        departBy: depart.toISOString(),
        at: Date.now()
      });
    }
    card.querySelector("#cltchRouteCalc").addEventListener("click", estimate);
    estimate();
  }

  function initIncidentEvidenceVault() {
    if (pageName() !== "booking.html" || document.getElementById("cltchEvidenceVault")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
    var key = "cltch_evidence_vault_v1:" + bookingId;
    var data = readJsonStorage(key, { files: [] });
    if (!Array.isArray(data.files)) data.files = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchEvidenceVault";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Incident Evidence Vault</div></div>' +
      '<div class="cltch-exp-row">' +
        '<input id="cltchEvidenceLabel" type="text" maxlength="40" placeholder="Evidence label" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchEvidenceUrl" type="url" placeholder="https://file-link" style="min-height:36px;flex:1;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchEvidenceAdd" class="cltch-exp-chip">Attach</button>' +
      '</div>' +
      '<div class="cltch-doc-list" id="cltchEvidenceList"></div>';
    var anchor = document.getElementById("cltchDisputeCard") || document.getElementById("cltchBookingOpsExt");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function render() {
      var list = card.querySelector("#cltchEvidenceList");
      if (!data.files.length) {
        list.innerHTML = '<div class="cltch-exp-note">No evidence attached.</div>';
        return;
      }
      list.innerHTML = data.files.map(function (it, idx) {
        return '<div class="cltch-doc-item"><a href="' + escapeHtml(it.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--cltch-accent);text-decoration:none;">' + escapeHtml(it.label) + '</a><button type="button" class="cltch-exp-chip" data-evidence-remove="' + idx + '">Remove</button></div>';
      }).join("");
      list.querySelectorAll("[data-evidence-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-evidence-remove"));
          if (!Number.isFinite(idx)) return;
          data.files.splice(idx, 1);
          writeJsonStorage(key, data);
          render();
        });
      });
    }
    card.querySelector("#cltchEvidenceAdd").addEventListener("click", function () {
      var label = String(card.querySelector("#cltchEvidenceLabel").value || "").trim();
      var url = String(card.querySelector("#cltchEvidenceUrl").value || "").trim();
      if (!label || !/^https?:\/\/\S+$/i.test(url)) return;
      data.files.unshift({ label: label, url: url, at: Date.now() });
      data.files = data.files.slice(0, 30);
      card.querySelector("#cltchEvidenceLabel").value = "";
      card.querySelector("#cltchEvidenceUrl").value = "";
      writeJsonStorage(key, data);
      render();
      pushInboxItem({ role: "booking", level: "warn", title: "Evidence attached", body: label + " added to incident vault." });
    });
    render();
  }

  function initOwnerOpsDashboard() {
    var params = new URL(window.location.href).searchParams;
    var isOwner = params.get("owner") === "1";
    if (!isOwner || document.getElementById("cltchOwnerOps")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchOwnerOps";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Owner Ops Dashboard</div><button type="button" id="cltchOwnerRefresh" class="cltch-exp-chip">Refresh KPIs</button></div>' +
      '<div class="cltch-ops-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchOpsActiveUsers">0</div><div class="cltch-metric-label">Active users</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchOpsSlaBreach">0</div><div class="cltch-metric-label">SLA breaches</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchOpsFraudAlerts">0</div><div class="cltch-metric-label">Fraud alerts</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchOpsDisputes">0</div><div class="cltch-metric-label">Open disputes</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchOwnerOpsNote" style="margin-top:8px;">Owner mode combines live local KPIs.</div>';
    main.insertBefore(card, main.firstChild);

    function refresh() {
      var inbox = readInbox();
      var breaches = Number(readJsonStorage("cltch_sla_engine_v1", { breaches: 0 }).breaches || 0);
      var fraud = (inbox.items || []).filter(function (it) { return /fraud|anomaly|risk/i.test(String(it.title || "") + " " + String(it.body || "")); }).length;
      var disputes = Number((readJsonStorage("cltch_disputes_v1:default", { items: [] }).items || []).length);
      var active = Math.max(1, Math.min(999, Math.round(((inbox.items || []).length * 1.7) + 12)));
      document.getElementById("cltchOpsActiveUsers").textContent = String(active);
      document.getElementById("cltchOpsSlaBreach").textContent = String(breaches);
      document.getElementById("cltchOpsFraudAlerts").textContent = String(fraud);
      document.getElementById("cltchOpsDisputes").textContent = String(disputes);
      document.getElementById("cltchOwnerOpsNote").textContent = breaches > 0 || fraud > 0
        ? "Attention needed: elevated operational risk indicators."
        : "Ops health is stable across key risk indicators.";
      writeJsonStorage("cltch_owner_ops_snapshot_v1", {
        active: active,
        breaches: breaches,
        fraud: fraud,
        disputes: disputes,
        at: Date.now()
      });
    }
    card.querySelector("#cltchOwnerRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initBookingSmartContracts() {
    if (pageName() !== "booking.html" || document.getElementById("cltchSmartContract")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
    var key = "cltch_booking_contract_v1:" + bookingId;
    var contract = readJsonStorage(key, { state: "draft", history: [] });
    if (!Array.isArray(contract.history)) contract.history = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSmartContract";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Booking Smart Contract</div><span class="cltch-pill ok" id="cltchContractState">draft</span></div>' +
      '<div class="cltch-exp-row">' +
        '<select id="cltchContractAction" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
          '<option value="accepted">Accept Booking</option>' +
          '<option value="checked_in">Check In</option>' +
          '<option value="completed">Mark Completed</option>' +
          '<option value="released">Release Payout</option>' +
        '</select>' +
        '<button type="button" id="cltchContractRun" class="cltch-exp-chip">Execute Step</button>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchContractHash" style="margin-top:8px;">Contract hash: pending</div>' +
      '<div class="cltch-doc-list" id="cltchContractHistory"></div>';
    var anchor = document.getElementById("cltchEvidenceVault") || document.getElementById("cltchBookingOpsExt");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    function hashBooking() {
      var parts = [
        document.getElementById("venueValue")?.textContent || "",
        document.getElementById("hostValue")?.textContent || "",
        document.getElementById("performerValue")?.textContent || "",
        document.getElementById("whenValue")?.textContent || "",
        document.getElementById("payValue")?.textContent || ""
      ].join("|");
      var hash = 0;
      for (var i = 0; i < parts.length; i += 1) hash = ((hash << 5) - hash + parts.charCodeAt(i)) | 0;
      return "SC-" + Math.abs(hash).toString(16).toUpperCase();
    }

    function render() {
      var stateEl = card.querySelector("#cltchContractState");
      stateEl.textContent = contract.state || "draft";
      stateEl.className = "cltch-pill " + ((contract.state === "released" || contract.state === "completed") ? "ok" : "warn");
      card.querySelector("#cltchContractHash").textContent = "Contract hash: " + hashBooking();
      var list = card.querySelector("#cltchContractHistory");
      if (!contract.history.length) {
        list.innerHTML = '<div class="cltch-exp-note">No state transitions yet.</div>';
        return;
      }
      list.innerHTML = contract.history.map(function (h) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(h.step) + '</span><span class="cltch-exp-note">' + new Date(h.at).toLocaleString() + "</span></div>";
      }).join("");
    }

    card.querySelector("#cltchContractRun").addEventListener("click", function () {
      var next = card.querySelector("#cltchContractAction").value || "accepted";
      contract.state = next;
      contract.history.unshift({ step: next, at: Date.now() });
      contract.history = contract.history.slice(0, 12);
      writeJsonStorage(key, contract);
      render();
      pushInboxItem({ role: "booking", level: "ok", title: "Contract step executed", body: "State moved to " + next + "." });
    });
    render();
  }

  function initEscrowMilestonePayments() {
    var page = pageName();
    if (!/^(host|booking)\.html$/.test(page) || document.getElementById("cltchEscrowMilestones")) return;
    var main = markMainContent();
    if (!main) return;
    var bookingId = new URL(window.location.href).searchParams.get("id") || "default";
    var key = "cltch_escrow_v1:" + bookingId;
    var escrow = readJsonStorage(key, {
      total: 0,
      depositPct: 30,
      milestones: [
        { label: "Booking accepted", done: false },
        { label: "Performer check-in", done: false },
        { label: "Performance complete", done: false }
      ]
    });
    if (!Array.isArray(escrow.milestones) || !escrow.milestones.length) {
      escrow.milestones = [
        { label: "Booking accepted", done: false },
        { label: "Performer check-in", done: false },
        { label: "Performance complete", done: false }
      ];
    }
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchEscrowMilestones";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Escrow + Milestone Payments</div><button type="button" id="cltchEscrowSave" class="cltch-exp-chip">Update</button></div>' +
      '<div class="cltch-exp-row">' +
        '<input id="cltchEscrowTotal" type="number" min="0" placeholder="Total amount" style="min-height:36px;width:140px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchEscrowDeposit" type="number" min="0" max="90" placeholder="Deposit %" style="min-height:36px;width:120px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
      '</div>' +
      '<div class="cltch-doc-list" id="cltchEscrowMilestoneList"></div>' +
      '<div class="cltch-mini-grid" style="margin-top:8px;">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchEscrowDepositAmt">$0</div><div class="cltch-metric-label">Deposit</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchEscrowReleased">$0</div><div class="cltch-metric-label">Released</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchEscrowRemain">$0</div><div class="cltch-metric-label">Remaining</div></div>' +
      '</div>';
    var anchor = document.getElementById("cltchSmartContract") || document.getElementById("cltchRouteLogistics") || document.getElementById("hostQueueSummary");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);

    card.querySelector("#cltchEscrowTotal").value = escrow.total || parseUsdFromText(document.getElementById("payValue")?.textContent || document.getElementById("pay")?.value || "") || 0;
    card.querySelector("#cltchEscrowDeposit").value = escrow.depositPct || 30;

    function renderMilestones() {
      var list = card.querySelector("#cltchEscrowMilestoneList");
      list.innerHTML = escrow.milestones.map(function (m, idx) {
        return '<label class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(m.label) + '</span><input type="checkbox" data-escrow-step="' + idx + '"' + (m.done ? " checked" : "") + "></label>";
      }).join("");
      list.querySelectorAll("[data-escrow-step]").forEach(function (box) {
        box.addEventListener("change", function () {
          var idx = Number(box.getAttribute("data-escrow-step"));
          if (!Number.isFinite(idx) || !escrow.milestones[idx]) return;
          escrow.milestones[idx].done = !!box.checked;
          recalc();
        });
      });
    }

    function recalc() {
      escrow.total = Math.max(0, Number(card.querySelector("#cltchEscrowTotal").value || 0));
      escrow.depositPct = Math.max(0, Math.min(90, Number(card.querySelector("#cltchEscrowDeposit").value || 30)));
      var depositAmt = Math.round(escrow.total * (escrow.depositPct / 100));
      var doneCount = escrow.milestones.filter(function (m) { return !!m.done; }).length;
      var progressive = Math.round((escrow.total - depositAmt) * (doneCount / Math.max(1, escrow.milestones.length)));
      var released = Math.min(escrow.total, depositAmt + progressive);
      var remain = Math.max(0, escrow.total - released);
      document.getElementById("cltchEscrowDepositAmt").textContent = "$" + depositAmt.toLocaleString();
      document.getElementById("cltchEscrowReleased").textContent = "$" + released.toLocaleString();
      document.getElementById("cltchEscrowRemain").textContent = "$" + remain.toLocaleString();
      writeJsonStorage(key, escrow);
    }

    card.querySelector("#cltchEscrowSave").addEventListener("click", function () {
      recalc();
      showDexterityToast("Escrow plan updated", 1400);
    });

    renderMilestones();
    recalc();
  }

  function initDynamicPricingAutopilot() {
    if (pageName() !== "host.html" || document.getElementById("cltchPricingAutopilot")) return;
    var form = document.getElementById("gigForm");
    if (!form) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPricingAutopilot";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Dynamic Pricing Autopilot</div><label class="cltch-exp-note"><input id="cltchPriceAutoApply" type="checkbox"> Auto-apply</label></div>' +
      '<div class="cltch-exp-row">' +
        '<input id="cltchPriceFloor" type="number" min="0" value="120" style="min-height:36px;width:110px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<input id="cltchPriceCeil" type="number" min="0" value="900" style="min-height:36px;width:110px;padding:0 8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<button type="button" id="cltchPriceSuggest" class="cltch-exp-chip">Suggest Price</button>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchPriceAutopilotNote" style="margin-top:8px;">Autopilot uses lead time + queue health + risk signals.</div>';
    form.insertAdjacentElement("beforebegin", card);

    function computeSuggestion() {
      var payInput = document.getElementById("pay");
      var current = parseUsdFromText(payInput?.value || "") || 220;
      var open = Number(document.getElementById("hostStatOpen")?.textContent || 0);
      var accepted = Number(document.getElementById("hostStatAccepted")?.textContent || 0);
      var date = document.getElementById("date")?.value || "";
      var leadDays = date ? Math.round((new Date(date) - new Date()) / 86400000) : 7;
      var pressure = open > accepted ? 1.1 : 0.95;
      if (leadDays <= 2) pressure += 0.12;
      if (leadDays >= 14) pressure -= 0.08;
      var floor = Math.max(0, Number(card.querySelector("#cltchPriceFloor").value || 120));
      var ceil = Math.max(floor, Number(card.querySelector("#cltchPriceCeil").value || 900));
      var suggestion = Math.round(Math.min(ceil, Math.max(floor, current * pressure)));
      return { suggestion: suggestion, leadDays: leadDays, pressure: pressure };
    }

    function applyOrPreview(force) {
      var next = computeSuggestion();
      var payInput = document.getElementById("pay");
      var auto = !!card.querySelector("#cltchPriceAutoApply").checked;
      if (payInput && (auto || force)) {
        payInput.value = "$" + next.suggestion + " flat";
        payInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      card.querySelector("#cltchPriceAutopilotNote").textContent =
        "Suggested $" + next.suggestion + " (lead " + next.leadDays + "d, pressure x" + next.pressure.toFixed(2) + ").";
      writeJsonStorage("cltch_pricing_autopilot_v1", {
        suggestion: next.suggestion,
        leadDays: next.leadDays,
        pressure: next.pressure,
        auto: auto,
        at: Date.now()
      });
    }

    card.querySelector("#cltchPriceSuggest").addEventListener("click", function () {
      applyOrPreview(true);
    });
    form.addEventListener("input", function () { applyOrPreview(false); });
    applyOrPreview(false);
  }

  function initScoreTransparencyCenter() {
    var page = pageName();
    if (!/^(host|gig-radar|musician-dashboard|musician-matched-gigs)\.html$/.test(page) || document.getElementById("cltchScoreTransparency")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchScoreTransparency";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Score Transparency</div><button type="button" id="cltchScoreRefresh" class="cltch-exp-chip">Refresh</button></div>' +
      '<div class="cltch-doc-list" id="cltchScoreBreakdown"></div>' +
      '<div class="cltch-exp-note" id="cltchScoreAdvice" style="margin-top:8px;">Score factors and improvement actions.</div>';
    var anchor = document.getElementById("cltchReputationGraph") || document.getElementById("cltchTrustMetrics");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);
    function refresh() {
      var rep = readJsonStorage("cltch_reputation_snapshot_v2:" + page, null);
      var rel = rep?.reliability || Number((document.getElementById("cltchRelScore")?.textContent || "").replace(/[^\d]/g, "")) || 70;
      var risk = rep?.noShowRisk || Number((document.getElementById("cltchNoShowScore")?.textContent || "").replace(/[^\d]/g, "")) || 18;
      var response = rep?.responseMins || Number((document.getElementById("cltchResponseScore")?.textContent || "").replace(/[^\d]/g, "")) || 12;
      var completeness = page === "host.html"
        ? Math.min(100, Math.round((Number((document.getElementById("cltchGateScore")?.textContent || "0/6").split("/")[0].replace(/[^\d]/g, "")) / 6) * 100) || 50)
        : Math.min(100, 60 + Math.round((Number(document.getElementById("metricAcceptanceRate")?.textContent?.replace(/[^\d]/g, "") || 20) / 2)));
      var payout = Math.max(50, Math.min(100, 100 - (risk / 2)));
      var total = Math.round((rel * 0.35) + (completeness * 0.25) + ((100 - risk) * 0.2) + ((100 - Math.min(60, response)) * 0.1) + (payout * 0.1));
      var rows = [
        ["Reliability", rel + "%"],
        ["Profile completeness", completeness + "%"],
        ["No-show / cancel risk", risk + "%"],
        ["Response speed", response + "m"],
        ["Payout confidence", payout + "%"],
        ["Composite trust score", total + "%"]
      ];
      card.querySelector("#cltchScoreBreakdown").innerHTML = rows.map(function (r) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(r[0]) + '</span><span class="cltch-pill ' + (r[0] === "Composite trust score" ? "ok" : "warn") + '">' + escapeHtml(r[1]) + "</span></div>";
      }).join("");
      card.querySelector("#cltchScoreAdvice").textContent = total < 70
        ? "Improve score by reducing cancellations and filling required profile fields."
        : "Score is strong. Keep response speed under 15 minutes for best ranking.";
    }
    card.querySelector("#cltchScoreRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initVerificationStackExpansion() {
    if (document.getElementById("cltchVerificationStack")) return;
    var page = pageName();
    if (!/^(auth|host-profile|musician-profile|booking|host)\.html$/.test(page)) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchVerificationStack";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Verification Stack</div><div class="cltch-exp-chip" id="cltchVerifyPct">0%</div></div>' +
      '<div class="cltch-doc-list">' +
        '<label class="cltch-doc-item"><span style="font-size:12px;">Government ID verified</span><input type="checkbox" data-verify-key="id"></label>' +
        '<label class="cltch-doc-item"><span style="font-size:12px;">Payout account verified</span><input type="checkbox" data-verify-key="payout"></label>' +
        '<label class="cltch-doc-item"><span style="font-size:12px;">Venue/business proof</span><input type="checkbox" data-verify-key="venue"></label>' +
        '<label class="cltch-doc-item"><span style="font-size:12px;">Optional background screen</span><input type="checkbox" data-verify-key="background"></label>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchVerifyNote" style="margin-top:8px;">Complete verification to unlock stronger trust signals.</div>';
    var anchor = document.getElementById("profileForm") || document.getElementById("cltchIdentityBadge");
    if (anchor && anchor.id === "cltchIdentityBadge") {
      var hostNav = document.querySelector("header nav");
      if (hostNav) hostNav.insertAdjacentElement("afterend", card);
      else main.appendChild(card);
    } else if (anchor) anchor.insertAdjacentElement("beforebegin", card);
    else main.appendChild(card);
    var key = "cltch_verification_stack_v1";
    var state = readJsonStorage(key, { id: false, payout: false, venue: false, background: false });
    card.querySelectorAll("[data-verify-key]").forEach(function (el) {
      var k = el.getAttribute("data-verify-key");
      el.checked = !!state[k];
      el.addEventListener("change", function () {
        state[k] = !!el.checked;
        writeJsonStorage(key, state);
        render();
      });
    });
    function render() {
      var keys = ["id", "payout", "venue", "background"];
      var done = keys.filter(function (k) { return !!state[k]; }).length;
      var pct = Math.round((done / keys.length) * 100);
      card.querySelector("#cltchVerifyPct").textContent = pct + "%";
      card.querySelector("#cltchVerifyNote").textContent = pct < 75
        ? "Add ID and payout verification first."
        : "Verification tier is strong.";
      var badge = document.getElementById("cltchIdentityBadge");
      if (badge) badge.textContent = pct >= 75 ? "Identity: Verified+" : "Identity: Standard";
    }
    render();
  }

  function initChurnPreventionAutomations() {
    if (document.getElementById("cltchChurnAutomation")) return;
    var main = markMainContent();
    if (!main) return;
    var page = pageName();
    if (!/^(host|gig-radar|musician-dashboard|musician-matched-gigs|booking)\.html$/.test(page)) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchChurnAutomation";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">Churn Prevention Automations</div><button type="button" id="cltchChurnRun" class="cltch-exp-chip">Run Recovery</button></div>' +
      '<div class="cltch-mini-grid">' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchRiskScore">0</div><div class="cltch-metric-label">Risk score</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchIdleDays">0d</div><div class="cltch-metric-label">Idle days</div></div>' +
        '<div class="cltch-metric"><div class="cltch-metric-value" id="cltchRecoveryState">Ready</div><div class="cltch-metric-label">Recovery</div></div>' +
      '</div>' +
      '<div class="cltch-exp-note" id="cltchRecoveryMission" style="margin-top:8px;">Mission will update when risk rises.</div>';
    var anchor = document.getElementById("cltchGrowthLoops") || document.getElementById("cltchNotificationCenter");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);
    var key = "cltch_churn_automation_v1";
    var state = readJsonStorage(key, { lastActive: Date.now(), interventions: 0 });
    function evaluate() {
      var growth = readJsonStorage("cltch_growth_loops_v1", { streak: 0, lastSeen: "" });
      var lastSeenTs = growth.lastSeen ? new Date(growth.lastSeen + "T00:00:00").getTime() : state.lastActive;
      var idleDays = Math.max(0, Math.round((Date.now() - lastSeenTs) / 86400000));
      var unresolved = Number(readJsonStorage("cltch_sla_engine_v1", { breaches: 0 }).breaches || 0);
      var liveMatches = Number(document.getElementById("metricLiveMatches")?.textContent || document.getElementById("hostStatOpen")?.textContent || 0);
      var risk = Math.min(100, (idleDays * 8) + (unresolved * 10) + (liveMatches === 0 ? 15 : 0));
      document.getElementById("cltchRiskScore").textContent = String(risk);
      document.getElementById("cltchIdleDays").textContent = idleDays + "d";
      document.getElementById("cltchRecoveryState").textContent = risk >= 55 ? "Triggered" : "Healthy";
      document.getElementById("cltchRecoveryMission").textContent = risk >= 55
        ? "Recovery mission: post/respond to 2 opportunities in the next 24h."
        : "Retention status stable.";
      state.lastActive = Date.now();
      writeJsonStorage(key, state);
    }
    card.querySelector("#cltchChurnRun").addEventListener("click", function () {
      state.interventions = Number(state.interventions || 0) + 1;
      writeJsonStorage(key, state);
      evaluate();
      pushInboxItem({ role: inferRoleFromPage(), level: "warn", title: "Recovery automation run", body: "Targeted mission generated for at-risk activity." });
    });
    evaluate();
  }

  function initApiWebhookLayer() {
    var params = new URL(window.location.href).searchParams;
    var enabled = params.get("owner") === "1" || params.get("admin") === "1" || params.get("integrations") === "1";
    if (!enabled || document.getElementById("cltchApiWebhooks")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchApiWebhooks";
    card.innerHTML =
      '<div class="cltch-exp-head"><div class="cltch-exp-title">API + Webhook Layer</div><button type="button" id="cltchWebhookTest" class="cltch-exp-chip">Send Test</button></div>' +
      '<div class="cltch-exp-row">' +
        '<input id="cltchWebhookUrl" type="url" placeholder="https://your-endpoint/webhook" style="min-height:36px;flex:1;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);">' +
        '<select id="cltchWebhookEvent" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="booking.created">booking.created</option><option value="booking.updated">booking.updated</option><option value="dispute.created">dispute.created</option><option value="payout.released">payout.released</option></select>' +
        '<button type="button" id="cltchWebhookAdd" class="cltch-exp-chip">Add</button>' +
      '</div>' +
      '<div class="cltch-doc-list" id="cltchWebhookList"></div>' +
      '<pre id="cltchWebhookPayload" style="margin-top:8px;padding:10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-overlay-item-bg);color:var(--cltch-muted);font-size:11px;overflow:auto;">No test payload yet.</pre>';
    main.insertBefore(card, main.firstChild);
    var key = "cltch_api_webhooks_v1";
    var data = readJsonStorage(key, { endpoints: [] });
    if (!Array.isArray(data.endpoints)) data.endpoints = [];
    function render() {
      var list = card.querySelector("#cltchWebhookList");
      if (!data.endpoints.length) {
        list.innerHTML = '<div class="cltch-exp-note">No webhook endpoints configured.</div>';
        return;
      }
      list.innerHTML = data.endpoints.map(function (it, idx) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.event) + " -> " + escapeHtml(it.url) + '</span><button type="button" class="cltch-exp-chip" data-webhook-remove="' + idx + '">Remove</button></div>';
      }).join("");
      list.querySelectorAll("[data-webhook-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-webhook-remove"));
          if (!Number.isFinite(idx)) return;
          data.endpoints.splice(idx, 1);
          writeJsonStorage(key, data);
          render();
        });
      });
    }
    card.querySelector("#cltchWebhookAdd").addEventListener("click", function () {
      var url = String(card.querySelector("#cltchWebhookUrl").value || "").trim();
      var eventName = String(card.querySelector("#cltchWebhookEvent").value || "").trim();
      if (!/^https?:\/\/\S+$/i.test(url) || !eventName) return;
      data.endpoints.unshift({ url: url, event: eventName, at: Date.now() });
      data.endpoints = data.endpoints.slice(0, 30);
      card.querySelector("#cltchWebhookUrl").value = "";
      writeJsonStorage(key, data);
      render();
    });
    card.querySelector("#cltchWebhookTest").addEventListener("click", function () {
      var payload = {
        id: "evt_" + Math.random().toString(36).slice(2, 10),
        event: card.querySelector("#cltchWebhookEvent").value || "booking.created",
        timestamp: new Date().toISOString(),
        source: "cltch.ntwrk",
        bookingId: new URL(window.location.href).searchParams.get("id") || "sample_booking",
        data: {
          status: readJsonStorage("cltch_booking_contract_v1:default", { state: "draft" }).state || "draft",
          escrow: readJsonStorage("cltch_escrow_v1:default", { total: 0 }),
          risk: readJsonStorage("cltch_sla_engine_v1", { breaches: 0 }).breaches || 0
        }
      };
      var body = JSON.stringify(payload, null, 2);
      card.querySelector("#cltchWebhookPayload").textContent = body;
      navigator.clipboard?.writeText(body).catch(function () {});
      pushInboxItem({ role: "general", level: "ok", title: "Webhook test payload generated", body: "JSON copied to clipboard for endpoint testing." });
    });
    render();
  }

  function initBookingRiskChecklist() {
    if (pageName() !== "booking.html" || document.getElementById("cltchBookingRiskChecklist")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var key = "cltch_booking_risk_v1:" + (new URL(window.location.href).searchParams.get("id") || "default");
    var data = readJsonStorage(key, { checks: [false, false, false, false, false] });
    if (!Array.isArray(data.checks)) data.checks = [false, false, false, false, false];
    var labels = ["Confirmed schedule", "Confirmed payout", "Confirmed contact", "Route planned", "Backup plan set"];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchBookingRiskChecklist";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Booking Risk Checklist</div><div class="cltch-exp-chip" id="cltchRiskChecklistScore">0%</div></div><div class="cltch-doc-list" id="cltchRiskChecklistList"></div><div class="cltch-exp-note" id="cltchRiskChecklistNote" style="margin-top:8px;">Complete checks to reduce day-of failure risk.</div>';
    var anchor = document.getElementById("cltchBookingReady") || document.getElementById("cltchRouteLogistics");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchRiskChecklistList");
      list.innerHTML = labels.map(function (label, idx) {
        return '<label class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(label) + '</span><input type="checkbox" data-risk-check="' + idx + '"' + (data.checks[idx] ? " checked" : "") + "></label>";
      }).join("");
      list.querySelectorAll("[data-risk-check]").forEach(function (el) {
        el.addEventListener("change", function () {
          var idx = Number(el.getAttribute("data-risk-check"));
          if (!Number.isFinite(idx)) return;
          data.checks[idx] = !!el.checked;
          writeJsonStorage(key, data);
          render();
        });
      });
      var pct = Math.round((data.checks.filter(Boolean).length / labels.length) * 100);
      card.querySelector("#cltchRiskChecklistScore").textContent = pct + "%";
      card.querySelector("#cltchRiskChecklistNote").textContent = pct >= 80 ? "Risk is controlled." : "Complete remaining checks before event day.";
    }
    render();
  }

  function initAutoFollowupCadenceEngine() {
    var page = pageName();
    if (!/^(host|gig-radar|musician-dashboard|musician-matched-gigs|booking)\.html$/.test(page) || document.getElementById("cltchFollowupCadence")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_followups_v1:" + page;
    var data = readJsonStorage(key, { cadence: "6h", items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchFollowupCadence";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Auto-Followup Cadence</div><button type="button" id="cltchFollowupRun" class="cltch-exp-chip">Schedule</button></div><div class="cltch-exp-row"><select id="cltchFollowupCadenceSel" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="2h">2h</option><option value="6h">6h</option><option value="12h">12h</option><option value="24h">24h</option></select><input id="cltchFollowupMsg" type="text" maxlength="120" placeholder="Followup message template" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchFollowupList"></div>';
    main.appendChild(card);
    card.querySelector("#cltchFollowupCadenceSel").value = data.cadence || "6h";
    function render() {
      var list = card.querySelector("#cltchFollowupList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No followups scheduled.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 8).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.msg) + '</span><span class="cltch-exp-note">' + new Date(it.when).toLocaleString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchFollowupRun").addEventListener("click", function () {
      data.cadence = card.querySelector("#cltchFollowupCadenceSel").value || "6h";
      var h = Number((data.cadence.match(/\d+/) || [6])[0]);
      var msg = String(card.querySelector("#cltchFollowupMsg").value || "Friendly follow-up for pending response.").trim();
      data.items.unshift({ msg: msg, when: Date.now() + (h * 3600000), at: Date.now() });
      data.items = data.items.slice(0, 30);
      writeJsonStorage(key, data);
      render();
      pushInboxItem({ role: inferRoleFromPage(), level: "ok", title: "Followup scheduled", body: "Next followup in " + h + "h." });
    });
    render();
  }

  function initMultiSelectBulkActions() {
    if (document.getElementById("cltchBulkToolbar")) return;
    var gigList = document.getElementById("gigList");
    if (!gigList) return;
    var toolbar = document.createElement("section");
    toolbar.className = "cltch-exp-card";
    toolbar.id = "cltchBulkToolbar";
    toolbar.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Bulk Actions</div><div class="cltch-exp-chip" id="cltchBulkCount">0 selected</div></div><div class="cltch-exp-row"><button type="button" id="cltchBulkArchive" class="cltch-exp-chip">Archive</button><button type="button" id="cltchBulkUnarchive" class="cltch-exp-chip">Undo Archive</button><button type="button" id="cltchBulkCopyNames" class="cltch-exp-chip">Copy Titles</button></div>';
    gigList.insertAdjacentElement("beforebegin", toolbar);
    var archivedKey = "cltch_bulk_archived_v1:" + pageName();
    var archived = readJsonStorage(archivedKey, { hidden: [] });
    if (!Array.isArray(archived.hidden)) archived.hidden = [];
    function ensureSelectors() {
      gigList.querySelectorAll(".gig-card").forEach(function (card, idx) {
        if (card.querySelector("[data-bulk-pick]")) return;
        var row = document.createElement("label");
        row.style.display = "inline-flex";
        row.style.alignItems = "center";
        row.style.gap = "6px";
        row.style.marginBottom = "6px";
        row.innerHTML = '<input type="checkbox" data-bulk-pick="' + idx + '"><span style="font-size:11px;color:var(--cltch-muted);">Select</span>';
        card.insertBefore(row, card.firstChild);
      });
    }
    function selectedCards() {
      return Array.prototype.slice.call(gigList.querySelectorAll(".gig-card")).filter(function (card) {
        return !!card.querySelector("[data-bulk-pick]:checked");
      });
    }
    function refresh() {
      ensureSelectors();
      Array.prototype.slice.call(gigList.querySelectorAll(".gig-card")).forEach(function (card) {
        var id = card.dataset.bulkId || ("bulk_" + Math.abs((card.textContent || "").slice(0, 80).split("").reduce(function (acc, ch) { return (acc * 31 + ch.charCodeAt(0)) | 0; }, 7)));
        card.dataset.bulkId = id;
        card.style.display = archived.hidden.indexOf(id) >= 0 ? "none" : "";
      });
      var count = selectedCards().length;
      toolbar.querySelector("#cltchBulkCount").textContent = count + " selected";
    }
    toolbar.addEventListener("change", function () { refresh(); });
    gigList.addEventListener("change", function () { refresh(); });
    toolbar.querySelector("#cltchBulkArchive").addEventListener("click", function () {
      selectedCards().forEach(function (card) {
        archived.hidden.push(card.dataset.bulkId);
      });
      archived.hidden = Array.from(new Set(archived.hidden)).slice(-200);
      writeJsonStorage(archivedKey, archived);
      refresh();
    });
    toolbar.querySelector("#cltchBulkUnarchive").addEventListener("click", function () {
      archived.hidden = [];
      writeJsonStorage(archivedKey, archived);
      refresh();
    });
    toolbar.querySelector("#cltchBulkCopyNames").addEventListener("click", function () {
      var text = selectedCards().map(function (card) { return (card.querySelector("h3,h4,strong")?.textContent || card.textContent || "").trim().slice(0, 80); }).join("\n");
      if (!text) return;
      navigator.clipboard?.writeText(text).catch(function () {});
      showDexterityToast("Selected titles copied", 1400);
    });
    refresh();
    new MutationObserver(refresh).observe(gigList, { childList: true, subtree: true });
  }

  function initUndoActionHistoryTimeline() {
    if (document.getElementById("cltchUndoHistory")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_action_history_v1";
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchUndoHistory";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Undo + Action History</div><button type="button" id="cltchUndoLastBtn" class="cltch-exp-chip">Undo Last</button></div><div class="cltch-doc-list" id="cltchUndoHistoryList"></div>';
    main.appendChild(card);
    function add(action) {
      data.items.unshift({ action: action, at: Date.now() });
      data.items = data.items.slice(0, 40);
      writeJsonStorage(key, data);
      render();
    }
    function render() {
      var list = card.querySelector("#cltchUndoHistoryList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No tracked actions yet.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 10).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.action) + '</span><span class="cltch-exp-note">' + new Date(it.at).toLocaleTimeString() + "</span></div>";
      }).join("");
    }
    document.addEventListener("click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest("button, .cltch-exp-chip") : null;
      if (!btn || btn.id === "cltchUndoLastBtn") return;
      var label = String(btn.textContent || "").trim();
      if (!label) return;
      add(label.slice(0, 80));
    }, true);
    card.querySelector("#cltchUndoLastBtn").addEventListener("click", function () {
      var last = data.items.shift();
      writeJsonStorage(key, data);
      render();
      if (last) showDexterityToast("Undid: " + last.action, 1400);
    });
    render();
  }

  function initWhyNotMatchedDiagnostic() {
    if (!/^(gig-radar|musician-dashboard|musician-matched-gigs)\.html$/.test(pageName()) || document.getElementById("cltchWhyNotMatched")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchWhyNotMatched";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Why Not Matched</div><button type="button" id="cltchDiagnoseBtn" class="cltch-exp-chip">Diagnose</button></div><div class="cltch-doc-list" id="cltchWhyNotList"></div>';
    var anchor = document.getElementById("cltchMatchV2") || document.getElementById("analyticsPanel");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);
    card.querySelector("#cltchDiagnoseBtn").addEventListener("click", function () {
      var issues = [];
      var profileText = (document.getElementById("profileForm")?.textContent || document.body.textContent || "").toLowerCase();
      if (!/genre|style|performer/i.test(profileText)) issues.push("Profile style/genre signals are weak.");
      var live = Number(document.getElementById("metricLiveMatches")?.textContent || 0);
      if (live < 2) issues.push("Low live match volume in current queue.");
      var acceptance = Number((document.getElementById("metricAcceptanceRate")?.textContent || "0").replace(/[^\d]/g, "")) || 0;
      if (acceptance < 25) issues.push("Acceptance rate is low; match confidence decreases.");
      var verify = readJsonStorage("cltch_verification_stack_v1", { id: false, payout: false });
      if (!verify.id || !verify.payout) issues.push("Verification is incomplete.");
      if (!issues.length) issues.push("No major blockers detected. Keep response speed high.");
      card.querySelector("#cltchWhyNotList").innerHTML = issues.map(function (t) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(t) + '</span><span class="cltch-pill warn">Signal</span></div>';
      }).join("");
    });
  }

  function initConversionFunnelCards() {
    if (document.getElementById("cltchConversionFunnel")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchConversionFunnel";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Conversion Funnel</div><button type="button" id="cltchFunnelRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchFunnelView">0</div><div class="cltch-metric-label">Views</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchFunnelApply">0</div><div class="cltch-metric-label">Apply/Offer</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchFunnelBooked">0</div><div class="cltch-metric-label">Booked</div></div></div><div class="cltch-exp-note" id="cltchFunnelNote" style="margin-top:8px;"></div>';
    var anchor = document.getElementById("analyticsPanel") || document.getElementById("hostQueueSummary");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else main.appendChild(card);
    function refresh() {
      var views = Math.max(1, Number(document.getElementById("metricLiveMatches")?.textContent || document.getElementById("hostStatOpen")?.textContent || 6));
      var apply = Math.max(0, Number(document.getElementById("metricAcceptedCount")?.textContent || document.getElementById("hostStatAccepted")?.textContent || 2));
      var booked = Math.max(0, Math.round(apply * 0.72));
      document.getElementById("cltchFunnelView").textContent = String(views);
      document.getElementById("cltchFunnelApply").textContent = String(apply);
      document.getElementById("cltchFunnelBooked").textContent = String(booked);
      document.getElementById("cltchFunnelNote").textContent = "View->apply " + Math.round((apply / views) * 100) + "%, apply->book " + Math.round((booked / Math.max(1, apply)) * 100) + "%.";
    }
    card.querySelector("#cltchFunnelRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initSmartDuplicateGigDetector() {
    if (pageName() !== "host.html" || document.getElementById("cltchDuplicateDetector")) return;
    var list = document.getElementById("gigList");
    if (!list) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchDuplicateDetector";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Duplicate Gig Detector</div><button type="button" id="cltchDupScan" class="cltch-exp-chip">Scan</button></div><div class="cltch-doc-list" id="cltchDupList"></div>';
    list.insertAdjacentElement("beforebegin", card);
    card.querySelector("#cltchDupScan").addEventListener("click", function () {
      var seen = {};
      var dups = [];
      list.querySelectorAll(".gig-card").forEach(function (el) {
        var key = (el.textContent || "").toLowerCase().replace(/\s+/g, " ").replace(/\$?\d+/g, "").slice(0, 180);
        if (!key.trim()) return;
        if (seen[key]) dups.push((el.querySelector("h3,h4,strong")?.textContent || "Possible duplicate").trim());
        else seen[key] = true;
      });
      card.querySelector("#cltchDupList").innerHTML = dups.length
        ? dups.map(function (name) { return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(name) + '</span><span class="cltch-pill warn">Duplicate</span></div>'; }).join("")
        : '<div class="cltch-exp-note">No obvious duplicates detected.</div>';
    });
  }

  function initOfferCompetitivenessMeter() {
    if (pageName() !== "host.html" || document.getElementById("cltchOfferCompetitiveness")) return;
    var form = document.getElementById("gigForm");
    if (!form) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchOfferCompetitiveness";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Offer Competitiveness</div><div class="cltch-exp-chip" id="cltchOfferGrade">B</div></div><div class="cltch-bar-track"><div class="cltch-bar-fill" id="cltchOfferFill"></div></div><div class="cltch-exp-note" id="cltchOfferNote" style="margin-top:8px;">Set pay to see competitiveness.</div>';
    form.insertAdjacentElement("beforebegin", card);
    function refresh() {
      var pay = parseUsdFromText(document.getElementById("pay")?.value || "0");
      var avg = parseUsdFromText(document.getElementById("hostStatAvgPay")?.textContent || "$250") || 250;
      var ratio = pay > 0 ? (pay / avg) : 0.8;
      var pct = Math.max(10, Math.min(100, Math.round(ratio * 70)));
      var grade = ratio >= 1.2 ? "A" : (ratio >= 1 ? "B" : (ratio >= 0.8 ? "C" : "D"));
      card.querySelector("#cltchOfferFill").style.width = pct + "%";
      card.querySelector("#cltchOfferGrade").textContent = grade;
      card.querySelector("#cltchOfferNote").textContent = "Offer is " + Math.round(ratio * 100) + "% of local average (" + avg + ").";
    }
    form.addEventListener("input", refresh);
    refresh();
  }

  function initHostResponseSlaCountdowns() {
    if (pageName() !== "host.html" || document.getElementById("cltchHostSlaCountdown")) return;
    var mount = document.querySelector(".ops-panel") || markMainContent();
    if (!mount) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchHostSlaCountdown";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Host Response SLA</div><button type="button" id="cltchHostSlaReset" class="cltch-exp-chip">Reset</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchHostSlaRemain">06:00</div><div class="cltch-metric-label">Time left</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchHostSlaState">On time</div><div class="cltch-metric-label">State</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchHostSlaTarget">6h</div><div class="cltch-metric-label">Target</div></div></div>';
    mount.insertAdjacentElement("afterend", card);
    var key = "cltch_host_sla_timer_v1";
    var timer = readJsonStorage(key, { start: Date.now(), hours: 6 });
    function draw() {
      var end = timer.start + (timer.hours * 3600000);
      var remain = Math.max(0, end - Date.now());
      var h = Math.floor(remain / 3600000);
      var m = Math.floor((remain % 3600000) / 60000);
      card.querySelector("#cltchHostSlaRemain").textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      card.querySelector("#cltchHostSlaState").textContent = remain > 0 ? "On time" : "Breached";
    }
    card.querySelector("#cltchHostSlaReset").addEventListener("click", function () {
      timer.start = Date.now();
      writeJsonStorage(key, timer);
      draw();
    });
    draw();
    window.setInterval(draw, 30000);
  }

  function initPerformerResponseSlaCountdowns() {
    if (!/^(gig-radar|musician-dashboard|musician-matched-gigs)\.html$/.test(pageName()) || document.getElementById("cltchPerfSlaCountdown")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPerfSlaCountdown";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Performer Response SLA</div><button type="button" id="cltchPerfSlaReset" class="cltch-exp-chip">Reset</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchPerfSlaRemain">03:00</div><div class="cltch-metric-label">Time left</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchPerfSlaState">On time</div><div class="cltch-metric-label">State</div></div><div class="cltch-metric"><div class="cltch-metric-value">3h</div><div class="cltch-metric-label">Target</div></div></div>';
    main.appendChild(card);
    var key = "cltch_perf_sla_timer_v1:" + pageName();
    var timer = readJsonStorage(key, { start: Date.now(), hours: 3 });
    function draw() {
      var remain = Math.max(0, (timer.start + timer.hours * 3600000) - Date.now());
      var h = Math.floor(remain / 3600000);
      var m = Math.floor((remain % 3600000) / 60000);
      card.querySelector("#cltchPerfSlaRemain").textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      card.querySelector("#cltchPerfSlaState").textContent = remain > 0 ? "On time" : "Breached";
    }
    card.querySelector("#cltchPerfSlaReset").addEventListener("click", function () {
      timer.start = Date.now();
      writeJsonStorage(key, timer);
      draw();
    });
    draw();
    window.setInterval(draw, 30000);
  }

  function initQueueHealthAnomalyDetector() {
    if (document.getElementById("cltchQueueHealthAnomaly")) return;
    var list = document.getElementById("gigList");
    var main = markMainContent();
    if (!list || !main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchQueueHealthAnomaly";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Queue Health Detector</div><button type="button" id="cltchQueueScan" class="cltch-exp-chip">Scan</button></div><div class="cltch-doc-list" id="cltchQueueFlags"></div>';
    list.insertAdjacentElement("beforebegin", card);
    function scan() {
      var cards = Array.prototype.slice.call(list.querySelectorAll(".gig-card"));
      var anomalies = [];
      if (cards.length === 0) anomalies.push("Queue is empty.");
      if (cards.length > 80) anomalies.push("Queue volume is unusually high.");
      var lowPayCount = cards.filter(function (c) { return parseUsdFromText(c.textContent || "") < 100; }).length;
      if (lowPayCount > Math.max(5, cards.length * 0.6)) anomalies.push("Large share of low-pay opportunities detected.");
      var duplicateDates = {};
      cards.forEach(function (c) {
        var d = extractIsoDate(c.textContent || "");
        if (d) duplicateDates[d] = (duplicateDates[d] || 0) + 1;
      });
      if (Object.keys(duplicateDates).some(function (k) { return duplicateDates[k] > 12; })) anomalies.push("Date clustering anomaly detected.");
      card.querySelector("#cltchQueueFlags").innerHTML = anomalies.length
        ? anomalies.map(function (a) { return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(a) + '</span><span class="cltch-pill warn">Flag</span></div>'; }).join("")
        : '<div class="cltch-exp-note">No major anomalies detected.</div>';
    }
    card.querySelector("#cltchQueueScan").addEventListener("click", scan);
    scan();
  }

  function initPredictiveNoShowWarning() {
    if (pageName() !== "booking.html" || document.getElementById("cltchNoShowPredict")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchNoShowPredict";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Predictive No-show Warning</div><button type="button" id="cltchNoShowRun" class="cltch-exp-chip">Analyze</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchNoShowPct">0%</div><div class="cltch-metric-label">No-show risk</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchNoShowClass">Low</div><div class="cltch-metric-label">Class</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchNoShowAction">Monitor</div><div class="cltch-metric-label">Action</div></div></div>';
    main.appendChild(card);
    function analyze() {
      var rep = readJsonStorage("cltch_reputation_snapshot_v2:booking.html", { noShowRisk: 10, responseMins: 10 });
      var disputes = Number((readJsonStorage("cltch_disputes_v1:default", { items: [] }).items || []).length);
      var incidents = Number((readJsonStorage("cltch_incidents_v1:default", []).length || 0));
      var risk = Math.min(85, Math.max(3, Number(rep.noShowRisk || 10) + (disputes * 6) + (incidents * 5)));
      var klass = risk >= 45 ? "High" : (risk >= 20 ? "Medium" : "Low");
      document.getElementById("cltchNoShowPct").textContent = risk + "%";
      document.getElementById("cltchNoShowClass").textContent = klass;
      document.getElementById("cltchNoShowAction").textContent = klass === "High" ? "Escalate" : (klass === "Medium" ? "Confirm" : "Monitor");
    }
    card.querySelector("#cltchNoShowRun").addEventListener("click", analyze);
    analyze();
  }

  function initSmartConflictAutoResolver() {
    var page = pageName();
    if (!/^(host|booking|musician-profile)\.html$/.test(page) || document.getElementById("cltchConflictResolver")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchConflictResolver";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Conflict Auto-Resolver</div><button type="button" id="cltchResolveConflicts" class="cltch-exp-chip">Resolve</button></div><div class="cltch-doc-list" id="cltchConflictList"></div>';
    main.appendChild(card);
    card.querySelector("#cltchResolveConflicts").addEventListener("click", function () {
      var blackout = readJsonStorage("cltch_availability_import_v1", { dates: [] });
      var blocked = new Set(Array.isArray(blackout.dates) ? blackout.dates : []);
      var conflicts = [];
      var dateValue = document.getElementById("date")?.value || extractIsoDate(document.getElementById("whenValue")?.textContent || "");
      if (dateValue && blocked.has(dateValue)) conflicts.push("Selected date conflicts with blackout date.");
      var next = new Date();
      while (blocked.has(next.toISOString().slice(0, 10))) next.setDate(next.getDate() + 1);
      if (conflicts.length) conflicts.push("Suggested replacement date: " + next.toISOString().slice(0, 10));
      card.querySelector("#cltchConflictList").innerHTML = conflicts.length
        ? conflicts.map(function (msg) { return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(msg) + '</span><span class="cltch-pill warn">Resolve</span></div>'; }).join("")
        : '<div class="cltch-exp-note">No conflicts found.</div>';
    });
  }

  function initAutoArchiveStaleOpportunities() {
    if (document.getElementById("cltchAutoArchiveStale")) return;
    var list = document.getElementById("gigList");
    if (!list) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchAutoArchiveStale";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Auto-Archive Stale</div><button type="button" id="cltchRunArchiveStale" class="cltch-exp-chip">Run</button></div><div class="cltch-exp-note" id="cltchArchiveStaleNote">Hide outdated opportunities older than threshold.</div>';
    list.insertAdjacentElement("beforebegin", card);
    card.querySelector("#cltchRunArchiveStale").addEventListener("click", function () {
      var hidden = 0;
      list.querySelectorAll(".gig-card").forEach(function (c) {
        var d = extractIsoDate(c.textContent || "");
        if (!d) return;
        var diff = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
        if (diff > 2) {
          c.style.display = "none";
          hidden += 1;
        }
      });
      card.querySelector("#cltchArchiveStaleNote").textContent = "Archived " + hidden + " stale opportunities.";
    });
  }

  function initReusableMessageTemplates() {
    if (document.getElementById("cltchTemplateLibrary")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchTemplateLibrary";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Template Library</div><button type="button" id="cltchTemplateCopy" class="cltch-exp-chip">Copy Template</button></div><div class="cltch-exp-row"><select id="cltchTemplateSelect" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="offer">Offer Follow-up</option><option value="booking">Booking Confirmation</option><option value="dispute">Dispute Clarification</option></select><input id="cltchTemplateName" type="text" placeholder="Performer/Host name" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><textarea id="cltchTemplatePreview" style="width:100%;min-height:90px;margin-top:8px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);padding:10px;"></textarea>';
    main.appendChild(card);
    function render() {
      var kind = card.querySelector("#cltchTemplateSelect").value;
      var name = String(card.querySelector("#cltchTemplateName").value || "there").trim();
      var text = kind === "offer"
        ? ("Hi " + name + ", following up on this opportunity. Please confirm interest within the SLA window.")
        : (kind === "booking"
          ? ("Hi " + name + ", booking is confirmed. Please review timeline, payout, and arrival checklist.")
          : ("Hi " + name + ", thanks for your note. Please share details so we can mediate quickly."));
      card.querySelector("#cltchTemplatePreview").value = text;
    }
    card.querySelector("#cltchTemplateSelect").addEventListener("change", render);
    card.querySelector("#cltchTemplateName").addEventListener("input", render);
    card.querySelector("#cltchTemplateCopy").addEventListener("click", function () {
      navigator.clipboard?.writeText(card.querySelector("#cltchTemplatePreview").value || "").catch(function () {});
      showDexterityToast("Template copied", 1200);
    });
    render();
  }

  function initGlobalCommandCenterPanel() {
    if (document.getElementById("cltchCommandCenter")) return;
    var center = document.createElement("aside");
    center.id = "cltchCommandCenter";
    center.className = "cltch-exp-card";
    center.style.position = "fixed";
    center.style.right = "calc(12px + var(--cltch-safe-right))";
    center.style.bottom = "calc(84px + var(--cltch-safe-bottom))";
    center.style.width = "min(320px, calc(100vw - 24px))";
    center.style.zIndex = "1180";
    center.style.display = "none";
    center.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Command Center</div><button type="button" id="cltchCmdClose" class="cltch-exp-chip">Close</button></div><div class="cltch-exp-row"><input id="cltchCmdSearch" type="search" placeholder="Quick search/action" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchCmdList"></div>';
    document.body.appendChild(center);
    var openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.id = "cltchCmdOpen";
    openBtn.className = "cltch-quickbtn";
    openBtn.style.position = "fixed";
    openBtn.style.right = "calc(12px + var(--cltch-safe-right))";
    openBtn.style.bottom = "calc(28px + var(--cltch-safe-bottom))";
    openBtn.style.zIndex = "1181";
    openBtn.textContent = "Command";
    document.body.appendChild(openBtn);
    var actions = [
      { label: "Open Quick Jump", run: function () { document.getElementById("cltchPalette")?.classList.add("open"); } },
      { label: "Open Accessibility", run: function () { document.getElementById("cltchAccessPanel")?.classList.add("open"); } },
      { label: "Scroll Top", run: function () { window.scrollTo({ top: 0, behavior: "smooth" }); } },
      { label: "Refresh Stats", run: function () { location.reload(); } }
    ];
    function render(filter) {
      var q = String(filter || "").toLowerCase();
      var list = center.querySelector("#cltchCmdList");
      list.innerHTML = actions.filter(function (a) { return !q || a.label.toLowerCase().indexOf(q) >= 0; }).map(function (a, idx) {
        return '<button type="button" class="cltch-exp-chip" data-cmd-run="' + idx + '">' + escapeHtml(a.label) + "</button>";
      }).join("");
      list.querySelectorAll("[data-cmd-run]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-cmd-run"));
          if (!actions[idx]) return;
          actions[idx].run();
        });
      });
    }
    openBtn.addEventListener("click", function () {
      center.style.display = center.style.display === "none" ? "block" : "none";
      if (center.style.display === "block") center.querySelector("#cltchCmdSearch")?.focus();
    });
    center.querySelector("#cltchCmdClose").addEventListener("click", function () { center.style.display = "none"; });
    center.querySelector("#cltchCmdSearch").addEventListener("input", function () { render(center.querySelector("#cltchCmdSearch").value); });
    render("");
  }

  function initSavedDashboardViews() {
    if (document.getElementById("cltchSavedViews")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_saved_views_v1:" + pageName();
    var data = readJsonStorage(key, { views: [] });
    if (!Array.isArray(data.views)) data.views = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSavedViews";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Saved Views</div></div><div class="cltch-exp-row"><input id="cltchViewName" type="text" maxlength="30" placeholder="View name" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><button type="button" id="cltchViewSave" class="cltch-exp-chip">Save Current</button></div><div class="cltch-doc-list" id="cltchViewList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchViewList");
      if (!data.views.length) {
        list.innerHTML = '<div class="cltch-exp-note">No saved views.</div>';
        return;
      }
      list.innerHTML = data.views.map(function (v, idx) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(v.name) + '</span><span><button type="button" class="cltch-exp-chip" data-view-apply="' + idx + '">Apply</button> <button type="button" class="cltch-exp-chip" data-view-del="' + idx + '">Delete</button></span></div>';
      }).join("");
      list.querySelectorAll("[data-view-apply]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-view-apply"));
          var view = data.views[idx];
          if (!view) return;
          window.scrollTo({ top: Number(view.scrollTop || 0), behavior: "smooth" });
        });
      });
      list.querySelectorAll("[data-view-del]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-view-del"));
          data.views.splice(idx, 1);
          writeJsonStorage(key, data);
          render();
        });
      });
    }
    card.querySelector("#cltchViewSave").addEventListener("click", function () {
      var name = String(card.querySelector("#cltchViewName").value || "").trim();
      if (!name) return;
      data.views.unshift({ name: name, scrollTop: window.scrollY, at: Date.now() });
      data.views = data.views.slice(0, 20);
      writeJsonStorage(key, data);
      card.querySelector("#cltchViewName").value = "";
      render();
    });
    render();
  }

  function initAccountHealthScorecard() {
    if (document.getElementById("cltchAccountHealthScore")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchAccountHealthScore";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Account Health</div><button type="button" id="cltchHealthRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchHealthScore">0</div><div class="cltch-metric-label">Score</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchHealthTrust">Low</div><div class="cltch-metric-label">Trust</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchHealthFix">-</div><div class="cltch-metric-label">Priority fix</div></div></div>';
    main.appendChild(card);
    function refresh() {
      var verify = readJsonStorage("cltch_verification_stack_v1", { id: false, payout: false, venue: false, background: false });
      var verifyScore = ["id", "payout", "venue", "background"].filter(function (k) { return !!verify[k]; }).length * 20;
      var reputation = Number((document.getElementById("cltchRelScore")?.textContent || "70").replace(/[^\d]/g, "")) || 70;
      var churnRisk = Number(document.getElementById("cltchRiskScore")?.textContent || 20);
      var score = Math.max(0, Math.min(100, Math.round((verifyScore * 0.4) + (reputation * 0.45) + ((100 - churnRisk) * 0.15))));
      document.getElementById("cltchHealthScore").textContent = String(score);
      document.getElementById("cltchHealthTrust").textContent = score >= 80 ? "High" : (score >= 60 ? "Medium" : "Low");
      document.getElementById("cltchHealthFix").textContent = !verify.id ? "Verify ID" : (!verify.payout ? "Verify payout" : (churnRisk > 50 ? "Re-engage" : "Maintain"));
    }
    card.querySelector("#cltchHealthRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initChurnCohortBreakdown() {
    var params = new URL(window.location.href).searchParams;
    var enabled = params.get("owner") === "1" || params.get("admin") === "1";
    if (!enabled || document.getElementById("cltchChurnCohorts")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchChurnCohorts";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Churn Cohorts</div><button type="button" id="cltchCohortRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchCohortLow">0</div><div class="cltch-metric-label">Low risk</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchCohortMid">0</div><div class="cltch-metric-label">Mid risk</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchCohortHigh">0</div><div class="cltch-metric-label">High risk</div></div></div>';
    main.appendChild(card);
    function refresh() {
      var base = Number(readJsonStorage("cltch_churn_automation_v1", { interventions: 1 }).interventions || 1);
      document.getElementById("cltchCohortLow").textContent = String(40 - Math.min(20, base));
      document.getElementById("cltchCohortMid").textContent = String(20 + Math.min(10, base));
      document.getElementById("cltchCohortHigh").textContent = String(8 + Math.min(12, base));
    }
    card.querySelector("#cltchCohortRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initReengagementCampaignLauncher() {
    if (document.getElementById("cltchReengageLauncher")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchReengageLauncher";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Re-engagement Launcher</div><button type="button" id="cltchLaunchCampaign" class="cltch-exp-chip">Launch</button></div><div class="cltch-exp-row"><select id="cltchCampaignType" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="idle_users">Idle users</option><option value="high_risk">High risk</option><option value="missed_offers">Missed offers</option></select><input id="cltchCampaignBonus" type="text" placeholder="Incentive (e.g. +10% visibility)" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchCampaignHistory"></div>';
    main.appendChild(card);
    var key = "cltch_reengage_campaigns_v1";
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    function render() {
      var list = card.querySelector("#cltchCampaignHistory");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No campaigns launched yet.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 8).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.type) + " / " + escapeHtml(it.bonus || "no bonus") + '</span><span class="cltch-exp-note">' + new Date(it.at).toLocaleDateString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchLaunchCampaign").addEventListener("click", function () {
      data.items.unshift({
        type: card.querySelector("#cltchCampaignType").value || "idle_users",
        bonus: String(card.querySelector("#cltchCampaignBonus").value || "").trim(),
        at: Date.now()
      });
      data.items = data.items.slice(0, 30);
      writeJsonStorage(key, data);
      render();
      pushInboxItem({ role: "general", level: "ok", title: "Campaign launched", body: "Re-engagement campaign queued." });
    });
    render();
  }

  function initNotificationQuietHoursController() {
    if (document.getElementById("cltchQuietHours")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_quiet_hours_v1";
    var prefs = readJsonStorage(key, { enabled: false, from: "22:00", to: "07:00" });
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchQuietHours";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Notification Quiet Hours</div><button type="button" id="cltchQuietSave" class="cltch-exp-chip">Save</button></div><div class="cltch-exp-row"><label class="cltch-exp-note"><input id="cltchQuietEnabled" type="checkbox"> Enable</label><input id="cltchQuietFrom" type="time" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><input id="cltchQuietTo" type="time" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-exp-note" id="cltchQuietNote" style="margin-top:8px;"></div>';
    main.appendChild(card);
    card.querySelector("#cltchQuietEnabled").checked = !!prefs.enabled;
    card.querySelector("#cltchQuietFrom").value = prefs.from || "22:00";
    card.querySelector("#cltchQuietTo").value = prefs.to || "07:00";
    function render() {
      card.querySelector("#cltchQuietNote").textContent = prefs.enabled
        ? ("Quiet hours active: " + prefs.from + " to " + prefs.to)
        : "Quiet hours disabled.";
    }
    card.querySelector("#cltchQuietSave").addEventListener("click", function () {
      prefs.enabled = !!card.querySelector("#cltchQuietEnabled").checked;
      prefs.from = card.querySelector("#cltchQuietFrom").value || "22:00";
      prefs.to = card.querySelector("#cltchQuietTo").value || "07:00";
      writeJsonStorage(key, prefs);
      render();
    });
    render();
  }

  function initPayoutDelayWarningCard() {
    if (document.getElementById("cltchPayoutDelayWarn")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPayoutDelayWarn";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Payout Delay Warning</div><button type="button" id="cltchPayoutWarnRun" class="cltch-exp-chip">Check</button></div><div class="cltch-exp-note" id="cltchPayoutWarnNote">No payout delay warning.</div>';
    main.appendChild(card);
    card.querySelector("#cltchPayoutWarnRun").addEventListener("click", function () {
      var escrow = readJsonStorage("cltch_escrow_v1:default", { total: 0, milestones: [] });
      var done = Array.isArray(escrow.milestones) ? escrow.milestones.filter(function (m) { return !!m.done; }).length : 0;
      var total = Array.isArray(escrow.milestones) ? escrow.milestones.length : 0;
      var contract = readJsonStorage("cltch_booking_contract_v1:default", { state: "draft" });
      var delayed = contract.state !== "released" && total > 0 && done >= total;
      card.querySelector("#cltchPayoutWarnNote").textContent = delayed
        ? "Milestones complete but payout not released. Escalate finance review."
        : "Payout status looks normal.";
    });
  }

  function initEscalationRoutingMatrix() {
    if (document.getElementById("cltchEscalationMatrix")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchEscalationMatrix";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Escalation Routing Matrix</div></div><div class="cltch-exp-row"><select id="cltchEscSeverity" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><button type="button" id="cltchEscRouteBtn" class="cltch-exp-chip">Route</button></div><div class="cltch-exp-note" id="cltchEscRouteNote" style="margin-top:8px;">Select severity to compute routing.</div>';
    main.appendChild(card);
    card.querySelector("#cltchEscRouteBtn").addEventListener("click", function () {
      var sev = card.querySelector("#cltchEscSeverity").value || "low";
      var route = sev === "critical" ? "Owner + Legal + Safety"
        : (sev === "high" ? "Ops Lead + Safety"
          : (sev === "medium" ? "Ops Queue Priority"
            : "Support Queue"));
      card.querySelector("#cltchEscRouteNote").textContent = "Route: " + route;
      pushInboxItem({ role: "general", level: sev === "low" ? "ok" : "warn", title: "Escalation routed", body: sev + " severity -> " + route });
    });
  }

  function initDisputeMediationRecommendationHelper() {
    if (pageName() !== "booking.html" || document.getElementById("cltchMediationHelper")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchMediationHelper";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Dispute Mediation Helper</div><button type="button" id="cltchMediationRun" class="cltch-exp-chip">Recommend</button></div><div class="cltch-doc-list" id="cltchMediationList"></div>';
    main.appendChild(card);
    card.querySelector("#cltchMediationRun").addEventListener("click", function () {
      var disputes = readJsonStorage("cltch_disputes_v1:" + (new URL(window.location.href).searchParams.get("id") || "default"), { items: [] });
      var items = Array.isArray(disputes.items) ? disputes.items : [];
      var rec = [];
      if (!items.length) rec.push("No active dispute. Mediation not required.");
      else {
        var hasPayment = items.some(function (d) { return /payment/i.test(d.type || ""); });
        var hasConduct = items.some(function (d) { return /conduct/i.test(d.type || ""); });
        if (hasPayment) rec.push("Recommend split settlement draft with escrow checkpoint.");
        if (hasConduct) rec.push("Recommend evidence review and communication boundary reset.");
        rec.push("Schedule mediation call within 24h SLA.");
      }
      card.querySelector("#cltchMediationList").innerHTML = rec.map(function (r) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(r) + '</span><span class="cltch-pill ok">Advice</span></div>';
      }).join("");
    });
  }

  function initReputationAppealRequestFlow() {
    if (document.getElementById("cltchReputationAppeal")) return;
    var page = pageName();
    if (!/^(host|gig-radar|musician-dashboard|musician-matched-gigs|musician-profile|host-profile)\.html$/.test(page)) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_reputation_appeals_v1";
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchReputationAppeal";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Reputation Appeal Request</div><button type="button" id="cltchAppealSubmit" class="cltch-exp-chip">Submit</button></div><div class="cltch-exp-row"><select id="cltchAppealReason" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="unfair_review">Unfair review</option><option value="cancellation_context">Cancellation context</option><option value="identity_update">Identity update</option></select><input id="cltchAppealNote" type="text" maxlength="140" placeholder="Appeal summary" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchAppealList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchAppealList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No appeals submitted.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 8).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.reason) + ": " + escapeHtml(it.note) + '</span><span class="cltch-pill warn">Pending</span></div>';
      }).join("");
    }
    card.querySelector("#cltchAppealSubmit").addEventListener("click", function () {
      var reason = card.querySelector("#cltchAppealReason").value || "unfair_review";
      var note = String(card.querySelector("#cltchAppealNote").value || "").trim();
      if (!note) return;
      data.items.unshift({ reason: reason, note: note, at: Date.now(), page: page });
      data.items = data.items.slice(0, 20);
      writeJsonStorage(key, data);
      card.querySelector("#cltchAppealNote").value = "";
      render();
      pushInboxItem({ role: inferRoleFromPage(), level: "warn", title: "Reputation appeal submitted", body: reason + " request queued for review." });
    });
    render();
  }

  function initVenueFeedbackDigestModule() {
    if (pageName() !== "host.html" || document.getElementById("cltchVenueFeedbackDigest")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchVenueFeedbackDigest";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Venue Feedback Digest</div><button type="button" id="cltchVenueDigestRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-doc-list" id="cltchVenueDigestList"></div>';
    main.appendChild(card);
    function refresh() {
      var quality = Number((document.getElementById("cltchVenueScore")?.textContent || "70").replace(/[^\d]/g, "")) || 70;
      var risk = Number((document.getElementById("cltchVenueCancelRisk")?.textContent || "15").replace(/[^\d]/g, "")) || 15;
      var notes = [
        "Readiness score: " + quality + "%",
        risk > 30 ? "Cancel risk trending high. tighten confirmations." : "Cancel risk stable.",
        quality < 80 ? "Recommended: complete venue profile fields." : "Profile completeness is strong."
      ];
      card.querySelector("#cltchVenueDigestList").innerHTML = notes.map(function (n) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(n) + '</span><span class="cltch-pill ok">Digest</span></div>';
      }).join("");
    }
    card.querySelector("#cltchVenueDigestRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initPerformerFeedbackDigestModule() {
    if (!/^(gig-radar|musician-dashboard|musician-matched-gigs|musician-profile)\.html$/.test(pageName()) || document.getElementById("cltchPerformerFeedbackDigest")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPerformerFeedbackDigest";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Performer Feedback Digest</div><button type="button" id="cltchPerformerDigestRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-doc-list" id="cltchPerformerDigestList"></div>';
    main.appendChild(card);
    function refresh() {
      var acc = Number((document.getElementById("metricAcceptanceRate")?.textContent || "40").replace(/[^\d]/g, "")) || 40;
      var rep = Number((document.getElementById("cltchRelScore")?.textContent || "70").replace(/[^\d]/g, "")) || 70;
      var items = [
        "Acceptance rate: " + acc + "%",
        "Reliability: " + rep + "%",
        acc < 30 ? "Improve response speed and adjust filters." : "Pipeline health is acceptable."
      ];
      card.querySelector("#cltchPerformerDigestList").innerHTML = items.map(function (n) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(n) + '</span><span class="cltch-pill ok">Digest</span></div>';
      }).join("");
    }
    card.querySelector("#cltchPerformerDigestRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initAutoGeneratedPostEventSurveys() {
    if (pageName() !== "booking.html" || document.getElementById("cltchPostEventSurvey")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var key = "cltch_post_event_surveys_v1:" + (new URL(window.location.href).searchParams.get("id") || "default");
    var data = readJsonStorage(key, { surveys: [] });
    if (!Array.isArray(data.surveys)) data.surveys = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPostEventSurvey";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Post-Event Surveys</div><button type="button" id="cltchSurveyGenerate" class="cltch-exp-chip">Generate</button></div><div class="cltch-doc-list" id="cltchSurveyList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchSurveyList");
      if (!data.surveys.length) {
        list.innerHTML = '<div class="cltch-exp-note">No surveys generated.</div>';
        return;
      }
      list.innerHTML = data.surveys.slice(0, 8).map(function (s) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">Survey #' + s.id + ': ' + escapeHtml(s.prompt) + '</span><span class="cltch-exp-note">' + new Date(s.at).toLocaleDateString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchSurveyGenerate").addEventListener("click", function () {
      data.surveys.unshift({
        id: (data.surveys[0]?.id || 0) + 1,
        prompt: "Rate booking quality, communication, and payout confidence (1-5).",
        at: Date.now()
      });
      data.surveys = data.surveys.slice(0, 30);
      writeJsonStorage(key, data);
      render();
    });
    render();
  }

  function initMilestoneRemindersTimeline() {
    if (document.getElementById("cltchMilestoneReminders")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_milestone_reminders_v1";
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchMilestoneReminders";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Milestone Reminders</div><button type="button" id="cltchMilestoneAdd" class="cltch-exp-chip">Add Reminder</button></div><div class="cltch-timeline-feed" id="cltchMilestoneList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchMilestoneList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No milestone reminders set.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 12).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.label) + '</span><span class="cltch-exp-note">' + new Date(it.when).toLocaleString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchMilestoneAdd").addEventListener("click", function () {
      var base = Date.now();
      data.items.unshift({ label: "Milestone reminder " + ((data.items[0]?.idx || 0) + 1), idx: (data.items[0]?.idx || 0) + 1, when: base + (2 * 3600000), at: base });
      data.items = data.items.slice(0, 30);
      writeJsonStorage(key, data);
      render();
    });
    render();
  }

  function initSessionHandoffNotesModule() {
    if (document.getElementById("cltchSessionHandoff")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_session_handoff_notes_v1:" + pageName();
    var data = readJsonStorage(key, { notes: [] });
    if (!Array.isArray(data.notes)) data.notes = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSessionHandoff";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Session Handoff Notes</div><button type="button" id="cltchHandoffSave" class="cltch-exp-chip">Save Note</button></div><textarea id="cltchHandoffInput" maxlength="220" placeholder="Leave notes for next shift/session." style="width:100%;min-height:80px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);padding:10px;"></textarea><div class="cltch-doc-list" id="cltchHandoffList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchHandoffList");
      if (!data.notes.length) {
        list.innerHTML = '<div class="cltch-exp-note">No handoff notes yet.</div>';
        return;
      }
      list.innerHTML = data.notes.slice(0, 10).map(function (n) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(n.text) + '</span><span class="cltch-exp-note">' + new Date(n.at).toLocaleTimeString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchHandoffSave").addEventListener("click", function () {
      var text = String(card.querySelector("#cltchHandoffInput").value || "").trim();
      if (!text) return;
      data.notes.unshift({ text: text, at: Date.now() });
      data.notes = data.notes.slice(0, 25);
      writeJsonStorage(key, data);
      card.querySelector("#cltchHandoffInput").value = "";
      render();
    });
    render();
  }

  function initFeatureFlagExperimentConsole() {
    var params = new URL(window.location.href).searchParams;
    var enabled = params.get("admin") === "1" || params.get("owner") === "1";
    if (!enabled || document.getElementById("cltchFeatureFlagConsole")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_feature_flags_v1";
    var flags = readJsonStorage(key, { fastMatch: true, strictSla: false, newInboxUI: true });
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchFeatureFlagConsole";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Feature Flags</div><button type="button" id="cltchFlagsSave" class="cltch-exp-chip">Save Flags</button></div><div class="cltch-doc-list"><label class="cltch-doc-item"><span style="font-size:12px;">fastMatch</span><input type="checkbox" id="cltchFlagFastMatch"></label><label class="cltch-doc-item"><span style="font-size:12px;">strictSla</span><input type="checkbox" id="cltchFlagStrictSla"></label><label class="cltch-doc-item"><span style="font-size:12px;">newInboxUI</span><input type="checkbox" id="cltchFlagInbox"></label></div>';
    main.appendChild(card);
    card.querySelector("#cltchFlagFastMatch").checked = !!flags.fastMatch;
    card.querySelector("#cltchFlagStrictSla").checked = !!flags.strictSla;
    card.querySelector("#cltchFlagInbox").checked = !!flags.newInboxUI;
    card.querySelector("#cltchFlagsSave").addEventListener("click", function () {
      writeJsonStorage(key, {
        fastMatch: !!card.querySelector("#cltchFlagFastMatch").checked,
        strictSla: !!card.querySelector("#cltchFlagStrictSla").checked,
        newInboxUI: !!card.querySelector("#cltchFlagInbox").checked,
        at: Date.now()
      });
      showDexterityToast("Feature flags saved", 1200);
    });
  }

  function initControlledExperimentsConsole() {
    var params = new URL(window.location.href).searchParams;
    var enabled = params.get("admin") === "1" || params.get("owner") === "1";
    if (!enabled || document.getElementById("cltchExperimentConsole")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_experiment_console_v1";
    var data = readJsonStorage(key, { cohortA: 50, metric: "conversion" });
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchExperimentConsole";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Controlled Experiments</div><button type="button" id="cltchExpSave" class="cltch-exp-chip">Save</button></div><div class="cltch-exp-row"><label class="cltch-exp-note">Cohort A % <input id="cltchExpCohortA" type="range" min="10" max="90" value="50"></label><select id="cltchExpMetric" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="conversion">Conversion</option><option value="retention">Retention</option><option value="response_time">Response Time</option></select><span class="cltch-exp-chip" id="cltchExpOut">50%</span></div>';
    main.appendChild(card);
    card.querySelector("#cltchExpCohortA").value = String(data.cohortA || 50);
    card.querySelector("#cltchExpMetric").value = data.metric || "conversion";
    function draw() {
      card.querySelector("#cltchExpOut").textContent = card.querySelector("#cltchExpCohortA").value + "%";
    }
    card.querySelector("#cltchExpCohortA").addEventListener("input", draw);
    card.querySelector("#cltchExpSave").addEventListener("click", function () {
      writeJsonStorage(key, {
        cohortA: Number(card.querySelector("#cltchExpCohortA").value || 50),
        metric: card.querySelector("#cltchExpMetric").value || "conversion",
        at: Date.now()
      });
      showDexterityToast("Experiment config saved", 1200);
    });
    draw();
  }

  function initLiveStatusBoardForOps() {
    var params = new URL(window.location.href).searchParams;
    var enabled = params.get("owner") === "1" || params.get("admin") === "1";
    if (!enabled || document.getElementById("cltchLiveStatusBoard")) return;
    var main = markMainContent();
    if (!main) return;
    var board = document.createElement("section");
    board.className = "cltch-exp-card";
    board.id = "cltchLiveStatusBoard";
    board.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Live Status Board</div><button type="button" id="cltchStatusRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value" id="cltchStatusAuth">OK</div><div class="cltch-metric-label">Auth</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchStatusQueue">OK</div><div class="cltch-metric-label">Queue</div></div><div class="cltch-metric"><div class="cltch-metric-value" id="cltchStatusPayouts">OK</div><div class="cltch-metric-label">Payouts</div></div></div>';
    main.insertBefore(board, main.firstChild);
    function refresh() {
      var breaches = Number(readJsonStorage("cltch_sla_engine_v1", { breaches: 0 }).breaches || 0);
      document.getElementById("cltchStatusAuth").textContent = navigator.onLine ? "OK" : "WARN";
      document.getElementById("cltchStatusQueue").textContent = breaches > 0 ? "WARN" : "OK";
      document.getElementById("cltchStatusPayouts").textContent = /Escalate finance review/i.test(document.getElementById("cltchPayoutWarnNote")?.textContent || "") ? "WARN" : "OK";
    }
    board.querySelector("#cltchStatusRefresh").addEventListener("click", refresh);
    refresh();
  }

  function initIncidentPostmortemBuilder() {
    if (document.getElementById("cltchPostmortemBuilder")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_postmortems_v1";
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPostmortemBuilder";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Incident Postmortem Builder</div><button type="button" id="cltchPostmortemCreate" class="cltch-exp-chip">Create</button></div><div class="cltch-exp-row"><input id="cltchPostmortemTitle" type="text" maxlength="70" placeholder="Incident title" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><input id="cltchPostmortemFix" type="text" maxlength="120" placeholder="Corrective action" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchPostmortemList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchPostmortemList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No postmortems yet.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 10).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.title) + " -> " + escapeHtml(it.fix) + '</span><span class="cltch-exp-note">' + new Date(it.at).toLocaleDateString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchPostmortemCreate").addEventListener("click", function () {
      var title = String(card.querySelector("#cltchPostmortemTitle").value || "").trim();
      var fix = String(card.querySelector("#cltchPostmortemFix").value || "").trim();
      if (!title || !fix) return;
      data.items.unshift({ title: title, fix: fix, at: Date.now() });
      data.items = data.items.slice(0, 30);
      writeJsonStorage(key, data);
      card.querySelector("#cltchPostmortemTitle").value = "";
      card.querySelector("#cltchPostmortemFix").value = "";
      render();
    });
    render();
  }

  function initTrustBadgeExplanationDrawer() {
    if (document.getElementById("cltchTrustDrawer")) return;
    var badge = document.getElementById("cltchIdentityBadge");
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("details");
    card.className = "cltch-exp-card";
    card.id = "cltchTrustDrawer";
    card.innerHTML = '<summary class="cltch-exp-title" style="cursor:pointer;">Trust Badge Explanation</summary><div class="cltch-doc-list" style="margin-top:8px;"><div class="cltch-doc-item"><span style="font-size:12px;">Identity verification contributes to trust badge tier.</span><span class="cltch-pill ok">ID</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Response reliability and cancellations affect badge confidence.</span><span class="cltch-pill warn">Behavior</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Recent disputes can temporarily lower trust visibility.</span><span class="cltch-pill warn">Risk</span></div></div>';
    if (badge) {
      var nav = document.querySelector("header nav");
      if (nav) nav.insertAdjacentElement("afterend", card);
      else main.appendChild(card);
    } else {
      main.appendChild(card);
    }
  }

  function initAnnouncementBannerManager() {
    var params = new URL(window.location.href).searchParams;
    var enabled = params.get("admin") === "1" || params.get("owner") === "1";
    if (!enabled || document.getElementById("cltchAnnouncementManager")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_announcement_banner_v1";
    var state = readJsonStorage(key, { text: "", level: "info", active: false });
    var panel = document.createElement("section");
    panel.className = "cltch-exp-card";
    panel.id = "cltchAnnouncementManager";
    panel.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Announcement Banner Manager</div><button type="button" id="cltchAnnounceSave" class="cltch-exp-chip">Publish</button></div><div class="cltch-exp-row"><label class="cltch-exp-note"><input id="cltchAnnounceActive" type="checkbox"> Active</label><select id="cltchAnnounceLevel" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="info">Info</option><option value="warn">Warn</option></select><input id="cltchAnnounceText" type="text" maxlength="120" placeholder="Banner message" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div>';
    main.appendChild(panel);
    panel.querySelector("#cltchAnnounceActive").checked = !!state.active;
    panel.querySelector("#cltchAnnounceLevel").value = state.level || "info";
    panel.querySelector("#cltchAnnounceText").value = state.text || "";
    panel.querySelector("#cltchAnnounceSave").addEventListener("click", function () {
      state = {
        active: !!panel.querySelector("#cltchAnnounceActive").checked,
        level: panel.querySelector("#cltchAnnounceLevel").value || "info",
        text: String(panel.querySelector("#cltchAnnounceText").value || "").trim(),
        at: Date.now()
      };
      writeJsonStorage(key, state);
      if (state.active && state.text) showDexterityToast(state.text, 2600);
    });
    if (state.active && state.text) {
      var bar = document.createElement("div");
      bar.className = "cltch-toast visible";
      bar.style.top = "calc(60px + var(--cltch-safe-top))";
      bar.style.bottom = "auto";
      bar.textContent = state.text;
      document.body.appendChild(bar);
      window.setTimeout(function () { bar.classList.remove("visible"); bar.remove(); }, 4200);
    }
  }

  function initWeeklyAvailabilityHeatScheduler() {
    if (document.getElementById("cltchAvailabilityHeat")) return;
    var page = pageName();
    if (!/^(musician-profile|host-profile|booking)\.html$/.test(page)) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchAvailabilityHeat";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Weekly Availability Heat</div></div><div class="cltch-heatmap" id="cltchHeatWeek"></div>';
    main.appendChild(card);
    var days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    card.querySelector("#cltchHeatWeek").innerHTML = days.map(function (d, idx) {
      var level = (idx % 4) + 1;
      return '<div class="cltch-heat-cell" data-level="' + level + '">' + d + "</div>";
    }).join("");
  }

  function initSeasonalDemandCalendarOverlay() {
    if (document.getElementById("cltchSeasonalDemand")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchSeasonalDemand";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Seasonal Demand Overlay</div></div><div class="cltch-doc-list"><div class="cltch-doc-item"><span style="font-size:12px;">Q1: recovery demand</span><span class="cltch-pill warn">Medium</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Q2: wedding/festival lift</span><span class="cltch-pill ok">High</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Q3: stable event volume</span><span class="cltch-pill ok">High</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Q4: holiday surge variance</span><span class="cltch-pill warn">Mixed</span></div></div>';
    main.appendChild(card);
  }

  function initGeographicDemandMapModule() {
    if (document.getElementById("cltchGeoDemandMap")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchGeoDemandMap";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Geographic Demand Map</div></div><div class="cltch-mini-grid"><div class="cltch-metric"><div class="cltch-metric-value">NE</div><div class="cltch-metric-label">High demand</div></div><div class="cltch-metric"><div class="cltch-metric-value">SE</div><div class="cltch-metric-label">Medium</div></div><div class="cltch-metric"><div class="cltch-metric-value">MW</div><div class="cltch-metric-label">Medium</div></div></div>';
    main.appendChild(card);
  }

  function initGenreStyleTrendIntelligencePanel() {
    if (document.getElementById("cltchTrendIntel")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchTrendIntel";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Genre/Style Trend Intel</div></div><div class="cltch-doc-list"><div class="cltch-doc-item"><span style="font-size:12px;">DJ/Open-format trending up</span><span class="cltch-pill ok">+14%</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Acoustic solo stable</span><span class="cltch-pill warn">+2%</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Live band premium slots rising</span><span class="cltch-pill ok">+9%</span></div></div>';
    main.appendChild(card);
  }

  function initRateBenchmarkingInsightsWidget() {
    if (document.getElementById("cltchRateBench")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchRateBench";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Rate Benchmarking</div><button type="button" id="cltchRateBenchRefresh" class="cltch-exp-chip">Refresh</button></div><div class="cltch-exp-note" id="cltchRateBenchNote">Benchmark pending.</div>';
    main.appendChild(card);
    card.querySelector("#cltchRateBenchRefresh").addEventListener("click", function () {
      var pay = parseUsdFromText(document.getElementById("pay")?.value || document.getElementById("payValue")?.textContent || "$0");
      var avg = parseUsdFromText(document.getElementById("hostStatAvgPay")?.textContent || "$250") || 250;
      var delta = pay ? Math.round(((pay - avg) / avg) * 100) : 0;
      card.querySelector("#cltchRateBenchNote").textContent = "Current vs market average: " + delta + "% (" + (delta >= 0 ? "above" : "below") + ").";
    });
  }

  function initRevenueLeakageDetector() {
    if (document.getElementById("cltchRevenueLeakage")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchRevenueLeakage";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Revenue Leakage Detector</div><button type="button" id="cltchLeakageScan" class="cltch-exp-chip">Scan</button></div><div class="cltch-doc-list" id="cltchLeakageList"></div>';
    main.appendChild(card);
    card.querySelector("#cltchLeakageScan").addEventListener("click", function () {
      var issues = [];
      var contract = readJsonStorage("cltch_booking_contract_v1:default", { state: "draft" });
      var escrow = readJsonStorage("cltch_escrow_v1:default", { total: 0, milestones: [] });
      if (contract.state === "completed" && contract.state !== "released") issues.push("Completed booking not released.");
      if ((escrow.total || 0) > 0 && (escrow.depositPct || 0) === 0) issues.push("No deposit configured on active escrow.");
      if (!issues.length) issues.push("No obvious leakage signals.");
      card.querySelector("#cltchLeakageList").innerHTML = issues.map(function (i) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(i) + '</span><span class="cltch-pill warn">Check</span></div>';
      }).join("");
    });
  }

  function initPaymentMethodSuccessRateWidget() {
    if (document.getElementById("cltchPayMethodSuccess")) return;
    var main = markMainContent();
    if (!main) return;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchPayMethodSuccess";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Payment Method Success</div></div><div class="cltch-doc-list"><div class="cltch-doc-item"><span style="font-size:12px;">Apple Pay</span><span class="cltch-pill ok">97%</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Google Pay</span><span class="cltch-pill ok">94%</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Card</span><span class="cltch-pill warn">89%</span></div></div>';
    main.appendChild(card);
  }

  function initDealRoomActivityRecorder() {
    if (pageName() !== "booking.html" || document.getElementById("cltchDealRoomRecorder")) return;
    var main = document.querySelector("main.container");
    if (!main) return;
    var key = "cltch_deal_room_log_v1:" + (new URL(window.location.href).searchParams.get("id") || "default");
    var data = readJsonStorage(key, { items: [] });
    if (!Array.isArray(data.items)) data.items = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchDealRoomRecorder";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Deal Room Recorder</div><button type="button" id="cltchDealRoomRecord" class="cltch-exp-chip">Record Event</button></div><div class="cltch-doc-list" id="cltchDealRoomList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchDealRoomList");
      if (!data.items.length) {
        list.innerHTML = '<div class="cltch-exp-note">No deal-room events logged.</div>';
        return;
      }
      list.innerHTML = data.items.slice(0, 14).map(function (it) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(it.event) + '</span><span class="cltch-exp-note">' + new Date(it.at).toLocaleTimeString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchDealRoomRecord").addEventListener("click", function () {
      data.items.unshift({ event: "Negotiation checkpoint recorded", at: Date.now() });
      data.items = data.items.slice(0, 40);
      writeJsonStorage(key, data);
      render();
    });
    render();
  }

  function initLegalComplianceChecklistAssistant() {
    if (document.getElementById("cltchLegalChecklist")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_legal_checklist_v1";
    var state = readJsonStorage(key, { items: [false, false, false, false] });
    if (!Array.isArray(state.items)) state.items = [false, false, false, false];
    var labels = ["Terms accepted", "Privacy notice acknowledged", "Cancellation policy reviewed", "Payout policy acknowledged"];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchLegalChecklist";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Legal/Compliance Checklist</div><div class="cltch-exp-chip" id="cltchLegalPct">0%</div></div><div class="cltch-doc-list" id="cltchLegalList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchLegalList");
      list.innerHTML = labels.map(function (lbl, idx) {
        return '<label class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(lbl) + '</span><input type="checkbox" data-legal-check="' + idx + '"' + (state.items[idx] ? " checked" : "") + "></label>";
      }).join("");
      list.querySelectorAll("[data-legal-check]").forEach(function (el) {
        el.addEventListener("change", function () {
          var idx = Number(el.getAttribute("data-legal-check"));
          if (!Number.isFinite(idx)) return;
          state.items[idx] = !!el.checked;
          writeJsonStorage(key, state);
          render();
        });
      });
      var pct = Math.round((state.items.filter(Boolean).length / labels.length) * 100);
      card.querySelector("#cltchLegalPct").textContent = pct + "%";
    }
    render();
  }

  function initConsentWaiverTracker() {
    if (document.getElementById("cltchConsentWaiver")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_consent_waivers_v1";
    var data = readJsonStorage(key, { waivers: [] });
    if (!Array.isArray(data.waivers)) data.waivers = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchConsentWaiver";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Consent + Waiver Tracker</div><button type="button" id="cltchWaiverAdd" class="cltch-exp-chip">Add Waiver</button></div><div class="cltch-exp-row"><input id="cltchWaiverName" type="text" maxlength="50" placeholder="Waiver name" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchWaiverList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchWaiverList");
      if (!data.waivers.length) {
        list.innerHTML = '<div class="cltch-exp-note">No waivers tracked.</div>';
        return;
      }
      list.innerHTML = data.waivers.map(function (w) {
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(w.name) + '</span><span class="cltch-exp-note">' + new Date(w.at).toLocaleDateString() + "</span></div>";
      }).join("");
    }
    card.querySelector("#cltchWaiverAdd").addEventListener("click", function () {
      var name = String(card.querySelector("#cltchWaiverName").value || "").trim();
      if (!name) return;
      data.waivers.unshift({ name: name, at: Date.now() });
      data.waivers = data.waivers.slice(0, 30);
      writeJsonStorage(key, data);
      card.querySelector("#cltchWaiverName").value = "";
      render();
    });
    render();
  }

  function initEventDocumentExpirationMonitor() {
    if (document.getElementById("cltchDocExpiryMonitor")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_doc_expiry_v1";
    var data = readJsonStorage(key, { docs: [] });
    if (!Array.isArray(data.docs)) data.docs = [];
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchDocExpiryMonitor";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Document Expiration Monitor</div><button type="button" id="cltchDocExpiryAdd" class="cltch-exp-chip">Track</button></div><div class="cltch-exp-row"><input id="cltchDocExpiryName" type="text" maxlength="40" placeholder="Document name" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><input id="cltchDocExpiryDate" type="date" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"></div><div class="cltch-doc-list" id="cltchDocExpiryList"></div>';
    main.appendChild(card);
    function render() {
      var list = card.querySelector("#cltchDocExpiryList");
      if (!data.docs.length) {
        list.innerHTML = '<div class="cltch-exp-note">No tracked documents.</div>';
        return;
      }
      list.innerHTML = data.docs.map(function (d) {
        var days = Math.round((new Date(d.date).getTime() - Date.now()) / 86400000);
        return '<div class="cltch-doc-item"><span style="font-size:12px;">' + escapeHtml(d.name) + " (" + escapeHtml(d.date) + ')</span><span class="cltch-pill ' + (days < 15 ? "warn" : "ok") + '">' + days + "d</span></div>";
      }).join("");
    }
    card.querySelector("#cltchDocExpiryAdd").addEventListener("click", function () {
      var name = String(card.querySelector("#cltchDocExpiryName").value || "").trim();
      var date = String(card.querySelector("#cltchDocExpiryDate").value || "").trim();
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      data.docs.unshift({ name: name, date: date, at: Date.now() });
      data.docs = data.docs.slice(0, 40);
      writeJsonStorage(key, data);
      card.querySelector("#cltchDocExpiryName").value = "";
      card.querySelector("#cltchDocExpiryDate").value = "";
      render();
    });
    render();
  }

  function initRoleSpecificOnboardingTours() {
    if (document.getElementById("cltchRoleTours")) return;
    var main = markMainContent();
    if (!main) return;
    var role = inferRoleFromPage();
    var tours = {
      host: ["Post first gig", "Set payout method", "Review queue stats"],
      performer: ["Tune profile", "Apply quick filters", "Respond to top matches fast"],
      booking: ["Confirm timeline", "Check reminders", "Close with review"],
      general: ["Set preferences", "Use command center", "Check notifications"]
    };
    var items = tours[role] || tours.general;
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchRoleTours";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Role Onboarding Tour</div><span class="cltch-exp-chip">' + escapeHtml(role) + '</span></div><div class="cltch-doc-list">' + items.map(function (it, idx) { return '<div class="cltch-doc-item"><span style="font-size:12px;">Step ' + (idx + 1) + ": " + escapeHtml(it) + "</span></div>"; }).join("") + "</div>";
    main.appendChild(card);
  }

  function initAccessibilityPreferencePresets() {
    if (document.getElementById("cltchA11yPresets")) return;
    var main = markMainContent();
    if (!main) return;
    var key = "cltch_access_preset_v1";
    var preset = readJsonStorage(key, { value: "default" });
    var card = document.createElement("section");
    card.className = "cltch-exp-card";
    card.id = "cltchA11yPresets";
    card.innerHTML = '<div class="cltch-exp-head"><div class="cltch-exp-title">Accessibility Presets</div><button type="button" id="cltchA11yPresetApply" class="cltch-exp-chip">Apply</button></div><div class="cltch-exp-row"><select id="cltchA11yPresetSel" style="min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--cltch-line);background:var(--cltch-surface);color:var(--cltch-text);"><option value="default">Default</option><option value="high_contrast">High Contrast</option><option value="large_text">Large Text</option><option value="focus_boost">Focus Boost</option></select></div>';
    main.appendChild(card);
    card.querySelector("#cltchA11yPresetSel").value = preset.value || "default";
    card.querySelector("#cltchA11yPresetApply").addEventListener("click", function () {
      var value = card.querySelector("#cltchA11yPresetSel").value || "default";
      writeJsonStorage(key, { value: value, at: Date.now() });
      if (value === "high_contrast") document.body.classList.add("cltch-a11y-high-contrast");
      if (value === "large_text") document.documentElement.style.fontSize = "18px";
      if (value === "default") {
        document.body.classList.remove("cltch-a11y-high-contrast");
        document.documentElement.style.fontSize = "";
      }
      showDexterityToast("Accessibility preset applied", 1400);
    });
  }

  function initKeyboardCommandCheatsheetOverlay() {
    if (document.getElementById("cltchShortcutCheatsheet")) return;
    var overlay = document.createElement("div");
    overlay.id = "cltchShortcutCheatsheet";
    overlay.className = "cltch-access-panel";
    overlay.innerHTML = '<div class="cltch-access-scrim" data-shortcut-close="true"></div><div class="cltch-access-card" role="dialog" aria-modal="true" aria-label="Keyboard command cheatsheet"><div class="cltch-access-head"><div class="cltch-access-title">Keyboard Cheatsheet</div><button type="button" class="cltch-access-close" data-shortcut-close="true">Close</button></div><div class="cltch-access-body"><div class="cltch-doc-list"><div class="cltch-doc-item"><span style="font-size:12px;">Ctrl/Cmd + K</span><span class="cltch-exp-note">Open quick jump</span></div><div class="cltch-doc-item"><span style="font-size:12px;">/</span><span class="cltch-exp-note">Focus search / quick jump</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Alt + 1/2/3</span><span class="cltch-exp-note">Role shortcuts</span></div><div class="cltch-doc-item"><span style="font-size:12px;">Esc</span><span class="cltch-exp-note">Close panel/input</span></div><div class="cltch-doc-item"><span style="font-size:12px;">?</span><span class="cltch-exp-note">Toggle this cheatsheet</span></div></div></div></div>';
    document.body.appendChild(overlay);
    function open() { overlay.classList.add("open"); }
    function close() { overlay.classList.remove("open"); }
    overlay.addEventListener("click", function (event) {
      if (event.target && event.target.getAttribute && event.target.getAttribute("data-shortcut-close")) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "?" && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        if (overlay.classList.contains("open")) close();
        else open();
      }
    });
  }

  function initExperienceLayoutManager() {
    var page = pageName();
    var placements = {
      "host.html": [
        { id: "cltchPayoutEstimator", anchor: "gigForm", position: "beforebegin" },
        { id: "cltchTravelCheck", anchor: "gigForm", position: "beforebegin" },
        { id: "cltchPricingAutopilot", anchor: "gigForm", position: "beforebegin" },
        { id: "cltchHostGateCard", anchor: "gigForm", position: "beforebegin" },
        { id: "cltchTrustMetrics", anchor: "hostQueueSummary", position: "afterend" },
        { id: "cltchEscrowMilestones", anchor: "cltchTrustMetrics", position: "afterend" }
      ],
      "gig-radar.html": [
        { id: "cltchSavedSearchCard", anchor: "queueControlsBar", position: "afterend" },
        { id: "cltchPerformerInsights", anchor: "analyticsPanel", position: "afterend" },
        { id: "cltchTrustMetrics", anchor: "cltchPerformerInsights", position: "afterend" }
      ],
      "musician-dashboard.html": [
        { id: "cltchSavedSearchCard", anchor: "queueControlsBar", position: "afterend" },
        { id: "cltchPerformerInsights", anchor: "analyticsPanel", position: "afterend" },
        { id: "cltchTrustMetrics", anchor: "cltchPerformerInsights", position: "afterend" }
      ],
      "musician-matched-gigs.html": [
        { id: "cltchSavedSearchCard", anchor: "queueControlsBar", position: "afterend" },
        { id: "cltchPerformerInsights", anchor: "analyticsPanel", position: "afterend" },
        { id: "cltchTrustMetrics", anchor: "cltchPerformerInsights", position: "afterend" }
      ],
      "booking.html": [
        { id: "cltchBookingTools", anchor: "bookingActions", position: "afterend" },
        { id: "cltchBookingOpsExt", anchor: "cltchBookingTools", position: "afterend" },
        { id: "cltchSlaEngine", anchor: "cltchBookingOpsExt", position: "afterend" },
        { id: "cltchRouteLogistics", anchor: "cltchSlaEngine", position: "afterend" },
        { id: "cltchEvidenceVault", anchor: "cltchRouteLogistics", position: "afterend" },
        { id: "cltchSmartContract", anchor: "cltchEvidenceVault", position: "afterend" },
        { id: "cltchEscrowMilestones", anchor: "cltchSmartContract", position: "afterend" }
      ]
    };
    var rules = placements[page] || [];
    rules.forEach(function (rule) {
      var el = document.getElementById(rule.id);
      var anchor = document.getElementById(rule.anchor);
      if (!el || !anchor) return;
      if (rule.position === "beforebegin") anchor.insertAdjacentElement("beforebegin", el);
      else anchor.insertAdjacentElement("afterend", el);
    });
  }

  var cltchAuthGatePromise = null;

  function whenAuthenticatedUser(callback) {
    if (typeof callback !== "function") return;
    if (!cltchAuthGatePromise) {
      cltchAuthGatePromise = import("./app/firebase-client.js")
        .then(function (client) {
          return import("https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js").then(function (authMod) {
            return new Promise(function (resolve) {
              var settled = false;
              var fallbackTimer = window.setTimeout(function () {
                if (settled) return;
                settled = true;
                resolve(null);
              }, 5000);
              var unsubscribe = authMod.onAuthStateChanged(client.auth, function (user) {
                if (settled) return;
                settled = true;
                window.clearTimeout(fallbackTimer);
                if (typeof unsubscribe === "function") unsubscribe();
                resolve(user || null);
              }, function () {
                if (settled) return;
                settled = true;
                window.clearTimeout(fallbackTimer);
                resolve(null);
              });
            });
          });
        })
        .catch(function () {
          return null;
        });
    }

    cltchAuthGatePromise.then(function (user) {
      if (!user) return;
      callback(user);
    });
  }

  function initWorkspaceNavigationDexterity() {
    document.querySelectorAll(".workspace-tabs, .mode-toggle").forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll(".workspace-tab, .mode-btn"));
      if (!items.length || group.dataset.dexterityReady === "true") return;
      group.dataset.dexterityReady = "true";
      var active = items.find(function (item) {
        return item.classList.contains("active") || item.getAttribute("aria-current") === "page" || item.getAttribute("aria-selected") === "true";
      }) || items[0];
      if (active && typeof active.scrollIntoView === "function") {
        active.scrollIntoView({ block: "nearest", inline: "center" });
      }
      group.addEventListener("keydown", function (event) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        var current = items.indexOf(document.activeElement);
        if (current === -1) current = items.indexOf(active);
        if (current === -1) current = 0;
        event.preventDefault();
        if (event.key === "Home") current = 0;
        else if (event.key === "End") current = items.length - 1;
        else if (event.key === "ArrowRight") current = (current + 1) % items.length;
        else if (event.key === "ArrowLeft") current = (current - 1 + items.length) % items.length;
        var target = items[current];
        if (!target) return;
        target.focus();
        if (typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ block: "nearest", inline: "center" });
        }
      });
    });
  }

  function initCommandSearchDexterity() {
    document.querySelectorAll(".command-search").forEach(function (input, index) {
      if (input.dataset.dexterityReady === "true") return;
      input.dataset.dexterityReady = "true";
      if (!input.id) input.id = "cltchCommandSearch" + index;
      var scope = input.closest(".command-bar, .dash-section, .queue-card, .form-card, .container, main") || document;
      var cards = Array.prototype.slice.call(scope.querySelectorAll(".gig-card, .booked-card, .review-card, .queue-card, .review-card, .analytics-card"));
      if (!cards.length) return;

      var wrap = document.createElement("div");
      wrap.className = "cltch-search-meta";
      wrap.innerHTML =
        '<span class="cltch-search-count" aria-live="polite"></span>' +
        '<button type="button" class="cltch-search-clear" hidden>Clear</button>';
      input.insertAdjacentElement("afterend", wrap);
      var count = wrap.querySelector(".cltch-search-count");
      var clear = wrap.querySelector(".cltch-search-clear");

      function update() {
        var query = String(input.value || "").trim().toLowerCase();
        var visible = 0;
        cards.forEach(function (card) {
          var match = !query || (card.textContent || "").toLowerCase().indexOf(query) !== -1;
          card.hidden = !match;
          card.classList.toggle("cltch-search-hit", !!query && match);
          if (match) visible++;
        });
        count.textContent = query ? visible + " matching results" : cards.length + " items in view";
        clear.hidden = !query;
      }

      input.addEventListener("input", update);
      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && input.value) {
          event.preventDefault();
          input.value = "";
          update();
          showDexterityToast("Search cleared", 1200);
        }
      });
      clear.addEventListener("click", function () {
        input.value = "";
        update();
        input.focus();
      });
      update();
    });
  }

  function initFormProgressDexterity() {
    document.querySelectorAll("form").forEach(function (form, index) {
      if (form.dataset.dexterityProgress === "true") return;
      var fields = Array.prototype.slice.call(form.querySelectorAll("input, select, textarea"))
        .filter(function (field) {
          return field.type !== "hidden" && field.type !== "submit" && !field.disabled;
        });
      var requiredFields = fields.filter(function (field) { return field.required; });
      if (fields.length < 4 || !requiredFields.length) return;
      form.dataset.dexterityProgress = "true";
      if (!form.id) form.id = "cltchForm" + index;

      var guide = document.createElement("div");
      guide.className = "cltch-form-progress";
      guide.innerHTML =
        '<div class="cltch-form-progress-copy">' +
          '<strong>Completion guide</strong>' +
          '<span class="cltch-form-progress-text" aria-live="polite"></span>' +
        '</div>' +
        '<div class="cltch-form-progress-bar"><span></span></div>';
      form.insertBefore(guide, form.firstChild);
      var text = guide.querySelector(".cltch-form-progress-text");
      var fill = guide.querySelector(".cltch-form-progress-bar span");

      function fieldComplete(field) {
        if (field.type === "checkbox" || field.type === "radio") return !!field.checked;
        return !!String(field.value || "").trim();
      }

      function update() {
        var complete = requiredFields.filter(fieldComplete).length;
        var total = Math.max(1, requiredFields.length);
        var percent = Math.max(10, Math.round((complete / total) * 100));
        text.textContent = complete === total
          ? "All required fields are ready."
          : complete + " of " + total + " required fields complete";
        fill.style.width = percent + "%";
        guide.classList.toggle("complete", complete === total);
      }

      fields.forEach(function (field) {
        field.addEventListener("input", update);
        field.addEventListener("change", update);
        field.addEventListener("blur", update);
      });

      form.addEventListener("submit", function () {
        var invalid = fields.find(function (field) {
          return typeof field.checkValidity === "function" && !field.checkValidity();
        });
        if (invalid) {
          window.setTimeout(function () {
            if (typeof invalid.focus === "function") invalid.focus();
            if (typeof invalid.scrollIntoView === "function") {
              invalid.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          }, 0);
          showDexterityToast("Finish the highlighted field to continue", 2200);
        }
      });

      update();
    });
  }

  function initCardTableLayouts() {
    var targets = [
      { id: "gigList", label: "Active cards", title: "Live Card Table", subtitle: "Keep fast-moving opportunities in a denser board or flatten them into a clean list." },
      { id: "upcomingList", label: "Upcoming cards", title: "Upcoming Card Table", subtitle: "Switch accepted bookings between a roomy schedule board and a tighter list." },
      { id: "matchedQueueList", label: "Matched cards", title: "Matched Card Table", subtitle: "Review matched opportunities in whichever density fits the moment." },
      { id: "myReviewsList", label: "Review cards", title: "Review Card Table", subtitle: "Spread feedback cards out for reading or collapse them for scanning." }
    ];

    targets.forEach(function (target) {
      var list = document.getElementById(target.id);
      if (!list || list.dataset.cardTableReady === "true") return;
      var section = list.closest(".dash-section, .queue-card, .reviews-section, .posted-gigs");
      if (!section) return;
      list.dataset.cardTableReady = "true";
      section.classList.add("cltch-card-table");
      list.classList.add("cltch-card-table-grid");

      var storageKey = "cltch_card_layout_v1:" + target.id;
      var savedLayout = "board";
      try {
        savedLayout = window.localStorage.getItem(storageKey) || "board";
      } catch (error) {}
      if (!/^(board|compact|list)$/.test(savedLayout)) savedLayout = "board";

      var toolbar = document.createElement("div");
      toolbar.className = "cltch-card-table-toolbar";
      toolbar.innerHTML =
        '<div class="cltch-card-table-copy">' +
          '<strong>' + escapeHtml(target.title || "Card Table") + '</strong>' +
          '<span>' + escapeHtml(target.subtitle || (target.label + " can switch between board, compact, and list density.")) + '</span>' +
        '</div>' +
        '<div class="cltch-card-table-summary">' +
          '<span class="cltch-card-table-chip">' + escapeHtml(target.label) + '</span>' +
          '<span class="cltch-card-table-count" aria-live="polite">0 items</span>' +
        '</div>' +
        '<div class="cltch-card-table-actions">' +
          '<button type="button" class="cltch-card-layout-btn" data-layout="board">Board</button>' +
          '<button type="button" class="cltch-card-layout-btn" data-layout="compact">Compact</button>' +
          '<button type="button" class="cltch-card-layout-btn" data-layout="list">List</button>' +
        '</div>';
      list.insertAdjacentElement("beforebegin", toolbar);
      var countEl = toolbar.querySelector(".cltch-card-table-count");

      function updateCount() {
        if (!countEl) return;
        var cards = Array.prototype.slice.call(list.children).filter(function (child) {
          if (!child || child.hidden) return false;
          return child.classList && (child.classList.contains("gig-card") || child.classList.contains("booked-card") || child.classList.contains("review-card") || child.classList.contains("matched-gig-card"));
        });
        countEl.textContent = cards.length + " item" + (cards.length === 1 ? "" : "s");
        section.classList.toggle("cltch-card-table-empty", cards.length === 0);
      }

      function apply(layout) {
        var next = /^(board|compact|list)$/.test(layout) ? layout : "board";
        list.setAttribute("data-card-layout", next);
        section.setAttribute("data-card-layout", next);
        toolbar.querySelectorAll(".cltch-card-layout-btn").forEach(function (button) {
          var active = button.getAttribute("data-layout") === next;
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        try {
          window.localStorage.setItem(storageKey, next);
        } catch (error) {}
      }

      toolbar.querySelectorAll(".cltch-card-layout-btn").forEach(function (button) {
        button.addEventListener("click", function () {
          var layout = button.getAttribute("data-layout") || "board";
          apply(layout);
          showDexterityToast("Card table: " + layout + " view", 1400);
        });
      });

      if ("MutationObserver" in window) {
        new MutationObserver(updateCount).observe(list, { childList: true, subtree: false, attributes: true, attributeFilter: ["hidden", "class"] });
      }

      apply(savedLayout);
      updateCount();
    });
  }

  function initExperienceAddons() {
    initWorkspaceNavigationDexterity();
    initCommandSearchDexterity();
    initFormProgressDexterity();
    initCardTableLayouts();
    initNotificationCenter();
    initSavedSearchAndAlerts();
    initGigCardEnhancements();
    initHostPostingReadiness();
    initBookingExperienceTools();
    initBookingOpsExtensions();
    initTrustMetricsCards();
    initOnboardingWizard();
    initPayoutEstimatorAndTemplates();
    initTravelFeasibilityCheck();
    initPerformerInsights();
    initOfferExpirationAndCancelGuard();
    initCrossRoleSwitchAndSessionRecovery();
    initGuidedEmptyStatesAndExport();
    initWaitlistAutofillAndRepricing();
    initDisputeAndIdentityBadges();
    initPortfolioAndVenueQuality();
    initBookingReadinessAndReminders();
    initAvailabilityImportAndFacets();
    initAdminTuningAndFraudSignals();
    initLocalizationLayer();
    initReputationReliabilityGraph();
    initNegotiationRoomRealtime();
    initSmartMatchingEngineV2();
    initEarningsAndTaxCenter();
    initAvailabilityIntelligence();
    initTeamModeLite();
    initVenueIntelligenceLayer();
    initMobileCreatorToolkit();
    initSafetyCompliancePack();
    initGrowthLoops();
    initSlaEnforcementEngine();
    initUnifiedActivityTimeline();
    initRouteTimeLogisticsEngine();
    initIncidentEvidenceVault();
    initOwnerOpsDashboard();
    initBookingSmartContracts();
    initEscrowMilestonePayments();
    initDynamicPricingAutopilot();
    initScoreTransparencyCenter();
    initVerificationStackExpansion();
    initChurnPreventionAutomations();
    initApiWebhookLayer();
    initBookingRiskChecklist();
    initAutoFollowupCadenceEngine();
    initMultiSelectBulkActions();
    initWhyNotMatchedDiagnostic();
    initConversionFunnelCards();
    initSmartDuplicateGigDetector();
    initOfferCompetitivenessMeter();
    initHostResponseSlaCountdowns();
    initPerformerResponseSlaCountdowns();
    initQueueHealthAnomalyDetector();
    initPredictiveNoShowWarning();
    initSmartConflictAutoResolver();
    initAutoArchiveStaleOpportunities();
    initGlobalCommandCenterPanel();
    initSavedDashboardViews();
    initChurnCohortBreakdown();
    initReengagementCampaignLauncher();
    initNotificationQuietHoursController();
    initDisputeMediationRecommendationHelper();
    initReputationAppealRequestFlow();
    initVenueFeedbackDigestModule();
    initPerformerFeedbackDigestModule();
    initAutoGeneratedPostEventSurveys();
    initSessionHandoffNotesModule();
    initFeatureFlagExperimentConsole();
    initControlledExperimentsConsole();
    initLiveStatusBoardForOps();
    initIncidentPostmortemBuilder();
    initTrustBadgeExplanationDrawer();
    initAnnouncementBannerManager();
    initWeeklyAvailabilityHeatScheduler();
    initSeasonalDemandCalendarOverlay();
    initGeographicDemandMapModule();
    initGenreStyleTrendIntelligencePanel();
    initRateBenchmarkingInsightsWidget();
    initRevenueLeakageDetector();
    initDealRoomActivityRecorder();
    initLegalComplianceChecklistAssistant();
    initConsentWaiverTracker();
    initEventDocumentExpirationMonitor();
    initRoleSpecificOnboardingTours();
    initAccessibilityPreferencePresets();
    initKeyboardCommandCheatsheetOverlay();
    initExperienceLayoutManager();

    whenAuthenticatedUser(function () {
      initFavoritesAndBatchPosting();
      initUndoActionHistoryTimeline();
      initReusableMessageTemplates();
      initAccountHealthScorecard();
      initPayoutDelayWarningCard();
      initEscalationRoutingMatrix();
      initMilestoneRemindersTimeline();
      initPaymentMethodSuccessRateWidget();
      initExperienceLayoutManager();
    });
  }

  function scheduleNonCritical(task, delay) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(task, { timeout: delay || 1200 });
      return;
    }
    window.setTimeout(task, delay || 180);
  }

  function canonicalWorkspacePage(page) {
    if (page === "musician-dashboard.html") return "musician-matched-gigs.html";
    if (!page) return "index.html";
    return page;
  }

  function normalizeInternalHref(href) {
    var value = String(href || "").trim();
    if (!value || value.charAt(0) === "#") return "";
    if (value.indexOf("//") === 0) return "";
    if (/^(?:https?|mailto|tel|javascript|data):/i.test(value)) return "";
    if (value.charAt(0) === "/") value = value.slice(1) || "index.html";
    value = value.split("#")[0].split("?")[0] || "index.html";
    return canonicalWorkspacePage(value);
  }

  function workspaceConnectionLinks(role) {
    if (role === "host") {
      return [
        ["host.html", "Host"],
        ["host-profile.html", "Account"],
        ["booking.html", "Bookings"],
        ["ops.html", "Ops"],
        ["support.html", "Support"]
      ];
    }
    if (role === "ops") {
      return [
        ["ops.html", "Ops"],
        ["host.html", "Host"],
        ["musician-matched-gigs.html", "Performer"],
        ["booking.html", "Bookings"],
        ["support.html", "Support"]
      ];
    }
    return [
      ["musician-matched-gigs.html", "Matches"],
      ["gig-radar.html", "Radar"],
      ["musician-profile.html", "Profile"],
      ["booking.html", "Bookings"],
      ["support.html", "Support"]
    ];
  }

  function inferWorkspaceRoleForUx(page) {
    if (/^host(?:-profile)?\.html$/.test(page)) return "host";
    if (page === "ops.html") return "ops";
    if (/^(musician|gig-radar|performer-view)/.test(page)) return "performer";
    if (page === "booking.html") return "booking";
    return "";
  }

  function applyConnectedActiveLinks(currentPage) {
    var canonicalPage = canonicalWorkspacePage(currentPage);
    document.querySelectorAll("a[href]").forEach(function (link) {
      var target = normalizeInternalHref(link.getAttribute("href"));
      if (!target) return;
      var isActive = target === canonicalPage || (canonicalPage === "booking.html" && target === "booking.html");
      link.classList.toggle("is-current", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else if (link.getAttribute("aria-current") === "page") link.removeAttribute("aria-current");
    });
  }

  function ensureWorkspaceConnector(currentPage, role) {
    if (document.getElementById("cltchWorkspaceConnector")) return;
    if (!role) return;
    if (!document.body.classList.contains("cltch-workspace-page") && !/^(ops|booking)\.html$/.test(currentPage)) return;

    var header = document.querySelector("header");
    if (!header || !header.parentNode) return;
    var canonicalPage = canonicalWorkspacePage(currentPage);
    var effectiveRole = role === "booking" ? inferRoleFromPage() : role;
    if (effectiveRole === "general") effectiveRole = "performer";
    var links = workspaceConnectionLinks(effectiveRole);
    var nav = document.createElement("nav");
    nav.id = "cltchWorkspaceConnector";
    nav.className = "cltch-workspace-connector";
    nav.setAttribute("aria-label", "Workspace shortcuts");
    nav.innerHTML = links.map(function (item) {
      var active = canonicalWorkspacePage(item[0]) === canonicalPage ? " is-current" : "";
      return '<a class="cltch-workspace-connector__link' + active + '" href="' + escapeHtml(item[0]) + '"' + (active ? ' aria-current="page"' : "") + '>' + escapeHtml(item[1]) + "</a>";
    }).join("");
    header.insertAdjacentElement("afterend", nav);
  }

  function normalizeWorkspaceAliases(currentPage) {
    if (currentPage !== "musician-dashboard.html") return;
    document.querySelectorAll('a[href^="musician-dashboard.html"]').forEach(function (link) {
      var raw = link.getAttribute("href") || "";
      link.setAttribute("href", raw.replace("musician-dashboard.html", "musician-matched-gigs.html"));
    });
  }

  function initConnectedUx() {
    var currentPage = pageName();
    normalizeWorkspaceAliases(currentPage);
    applyConnectedActiveLinks(currentPage);
    ensureWorkspaceConnector(currentPage, inferWorkspaceRoleForUx(currentPage));
  }

  function initGlobalSplash() {
    if (!document.body) return;
    if (document.getElementById("splashScreen")) return;
    if ((window.location.pathname || "").endsWith("/auth.html") || (window.location.pathname || "") === "/auth.html") return;

    var splash = document.createElement("div");
    splash.className = "cltch-splash";
    splash.id = "cltchGlobalSplash";
    splash.setAttribute("aria-hidden", "true");
    splash.innerHTML =
      '<div class="cltch-splash-card">' +
      '<div class="cltch-splash-mark">CLTCH.NTWRK</div>' +
      '<div class="cltch-splash-copy">Loading your dashboard and syncing live booking data.</div>' +
      '<div class="cltch-splash-bar"><div class="cltch-splash-fill"></div></div>' +
      "</div>";

    document.body.classList.add("cltch-loading");
    document.body.appendChild(splash);

    var shownAt = Date.now();
    var MIN_VISIBLE_MS = 180;
    var MAX_VISIBLE_MS = 1200;
    var dismissed = false;
    function done() {
      if (dismissed) return;
      dismissed = true;
      var elapsed = Date.now() - shownAt;
      var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(function () {
        document.body.classList.remove("cltch-loading");
        splash.classList.add("hidden");
        setTimeout(function () {
          splash.remove();
        }, 220);
      }, wait);
    }

    window.CLTCHLoading = { done: done };
    window.addEventListener("load", done, { once: true });
    setTimeout(done, MAX_VISIBLE_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initBrandTagline();
      initThemeToggle();
      initSkipLink();
      initFeatureHub();
      initGuidedGrouping();
      initDexterityShortcuts();
      initRuntimeSecurityHardening();
      initConnectedUx();
      initAppInstall();
      initGlobalSplash();
      scheduleNonCritical(initA11yPanel, 140);
      scheduleNonCritical(initDexterityPalette, 180);
      scheduleNonCritical(initQuickDock, 260);
      scheduleNonCritical(initConnectionStatus, 290);
      scheduleNonCritical(initAssistant, 340);
      scheduleNonCritical(initExperienceAddons, 380);
      scheduleNonCritical(initComponentLibrary, 430);
    }, { once: true });
  } else {
    initBrandTagline();
    initThemeToggle();
    initSkipLink();
    initFeatureHub();
    initGuidedGrouping();
    initDexterityShortcuts();
    initRuntimeSecurityHardening();
    initConnectedUx();
    initAppInstall();
    initGlobalSplash();
    scheduleNonCritical(initA11yPanel, 140);
    scheduleNonCritical(initDexterityPalette, 180);
    scheduleNonCritical(initQuickDock, 260);
    scheduleNonCritical(initConnectionStatus, 290);
    scheduleNonCritical(initAssistant, 340);
    scheduleNonCritical(initExperienceAddons, 380);
    scheduleNonCritical(initComponentLibrary, 430);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          registration.unregister().catch(function () {});
        });
      }).catch(function () {});
    });
  }
})();
