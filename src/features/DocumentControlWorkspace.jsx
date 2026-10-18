import { useMemo, useState } from 'react'
import { FeaturePanel, FeatureRecordList, FeatureRecordManager, FeatureTabs, currentDate, useFeatureRecords } from './FeatureWave101Helpers'

const tabs = [{ id: 'files', label: 'Customer files' }, { id: 'control', label: 'Versions and approvals' }, { id: 'requests', label: 'Requests and retention' }, { id: 'search', label: 'Search and activity' }]
const emptyRows = []

export default function DocumentControlWorkspace({ backendState = {}, setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('documents')
  const { records: projectRecords } = useFeatureRecords('projects')
  const [tab, setTab] = useState('files')
  const [query, setQuery] = useState('')
  const [exportError, setExportError] = useState('')
  const files = backendState.documents || emptyRows
  const customers = backendState.customers || []

  const duplicateGroups = useMemo(() => {
    const keys = new Map()
    for (const file of files) {
      const key = `${String(file.file_name || '').toLowerCase()}|${Number(file.byte_size || 0)}`
      if (!file.file_name) continue
      keys.set(key, [...(keys.get(key) || []), file])
    }
    return [...keys.values()].filter((group) => group.length > 1)
  }, [files])

  const searchable = useMemo(() => records.filter((record) => {
    const text = [record.fileName, record.title, record.customer, record.project, record.tags, record.searchText, record.comments, record.notes].join(' ').toLowerCase()
    return !query.trim() || text.includes(query.trim().toLowerCase())
  }), [records, query])

  async function saveRecord(record) { await save(record); setError(''); setOperationNotice(`${record.title || record.fileName || 'Document record'} saved in the encrypted workspace.`) }
  async function deleteRecord(id) { await remove(id); setOperationNotice('Document record removed.') }

  async function previewFile(id) {
    if (!window.overheadBackend?.openCustomerDocument) throw new Error('The local document service is unavailable.')
    const result = await window.overheadBackend.openCustomerDocument(id)
    setOperationNotice(`Opened local attachment: ${result?.fileName || 'document'}`)
  }

  async function exportBundle() {
    const rows = searchable.filter((record) => record.kind === 'document_file')
    const payload = { format: 'overhead-document-manifest-v1', exportedAt: new Date().toISOString(), documents: rows.map(({ id, fileName, title, customer, project, tags, status, owner, retentionUntil, accessExpiresAt, notes }) => ({ id, fileName, title, customer, project, tags, status, owner, retentionUntil, accessExpiresAt, notes })) }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    link.download = `overhead-document-manifest-${currentDate()}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    await save({ kind: 'document_export', title: `Document manifest ${currentDate()}`, fileCount: rows.length, exportedAt: new Date().toISOString() })
    setExportError('')
    setOperationNotice('Document metadata manifest saved to this device. Original attachment files are not included.')
  }

  return <section className="reports-page">
    <FeatureTabs tabs={tabs} active={tab} onChange={setTab} />
    {(error || exportError) && <p className="form-error" role="alert">{error || exportError}</p>}{loading && <p className="queue-empty">Loading secure document records…</p>}
    {tab === 'files' && <FeaturePanel eyebrow="Documents and files" title="Customer file rooms" description="The existing customer record vault stores attachments in the local OverHead data folder. Add searchable metadata, tags, ownership, and expiry details here.">
      <div className="task-list">{customers.map((customer) => {
        const customerFiles = files.filter((file) => file.customer_id === customer.id)
        return <article className="feature-file-room" key={customer.id} style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--line)', borderRadius: 7 }}><strong>{customer.business_name || customer.owner_name || customer.email}</strong><span>{customerFiles.length} attachment{customerFiles.length === 1 ? '' : 's'}</span>{customerFiles.map((file) => <div className="task-row" key={file.id}><span>{file.label || file.file_name} · {(Number(file.byte_size || 0) / 1024).toFixed(1)} KB</span><button className="ghost-button" type="button" onClick={() => previewFile(file.id).catch((reason) => setError(reason.message))}>Open local attachment</button></div>)}{!customerFiles.length && <small>No local attachments.</small>}</article>
      })}{!customers.length && <p className="queue-empty">Create a customer record to use a customer file room.</p>}</div>
      <FeatureRecordManager records={records} kind="document_file" title="Document index" description="Index a file already stored in the customer vault. Search text is metadata you enter; OverHead does not OCR or index the file contents." fields={[{ name: 'title', label: 'Document title', required: true }, { name: 'fileName', label: 'Stored filename', required: true }, { name: 'customer', label: 'Customer name or ID' }, { name: 'project', label: 'Project name or ID' }, { name: 'tags', label: 'Tags (comma separated)' }, { name: 'searchText', label: 'Search keywords', multiline: true }, { name: 'owner', label: 'Document owner' }, { name: 'retentionUntil', label: 'Review or retention date', type: 'date' }, { name: 'accessExpiresAt', label: 'Shared access expiry', type: 'date' }, { name: 'status', label: 'Status', options: ['Current', 'Pending approval', 'Approved', 'Archived'], defaultValue: 'Current' }, { name: 'notes', label: 'Notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Current', 'Pending approval', 'Approved', 'Archived']} emptyText="No document metadata indexed." />
      {duplicateGroups.length > 0 && <div className="backend-health"><strong>Possible duplicate attachments</strong>{duplicateGroups.map((group) => <span key={`${group[0].file_name}-${group[0].byte_size}`}>{group.map((file) => file.label || file.file_name).join(' · ')} ({group[0].byte_size} bytes)</span>)}</div>}
    </FeaturePanel>}
    {tab === 'control' && <FeaturePanel eyebrow="Document control" title="Versions, approvals, and comments" description="Keep version history and review notes in local records. The source attachment remains unchanged until you upload a new file in the customer record.">
      <FeatureRecordManager records={records} kind="document_version" title="Document version history" description="Record version identifiers, change summaries, and source file names." fields={[{ name: 'title', label: 'Document title', required: true }, { name: 'fileName', label: 'Filename', required: true }, { name: 'version', label: 'Version', required: true }, { name: 'date', label: 'Version date', type: 'date', defaultValue: currentDate() }, { name: 'owner', label: 'Uploaded by' }, { name: 'changeSummary', label: 'What changed', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No versions recorded." />
      <FeatureRecordManager records={records} kind="document_approval" title="Document review and approval" description="Track requested review, reviewer decisions, and document status." fields={[{ name: 'title', label: 'Document or request', required: true }, { name: 'requestedBy', label: 'Requested by' }, { name: 'reviewer', label: 'Reviewer email', required: true }, { name: 'dueDate', label: 'Review deadline', type: 'date' }, { name: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected', 'Changes requested'], defaultValue: 'Pending' }, { name: 'comments', label: 'Review comments', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Pending', 'Approved', 'Rejected', 'Changes requested']} emptyText="No document reviews." />
      <FeatureRecordManager records={records} kind="document_comment" title="Inline document comments" description="Attach page-specific comments to a file's metadata record; this does not write annotations into a PDF." fields={[{ name: 'title', label: 'Document title', required: true }, { name: 'page', label: 'Page number', type: 'number', min: 1, step: 1 }, { name: 'author', label: 'Comment author' }, { name: 'date', label: 'Comment date', type: 'date', defaultValue: currentDate() }, { name: 'comments', label: 'Comment', multiline: true, required: true }, { name: 'status', label: 'Status', options: ['Open', 'Resolved'], defaultValue: 'Open' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Open', 'Resolved']} emptyText="No document comments." />
      <FeatureRecordManager records={records} kind="pdf_annotation" title="PDF annotation notes" description="Record page and review notes alongside a PDF reference. Actual PDF mark-up and rendering are not provided by this metadata tool." fields={[{ name: 'title', label: 'PDF document', required: true }, { name: 'page', label: 'Page number', type: 'number', min: 1, step: 1, required: true }, { name: 'annotation', label: 'Annotation note', multiline: true, required: true }, { name: 'author', label: 'Author' }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No PDF annotation notes." />
    </FeaturePanel>}
    {tab === 'requests' && <FeaturePanel eyebrow="Retention and requests" title="Document checklists and access dates" description="Track document requests, retention review dates, and access expiry as local checklist items. These reminders do not delete files or revoke an external link automatically.">
      <FeatureRecordManager records={records} kind="document_request" title="Document request checklist" description="List requested items, responsible person, deadline, and completion status." fields={[{ name: 'title', label: 'Requested document', required: true }, { name: 'customer', label: 'Customer name or ID' }, { name: 'owner', label: 'Responsible person' }, { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', options: ['Requested', 'Received', 'Reviewed', 'Not required'], defaultValue: 'Requested' }, { name: 'notes', label: 'Request notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Requested', 'Received', 'Reviewed', 'Not required']} emptyText="No document requests." />
      <FeatureRecordManager records={records} kind="retention_rule" title="File retention rules" description="Set a review or retention date and responsible owner. OverHead flags dates for review but does not delete retained business files automatically." fields={[{ name: 'title', label: 'Rule name', required: true }, { name: 'category', label: 'Document category' }, { name: 'retentionDays', label: 'Retention days', type: 'number', min: 1, step: 1 }, { name: 'reviewDate', label: 'Next review date', type: 'date' }, { name: 'owner', label: 'Responsible person' }, { name: 'status', label: 'Status', options: ['Active', 'Review due', 'Archived'], defaultValue: 'Active' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Active', 'Review due', 'Archived']} emptyText="No file retention rules." />
      <FeatureRecordManager records={records} kind="ownership_transfer" title="Document ownership transfer" description="Record an approved change in document ownership and custody." fields={[{ name: 'title', label: 'Document or bundle', required: true }, { name: 'fromOwner', label: 'Current owner' }, { name: 'toOwner', label: 'New owner', required: true }, { name: 'date', label: 'Transfer date', type: 'date', defaultValue: currentDate() }, { name: 'status', label: 'Status', options: ['Requested', 'Transferred', 'Canceled'], defaultValue: 'Requested' }, { name: 'notes', label: 'Approval or handoff notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Requested', 'Transferred', 'Canceled']} emptyText="No ownership transfers." />
      <FeatureRecordList records={projectRecords} emptyText="No indexed projects available." />
      <div className="backend-health"><strong>Secure external sharing and e-signatures</strong><span>Signed, expiring customer links and electronic signatures require a configured provider and server-side authorization. This local-only screen does not create public links or collect signatures.</span></div>
    </FeaturePanel>}
    {tab === 'search' && <FeaturePanel eyebrow="Document index" title="Search, activity, and export bundles" description="Search local document metadata and review changes. File contents are not uploaded, OCR-scanned, or indexed by this screen.">
      <label className="form-field">Search metadata<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filename, customer, tags, notes" /></label>
      <FeatureRecordList records={searchable} emptyText="No document records match." onDelete={deleteRecord} />
      <div className="backend-health"><strong>Recent document activity</strong>{(backendState.auditEvents || []).filter((event) => /document|pdf|export/i.test(`${event.action || ''} ${event.summary || ''}`)).slice(0, 12).map((event) => <span key={event.id}>{event.created_at} · {event.summary || event.action}</span>)}{!(backendState.auditEvents || []).some((event) => /document|pdf|export/i.test(`${event.action || ''} ${event.summary || ''}`)) && <span>No recent document activity.</span>}</div>
      <div className="button-row"><button className="primary-action" type="button" onClick={() => exportBundle().catch((reason) => setExportError(reason.message))}>Export document metadata bundle</button><span>Metadata only; attachment files are excluded.</span></div>
      <FeatureRecordList records={records.filter((record) => record.kind === 'document_export')} emptyText="No document bundles exported." />
      <div className="backend-health"><strong>Bulk file downloads</strong><span>Use the existing full workspace export in Tools for supported data exports. A selected-files download bundle is unavailable because the UI does not receive raw attachment paths or file bytes.</span></div>
    </FeaturePanel>}
  </section>
}
