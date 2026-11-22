'use client'

import { useMemo, useState } from 'react'

const startingTasks = [
  {
    id: 'OH-1042',
    title: 'Follow up on ceramic detail quote',
    customer: 'Oak City Detail',
    owner: 'Jordan',
    area: 'Quote follow-up',
    due: 'Today',
    status: 'Needs action',
    amount: 780,
  },
  {
    id: 'OH-1038',
    title: 'Check the overdue fleet invoice',
    customer: 'Triangle Fleet Care',
    owner: 'Casey',
    area: 'Invoice follow-up',
    due: '8 days overdue',
    status: 'Needs action',
    amount: 420,
  },
  {
    id: 'OH-1045',
    title: 'Review the after-hours service price',
    customer: 'Oak City Detail',
    owner: 'Jordan',
    area: 'Owner approval',
    due: 'Today',
    status: 'Waiting for owner',
    amount: 195,
  },
  {
    id: 'OH-1048',
    title: 'Send the post-service check-in',
    customer: 'Pine Ridge Mobile Wash',
    owner: 'Sam',
    area: 'Customer follow-up',
    due: 'Tomorrow',
    status: 'Scheduled',
    amount: 0,
  },
]

const customers = [
  {
    name: 'Oak City Detail',
    contact: 'Jordan Miles',
    email: 'jordan@oakcity.example',
    type: 'Auto detailing',
    note: 'Escalate custom pricing to the owner before sending a quote.',
  },
  {
    name: 'Triangle Fleet Care',
    contact: 'Casey Morgan',
    email: 'casey@trianglefleet.example',
    type: 'Fleet maintenance',
    note: 'Send invoice reminders to the billing contact and log the next step.',
  },
  {
    name: 'Pine Ridge Mobile Wash',
    contact: 'Sam Rivera',
    email: 'sam@pineridge.example',
    type: 'Mobile wash',
    note: 'Send a short check-in after completed service.',
  },
]

const startingActivity = [
  'A quote follow-up was assigned to Jordan.',
  'An invoice reminder was added to today’s review.',
  'A custom price was routed to the owner for approval.',
]

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const views = ['Overview', 'Work queue', 'Customers', 'Activity']

export default function DemoWorkspace() {
  const [activeView, setActiveView] = useState('Overview')
  const [tasks, setTasks] = useState(startingTasks)
  const [activity, setActivity] = useState(startingActivity)
  const [selectedCustomer, setSelectedCustomer] = useState(customers[0])
  const [notice, setNotice] = useState('')

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'Done'), [tasks])
  const followUpValue = useMemo(
    () => openTasks.filter((task) => task.area.includes('follow-up')).reduce((sum, task) => sum + task.amount, 0),
    [openTasks],
  )

  function completeTask(task) {
    if (task.status === 'Done') return
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'Done' } : item))
    setActivity((current) => [`${task.id} was marked complete in this demo.`, ...current])
    setNotice('Marked complete in this demo. Refresh or reset to start over.')
  }

  function resetDemo() {
    setTasks(startingTasks)
    setActivity(startingActivity)
    setSelectedCustomer(customers[0])
    setActiveView('Overview')
    setNotice('Demo reset to its sample starting point.')
  }

  return (
    <section id="try-demo" className="section demo-product-section" aria-label="Interactive OverHead sample workspace">
      <div className="demo-safety-banner" role="note">
        <span className="demo-safety-dot" aria-hidden="true" />
        <div>
          <strong>Sample workspace · fictional records</strong>
          <p>Changes are temporary and in memory. Leaving or refreshing resets them; nothing is sent, saved to an account, or connected to a real business.</p>
        </div>
        <button className="demo-reset" type="button" onClick={resetDemo}>Reset demo</button>
      </div>

      <div className="demo-app-frame">
        <aside className="demo-sidebar" aria-label="Demo navigation">
          <div className="demo-brand"><span>OH</span><div><strong>OverHead</strong><small>Sample office</small></div></div>
          <nav>
            {views.map((view) => (
              <button
                className={activeView === view ? 'active' : ''}
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                aria-current={activeView === view ? 'page' : undefined}
              >
                <span aria-hidden="true">{view === 'Overview' ? '⌂' : view === 'Work queue' ? '◷' : view === 'Customers' ? '◎' : '≋'}</span>
                {view}
              </button>
            ))}
          </nav>
          <div className="demo-sidebar-note">
            <span>DEMO MODE</span>
            <p>See the flow with sample data. No real records or services are connected.</p>
          </div>
        </aside>

        <div className="demo-main">
          <header className="demo-topbar">
            <div><span>Oak City Detail</span><small>Owner workspace · sample data</small></div>
            <span className="demo-plan-pill">Preview</span>
          </header>

          {notice && <p className="demo-notice" role="status">{notice}</p>}

          {activeView === 'Overview' && (
            <div className="demo-view-content">
              <div className="demo-view-heading">
                <div><p className="eyebrow">Sample workday</p><h2>See what needs a next step.</h2><p>Start with the customer work that may be waiting on a reply, payment, or decision.</p></div>
                <button className="demo-outline-button" type="button" onClick={() => setActiveView('Work queue')}>Review work queue <span aria-hidden="true">→</span></button>
              </div>

              <div className="demo-metrics">
                <article><span>Open work</span><strong>{openTasks.length}</strong><small>Items with a next action</small></article>
                <article><span>Follow-up value</span><strong>{money.format(followUpValue)}</strong><small>Illustrative open quote and invoice amounts</small></article>
                <article><span>Owner review</span><strong>{openTasks.filter((task) => task.status === 'Waiting for owner').length}</strong><small>Decisions waiting for approval</small></article>
              </div>

              <section className="demo-card">
                <div className="demo-card-heading"><div><span className="eyebrow">Needs attention</span><h3>Keep the next action visible.</h3></div><button type="button" className="demo-text-button" onClick={() => setActiveView('Work queue')}>View all</button></div>
                <TaskList tasks={openTasks.slice(0, 3)} onComplete={completeTask} onCustomer={(name) => { setSelectedCustomer(customers.find((customer) => customer.name === name) || customers[0]); setActiveView('Customers') }} />
              </section>

              <section className="demo-card demo-principle-card">
                <div><span className="eyebrow">One simple habit</span><h3>Capture it. Assign it. Follow through.</h3><p>OverHead puts the customer, next action, owner, and status together so work is easier to pick up and review.</p></div>
                <div className="demo-workflow-steps"><span><b>01</b> Capture context</span><span><b>02</b> Assign the next step</span><span><b>03</b> Review what changed</span></div>
              </section>
            </div>
          )}

          {activeView === 'Work queue' && (
            <div className="demo-view-content">
              <div className="demo-view-heading"><div><p className="eyebrow">Workflows · sample queue</p><h2>Every open item has an owner.</h2><p>Mark an item complete to see how the queue and activity record respond.</p></div><span className="demo-count">{openTasks.length} open</span></div>
              <section className="demo-card"><TaskList tasks={tasks} onComplete={completeTask} onCustomer={(name) => { setSelectedCustomer(customers.find((customer) => customer.name === name) || customers[0]); setActiveView('Customers') }} /></section>
              <p className="demo-inline-note">Completing a task only changes this temporary sample. It does not send a message or change real data.</p>
            </div>
          )}

          {activeView === 'Customers' && (
            <div className="demo-view-content">
              <div className="demo-view-heading"><div><p className="eyebrow">Customers · sample records</p><h2>Customer context stays close to the work.</h2><p>Select a fictional business to see its workflow notes and open work.</p></div></div>
              <div className="demo-customer-layout">
                <div className="demo-customer-list" role="list" aria-label="Sample customers">
                  {customers.map((customer) => (
                    <button key={customer.name} type="button" className={selectedCustomer.name === customer.name ? 'selected' : ''} onClick={() => setSelectedCustomer(customer)}>
                      <span className="demo-avatar">{customer.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                      <span><strong>{customer.name}</strong><small>{customer.type}</small></span>
                      <b>{tasks.filter((task) => task.customer === customer.name && task.status !== 'Done').length}</b>
                    </button>
                  ))}
                </div>
                <article className="demo-customer-detail">
                  <span className="eyebrow">Customer profile · fictional</span>
                  <h3>{selectedCustomer.name}</h3>
                  <p>{selectedCustomer.type}</p>
                  <dl><div><dt>Primary contact</dt><dd>{selectedCustomer.contact}</dd></div><div><dt>Email</dt><dd>{selectedCustomer.email}</dd></div><div><dt>Open items</dt><dd>{tasks.filter((task) => task.customer === selectedCustomer.name && task.status !== 'Done').length}</dd></div></dl>
                  <div className="demo-customer-rule"><strong>Workflow note</strong><p>{selectedCustomer.note}</p></div>
                  <div className="demo-related-work"><strong>Related work</strong>{tasks.filter((task) => task.customer === selectedCustomer.name).map((task) => <span key={task.id}>{task.title} <small>{task.status}</small></span>)}</div>
                </article>
              </div>
            </div>
          )}

          {activeView === 'Activity' && (
            <div className="demo-view-content">
              <div className="demo-view-heading"><div><p className="eyebrow">Evidence · sample activity</p><h2>Make the handoff easy to understand.</h2><p>Review a short history of what changed in this demo workspace.</p></div></div>
              <section className="demo-card"><div className="demo-activity-list">{activity.map((item, index) => <article key={`${item}-${index}`}><span aria-hidden="true">{index === 0 ? '●' : '○'}</span><div><strong>{item}</strong><small>{index === 0 && notice ? 'Just now · demo only' : `${index + 1} hours ago · sample activity`}</small></div></article>)}</div></section>
              <p className="demo-inline-note">This is an illustrative activity view, not an audit or compliance record.</p>
            </div>
          )}

          <footer className="demo-footer"><span>Fictional sample business and data</span><span>Browser preview only · no account · no live connections</span></footer>
        </div>
      </div>

      <div className="demo-boundaries">
        <strong>What this demo includes</strong>
        <p>A sample dashboard, customer records, work queue, follow-up amounts, and a temporary task-completion interaction.</p>
        <strong>What it does not do</strong>
        <p>No sign-in, uploads, imports, payments, email or text messages, integrations, account creation, or persistent storage. Use the installed apps for real business data.</p>
      </div>
    </section>
  )
}

function TaskList({ tasks, onComplete, onCustomer }) {
  if (!tasks.length) {
    return <div className="demo-empty"><strong>Queue clear.</strong><p>All sample items are complete. Reset the demo to explore again.</p></div>
  }

  return (
    <div className="demo-task-list">
      {tasks.map((task) => (
        <article className={task.status === 'Done' ? 'done' : ''} key={task.id}>
          <span className="demo-task-mark" aria-hidden="true">{task.status === 'Done' ? '✓' : task.area === 'Owner approval' ? '!' : '↗'}</span>
          <div className="demo-task-main"><span>{task.area} · {task.id}</span><strong>{task.title}</strong><button type="button" className="demo-task-customer" onClick={() => onCustomer(task.customer)}>{task.customer}</button></div>
          <div className="demo-task-meta"><strong>{task.amount ? money.format(task.amount) : '—'}</strong><small>{task.due} · {task.owner}</small><span className={task.status === 'Waiting for owner' ? 'waiting' : task.status === 'Done' ? 'complete' : ''}>{task.status}</span></div>
          {task.status !== 'Done' && <button type="button" className="demo-complete-button" onClick={() => onComplete(task)}>Mark done</button>}
        </article>
      ))}
    </div>
  )
}
