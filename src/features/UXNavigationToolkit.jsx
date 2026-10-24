import { useEffect, useMemo, useState } from 'react'
import './UXNavigationToolkit.css'

const SIDEBAR_KEY = 'overhead.navigation.sidebarWidth.v1'
const DENSITY_KEY = 'overhead.navigation.displayDensity.v1'
const TARGET_SIZE_KEY = 'overhead.navigation.targetSize.v1'
const LAYOUT_KEY = 'overhead.navigation.layout.v1'

const defaultLayout = { hidden: [], order: [], compactLabels: false, showDescriptions: true, collections: [] }

function readLayout() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) || '{}')
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => typeof id === 'string') : [],
      order: Array.isArray(parsed.order) ? parsed.order.filter((id) => typeof id === 'string') : [],
      compactLabels: Boolean(parsed.compactLabels),
      showDescriptions: parsed.showDescriptions !== false,
      collections: Array.isArray(parsed.collections) ? parsed.collections.filter((item) => item && typeof item.name === 'string' && Array.isArray(item.sections)) : [],
    }
  } catch { return defaultLayout }
}

function readSidebarWidth() {
  try {
    const value = Number(window.localStorage.getItem(SIDEBAR_KEY) || 248)
    return Math.min(360, Math.max(220, Number.isFinite(value) ? value : 248))
  } catch { return 248 }
}

function readDensity() {
  try {
    const value = window.localStorage.getItem(DENSITY_KEY)
    return value === 'compact' ? 'compact' : 'comfortable'
  } catch { return 'comfortable' }
}

function readTargetSize() {
  try { return window.localStorage.getItem(TARGET_SIZE_KEY) === 'roomy' ? 'roomy' : 'standard' } catch { return 'standard' }
}

/**
 * Small, reusable workspace navigation preferences. Preferences are local to
 * this device/profile and do not change account or team settings.
 *
 * Props:
 * - sections: [{ id, label }] visible to the current user
 * - activeSection: current section id
 * - onNavigate(sectionId): optional workspace navigation callback
 * - labels: optional { [sectionId]: displayLabel } map
 */
export function UXNavigationToolkit({ sections = [], activeSection = '', onNavigate, labels = {} }) {
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth)
  const [density, setDensity] = useState(readDensity)
  const [targetSize, setTargetSize] = useState(readTargetSize)
  const [layout, setLayout] = useState(readLayout)
  const [query, setQuery] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [selectedSections, setSelectedSections] = useState([])
  const [activeCollection, setActiveCollection] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.documentElement.style.setProperty('--ux-sidebar-width', `${sidebarWidth}px`)
    try { window.localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth)) } catch {}
  }, [sidebarWidth])

  useEffect(() => {
    document.documentElement.dataset.uxDensity = density
    try { window.localStorage.setItem(DENSITY_KEY, density) } catch {}
    return () => { delete document.documentElement.dataset.uxDensity }
  }, [density])

  useEffect(() => {
    document.documentElement.dataset.uxTargetSize = targetSize
    try { window.localStorage.setItem(TARGET_SIZE_KEY, targetSize) } catch {}
    return () => { delete document.documentElement.dataset.uxTargetSize }
  }, [targetSize])

  const choices = useMemo(() => sections.filter((section) => section?.id && section.id !== 'settings'), [sections])
  const orderedChoices = useMemo(() => {
    const rank = new Map(layout.order.map((id, index) => [id, index]))
    return [...choices].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.label.localeCompare(b.label))
  }, [choices, layout.order])
  const visibleChoices = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const collection = layout.collections.find((item) => item.name === activeCollection)
    return orderedChoices.filter((section) => !layout.hidden.includes(section.id)
      && (!collection || collection.sections.includes(section.id))
      && (!needle || `${labels[section.id] || section.label} ${section.detail || ''}`.toLocaleLowerCase().includes(needle)))
  }, [activeCollection, labels, layout.collections, layout.hidden, orderedChoices, query])

  useEffect(() => {
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch {}
  }, [layout])

  function moveSection(id, direction) {
    const current = [...visibleChoices]
    const index = current.findIndex((item) => item.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return
    ;[current[index], current[nextIndex]] = [current[nextIndex], current[index]]
    const positions = orderedChoices.map((item, position) => current.some((visible) => visible.id === item.id) ? position : -1).filter((position) => position >= 0)
    const nextOrder = orderedChoices.map((item) => item.id)
    positions.forEach((position, visibleIndex) => { nextOrder[position] = current[visibleIndex].id })
    setLayout((value) => ({ ...value, order: nextOrder }))
  }

  function saveCollection(event) {
    event.preventDefault()
    const name = collectionName.trim()
    if (!name || !selectedSections.length) { setNotice('Choose a name and at least one workspace for this collection.'); return }
    const collection = { name, sections: selectedSections.filter((id) => choices.some((section) => section.id === id)) }
    setLayout((value) => ({ ...value, collections: [...value.collections.filter((item) => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase()), collection] }))
    setCollectionName('')
    setSelectedSections([])
    setActiveCollection(name)
    setNotice(`Navigation collection “${name}” saved on this device.`)
  }

  function exportLayout() {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, layout }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'overhead-navigation-preferences.json'
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Navigation preferences exported. The file contains workspace section IDs and display choices only.')
  }

  async function importLayout(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 64 * 1024) throw new Error('The preferences file is too large.')
      const parsed = JSON.parse(await file.text())
      const imported = parsed?.schemaVersion === 1 ? parsed.layout : null
      if (!imported || !Array.isArray(imported.hidden) || !Array.isArray(imported.order) || !Array.isArray(imported.collections)) throw new Error('Choose an OverHead navigation preferences file.')
      const available = new Set(choices.map((section) => section.id))
      const clean = {
        hidden: imported.hidden.filter((id) => available.has(id)),
        order: [...new Set(imported.order.filter((id) => available.has(id)))],
        compactLabels: Boolean(imported.compactLabels),
        showDescriptions: imported.showDescriptions !== false,
        collections: imported.collections.filter((item) => item && typeof item.name === 'string' && Array.isArray(item.sections)).map((item) => ({ name: item.name.slice(0, 40), sections: [...new Set(item.sections.filter((id) => available.has(id)))] })).filter((item) => item.name && item.sections.length),
      }
      setLayout((current) => ({ ...current, ...clean }))
      setNotice('Navigation preferences imported for workspaces available to your current role.')
    } catch (error) { setNotice(error?.message || 'The navigation preferences could not be imported.') }
  }

  function resetLayout() {
    setLayout(defaultLayout)
    setQuery('')
    setActiveCollection('')
    setSidebarWidth(248)
    setDensity('comfortable')
    setTargetSize('standard')
    setNotice('Navigation and display preferences reset on this device.')
  }

  return <section className="ux-navigation-toolkit" aria-labelledby="ux-navigation-title">
    <div className="ux-navigation-toolkit-heading">
      <div><p className="eyebrow">Personal workspace</p><h3 id="ux-navigation-title">Navigation and display</h3></div>
      <a className="ux-skip-link" href="#active-workspace-panel">Skip to current workspace</a>
    </div>

    <NavigationBreadcrumbs sections={choices} activeSection={activeSection} labels={labels} onNavigate={onNavigate} />
    <div className="ux-navigation-directory-heading">
      <div><h4>Find and organize workspaces</h4><p>Search the sections available to your role, then open the one you need.</p></div>
      <span>{visibleChoices.length} shown</span>
    </div>
    <div className="ux-navigation-toolkit-controls">
      <label>Find a workspace<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace names and descriptions" /></label>
      <label>Show collection<select value={activeCollection} onChange={(event) => setActiveCollection(event.target.value)}><option value="">All visible workspaces</option>{layout.collections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
    </div>

    <details className="ux-navigation-customize">
      <summary>Personalize navigation and display</summary>
      <p>These choices apply on this device and do not change what your role can access.</p>
      <div className="ux-navigation-settings">
        <label>Sidebar width <strong>{sidebarWidth}px</strong><input type="range" min="220" max="360" step="10" value={sidebarWidth} onChange={(event) => setSidebarWidth(Number(event.target.value))} aria-label="Sidebar width" /></label>
        <label>Display spacing<select value={density} onChange={(event) => setDensity(event.target.value)} aria-label="Display spacing"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
        <label>Control target size<select value={targetSize} onChange={(event) => setTargetSize(event.target.value)} aria-label="Control target size"><option value="standard">Standard</option><option value="roomy">Larger click and touch targets</option></select><small>Makes common navigation and form controls easier to select.</small></label>
        <label className="ux-navigation-check"><input type="checkbox" checked={layout.compactLabels} onChange={(event) => setLayout((value) => ({ ...value, compactLabels: event.target.checked }))} />Use compact workspace labels</label>
        <label className="ux-navigation-check"><input type="checkbox" checked={layout.showDescriptions} onChange={(event) => setLayout((value) => ({ ...value, showDescriptions: event.target.checked }))} />Show workspace descriptions</label>
      </div>
      <details className="ux-navigation-collection-details">
        <summary>Create or update a workspace collection</summary>
        <form className="ux-navigation-collection-form" onSubmit={saveCollection}>
          <label>Collection name<input maxLength={40} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="For example, Daily operations" /></label>
          <p>Select the sections you want to see together. You can switch collections above.</p>
          <div className="ux-navigation-section-picker">{choices.map((section) => <label key={section.id}><input type="checkbox" checked={selectedSections.includes(section.id)} onChange={(event) => setSelectedSections((current) => event.target.checked ? [...new Set([...current, section.id])] : current.filter((id) => id !== section.id))} />{labels[section.id] || section.label}</label>)}</div>
          <button type="submit">Save collection</button>
        </form>
      </details>
    </details>

    <div className="ux-navigation-directory" aria-label="Workspace navigation preferences">
      <strong>Workspace directory</strong>
      {visibleChoices.map((section) => <div className="ux-navigation-directory-row" key={section.id}>
        <button type="button" className="ux-navigation-open" onClick={() => onNavigate?.(section.id)} disabled={!onNavigate} aria-label={`Open ${labels[section.id] || section.label}`} aria-current={activeSection === section.id ? 'page' : undefined}>
          <strong>{layout.compactLabels ? `${(labels[section.id] || section.label).slice(0, 18)}${(labels[section.id] || section.label).length > 18 ? '…' : ''}` : (labels[section.id] || section.label)}</strong>
          {layout.showDescriptions && section.detail && <small>{section.detail}</small>}
        </button>
        <div className="ux-navigation-row-actions">
          <button type="button" aria-label={`Move ${section.label} up`} title="Move up in this list" disabled={visibleChoices.findIndex((item) => item.id === section.id) === 0} onClick={() => moveSection(section.id, -1)}>↑</button>
          <button type="button" aria-label={`Move ${section.label} down`} title="Move down in this list" disabled={visibleChoices.findIndex((item) => item.id === section.id) === visibleChoices.length - 1} onClick={() => moveSection(section.id, 1)}>↓</button>
          <button type="button" onClick={() => setLayout((value) => ({ ...value, hidden: [...new Set([...value.hidden, section.id])] }))}>Hide from this list</button>
        </div>
      </div>)}
      {!visibleChoices.length && <p>No workspaces match these navigation preferences.</p>}
      {layout.hidden.length > 0 && <details><summary>Hidden workspaces ({layout.hidden.length})</summary>{layout.hidden.filter((id) => choices.some((section) => section.id === id)).map((id) => {
        const section = choices.find((item) => item.id === id)
        return <p key={id}>{labels[id] || section.label}<button type="button" onClick={() => setLayout((value) => ({ ...value, hidden: value.hidden.filter((hiddenId) => hiddenId !== id) }))}>Show again</button></p>
      })}</details>}
    </div>

    <div className="ux-navigation-toolkit-actions"><button type="button" onClick={exportLayout}>Export navigation preferences</button><label className="ux-navigation-import">Import preferences<input type="file" accept="application/json,.json" onChange={(event) => importLayout(event)} /></label><button type="button" onClick={resetLayout}>Reset navigation layout</button></div>
    {notice && <p role="status" className="ux-navigation-note">{notice}</p>}
    <p className="ux-navigation-note">Your navigation and display choices are saved on this device. Hiding a section here only removes it from this directory; it does not change role access. Recent pages, favorites, startup page, shortcuts, motion, sidebar collapse, and contrast stay in their existing controls.</p>
  </section>
}

/** Reusable, accessible breadcrumb trail for a flat workspace navigation map. */
export function NavigationBreadcrumbs({ sections = [], activeSection = '', labels = {}, onNavigate }) {
  const active = sections.find((section) => section.id === activeSection)
  if (!active) return null
  const home = sections.find((section) => section.id === 'overview')
  const crumbs = home && home.id !== active.id ? [home, active] : [active]

  return <nav className="ux-navigation-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {crumbs.map((section, index) => {
        const label = labels[section.id] || section.label
        const current = index === crumbs.length - 1
        return <li key={section.id}>
          {current || !onNavigate
            ? <span aria-current={current ? 'page' : undefined}>{label}</span>
            : <button type="button" onClick={() => onNavigate(section.id)}>{label}</button>}
        </li>
      })}
    </ol>
  </nav>
}
