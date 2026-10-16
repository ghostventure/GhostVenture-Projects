(function (root) {
  "use strict";

  // List only tools that are actually wired into ops.html. These controls are
  // local browser aids; the current Firebase project has no connected ops API.
  var catalog = [
    { id: "booking-agreement", domain: "booking", domainTitle: "Booking", name: "Booking agreement checklist", summary: "Confirm scope, terms, day-of contacts, and rider details.", storage: "This browser" },
    { id: "booking-timeline", domain: "booking", domainTitle: "Booking", name: "Booking status timeline", summary: "Walk through request, offer, acceptance, check-in, completion, and payment states.", storage: "This browser" },
    { id: "payment-checklist", domain: "payments", domainTitle: "Payments", name: "Payment readiness checklist", summary: "Record a manual payment plan and receipt readiness for operator review.", storage: "This browser" },
    { id: "issue-note", domain: "support", domainTitle: "Support", name: "Issue note form", summary: "Capture an issue type and a next-action note for local review.", storage: "This browser" },
    { id: "trust-checklist", domain: "trust", domainTitle: "Trust", name: "Trust readiness checklist", summary: "Review email, profile, payout, and work-proof readiness.", storage: "This browser" },
    { id: "portfolio-links", domain: "portfolio", domainTitle: "Portfolio", name: "Portfolio link manager", summary: "Keep and remove reference links in the current browser.", storage: "This browser" },
    { id: "ops-lanes", domain: "platform", domainTitle: "Platform", name: "Operations lane overview", summary: "Review six manual oversight lanes; no production cases are fetched.", storage: "No case data" }
  ];

  function matches(component, query, domain) {
    var q = String(query || "").trim().toLowerCase();
    if (domain && component.domain !== domain) return false;
    if (!q) return true;
    return [
      component.id,
      component.domainTitle,
      component.name,
      component.summary,
      component.storage
    ].join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function summarize() {
    return {
      total: catalog.length,
      domains: Array.from(new Set(catalog.map(function (component) { return component.domain; }))).length,
      connectedIntegrations: 0
    };
  }

  function find(query, options) {
    var domain = options && options.domain ? options.domain : "";
    var limit = options && options.limit ? options.limit : 200;
    return catalog.filter(function (component) {
      return matches(component, query, domain);
    }).slice(0, limit);
  }

  function mount(target) {
    if (!root.document) return;
    var container = typeof target === "string" ? root.document.getElementById(target) : target;
    if (!container) return;

    var summary = summarize();
    var wrapper = root.document.createElement("div");
    wrapper.className = "cltch-component-catalog";
    wrapper.innerHTML = [
      '<div class="cltch-component-catalog__summary" aria-label="Available operational helper summary">',
        stat("Wired helpers", String(summary.total)),
        stat("Domains", String(summary.domains)),
        stat("Live integrations", String(summary.connectedIntegrations)),
        stat("Storage", "Local only"),
      '</div>',
      '<div class="cltch-component-catalog__tools">',
        '<label><span>Search</span><input type="search" data-component-search placeholder="Search available helpers"></label>',
        '<label><span>Domain</span><select data-component-domain><option value="">All domains</option>' + domainOptions() + '</select></label>',
      '</div>',
      '<div class="cltch-component-catalog__meta" data-component-meta></div>',
      '<div class="cltch-component-catalog__list" data-component-list></div>'
    ].join("");

    container.innerHTML = "";
    container.appendChild(wrapper);

    var search = wrapper.querySelector("[data-component-search]");
    var domain = wrapper.querySelector("[data-component-domain]");
    var meta = wrapper.querySelector("[data-component-meta]");
    var list = wrapper.querySelector("[data-component-list]");
    var renderQueued = false;

    function queueRender() {
      if (renderQueued) return;
      renderQueued = true;
      schedule(function () {
        renderQueued = false;
        renderList(list, meta, search.value, domain.value);
      });
    }

    search.addEventListener("input", queueRender);
    domain.addEventListener("change", queueRender);
    renderList(list, meta, "", "");
  }

  function stat(label, value) {
    return '<article><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></article>';
  }

  function domainOptions() {
    var domains = new Map();
    catalog.forEach(function (component) { domains.set(component.domain, component.domainTitle); });
    return Array.from(domains.entries()).map(function (domain) {
      return '<option value="' + escapeHtml(domain[0]) + '">' + escapeHtml(domain[1]) + '</option>';
    }).join("");
  }

  function renderList(list, meta, query, domain) {
    var matchesList = catalog.filter(function (component) {
      return matches(component, query, domain);
    });
    var visible = matchesList.slice(0, 120);
    var fragment = root.document.createDocumentFragment();
    list.innerHTML = "";
    visible.forEach(function (component) {
      fragment.appendChild(componentRow(component));
    });
    list.appendChild(fragment);
    meta.textContent = "Showing " + visible.length.toLocaleString() + " of " + matchesList.length.toLocaleString() + " matching components. Full installed catalog: " + catalog.length.toLocaleString() + ".";
  }

  function componentRow(component) {
    var row = root.document.createElement("article");
    row.className = "cltch-component-catalog__row";
    row.innerHTML = [
      '<div>',
        '<strong>' + escapeHtml(component.name) + '</strong>',
        '<span>' + escapeHtml(component.summary) + '</span>',
      '</div>',
      '<dl>',
        '<div><dt>Type</dt><dd>Manual helper</dd></div>',
        '<div><dt>Data</dt><dd>' + escapeHtml(component.storage) + '</dd></div>',
      '</dl>'
    ].join("");
    return row;
  }

  function schedule(callback) {
    if (typeof root.requestIdleCallback === "function") {
      root.requestIdleCallback(callback, { timeout: 250 });
      return;
    }
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(callback);
      return;
    }
    root.setTimeout(callback, 16);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  root.CLTCHOperationalComponents = {
    catalog: catalog,
    domains: Array.from(new Map(catalog.map(function (component) {
      return [component.domain, { id: component.domain, title: component.domainTitle }];
    })).values()),
    find: find,
    mount: mount,
    summarize: summarize
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
