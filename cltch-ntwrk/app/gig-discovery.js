import { collection, getDocs, query, where, orderBy, startAfter, limit } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { auth, db } from "./firebase-client.js";
import { matchesGigSearch, normalizeGigSearch, readGigSearch, saveGigSearch } from "./gig-discovery-filters.js";
import { activeGigSearchCriteria, clearOneGigSearchCriterion } from "./gig-discovery-recovery.js";
import { formatListedPay } from "./gig-discovery-pay.js";

const form = document.getElementById("searchForm");
const fields = {
  phrase: document.getElementById("phrase"),
  performerType: document.getElementById("performerType"),
  fromDate: document.getElementById("fromDate"),
  toDate: document.getElementById("toDate"),
  minimumPay: document.getElementById("minimumPay")
};
const status = document.getElementById("feedStatus");
const results = document.getElementById("results");
const savedState = document.getElementById("savedState");
const refreshGigs = document.getElementById("refreshGigs");
const loadMoreGigs = document.getElementById("loadMoreGigs");
const paginationStatus = document.getElementById("paginationStatus");
const PAGE_SIZE = 40;
let currentUser = null;
let gigs = [];
let lastDoc = null;
let hasMore = false;
let feedLoading = false;
let feedLoadMode = "";
let feedErrorMode = "";
let feedGeneration = 0;
let queryWindow = null;

function readForm() {
  return normalizeGigSearch(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])));
}

function writeForm(search) {
  const normalized = normalizeGigSearch(search);
  Object.entries(fields).forEach(([key, field]) => { field.value = String(normalized[key]); });
}

function addText(parent, tag, value, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function render() {
  const filtered = gigs.filter((item) => matchesGigSearch(item.data, readForm()));
  const filters = readForm();
  results.replaceChildren();
  if (!gigs.length) {
    if (feedLoading) {
      status.dataset.state = "loading";
      status.textContent = "Loading open gigs…";
    } else if (feedErrorMode) {
      status.dataset.state = "error";
      status.textContent = "Open gigs could not load. Use the retry control below.";
    } else {
      status.dataset.state = "";
      status.textContent = "No open gigs are available in the current feed.";
    }
    return;
  }
  status.dataset.state = "";
  status.textContent = `${filtered.length} of ${gigs.length} loaded open gigs match this combined search.${hasMore ? " More results may be available." : " All current results are loaded."}`;
  if (!filtered.length) {
    addText(results, "h2", hasMore ? "No loaded gigs match this search yet." : "No gigs match this search.");
    const criteria = activeGigSearchCriteria(filters);
    if (!criteria.length) {
      addText(results, "p", hasMore
        ? "No search filters are active to relax. Load more open gigs to check additional results."
        : "No search filters are active to relax. The open gig feed has no matching results.");
      if (hasMore) addText(results, "p", "More gigs may match after loading the next page.");
      return;
    }
    addText(results, "p", hasMore
      ? "Try removing one filter at a time, or load more gigs. Each filter option keeps your other search criteria in place."
      : "Try removing one filter at a time. Each option keeps your other search criteria in place.");
    if (hasMore) addText(results, "p", "More gigs may match after loading the next page.");
    const recoveryOptions = document.createElement("ul");
    recoveryOptions.setAttribute("aria-label", "Search filters you can remove individually");
    for (const criterion of criteria) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Remove ${criterion.label}: ${criterion.value}`;
      button.setAttribute("aria-label", `Remove ${criterion.label} filter, currently ${criterion.value}`);
      button.addEventListener("click", () => {
        const relaxed = clearOneGigSearchCriterion(readForm(), criterion.key);
        if (!relaxed) return;
        writeForm(relaxed);
        fields[criterion.key].setCustomValidity("");
        render();
        fields[criterion.key].focus();
      });
      item.append(button);
      recoveryOptions.append(item);
    }
    results.append(recoveryOptions);
    return;
  }
  for (const { id, data } of filtered) {
    const article = document.createElement("article");
    article.className = "gig";
    addText(article, "h2", data.venue || "Open opportunity");
    addText(article, "p", [data.date || "Date pending", data.time, data.location || "Location pending"].filter(Boolean).join(" · "));
    const payLine = document.createElement("p");
    const gigKind = [data.genre, data.performerType || "musician"].filter(Boolean).join(" · ");
    payLine.append(document.createTextNode(`${gigKind ? `${gigKind} · ` : ""}Pay: `));
    const pay = formatListedPay(data.pay || "Pay not listed");
    const payText = document.createElement("span");
    payText.className = "pay-amount";
    payText.textContent = pay.text;
    if (pay.locale) payText.lang = pay.locale;
    payLine.append(payText);
    article.append(payLine);
    const link = document.createElement("a");
    link.href = `booking.html?id=${encodeURIComponent(id)}`;
    link.textContent = "View booking details";
    article.append(link);
    results.append(article);
  }
}

function updatePaginationControls() {
  paginationStatus.dataset.state = feedErrorMode ? "error" : feedLoading ? "loading" : "";
  refreshGigs.disabled = !currentUser || feedLoading;
  refreshGigs.textContent = feedErrorMode === "refresh"
    ? (gigs.length ? "Retry refresh" : "Retry loading gigs")
    : "Refresh gigs";
  loadMoreGigs.hidden = !currentUser || !hasMore;
  loadMoreGigs.disabled = !currentUser || feedLoading || !hasMore;
  loadMoreGigs.textContent = feedErrorMode === "more" ? "Retry loading more gigs" : "Load more open gigs";

  if (!currentUser) paginationStatus.textContent = "";
  else if (feedLoading) paginationStatus.textContent = feedLoadMode === "more" ? "Loading more open gigs…" : (gigs.length ? "Refreshing open gigs…" : "");
  else if (feedErrorMode === "more") paginationStatus.textContent = `${gigs.length} gigs remain available above. More could not load; retry to continue.`;
  else if (feedErrorMode === "refresh") paginationStatus.textContent = gigs.length
    ? `${gigs.length} previously loaded gigs are still available. Refresh failed; retry when ready.`
    : "Gigs could not load. Retry to try again.";
  else if (hasMore) paginationStatus.textContent = `${gigs.length} gigs loaded. More results may be available; load another page or refresh for newer results.`;
  else if (gigs.length) paginationStatus.textContent = `All ${gigs.length} current feed results are loaded. Refresh to check for updates.`;
  else paginationStatus.textContent = "";
}

function createQueryWindow() {
  const today = new Date().toISOString().slice(0, 10);
  const throughDate = new Date();
  throughDate.setDate(throughDate.getDate() + 180);
  return { today, through: throughDate.toISOString().slice(0, 10) };
}

async function loadGigPage({ reset = false } = {}) {
  if (!currentUser || feedLoading) return;
  const generation = feedGeneration;
  const pageCursor = reset ? null : lastDoc;
  const pageWindow = reset || !queryWindow ? createQueryWindow() : queryWindow;
  feedLoading = true;
  feedLoadMode = reset ? "refresh" : "more";
  feedErrorMode = "";
  updatePaginationControls();
  if (!gigs.length) render();

  try {
    const constraints = [
      where("status", "==", "open"),
      where("date", ">=", pageWindow.today),
      where("date", "<=", pageWindow.through),
      orderBy("date", "asc"),
      orderBy("createdAt", "desc")
    ];
    if (pageCursor) constraints.push(startAfter(pageCursor));
    constraints.push(limit(PAGE_SIZE));
    const snapshot = await getDocs(query(collection(db, "gigs"), ...constraints));
    if (generation !== feedGeneration) return;
    const page = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    if (reset) gigs = page;
    else {
      const knownIds = new Set(gigs.map((item) => item.id));
      gigs.push(...page.filter((item) => !knownIds.has(item.id)));
    }
    lastDoc = snapshot.docs.at(-1) || pageCursor;
    queryWindow = pageWindow;
    hasMore = snapshot.docs.length === PAGE_SIZE;
  } catch (error) {
    if (generation === feedGeneration) {
      console.error("Gig discovery page load failed:", error);
      feedErrorMode = reset ? "refresh" : "more";
    }
  } finally {
    if (generation === feedGeneration) {
      feedLoading = false;
      feedLoadMode = "";
      updatePaginationControls();
      render();
    }
  }
}

onAuthStateChanged(auth, (user) => {
  feedGeneration += 1;
  currentUser = user || null;
  feedLoading = false;
  feedLoadMode = "";
  feedErrorMode = "";
  gigs = [];
  lastDoc = null;
  hasMore = false;
  queryWindow = null;
  results.replaceChildren();
  if (!user) {
    status.dataset.state = "";
    status.replaceChildren(document.createTextNode("Sign in to load open gigs. "));
    const link = document.createElement("a");
    link.href = "auth.html?next=gig-discovery.html";
    link.textContent = "Sign in";
    status.append(link);
    document.getElementById("saveSearch").disabled = true;
    document.getElementById("restoreSearch").disabled = true;
    updatePaginationControls();
    return;
  }
  document.getElementById("saveSearch").disabled = false;
  document.getElementById("restoreSearch").disabled = false;
  status.textContent = "Loading open gigs…";
  status.dataset.state = "loading";
  loadGigPage({ reset: true });
});

refreshGigs.addEventListener("click", () => loadGigPage({ reset: true }));
loadMoreGigs.addEventListener("click", () => loadGigPage());

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", render);
form.addEventListener("change", render);
form.addEventListener("reset", () => queueMicrotask(render));
document.getElementById("saveSearch").addEventListener("click", () => {
  if (!currentUser) return;
  const filters = readForm();
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    fields.toDate.setCustomValidity("Choose an end date on or after the start date.");
    fields.toDate.reportValidity();
    return;
  }
  fields.toDate.setCustomValidity("");
  savedState.textContent = saveGigSearch(filters, undefined, currentUser.uid)
    ? "Combined search saved in this browser for this account."
    : "Browser storage is unavailable, so this search could not be saved.";
});
document.getElementById("restoreSearch").addEventListener("click", () => {
  if (!currentUser) return;
  const saved = readGigSearch(undefined, currentUser.uid);
  if (!saved) {
    savedState.textContent = "No saved search was found in this browser.";
    return;
  }
  writeForm(saved);
  fields.toDate.setCustomValidity("");
  savedState.textContent = "Saved combined search restored; the live results now use those criteria.";
  render();
});
