'use client'

import { useMemo, useState } from 'react'

const jobs = [
  {
    id: 'founding-product-engineer', title: 'Founding Product Engineer', team: 'Engineering', type: 'Full-time', workStyle: 'Flexible location', level: 'Founding', status: 'Accepting applications',
    summary: 'Own meaningful parts of the local-first desktop product and the secure account experience that connects the web and Windows surfaces.',
    outcomes: ['Ship practical workflow improvements that reduce daily operator friction.', 'Strengthen the account, sync, and trust layer with careful engineering judgment.', 'Turn customer and support evidence into product decisions with clear tradeoffs.'],
    profile: 'Strong product engineering fundamentals, comfort working across a desktop and web surface, and evidence of shipping reliable software that people use for real work.',
  },
  {
    id: 'customer-operations-implementation', title: 'Customer Operations and Implementation Specialist', team: 'Customer Operations', type: 'Full-time', workStyle: 'Remote - Eastern time preferred', level: 'Early team', status: 'Accepting applications',
    summary: 'Help new customers turn the OverHead product into a working office routine, then bring the patterns and friction back to the product team.',
    outcomes: ['Guide initial workspace setup and practical adoption.', 'Translate recurring customer questions into clearer onboarding and support materials.', 'Identify workflow gaps and help prioritize improvements that increase customer confidence.'],
    profile: 'Experience in customer success, implementation, office operations, or support for a software product. You communicate directly, notice details, and can turn an unclear issue into a clear next action.',
  },
  {
    id: 'product-designer', title: 'Product Designer, Operations Workflows', team: 'Design', type: 'Contract or Full-time', workStyle: 'Flexible location', level: 'Early team', status: 'Accepting applications',
    summary: 'Shape a premium but practical desktop and web product experience for customer records, queues, approvals, payments, and support evidence.',
    outcomes: ['Make dense operational workflows easier to scan, understand, and act on.', 'Create interaction patterns that help owners feel informed without making the product feel heavy.', 'Work closely with engineering and customer operations to test the details that matter in daily use.'],
    profile: 'A portfolio that shows strong information design, product judgment, and the ability to simplify complex workflows. Experience with B2B, workflow, finance, operations, or desktop software is useful.',
  },
  {
    id: 'growth-partnerships', title: 'Growth and Partnerships Lead', team: 'Growth', type: 'Flexible engagement', workStyle: 'Flexible location', level: 'Early team', status: 'Accepting applications',
    summary: 'Find focused paths to the owner-led businesses that benefit most from a clearer office command system and develop relationships that make the product easier to discover.',
    outcomes: ['Develop customer and partner insight around the strongest initial verticals.', 'Create clear product narratives grounded in real operational outcomes.', 'Build repeatable outreach and partnership experiments with disciplined learning loops.'],
    profile: 'Experience taking a practical B2B product to a specific customer audience. You can connect customer pain, positioning, partner relationships, and commercial experiments without relying on generic growth language.',
  },
]

export default function CareersJobBoard() {
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('All teams')
  const [type, setType] = useState('All types')
  const [workStyle, setWorkStyle] = useState('All work styles')
  const [selectedId, setSelectedId] = useState(jobs[0].id)
  const teams = ['All teams', ...new Set(jobs.map((job) => job.team))]
  const types = ['All types', ...new Set(jobs.map((job) => job.type))]
  const workStyles = ['All work styles', ...new Set(jobs.map((job) => job.workStyle))]
  const filteredJobs = useMemo(() => {
    const terms = query.trim().toLowerCase()
    return jobs.filter((job) => {
      const searchable = `${job.title} ${job.team} ${job.type} ${job.workStyle} ${job.level} ${job.summary} ${job.profile}`.toLowerCase()
      return (!terms || searchable.includes(terms)) && (team === 'All teams' || job.team === team) && (type === 'All types' || job.type === type) && (workStyle === 'All work styles' || job.workStyle === workStyle)
    })
  }, [query, team, type, workStyle])
  const selected = filteredJobs.find((job) => job.id === selectedId) || filteredJobs[0]
  const resetFilters = () => { setQuery(''); setTeam('All teams'); setType('All types'); setWorkStyle('All work styles') }

  return <section id="open-roles" className="section jobs-section">
    <div className="jobs-heading"><div><p className="eyebrow">Open roles</p><h2>Find work with a clear reason to exist.</h2><p className="section-copy">Start with the role that fits. Every listing states the work, the expected outcomes, the work arrangement, and a direct application action.</p></div><div className="jobs-count"><strong>{filteredJobs.length}</strong><span>{filteredJobs.length === 1 ? 'role matches your search' : 'roles match your search'}</span></div></div>
    <div className="job-search-controls">
      <label className="job-keyword"><span>Search roles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, skill, team, or keyword" /></label>
      <label><span>Team</span><select value={team} onChange={(event) => setTeam(event.target.value)}>{teams.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>Engagement</span><select value={type} onChange={(event) => setType(event.target.value)}>{types.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>Work style</span><select value={workStyle} onChange={(event) => setWorkStyle(event.target.value)}>{workStyles.map((option) => <option key={option}>{option}</option>)}</select></label>
      <button className="filter-reset" type="button" onClick={resetFilters}>Reset</button>
    </div>
    {!filteredJobs.length && <div className="jobs-empty"><strong>No roles match those filters.</strong><p>Try a broader keyword or remove a filter. You can also send an open application with the area you want to own.</p><button className="primary" type="button" onClick={resetFilters}>Show all roles</button></div>}
    {!!filteredJobs.length && <div className="jobs-workspace"><div className="job-list" aria-label="Job listings">{filteredJobs.map((job) => <button className={selected?.id === job.id ? 'job-listing selected' : 'job-listing'} type="button" key={job.id} onClick={() => setSelectedId(job.id)}><span>{job.status}</span><strong>{job.title}</strong><p>{job.team} · {job.type}</p><small>{job.workStyle}</small><em>Review role</em></button>)}</div><article className="job-detail"><div className="job-detail-head"><div><span>{selected.status}</span><h3>{selected.title}</h3><p>{selected.team} · {selected.type} · {selected.workStyle}</p></div><strong>{selected.level}</strong></div><p className="job-summary">{selected.summary}</p><div className="job-detail-section"><h4>What you will own</h4><ul>{selected.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul></div><div className="job-detail-section"><h4>What helps you succeed</h4><p>{selected.profile}</p></div><div className="job-detail-section"><h4>Before you invest more time</h4><p>Role scope, engagement structure, and compensation are discussed directly before a structured role interview so you can decide whether the opportunity is worth pursuing.</p></div><a className="primary" href={`mailto:solidartentertainment@gmail.com?subject=${encodeURIComponent(`OverHead application - ${selected.title}`)}`}>Apply by email</a><p className="job-apply-note">Include a short introduction and your resume, portfolio, or a relevant work example.</p></article></div>}
  </section>
}
