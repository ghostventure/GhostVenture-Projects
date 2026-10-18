const DATE_FIELDS = ['created_at', 'updated_at', 'scheduled_for', 'due_at', 'due_date', 'expense_date']

export function recordDate(record) {
  for (const field of DATE_FIELDS) if (record?.[field]) return Date.parse(record[field]) || 0
  return 0
}

export function buildReportMetrics(backendState = {}, rangeDays = 30) {
  const cutoff = rangeDays === 'all' ? 0 : Date.now() - Number(rangeDays) * 86400000
  const within = (record) => !cutoff || recordDate(record) >= cutoff
  const invoices = (backendState.invoices || []).filter(within)
  const quotes = (backendState.quotes || []).filter(within)
  const tasks = (backendState.tasks || []).filter(within)
  const expenses = (backendState.expenses || []).filter(within)
  const customers = (backendState.customers || []).filter(within)
  const revenueByMonth = new Map()
  for (const invoice of invoices) {
    const month = String(invoice.created_at || invoice.updated_at || '').slice(0, 7)
    if (month) revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + Number(invoice.amount || 0))
  }
  const invoiceCustomers = new Map()
  for (const invoice of invoices) if (invoice.customer_id) invoiceCustomers.set(invoice.customer_id, (invoiceCustomers.get(invoice.customer_id) || 0) + 1)
  const customerCohorts = new Map()
  for (const customer of customers) {
    const month = String(customer.created_at || '').slice(0, 7)
    if (month) customerCohorts.set(month, (customerCohorts.get(month) || 0) + 1)
  }
  const quotesSent = quotes.filter((quote) => ['Sent', 'Accepted', 'Declined'].includes(quote.status)).length
  const tasksDone = tasks.filter((task) => task.status === 'Complete').length
  const today = new Date()
  const aging = { current: 0, '1–30 days': 0, '31–60 days': 0, '61+ days': 0 }
  for (const invoice of backendState.invoices || []) {
    if (invoice.status === 'Paid' || invoice.status === 'Void') continue
    const due = Date.parse(invoice.due_date || '')
    if (!due || due >= today.getTime()) aging.current += Number(invoice.amount || 0)
    else {
      const days = Math.floor((today.getTime() - due) / 86400000)
      aging[days <= 30 ? '1–30 days' : days <= 60 ? '31–60 days' : '61+ days'] += Number(invoice.amount || 0)
    }
  }
  const expenseByMonth = new Map()
  for (const expense of expenses) {
    const month = String(expense.expense_date || '').slice(0, 7)
    if (month) expenseByMonth.set(month, (expenseByMonth.get(month) || 0) + Number(expense.amount || 0))
  }
  return {
    revenueByMonth: [...revenueByMonth].sort(([a], [b]) => a.localeCompare(b)),
    expenseByMonth: [...expenseByMonth].sort(([a], [b]) => a.localeCompare(b)),
    quoteConversion: { sent: quotesSent, accepted: quotes.filter((quote) => quote.status === 'Accepted').length, declined: quotes.filter((quote) => quote.status === 'Declined').length },
    customerRetention: { customers: customers.length, repeatCustomers: [...invoiceCustomers.values()].filter((count) => count > 1).length, cohorts: [...customerCohorts].sort(([a], [b]) => a.localeCompare(b)) },
    taskCompletion: { total: tasks.length, completed: tasksDone, rate: tasks.length ? Math.round(tasksDone / tasks.length * 100) : 0 },
    agingReceivables: aging,
    sourceCounts: { invoices: (backendState.invoices || []).length, quotes: (backendState.quotes || []).length, tasks: (backendState.tasks || []).length, expenses: (backendState.expenses || []).length, customers: (backendState.customers || []).length },
  }
}

export function filterReportRows(records = [], { period = '30', status = 'All', query = '' } = {}) {
  const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * 86400000
  const needle = query.trim().toLocaleLowerCase()
  return records.filter((record) => {
    const timestamp = recordDate(record)
    const matchesDate = !cutoff || (timestamp > 0 && timestamp >= cutoff)
    const matchesStatus = status === 'All' || String(record.status || 'Unspecified') === status
    const matchesText = !needle || Object.values(record).some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(needle))
    return matchesDate && matchesStatus && matchesText
  })
}
