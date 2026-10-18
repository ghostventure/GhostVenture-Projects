import { useEffect, useMemo, useState } from 'react'

const mappings = [
  { id: 'overhead', label: 'OverHead standard', columns: ['businessName', 'ownerName', 'email', 'industry', 'serviceArea', 'preferredContact'] },
  { id: 'quickbooks', label: 'QuickBooks customer columns', columns: ['businessName', 'ownerName', 'email', 'industry', 'serviceArea', 'preferredContact'] },
  { id: 'xero', label: 'Xero contact columns', columns: ['businessName', 'ownerName', 'email', 'industry', 'serviceArea', 'preferredContact'] },
]
const css = { minHeight: 38, padding: '8px 10px', border: '1px solid var(--line, #d7dce2)', borderRadius: 8, background: 'var(--surface, #fff)', color: 'var(--text, #17202a)' }
const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

function parseCsv(source) {
  const lines = String(source || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  return lines.map((line) => {
    const values = []; let cell = ''; let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index += 1 }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { values.push(cell); cell = '' }
      else cell += char
    }
    values.push(cell); return values
  })
}

export function IntegrationStudio({ backendState = {}, sessionRole = 'Owner', refreshBackend = async () => {}, setOperationNotice = () => {} }) {
  const [csvText, setCsvText] = useState('')
  const [mappingId, setMappingId] = useState('overhead')
  const [mappingPreset, setMappingPreset] = useState('')
  const [presets, setPresets] = useState([])
  const [preview, setPreview] = useState([])
  const [format, setFormat] = useState('quickbooks')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const customerList = backendState.customers || []
  useEffect(() => { window.overheadBackend.listFeatureRecords('integrations').then((items) => setPresets(items.filter((item) => item.kind === 'csv_mapping'))).catch(() => {}) }, [])
  const connectionRows = useMemo(() => [
    { name: 'Microsoft 365 / Business Central', connected: (backendState.microsoftConnections || []).length > 0, detail: `${(backendState.microsoftConnections || []).length} read-only connection(s)` },
    { name: 'Stripe', connected: (backendState.stripeConnections || []).length > 0, detail: `${(backendState.stripeConnections || []).length} connection(s); payment snapshots ${backendState.stripeImports?.length || 0}` },
    { name: 'Square', connected: (backendState.squareConnections || []).length > 0, detail: `${(backendState.squareConnections || []).length} connection(s); payment snapshots ${backendState.squareImports?.length || 0}` },
    ...['Google Calendar', 'Microsoft 365 Calendar', 'Google Drive', 'OneDrive', 'Dropbox', 'Slack', 'Microsoft Teams'].map((name) => ({ name, connected: false, detail: 'No account-scoped connector configured' })),
  ], [backendState])

  function createPreview() {
    const table = parseCsv(csvText)
    if (table.length < 2) { setError('Choose a CSV with a header row and at least one record.'); setPreview([]); return }
    const headers = table[0].map((value) => value.trim().replace(/^"|"$/g, ''))
    const rows = table.slice(1, 201).map((values, index) => {
      const record = Object.fromEntries(headers.map((header, column) => [header, String(values[column] || '').trim()]))
      const first = (keys) => keys.map((key) => record[key]).find(Boolean) || ''
      const row = {
        sourceRow: index + 2,
        businessName: first(['business_name', 'Business Name', 'Company', 'Name', 'Contact Name']),
        ownerName: first(['owner_name', 'Owner', 'Contact Person']),
        email: first(['email', 'Email', 'Email Address']).toLowerCase(),
        industry: first(['industry', 'Industry']) || 'General services',
        serviceArea: first(['service_area', 'Service Area']) || 'Local',
        preferredContact: first(['preferred_contact', 'Preferred Contact']) || 'Email',
      }
      const duplicate = Boolean(row.email && customerList.some((customer) => customer.email?.toLowerCase() === row.email))
      return { ...row, valid: Boolean(row.businessName), duplicate, issue: !row.businessName ? 'Business name is required' : duplicate ? 'Email matches an existing customer' : '' }
    })
    setPreview(rows); setError('')
  }
  async function importPreview() {
    if (!preview.length || preview.some((row) => !row.valid)) { setError('Fix or remove invalid rows before importing. Duplicates are skipped.'); return }
    setBusy(true); let imported = 0; let skipped = 0
    try {
      for (const row of preview) {
        if (row.duplicate) { skipped += 1; continue }
        await window.overheadBackend.createCustomer({ businessName: row.businessName, ownerName: row.ownerName, email: row.email, industry: row.industry, serviceArea: row.serviceArea, preferredContact: row.preferredContact })
        imported += 1
      }
      setError(''); setCsvText(''); setPreview([]); await refreshBackend(); setOperationNotice(`Imported ${imported} customers; skipped ${skipped} duplicates.`)
    } catch (reason) { setError(`${String(reason?.message || 'Import stopped.')} ${imported} rows imported before the error; inspect the customer list before retrying.`); await refreshBackend() }
    finally { setBusy(false) }
  }
  async function saveMapping() {
    if (!mappingPreset.trim()) { setError('Name the import mapping preset.'); return }
    try {
      await window.overheadBackend.upsertFeatureRecord({ collection: 'integrations', record: { id: crypto.randomUUID(), kind: 'csv_mapping', title: mappingPreset.trim().slice(0, 80), mapping_id: mappingId, fields: mappings.find((item) => item.id === mappingId)?.columns || [], created_by_role: sessionRole } })
      setPresets(await window.overheadBackend.listFeatureRecords('integrations').then((items) => items.filter((item) => item.kind === 'csv_mapping'))); setMappingPreset(''); setError(''); setOperationNotice('CSV mapping preset saved in the encrypted workspace.')
    } catch (reason) { setError(String(reason?.message || 'Mapping preset could not be saved.')) }
  }
  function exportAccounting() {
    const invoiceRows = backendState.invoices || []; const expenseRows = backendState.expenses || []
    const data = format === 'quickbooks'
      ? [['TxnDate', 'Name', 'Memo', 'Account', 'Amount'], ...invoiceRows.map((row) => [row.created_at?.slice(0, 10), row.title, `Invoice ${row.id}`, 'Accounts Receivable', row.amount]), ...expenseRows.map((row) => [row.expense_date, row.vendor, row.title, row.category, -Number(row.amount || 0)])]
      : [['Date', 'ContactName', 'Description', 'AccountCode', 'Amount'], ...invoiceRows.map((row) => [row.created_at?.slice(0, 10), row.customer_id, row.title, '200', row.amount]), ...expenseRows.map((row) => [row.expense_date, row.vendor, row.title, row.category, -Number(row.amount || 0)])]
    const csv = data.map((line) => line.map(escapeCsv).join(',')).join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = `overhead-${format}-accounting-export-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
    setOperationNotice(`${format === 'quickbooks' ? 'QuickBooks' : 'Xero'}-shaped CSV exported. Review account codes before importing.`)
  }
  return <section className="panel page-panel" aria-labelledby="integration-studio-title">
    <div className="section-head"><div><p className="eyebrow">Local and account-scoped connections</p><h2 id="integration-studio-title">Integration health</h2></div></div>
    <div className="dashboard-grid">{connectionRows.map((item) => <article className="backend-health" key={item.name}><strong>{item.name}</strong><span>{item.connected ? 'Connected' : 'Not configured'} · {item.detail}</span></article>)}</div>
    <article className="panel"><h3>Accounting exports</h3><p>Produce a reviewable CSV for accounting import. OverHead does not connect directly to accounting accounts or claim a tax-ready mapping.</p><div className="report-controls"><label>Format<select style={css} value={format} onChange={(event) => setFormat(event.target.value)}><option value="quickbooks">QuickBooks-compatible CSV</option><option value="xero">Xero-compatible CSV</option></select></label><button className="primary-action" type="button" onClick={exportAccounting}>Export invoices and expenses</button></div></article>
    <article className="panel"><h3>Customer CSV import</h3><p>Preview up to 200 rows locally; duplicate emails are marked and skipped. Imported rows use OverHead's normal validation and permissions.</p><label>Mapping preset<select style={css} value={mappingId} onChange={(event) => setMappingId(event.target.value)}>{mappings.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>CSV file<input type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setCsvText(await file.text()) }} /></label><textarea style={{ ...css, width: '100%', minHeight: 100, marginTop: 8 }} value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="business_name,email,owner_name" /><div className="button-row"><button className="ghost-button" type="button" onClick={createPreview}>Validate preview</button><button className="primary-action" type="button" disabled={busy || !preview.length} onClick={importPreview}>Import valid rows</button><input style={css} value={mappingPreset} onChange={(event) => setMappingPreset(event.target.value)} placeholder="Preset name" /><button className="ghost-button" type="button" onClick={saveMapping}>Save mapping</button></div>{preview.length > 0 && <div className="task-list">{preview.slice(0, 12).map((row) => <div className="task-row" key={row.sourceRow}><strong>Row {row.sourceRow}: {row.businessName || 'Missing business name'}</strong><span>{row.email}</span><span>{row.duplicate ? 'Duplicate · skipped' : row.valid ? 'Ready' : row.issue}</span></div>)}</div>}{presets.map((item) => <p className="form-hint" key={item.id}>Saved mapping: {item.title} ({item.mapping_id})</p>)}</article>
    <div className="backend-health"><strong>External actions that need account setup</strong><p>Calendar, cloud-drive, chat, Zapier, Make, and public webhook delivery need provider consent and account-scoped credentials. No secrets are stored in feature records. Stripe and Square access use their existing validated connection flows.</p></div>
    {error && <p className="form-error">{error}</p>}
  </section>
}
