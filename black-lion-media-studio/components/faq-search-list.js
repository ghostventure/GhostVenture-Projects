"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function normalize(value) {
  return String(value || "").toLocaleLowerCase().trim();
}

export function FaqSearchList({ items }) {
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return items.map((item, originalIndex) => ({ ...item, originalIndex })).filter((item) => {
      if (!terms.length) return true;
      const content = normalize(`${item.question} ${item.answer}`);
      return terms.every((term) => content.includes(term));
    });
  }, [items, query]);

  return (
    <div className="faq-search-list">
      <div className="faq-search-controls">
        <label className="faq-search-field">
          <span>Search questions and answers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try booking, payment, account, or privacy…"
            autoComplete="off"
          />
        </label>
        {query ? (
          <button type="button" className="button button-secondary faq-search-clear" onClick={() => setQuery("")}>
            Clear search
          </button>
        ) : null}
      </div>

      <p className="faq-search-count" role="status" aria-live="polite">
        {query.trim()
          ? `${filteredItems.length} of ${items.length} questions match your search.`
          : `${items.length} questions. Search either the question or its answer.`}
      </p>

      {filteredItems.length ? (
        <div className="legal-faq-list">
          {filteredItems.map((item) => {
            return (
              <details id={`faq-${item.originalIndex + 1}`} key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="faq-search-empty">
          <strong>No questions match “{query.trim()}”.</strong>
          <p>Try a shorter phrase, clear the search, or ask the studio for help.</p>
          <div className="faq-search-recovery">
            <button type="button" className="button button-secondary" onClick={() => setQuery("")}>Show all questions</button>
            <Link className="button" href="/support">Open Support</Link>
          </div>
        </div>
      )}
    </div>
  );
}
