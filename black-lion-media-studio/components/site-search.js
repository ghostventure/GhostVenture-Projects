"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { faqItems } from "../lib/legal-content";
import { serviceAdRoutes, serviceCatalog } from "../lib/services";

const pageItems = [
  { href: "/", title: "Home", description: "Black Lion Studios overview and branch directory.", keywords: "studio home start" },
  { href: "/about", title: "About the studio", description: "Learn how the studio branches and client handoff work.", keywords: "company team about" },
  { href: "/services", title: "All services", description: "Browse service branches and use Service Estimation.", keywords: "catalog directory estimate pricing" },
  { href: "/plan", title: "Project Planner", description: "Prepare a project brief and choose services.", keywords: "brief scope project budget timeline" },
  { href: "/book", title: "Book a project", description: "Choose a service and review appointment options.", keywords: "booking appointment schedule session" },
  { href: "/multimedia", title: "Black Lion Multimedia", description: "Photography, video, DJ, beat sessions, and production.", keywords: "photos video audio events music" },
  { href: "/tech-development", title: "Black Lion Tech Development", description: "AI, software, website, and PC support services.", keywords: "technology ai software website computer repair" },
  { href: "/fashion", title: "Black Lion Fashion", description: "Fashion projects, merch, and model opportunities.", keywords: "clothing fashion models merch apparel" },
  { href: "/models", title: "Model Sign-up", description: "Apply for model opportunities and review eligibility details.", keywords: "casting applicant application talent" },
  { href: "/models/faq", title: "Model FAQ", description: "Model application, eligibility, and review answers.", keywords: "casting applicant age policy questions" },
  { href: "/store", title: "Merch store", description: "Browse Black Lion Fashion collections and open the Plugz shop.", keywords: "clothes shop shopping order" },
  { href: "/work", title: "Work", description: "Explore the studio's work and service lanes.", keywords: "portfolio examples creative" },
  { href: "/portfolio", title: "Portfolio", description: "Browse portfolio lanes by studio branch.", keywords: "work gallery projects examples" },
  { href: "/contact", title: "Contact", description: "Choose the right way to contact the studio.", keywords: "email talk contact" },
  { href: "/support", title: "Support", description: "Find help with account, booking, billing, merch, or project issues.", keywords: "help problem account booking billing" },
  { href: "/portal", title: "Client portal", description: "Sign in, create an account, or start a service request.", keywords: "account login signup request" },
  { href: "/faq", title: "Frequently asked questions", description: "Answers about services, accounts, bookings, and policies.", keywords: "faq questions answers" },
  { href: "/ad-expansion", title: "Ad expansion system", description: "Review the studio's ad readiness workstreams.", keywords: "campaign advertising components" },
  { href: "/legal", title: "Legal and compliance", description: "Review policies, accessibility, payments, and compliance information.", keywords: "legal policy compliance accessibility" },
  { href: "/privacy", title: "Privacy policy", description: "Learn how client and account information is handled.", keywords: "privacy personal data security" },
  { href: "/terms", title: "Terms of use", description: "Review terms for the site, portal, requests, and payments.", keywords: "terms agreement rules" },
  { href: "/dmca", title: "Copyright claims", description: "Find copyright claim and DMCA information.", keywords: "copyright dmca intellectual property" }
].map((item) => ({ ...item, type: "page", typeLabel: "Page" }));

const serviceItems = serviceAdRoutes.map((route) => {
  const service = serviceCatalog.find((item) => item.slug === route.catalogSlug);
  return {
    href: route.route,
    title: service?.name || route.headline,
    description: route.summary || route.headline,
    keywords: [route.branchName, route.audience, route.headline, ...(route.fit || []).map((item) => typeof item === "string" ? item : `${item.label || ""} ${item.value || ""} ${item.copy || ""}`)].filter(Boolean).join(" "),
    type: "service",
    typeLabel: "Service",
    detail: service?.priceLabel || route.branchName
  };
});

const faqSearchItems = faqItems.map((item, index) => ({
  href: `/faq#faq-${index + 1}`,
  title: item.question,
  description: item.answer,
  keywords: "faq question answer",
  type: "faq",
  typeLabel: "FAQ"
}));

const searchItems = [...pageItems, ...serviceItems, ...faqSearchItems];
const searchFilters = [
  { id: "all", label: "All" },
  { id: "page", label: "Pages" },
  { id: "service", label: "Services" },
  { id: "faq", label: "FAQs" }
];
const suggestions = ["/services", "/plan", "/book", "/support", "/portal", "/faq"];
const resultLimit = 12;

function rankResults(query, filter) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = searchItems
    .filter((item) => filter === "all" || item.type === filter)
    .map((item, originalIndex) => {
      if (!terms.length) {
        if (filter !== "all") {
          return originalIndex < 6 ? { item, score: 100 - originalIndex, originalIndex } : null;
        }
        const suggestionRank = suggestions.indexOf(item.href);
        return suggestionRank === -1 ? null : { item, score: 100 - suggestionRank, originalIndex };
      }
      const title = item.title.toLowerCase();
      const href = item.href.toLowerCase();
      const content = `${item.description} ${item.keywords || ""}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (title.startsWith(term)) score += 12;
        else if (title.includes(term)) score += 8;
        else if (href.includes(term)) score += 6;
        else if (content.includes(term)) score += 3;
        else return null;
      }
      return { item, score, originalIndex };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex);

  return {
    items: candidates.slice(0, resultLimit).map(({ item }) => item),
    total: candidates.length
  };
}

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const rankedResults = useMemo(() => rankResults(query, filter), [query, filter]);
  const results = rankedResults.items;
  const activeResultId = results[activeIndex] ? `site-search-result-${activeIndex}` : undefined;

  useEffect(() => {
    function handleGlobalShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter]);

  function closeSearch() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleClose() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleInputKeyDown(event) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && activeResultId) {
      event.preventDefault();
      document.getElementById(activeResultId)?.click();
    }
  }

  return (
    <div className="site-search">
      <button
        ref={triggerRef}
        type="button"
        className="site-search-trigger"
        aria-label="Search pages, services, and FAQs"
        aria-keyshortcuts="Control+K Meta+K"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="site-search-dialog"
        onClick={() => setOpen(true)}
      >
        <span>Search</span>
        <kbd aria-hidden="true">Ctrl/⌘ K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        id="site-search-dialog"
        className="site-search-dialog"
        aria-labelledby="site-search-title"
        onClose={handleClose}
      >
        <div className="site-search-panel">
          <div className="site-search-heading">
            <div>
              <p className="label">Black Lion Studios</p>
              <h2 id="site-search-title">Search the studio</h2>
            </div>
            <button type="button" className="site-search-close" onClick={closeSearch} aria-label="Close search">×</button>
          </div>

          <label className="site-search-input-wrap">
            <span className="site-search-icon" aria-hidden="true">⌕</span>
            <span className="site-search-sr-only">Search pages, services, and FAQs</span>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="site-search-results"
              aria-activedescendant={activeResultId}
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              onKeyDown={handleInputKeyDown}
              placeholder="Try photography, account, booking…"
              maxLength={120}
              autoComplete="off"
            />
            <kbd className="site-search-escape">Esc</kbd>
          </label>

          <div className="site-search-filters" role="group" aria-label="Search categories">
            {searchFilters.map((item) => (
              <button
                type="button"
                key={item.id}
                className={filter === item.id ? "is-active" : ""}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="site-search-count" aria-live="polite">
            {rankedResults.total
              ? rankedResults.total > resultLimit
                ? `Showing ${results.length} of ${rankedResults.total} ${query.trim() ? "matching results" : "suggested destinations"}`
                : `${rankedResults.total} ${query.trim() ? "matching results" : "suggested destinations"}`
              : "No matching results"}
          </p>
          {results.length ? (
            <ul className="site-search-results" id="site-search-results" role="listbox" aria-label="Search results">
              {results.map((item, index) => (
                <li key={`${item.type}-${item.href}-${item.title}`} role="presentation">
                  <Link
                    href={item.href}
                    id={`site-search-result-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className="site-search-result"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={closeSearch}
                  >
                    <span className="site-search-result-copy">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </span>
                    <span className="site-search-result-type">{item.typeLabel}{item.detail ? ` · ${item.detail}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="site-search-empty">
              <strong>Try a different phrase</strong>
              <p>Search for a service, project need, account topic, or policy question.</p>
              <Link href="/support" onClick={closeSearch}>Get help choosing a path</Link>
            </div>
          )}
          <div className="site-search-footer" aria-hidden="true">
            <span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span>
          </div>
        </div>
      </dialog>
    </div>
  );
}
