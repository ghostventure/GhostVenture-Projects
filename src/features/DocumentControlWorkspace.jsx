import { useMemo, useState } from 'react'
import { FeaturePanel, FeatureRecordList, FeatureRecordManager, FeatureTabs, currentDate, useFeatureRecords } from './FeatureWave101Helpers'

const tabs = [{ id: 'files', label: 'Customer files' }, { id: 'control', label: 'Versions and approvals' }, { id: 'requests', label: 'Requests and retention' }, { id: 'search', label: 'Search and activity' }]
const emptyRows = []

export default function DocumentControlWorkspace({ backendState = {}, setOperationNotice = () => {}, refreshBackend = async () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('documents')
  const { records: projectRecords } = useFeatureRecords('projects')
  const [tab, setTab] = useState('files')
  const [query, setQuery] = useState('')
  const [exportError, setExportError] = useState('')
  const [selectedFileIds, setSelectedFileIds] = useState([])
  const [contentQuery, setContentQuery] = useState('')
  const [contentResults, setContentResults] = useState(null)
  const [contentBusy, setContentBusy] = useState(false)
  const [annotationDraft, setAnnotationDraft] = useState({ documentId: '', page: '1', annotation: '' })
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

  async function exportSelectedFiles() {
    if (!selectedFileIds.length) throw new Error('Select at least one stored attachment.')
    if (!window.overheadBackend?.exportCustomerDocumentBundle) throw new Error('The secure local document archive service is unavailable.')
    const result = await window.overheadBackend.exportCustomerDocumentBundle(selectedFileIds)
    if (result?.canceled) return
    setSelectedFileIds([])
    setExportError('')
    setOperationNotice(`Saved ${result.documentCount} attachment${result.documentCount === 1 ? '' : 's'} to ${result.fileName} (${(result.totalBytes / 1024 / 1024).toFixed(1)} MB).`)
  }

  async function searchDocumentContents() {
    const value = contentQuery.trim()
    if (value.length < 2) { setExportError('Enter at least two characters to search document contents.'); return }
    if (!window.overheadBackend?.searchStoredDocumentContents) { setExportError('Local document content search is unavailable.'); return }
    setContentBusy(true)
    try {
      const result = await window.overheadBackend.searchStoredDocumentContents({ query: value })
      setContentResults(result)
      setExportError('')
    } catch (reason) { setExportError(reason.message || 'Document content search failed.') }
    finally { setContentBusy(false) }
  }

  async function stampPdfAnnotation(event) {
    event.preventDefault()
    if (!window.overheadBackend?.annotateCustomerPdf) throw new Error('The local PDF annotation service is unavailable.')
    const result = await window.overheadBackend.annotateCustomerPdf({ documentId: annotationDraft.documentId, page: Number(annotationDraft.page), annotation: annotationDraft.annotation })
    await refreshBackend()
    setAnnotationDraft({ documentId: result.documentId, page: '1', annotation: '' })
    setOperationNotice(`Created ${result.fileName} with a visible annotation stamp on page ${result.page}. The source PDF was preserved.`)
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
        return <article className="feature-file-room" key={customer.id} style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--line)', borderRadius: 7 }}><strong>{customer.business_name || customer.owner_name || customer.email}</strong><span>{customerFiles.length} attachment{customerFiles.length === 1 ? '' : 's'}</span>{customerFiles.map((file) => <div className="task-row" key={file.id}><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={(event) => setSelectedFileIds((current) => event.target.checked ? [...current, file.id] : current.filter((id) => id !== file.id))} /><span>{file.label || file.file_name} · {(Number(file.byte_size || 0) / 1024).toFixed(1)} KB</span></label><button className="ghost-button" type="button" onClick={() => previewFile(file.id).catch((reason) => setError(reason.message))}>Open local attachment</button></div>)}{!customerFiles.length && <small>No local attachments.</small>}</article>
      })}{!customers.length && <p className="queue-empty">Create a customer record to use a customer file room.</p>}</div>
      <div className="button-row"><button className="primary-action" type="button" disabled={!selectedFileIds.length} onClick={() => exportSelectedFiles().catch((reason) => setExportError(reason.message))}>Download selected files as ZIP ({selectedFileIds.length})</button><span>Up to 100 files and 250 MB per archive. The native save dialog chooses the destination.</span></div>
      <FeatureRecordManager records={records} kind="document_file" title="Document index" description="Index a file already stored in the customer vault. Search text is metadata you enter; supported text content search is available in Search and activity." fields={[{ name: 'title', label: 'Document title', required: true }, { name: 'fileName', label: 'Stored filename', required: true }, { name: 'customer', label: 'Customer name or ID' }, { name: 'project', label: 'Project name or ID' }, { name: 'tags', label: 'Tags (comma separated)' }, { name: 'searchText', label: 'Search keywords', multiline: true }, { name: 'owner', label: 'Document owner' }, { name: 'retentionUntil', label: 'Review or retention date', type: 'date' }, { name: 'accessExpiresAt', label: 'Shared access expiry', type: 'date' }, { name: 'status', label: 'Status', options: ['Current', 'Pending approval', 'Approved', 'Archived'], defaultValue: 'Current' }, { name: 'notes', label: 'Notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Current', 'Pending approval', 'Approved', 'Archived']} emptyText="No document metadata indexed." />
      {duplicateGroups.length > 0 && <div className="backend-health"><strong>Possible duplicate attachments</strong>{duplicateGroups.map((group) => <span key={`${group[0].file_name}-${group[0].byte_size}`}>{group.map((file) => file.label || file.file_name).join(' · ')} ({group[0].byte_size} bytes)</span>)}</div>}
    </FeaturePanel>}
    {tab === 'control' && <FeaturePanel eyebrow="Document control" title="Versions, approvals, and comments" description="Keep version history and review notes in local records. The source attachment remains unchanged until you upload a new file in the customer record.">
      <FeatureRecordManager records={records} kind="document_version" title="Document version history" description="Record version identifiers, change summaries, and source file names." fields={[{ name: 'title', label: 'Document title', required: true }, { name: 'fileName', label: 'Filename', required: true }, { name: 'version', label: 'Version', required: true }, { name: 'date', label: 'Version date', type: 'date', defaultValue: currentDate() }, { name: 'owner', label: 'Uploaded by' }, { name: 'changeSummary', label: 'What changed', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No versions recorded." />
      <FeatureRecordManager records={records} kind="document_approval" title="Document review and approval" description="Track requested review, reviewer decisions, and document status." fields={[{ name: 'title', label: 'Document or request', required: true }, { name: 'requestedBy', label: 'Requested by' }, { name: 'reviewer', label: 'Reviewer email', required: true }, { name: 'dueDate', label: 'Review deadline', type: 'date' }, { name: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected', 'Changes requested'], defaultValue: 'Pending' }, { name: 'comments', label: 'Review comments', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Pending', 'Approved', 'Rejected', 'Changes requested']} emptyText="No document reviews." />
      <FeatureRecordManager records={records} kind="document_comment" title="Inline document comments" description="Attach page-specific comments to a file's metadata record; this does not write annotations into a PDF." fields={[{ name: 'title', label: 'Document title', required: true }, { name: 'page', label: 'Page number', type: 'number', min: 1, step: 1 }, { name: 'author', label: 'Comment author' }, { name: 'date', label: 'Comment date', type: 'date', defaultValue: currentDate() }, { name: 'comments', label: 'Comment', multiline: true, required: true }, { name: 'status', label: 'Status', options: ['Open', 'Resolved'], defaultValue: 'Open' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Open', 'Resolved']} emptyText="No document comments." />
      <form className="feature-form" onSubmit={(event) => stampPdfAnnotation(event).catch((reason) => setError(reason.message))}>
        <h3>Stamp an annotation into a PDF copy</h3><p>The original attachment stays unchanged. The annotated copy is saved in the protected customer folder.</p>
        <label className="form-field">Stored PDF<select value={annotationDraft.documentId} onChange={(event) => setAnnotationDraft((current) => ({ ...current, documentId: event.target.value }))} required><option value="">Select a PDF</option>{files.filter((file) => String(file.extension || file.file_name || '').toLowerCase().endsWith('.pdf')).map((file) => <option key={file.id} value={file.id}>{file.label || file.file_name}</option>)}</select></label>
        <label className="form-field">Page number<input type="number" min="1" step="1" value={annotationDraft.page} onChange={(event) => setAnnotationDraft((current) => ({ ...current, page: event.target.value }))} required /></label>
        <label className="form-field">Annotation text<textarea maxLength={1200} value={annotationDraft.annotation} onChange={(event) => setAnnotationDraft((current) => ({ ...current, annotation: event.target.value }))} required /></label>
        <button className="primary-action" type="submit" disabled={!files.some((file) => String(file.extension || file.file_name || '').toLowerCase().endsWith('.pdf'))}>Create annotated copy</button>
      </form>
      <FeatureRecordManager records={records} kind="pdf_annotation" title="PDF annotation notes" description="Keep non-stamped page comments as metadata alongside a PDF reference." fields={[{ name: 'title', label: 'PDF document', required: true }, { name: 'page', label: 'Page number', type: 'number', min: 1, step: 1, required: true }, { name: 'annotation', label: 'Annotation note', multiline: true, required: true }, { name: 'author', label: 'Author' }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No PDF annotation notes." />
    </FeaturePanel>}
    {tab === 'requests' && <FeaturePanel eyebrow="Retention and requests" title="Document checklists and access dates" description="Track document requests, retention review dates, and access expiry as local checklist items. These reminders do not delete files or revoke an external link automatically.">
      <FeatureRecordManager records={records} kind="document_request" title="Document request checklist" description="List requested items, responsible person, deadline, and completion status." fields={[{ name: 'title', label: 'Requested document', required: true }, { name: 'customer', label: 'Customer name or ID' }, { name: 'owner', label: 'Responsible person' }, { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', options: ['Requested', 'Received', 'Reviewed', 'Not required'], defaultValue: 'Requested' }, { name: 'notes', label: 'Request notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Requested', 'Received', 'Reviewed', 'Not required']} emptyText="No document requests." />
      <FeatureRecordManager records={records} kind="retention_rule" title="File retention rules" description="Set a review or retention date and responsible owner. OverHead flags dates for review but does not delete retained business files automatically." fields={[{ name: 'title', label: 'Rule name', required: true }, { name: 'category', label: 'Document category' }, { name: 'retentionDays', label: 'Retention days', type: 'number', min: 1, step: 1 }, { name: 'reviewDate', label: 'Next review date', type: 'date' }, { name: 'owner', label: 'Responsible person' }, { name: 'status', label: 'Status', options: ['Active', 'Review due', 'Archived'], defaultValue: 'Active' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Active', 'Review due', 'Archived']} emptyText="No file retention rules." />
      <FeatureRecordManager records={records} kind="ownership_transfer" title="Document ownership transfer" description="Record an approved change in document ownership and custody." fields={[{ name: 'title', label: 'Document or bundle', required: true }, { name: 'fromOwner', label: 'Current owner' }, { name: 'toOwner', label: 'New owner', required: true }, { name: 'date', label: 'Transfer date', type: 'date', defaultValue: currentDate() }, { name: 'status', label: 'Status', options: ['Requested', 'Transferred', 'Canceled'], defaultValue: 'Requested' }, { name: 'notes', label: 'Approval or handoff notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Requested', 'Transferred', 'Canceled']} emptyText="No ownership transfers." />
      <FeatureRecordList records={projectRecords} emptyText="No indexed projects available." />
      <div className="backend-health"><strong>Secure external sharing and e-signatures</strong><span>Signed, expiring customer links and electronic signatures require a configured provider and server-side authorization. This local-only screen does not create public links or collect signatures.</span></div>
    </FeaturePanel>}
    {tab === 'search' && <FeaturePanel eyebrow="Document index" title="Search, activity, and export bundles" description="Search metadata or locally search text in TXT, CSV, and DOCX files. PDF OCR, spreadsheets, and image text recognition are not included.">
      <label className="form-field">Search metadata<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filename, customer, tags, notes" /></label>
      <div className="feature-form"><h3>Search stored file contents</h3><p>Scans at most 200 supported files and 50 MB total; each file is limited to 4 MB. Content remains on this device.</p><div className="button-row"><label className="form-field">Text to find<input value={contentQuery} maxLength={100} onChange={(event) => setContentQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchDocumentContents() } }} placeholder="At least 2 characters" /></label><button className="primary-action" type="button" disabled={contentBusy} onClick={() => searchDocumentContents()}>{contentBusy ? 'Searching…' : 'Search file contents'}</button></div>{contentResults && <div className="backend-health"><strong>{contentResults.results.length} matching files · scanned {contentResults.scannedCount} · skipped {contentResults.skippedCount}</strong>{contentResults.results.map((result) => <div key={result.documentId}><button className="ghost-button" type="button" onClick={() => previewFile(result.documentId).catch((reason) => setError(reason.message))}>{result.label || result.fileName}</button><span>{result.matchCount} matches · {result.snippet}</span></div>)}</div>}</div>
      <FeatureRecordList records={searchable} emptyText="No document records match." onDelete={deleteRecord} />
      <div className="backend-health"><strong>Recent document activity</strong>{(backendState.auditEvents || []).filter((event) => /document|pdf|export/i.test(`${event.action || ''} ${event.summary || ''}`)).slice(0, 12).map((event) => <span key={event.id}>{event.created_at} · {event.summary || event.action}</span>)}{!(backendState.auditEvents || []).some((event) => /document|pdf|export/i.test(`${event.action || ''} ${event.summary || ''}`)) && <span>No recent document activity.</span>}</div>
      <div className="button-row"><button className="primary-action" type="button" onClick={() => exportBundle().catch((reason) => setExportError(reason.message))}>Export document metadata bundle</button><span>Metadata only; attachment files are excluded.</span></div>
      <FeatureRecordList records={records.filter((record) => record.kind === 'document_export')} emptyText="No document bundles exported." />
      <div className="backend-health"><strong>Bulk file downloads</strong><span>Use the customer file-room selection to save a local ZIP archive. Files are revalidated against the protected vault before export.</span></div>
    </FeaturePanel>}
  </section>
}
