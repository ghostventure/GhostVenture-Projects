import { collection, onSnapshot, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
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
let currentUser = null;
let gigs = [];

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
  const filtered = gigs.filter((item) => matchesGigSearch(item.data, readForm()))
    .sort((a, b) => String(a.data.date || "").localeCompare(String(b.data.date || "")));
  const filters = readForm();
  results.replaceChildren();
  if (!gigs.length) {
    status.dataset.state = "";
    status.textContent = "No open gigs are available in the current feed.";
    return;
  }
  status.dataset.state = "";
  status.textContent = `${filtered.length} of ${gigs.length} open gigs match this combined search.`;
  if (!filtered.length) {
    addText(results, "h2", "No gigs match this search.");
    const criteria = activeGigSearchCriteria(filters);
    if (!criteria.length) {
      addText(results, "p", "No search filters are active to relax. The open gig feed currently has no matching results.");
      return;
    }
    addText(results, "p", "Try removing one filter at a time. Each option keeps your other search criteria in place.");
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

let unsubscribe = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  unsubscribe?.();
  unsubscribe = null;
  gigs = [];
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
    return;
  }
  document.getElementById("saveSearch").disabled = false;
  document.getElementById("restoreSearch").disabled = false;
  const today = new Date().toISOString().slice(0, 10);
  const throughDate = new Date();
  throughDate.setDate(throughDate.getDate() + 180);
  status.textContent = "Loading open gigs…";
  status.dataset.state = "loading";
  const feed = query(collection(db, "gigs"), where("status", "==", "open"), where("date", ">=", today), where("date", "<=", throughDate.toISOString().slice(0, 10)), orderBy("date", "asc"), orderBy("createdAt", "desc"), limit(120));
  unsubscribe = onSnapshot(feed, (snapshot) => {
    gigs = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    render();
  }, () => {
    gigs = [];
    results.replaceChildren();
    status.dataset.state = "error";
    status.textContent = "Open gigs could not load. Check your connection and try again.";
  });
});

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
