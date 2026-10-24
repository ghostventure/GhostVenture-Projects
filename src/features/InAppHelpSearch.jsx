import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { helpArticles as localHelpArticles } from '../productBlueprint'
import './InAppHelpSearch.css'

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
}

export default function InAppHelpSearch({ articles = localHelpArticles }) {
  const [query, setQuery] = useState('')
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)

  const results = useMemo(() => {
    if (!terms.length) return articles
    return articles
      .map((article, index) => {
        const title = normalize(article.title)
        const category = normalize(article.category)
        const body = normalize(article.body)
        const searchable = `${title} ${category} ${body}`
        if (!terms.every((term) => searchable.includes(term))) return null
        const score = terms.reduce((total, term) => total + (title.includes(term) ? 5 : 0) + (category.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0)
        return { article, index, score }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ article }) => article)
  }, [articles, query])

  const status = !terms.length
    ? `${results.length} help ${results.length === 1 ? 'article' : 'articles'} available.`
    : `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”.`

  return (
    <section className="in-app-help-search" aria-labelledby="in-app-help-heading">
      <header className="in-app-help-search__header">
        <div>
          <h2 id="in-app-help-heading">Search help</h2>
          <p>Search the help articles included with OverHead. Results come from this app’s local help content.</p>
        </div>
      </header>

      <div className="in-app-help-search__field">
        <Search size={18} aria-hidden="true" />
        <label className="in-app-help-search__visually-hidden" htmlFor="in-app-help-query">Search help articles</label>
        <input
          id="in-app-help-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “password recovery” or “billing”"
          autoComplete="off"
          aria-controls="in-app-help-results"
        />
        {query && <button className="in-app-help-search__clear" type="button" onClick={() => setQuery('')} aria-label="Clear help search"><X size={16} aria-hidden="true" /></button>}
      </div>

      <p className="in-app-help-search__status" role="status" aria-live="polite">{status}</p>

      {results.length ? (
        <div className="in-app-help-search__results" id="in-app-help-results">
          {results.map((article) => (
            <details className="in-app-help-search__result" key={`${article.category}-${article.title}`}>
              <summary>
                <span className="in-app-help-search__category">{article.category}</span>
                <strong>{article.title}</strong>
              </summary>
              <p>{article.body}</p>
            </details>
          ))}
        </div>
      ) : (
        <div className="in-app-help-search__empty" role="note">
          <strong>No matching help articles</strong>
          <p>Try a shorter phrase or a different word. Search only covers the help content bundled with this app.</p>
          <button className="in-app-help-search__reset" type="button" onClick={() => setQuery('')}>Show all help articles</button>
        </div>
      )}
    </section>
  )
}
