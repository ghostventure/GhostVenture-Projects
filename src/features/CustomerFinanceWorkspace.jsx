import { useEffect, useMemo, useState } from 'react'
import { FeaturePanel, FeatureRecordList, FeatureRecordManager, FeatureTabs, currentDate, currentMonth, useFeatureRecords } from './FeatureWave101Helpers'

const tabs = [
  { id: 'invoices', label: 'Invoice plans' }, { id: 'purchasing', label: 'Purchasing' },
  { id: 'forecast', label: 'Cash flow' }, { id: 'controls', label: 'Tax and currency' },
  { id: 'credits', label: 'Credits and refunds' }, { id: 'close', label: 'Period close' },
]
const frequencies = ['Monthly', 'Quarterly', 'Yearly']
const accountingFormats = ['General ledger CSV', 'Invoice register CSV']
const emptyRows = []
const money = (amount, currency = 'USD') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount) || 0)

export default function CustomerFinanceWorkspace({ backendState = {}, setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('finance')
  const [tab, setTab] = useState('invoices')
  const [month, setMonth] = useState(currentMonth())
  const [taxDraft, setTaxDraft] = useState({ rate: '', label: 'Sales tax' })
  const [taxInvoiceDraft, setTaxInvoiceDraft] = useState({ title: '', amount: '', customerId: '' })
  const [currencyDraft, setCurrencyDraft] = useState({ currency: 'USD', rateToUsd: '1' })
  const [exportFormat, setExportFormat] = useState(accountingFormats[0])

  const recurring = records.filter((record) => record.kind === 'recurring_invoice' && record.status !== 'Paused')
  const taxSettings = records.filter((record) => record.kind === 'tax_setting')
  const currencySettings = records.filter((record) => record.kind === 'currency_setting')
  const latestTax = taxSettings[0]
  const invoices = backendState.invoices || emptyRows
  const expenses = backendState.expenses || emptyRows
  const transactions = records.filter((record) => record.kind === 'finance_transaction')
  const revenueSchedules = records.filter((record) => record.kind === 'revenue_schedule')

  const cashFlow = useMemo(() => {
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(`${month}-01T12:00:00`)
      date.setMonth(date.getMonth() + index)
      return date.toISOString().slice(0, 7)
    })
    return monthKeys.map((key) => {
      const inflow = invoices.filter((item) => item.status !== 'Paid' && String(item.due_date || '').startsWith(key)).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const outflow = expenses.filter((item) => String(item.expense_date || '').startsWith(key) && item.status !== 'Rejected').reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const planned = recurring.filter((item) => String(item.nextDue || '').startsWith(key)).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const recognized = revenueSchedules.filter((item) => {
        const offset = (Number(key.slice(0, 4)) - Number(String(item.startMonth || '').slice(0, 4))) * 12 + Number(key.slice(5, 7)) - Number(String(item.startMonth || '').slice(5, 7))
        return offset >= 0 && offset < Number(item.periods || 0)
      }).reduce((sum, item) => sum + Number(item.amount || 0) / Math.max(1, Number(item.periods || 1)), 0)
      return { month: key, inflow, outflow, planned, recognized, net: inflow - outflow + planned }
    })
  }, [month, invoices, expenses, recurring, revenueSchedules])
  const currencyTotals = useMemo(() => {
    const totals = new Map()
    for (const item of invoices) {
      const currency = String(item.currency || 'USD').toUpperCase()
      const total = totals.get(currency) || { currency, invoices: 0, expenses: 0 }
      total.invoices += Number(item.amount || 0)
      totals.set(currency, total)
    }
    for (const item of expenses) {
      const currency = String(item.currency || 'USD').toUpperCase()
      const total = totals.get(currency) || { currency, invoices: 0, expenses: 0 }
      total.expenses += Number(item.amount || 0)
      totals.set(currency, total)
    }
    for (const item of transactions) {
      const currency = String(item.currency || 'USD').toUpperCase()
      const total = totals.get(currency) || { currency, invoices: 0, expenses: 0, credits: 0 }
      if (item.direction === 'Credit') total.credits += Number(item.amount || 0)
      else total.invoices += Number(item.amount || 0)
      totals.set(currency, total)
    }
    return [...totals.values()].map((total) => {
      const rate = Number(currencySettings.find((item) => item.currency === total.currency)?.rateToUsd ?? (total.currency === 'USD' ? 1 : 0))
      const net = total.invoices + Number(total.credits || 0) - total.expenses
      return { ...total, net, usdEquivalent: rate > 0 ? net * rate : null, rate }
    })
  }, [invoices, expenses, currencySettings, transactions])

  useEffect(() => {
    if (latestTax) setTaxDraft({ rate: String(latestTax.rate ?? ''), label: latestTax.label || 'Sales tax' })
  }, [latestTax])

  async function issueNextInvoice(schedule) {
    if (!window.overheadBackend?.createInvoice) throw new Error('Invoice creation is unavailable.')
    await window.overheadBackend.createInvoice({ title: schedule.title, amount: Number(schedule.amount), dueDate: schedule.nextDue, customerId: schedule.customerId || '' })
    const next = new Date(`${schedule.nextDue}T12:00:00`)
    next.setMonth(next.getMonth() + (schedule.frequency === 'Quarterly' ? 3 : schedule.frequency === 'Yearly' ? 12 : 1))
    await save({ ...schedule, nextDue: next.toISOString().slice(0, 10) })
    setOperationNotice(`Invoice created from recurring plan. Next due date: ${next.toLocaleDateString()}.`)
  }

  async function issueFromTemplate(template) {
    const created = await window.overheadBackend?.createInvoice?.({ title: template.name || template.title, amount: Number(template.amount) })
    const invoice = Array.isArray(created) ? created[0] : null
    await save({ kind: 'invoice_template_use', title: `Invoice created from ${template.name || 'template'}`, templateId: template.id, invoiceId: invoice?.id || '', amount: Number(template.amount), createdAt: new Date().toISOString() })
    setOperationNotice(`Invoice created from template for ${money(template.amount)}.`)
  }

  async function saveTax() {
    const rate = Number(taxDraft.rate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Tax rate must be between 0 and 100 percent.')
    await save({ ...(latestTax || {}), kind: 'tax_setting', title: taxDraft.label, label: taxDraft.label, rate })
    setOperationNotice('Tax rate saved locally. New invoice totals can use this setting.')
  }

  async function createTaxInvoice() {
    const subtotal = Number(taxInvoiceDraft.amount)
    if (!taxInvoiceDraft.title.trim() || !Number.isFinite(subtotal) || subtotal <= 0) throw new Error('Enter an invoice title and a positive subtotal.')
    if (!latestTax) throw new Error('Save a tax rate before creating a tax-calculated invoice.')
    const tax = Math.round(subtotal * Number(latestTax.rate || 0)) / 100
    const total = Math.round((subtotal + tax) * 100) / 100
    const rows = await window.overheadBackend?.createInvoice?.({ title: taxInvoiceDraft.title.trim(), amount: total, customerId: taxInvoiceDraft.customerId })
    const invoice = Array.isArray(rows) ? rows[0] : null
    await save({ kind: 'tax_invoice', title: taxInvoiceDraft.title.trim(), invoiceId: invoice?.id || '', customerId: taxInvoiceDraft.customerId, subtotal, tax, total, taxRate: Number(latestTax.rate), taxLabel: latestTax.label, currency: 'USD' })
    setTaxInvoiceDraft({ title: '', amount: '', customerId: '' })
    setOperationNotice(`Tax-calculated invoice created: ${money(total)} total.`)
  }

  async function saveCurrency() {
    const rate = Number(currencyDraft.rateToUsd)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a positive conversion rate to USD.')
    await save({ kind: 'currency_setting', title: `${currencyDraft.currency} reference rate`, currency: currencyDraft.currency, rateToUsd: rate, rateDate: currentDate() })
    setOperationNotice('Currency reference rate saved. OverHead does not fetch live exchange rates.')
  }

  async function exportAccounting() {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const invoiceRows = invoices.map((row) => ({ date: row.due_date || row.created_at, reference: row.id, description: row.title, status: row.status, currency: row.currency || 'USD', amount: Number(row.amount || 0), kind: 'Invoice' }))
    const expenseRows = expenses.map((row) => ({ date: row.expense_date || row.created_at, reference: row.id, description: row.description || row.title, status: row.status, currency: row.currency || 'USD', amount: Number(row.amount || 0), kind: 'Expense' }))
    const manualRows = transactions.map((row) => ({ date: row.date || row.createdAt, reference: row.id, description: row.title, status: row.status, currency: row.currency || 'USD', amount: Number(row.amount || 0), kind: row.direction === 'Credit' ? 'Credit' : 'Debit' }))
    const creditRows = records.filter((row) => row.kind === 'credit_note').map((row) => ({ date: row.date, reference: row.id, description: row.title, status: row.status, currency: row.currency || 'USD', amount: Number(row.amount || 0), kind: 'Credit note' }))
    const register = [...invoiceRows, ...expenseRows, ...manualRows, ...creditRows].filter((row) => String(row.date || '').startsWith(month))
    const rows = exportFormat === 'Invoice register CSV'
      ? [['Date', 'Reference', 'Description', 'Status', 'Currency', 'Amount'], ...invoiceRows.filter((row) => String(row.date || '').startsWith(month)).map((row) => [row.date, row.reference, row.description, row.status, row.currency, row.amount])]
      : [['Date', 'Reference', 'Account', 'Description', 'Debit', 'Credit', 'Currency'], ...register.flatMap((row) => {
        const debit = ['Expense', 'Debit'].includes(row.kind)
        const account = row.kind === 'Expense' ? 'Operating Expense' : row.kind === 'Credit note' || row.kind === 'Credit' ? 'Credits' : 'Accounts Receivable / Revenue'
        return [[row.date, row.reference, account, row.description, debit ? row.amount : '', debit ? '' : row.amount, row.currency]]
      })]
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `overhead-accounting-${month.replace('-', '')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    await save({ kind: 'accounting_export', title: `${exportFormat} ${month}`, month, format: exportFormat, exportedRows: Math.max(0, rows.length - 1), exportedAt: new Date().toISOString() })
    setOperationNotice(`Accounting CSV saved to this device (${Math.max(0, rows.length - 1)} rows).`)
  }

  async function saveRecord(record) { await save(record); setError(''); setOperationNotice(`${record.title || 'Finance record'} saved locally.`) }
  async function deleteRecord(id) { await remove(id); setOperationNotice('Finance record deleted.') }

  return <section className="reports-page">
    <FeatureTabs tabs={tabs} active={tab} onChange={setTab} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p className="queue-empty">Loading secure finance records…</p>}
    {tab === 'invoices' && <>
      <FeaturePanel eyebrow="Billing and finance" title="Invoice templates and recurring billing" description="Save reusable local invoice terms. Create recurring invoices on their due date from a saved schedule; the schedule advances only after you create the invoice.">
        <FeatureRecordManager records={records} kind="invoice_template" title="Invoice templates" description="Store reusable item details and create invoices from the template." fields={[{ name: 'name', label: 'Template name', required: true }, { name: 'description', label: 'Line item description', required: true }, { name: 'amount', label: 'Amount', type: 'number', min: 0.01, step: 0.01, required: true }, { name: 'dueDays', label: 'Days until due', type: 'number', min: 0, step: 1, defaultValue: '30' }, { name: 'notes', label: 'Invoice notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} onAction={(template) => issueFromTemplate(template).catch((reason) => setError(reason.message))} actionLabel="Create invoice" emptyText="No invoice templates yet." />
        <FeatureRecordManager records={records} kind="recurring_invoice" title="Recurring invoice schedules" description="Track monthly, quarterly, and annual invoice plans. Generate each invoice manually so owners can review before it is issued." fields={[{ name: 'title', label: 'Invoice title', required: true }, { name: 'amount', label: 'Amount', type: 'number', min: 0.01, step: 0.01, required: true }, { name: 'customerId', label: 'Customer record ID' }, { name: 'frequency', label: 'Frequency', options: frequencies }, { name: 'nextDue', label: 'Next due date', type: 'date', required: true }, { name: 'status', label: 'Schedule status', options: ['Active', 'Paused'], defaultValue: 'Active' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Active', 'Paused']} emptyText="No recurring invoice plans yet." onAction={(schedule) => issueNextInvoice(schedule).catch((reason) => setError(reason.message))} actionLabel="Generate next invoice" />
      </FeaturePanel>
      <FeaturePanel eyebrow="Payment follow-up" title="Overdue invoice reminders" description="Create a local reminder task for an overdue invoice. OverHead does not send customer email from this screen.">
        <div className="task-list">{invoices.filter((invoice) => ['Open', 'Sent'].includes(invoice.status) && invoice.due_date && invoice.due_date < currentDate()).map((invoice) => <article className="task-row" key={invoice.id}><strong>{invoice.title}</strong><span>{invoice.status} · Due {invoice.due_date} · {money(invoice.amount)}</span><button className="ghost-button" type="button" onClick={async () => { await window.overheadBackend?.createQuickNote?.({ title: `Payment reminder: ${invoice.title}`, details: `Invoice ${invoice.id} is overdue. Review payment status and contact the billing contact.` }); setOperationNotice('Overdue invoice reminder added to the local work queue.') }}>Add reminder task</button></article>)}{!invoices.some((invoice) => ['Open', 'Sent'].includes(invoice.status) && invoice.due_date && invoice.due_date < currentDate()) && <p className="queue-empty">No overdue invoices.</p>}</div>
      </FeaturePanel>
    </>}
    {tab === 'purchasing' && <FeaturePanel eyebrow="Purchasing" title="Purchase order tracking" description="Track a purchase request through approval and receipt in the encrypted local workspace.">
      <FeatureRecordManager records={records} kind="purchase_order" title="Purchase orders" description="Record vendor, amount, requested date, and procurement status." fields={[{ name: 'title', label: 'Purchase description', required: true }, { name: 'vendor', label: 'Vendor', required: true }, { name: 'category', label: 'Category', options: ['Supplies', 'Equipment', 'Software', 'Services', 'Other'] }, { name: 'amount', label: 'Amount', type: 'number', min: 0, step: 0.01, required: true }, { name: 'date', label: 'Requested date', type: 'date', defaultValue: currentDate() }, { name: 'status', label: 'Status', options: ['Draft', 'Pending approval', 'Approved', 'Ordered', 'Received', 'Canceled'], defaultValue: 'Draft' }, { name: 'notes', label: 'Notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Draft', 'Pending approval', 'Approved', 'Ordered', 'Received', 'Canceled']} emptyText="No purchase orders recorded." />
    </FeaturePanel>}
    {tab === 'forecast' && <FeaturePanel eyebrow="Planning" title="Six-month cash-flow view" description="A simple forecast from open invoice due dates, recorded expenses, and active recurring invoice plans. It is a planning aid, not a bank balance or accounting forecast.">
      <label className="form-field">Start month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <div className="task-list">{cashFlow.map((row) => <article className="task-row" key={row.month}><strong>{row.month}</strong><span>Invoices due {money(row.inflow)}</span><span>Recorded costs {money(row.outflow)}</span><span>Planned recurring {money(row.planned)}</span><span>Revenue recognized {money(row.recognized)}</span><b>Projected {money(row.net)}</b></article>)}</div>
      <FeatureRecordManager records={records} kind="revenue_schedule" title="Revenue recognition schedules" description="Keep a month-by-month local schedule for amounts that should be recognized over time; it does not post journal entries." fields={[{ name: 'title', label: 'Schedule name', required: true }, { name: 'amount', label: 'Total amount', type: 'number', min: 0.01, step: 0.01, required: true }, { name: 'startMonth', label: 'First month', type: 'month', required: true }, { name: 'periods', label: 'Number of months', type: 'number', min: 1, step: 1, required: true }, { name: 'notes', label: 'Accounting note', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No revenue schedules." />
    </FeaturePanel>}
    {tab === 'controls' && <FeaturePanel eyebrow="Tax and currency" title="Local tax and currency settings" description="These settings are planning references. OverHead does not calculate tax obligations or fetch foreign-exchange rates.">
      <div className="profile-form compact-form"><label>Tax label<input value={taxDraft.label} onChange={(event) => setTaxDraft((current) => ({ ...current, label: event.target.value }))} /></label><label>Tax rate (%)<input type="number" min="0" max="100" step="0.001" value={taxDraft.rate} onChange={(event) => setTaxDraft((current) => ({ ...current, rate: event.target.value }))} /></label><button className="ghost-button" type="button" onClick={() => saveTax().catch((reason) => setError(reason.message))}>Save tax setting</button><span>Current: {latestTax?.label || 'No rate saved'} {latestTax ? `${latestTax.rate}%` : ''}</span></div>
      <div className="profile-form compact-form"><label>Currency<select value={currencyDraft.currency} onChange={(event) => setCurrencyDraft((current) => ({ ...current, currency: event.target.value }))}>{['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY'].map((currency) => <option key={currency}>{currency}</option>)}</select></label><label>Reference rate to USD<input type="number" min="0.000001" step="0.000001" value={currencyDraft.rateToUsd} onChange={(event) => setCurrencyDraft((current) => ({ ...current, rateToUsd: event.target.value }))} /></label><button className="ghost-button" type="button" onClick={() => saveCurrency().catch((reason) => setError(reason.message))}>Save reference rate</button></div>
      <FeatureRecordManager records={records} kind="finance_transaction" title="Multi-currency transaction" description="Record a non-invoice financial amount in its source currency for the currency summary. Add the manual reference rate above when you need a USD equivalent." fields={[{ name: 'title', label: 'Transaction description', required: true }, { name: 'direction', label: 'Direction', options: ['Debit', 'Credit'] }, { name: 'amount', label: 'Amount', type: 'number', min: 0.01, step: 0.01, required: true }, { name: 'currency', label: 'Currency', options: ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY'] }, { name: 'date', label: 'Date', type: 'date', defaultValue: currentDate() }, { name: 'status', label: 'Status', options: ['Planned', 'Recorded', 'Reconciled'], defaultValue: 'Recorded' }, { name: 'notes', label: 'Reference', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Planned', 'Recorded', 'Reconciled']} emptyText="No non-invoice transactions." />
      <FeatureRecordList records={records.filter((record) => record.kind === 'currency_setting')} emptyText="No currency reference rates saved." onDelete={deleteRecord} />
      <div className="task-list">{currencyTotals.map((row) => <article className="task-row" key={row.currency}><strong>{row.currency}</strong><span>Invoices {money(row.invoices, row.currency)}</span><span>Expenses {money(row.expenses, row.currency)}</span><span>Net {money(row.net, row.currency)}</span><span>{row.usdEquivalent === null ? 'No USD reference rate saved' : `USD reference ${money(row.usdEquivalent)}`}</span></article>)}{!currencyTotals.length && <p className="queue-empty">No invoiced or expense amounts to report yet.</p>}</div>
      <div className="profile-form compact-form"><strong>Create an invoice with this tax setting</strong><label>Invoice title<input value={taxInvoiceDraft.title} onChange={(event) => setTaxInvoiceDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Subtotal<input type="number" min="0.01" step="0.01" value={taxInvoiceDraft.amount} onChange={(event) => setTaxInvoiceDraft((current) => ({ ...current, amount: event.target.value }))} /></label><label>Customer<select value={taxInvoiceDraft.customerId} onChange={(event) => setTaxInvoiceDraft((current) => ({ ...current, customerId: event.target.value }))}><option value="">No customer assigned</option>{(backendState.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select></label><span>Tax {latestTax?.rate || 0}% · Total {money(Number(taxInvoiceDraft.amount || 0) * (1 + Number(latestTax?.rate || 0) / 100))}</span><button className="primary-action" type="button" onClick={() => createTaxInvoice().catch((reason) => setError(reason.message))}>Create tax-calculated invoice</button></div>
      <FeatureRecordList records={records.filter((record) => record.kind === 'tax_invoice')} emptyText="No tax-calculated invoices recorded." />
    </FeaturePanel>}
    {tab === 'credits' && <FeaturePanel eyebrow="Adjustments" title="Credits and refund register" description="Record issued credits and track refund state locally. These entries do not trigger processor refunds or change customer invoices.">
      <FeatureRecordManager records={records} kind="credit_note" title="Credit notes" description="Track a credit reason, amount, customer, and status." fields={[{ name: 'title', label: 'Credit note title', required: true }, { name: 'customer', label: 'Customer or billing email' }, { name: 'amount', label: 'Credit amount', type: 'number', min: 0.01, step: 0.01, required: true }, { name: 'date', label: 'Issue date', type: 'date', defaultValue: currentDate() }, { name: 'status', label: 'Status', options: ['Draft', 'Issued', 'Applied', 'Voided'], defaultValue: 'Draft' }, { name: 'notes', label: 'Reason', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Draft', 'Issued', 'Applied', 'Voided']} emptyText="No credit notes." />
      <FeatureRecordManager records={records} kind="refund_record" title="Refund tracking" description="Track a refund reference, amount, provider, and current outcome." fields={[{ name: 'title', label: 'Refund reference', required: true }, { name: 'customer', label: 'Customer or billing email' }, { name: 'amount', label: 'Refund amount', type: 'number', min: 0.01, step: 0.01, required: true }, { name: 'currency', label: 'Currency', options: ['USD', 'CAD', 'EUR', 'GBP', 'AUD'] }, { name: 'date', label: 'Refund date', type: 'date', defaultValue: currentDate() }, { name: 'status', label: 'Status', options: ['Requested', 'Processing', 'Refunded', 'Failed'], defaultValue: 'Requested' }, { name: 'notes', label: 'Notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Requested', 'Processing', 'Refunded', 'Failed']} emptyText="No refund records." />
    </FeaturePanel>}
    {tab === 'close' && <FeaturePanel eyebrow="Month-end" title="Financial close checklist and accounting exports" description="Use a separate checklist for each financial month and export a local CSV summary for your accounting workflow.">
      <label className="form-field">Close month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <FeatureRecordManager records={records} kind="close_check" title="Period close controls" description="Track reconciliation, approvals, and review tasks for the selected month." fields={[{ name: 'title', label: 'Close task', required: true }, { name: 'month', label: 'Month', type: 'month', defaultValue: month, required: true }, { name: 'owner', label: 'Responsible person' }, { name: 'status', label: 'Status', options: ['Open', 'In progress', 'Complete', 'Blocked'], defaultValue: 'Open' }, { name: 'notes', label: 'Review note', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Open', 'In progress', 'Complete', 'Blocked']} emptyText="No month-end checklist items." />
      <div className="profile-form compact-form"><label>Accounting CSV format<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>{accountingFormats.map((format) => <option key={format}>{format}</option>)}</select></label><button className="primary-action" type="button" onClick={() => exportAccounting().catch((reason) => setError(reason.message))}>Export accounting CSV</button><span>{invoices.length} invoice rows available · USD reference</span></div>
      <FeatureRecordList records={records.filter((record) => record.kind === 'accounting_export')} emptyText="No accounting exports created yet." />
    </FeaturePanel>}
  </section>
}
