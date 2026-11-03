import { useMemo, useState } from 'react'
import { FeatureForm, useFeatureRecords } from './FeatureWave101Helpers'
import './InventoryReorderWorkspace.css'

const fields = (includeOpeningStock) => [
  { name: 'title', label: 'Item or service name', required: true },
  { name: 'sku', label: 'SKU', required: true },
  { name: 'recordType', label: 'Type', options: ['Item', 'Service'], defaultValue: 'Item' },
  ...(includeOpeningStock ? [{ name: 'onHand', label: 'Opening on-hand quantity', type: 'number', min: 0, step: 1, defaultValue: '0' }] : []),
  { name: 'reorderPoint', label: 'Reorder point', type: 'number', min: 0, step: 1, defaultValue: '0' },
  { name: 'vendor', label: 'Preferred vendor' },
  { name: 'unitCost', label: 'Unit cost', type: 'number', min: 0, step: 0.01, defaultValue: '0' },
  { name: 'location', label: 'Storage location' },
]
const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value) || 0)

export default function InventoryReorderWorkspace({ setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('inventory')
  const [editing, setEditing] = useState(null)
  const [adjusting, setAdjusting] = useState(null)
  const [movement, setMovement] = useState({ direction: 'Receive', quantity: '', reason: '' })
  const [query, setQuery] = useState('')
  const inventory = records.filter((record) => record.kind === 'inventory_item')
  const movements = inventory.flatMap((item) => (item.stockMovements || []).map((movement, index) => ({ ...movement, id: `${item.id}-${index}`, title: item.title }))).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const filtered = useMemo(() => inventory.filter((item) => `${item.title} ${item.sku} ${item.vendor} ${item.location}`.toLowerCase().includes(query.toLowerCase())), [inventory, query])
  const lowStock = inventory.filter((item) => item.recordType !== 'Service' && Number(item.onHand || 0) <= Number(item.reorderPoint || 0))

  async function saveItem(input) {
    const sku = String(input.sku || '').trim()
    if (inventory.some((item) => item.sku?.toLowerCase() === sku.toLowerCase() && item.id !== editing?.id)) throw new Error('That SKU is already in this inventory list.')
    const now = new Date().toISOString()
    const item = {
      ...(editing || {}), ...input, kind: 'inventory_item', sku,
      onHand: editing ? Number(editing.onHand || 0) : Math.max(0, Number(input.onHand || 0)),
      reorderPoint: Math.max(0, Number(input.reorderPoint || 0)), unitCost: Math.max(0, Number(input.unitCost || 0)),
      stockMovements: editing?.stockMovements || [], updatedAt: now,
    }
    await save(item)
    setEditing(null)
    setOperationNotice(editing ? 'Inventory item details updated.' : 'Inventory item added to the local workspace.')
  }

  async function applyMovement() {
    const quantity = Math.floor(Number(movement.quantity))
    const delta = movement.direction === 'Adjust down' ? -quantity : quantity
    if (!adjusting || !Number.isInteger(quantity) || quantity <= 0 || !movement.reason.trim()) { setError('Enter a positive whole quantity and a reason for the stock change.'); return }
    const next = Number(adjusting.onHand || 0) + delta
    if (next < 0) { setError('This adjustment would make on-hand stock negative.'); return }
    const entry = { direction: movement.direction, quantity, delta, reason: movement.reason.trim(), createdAt: new Date().toISOString() }
    try {
      await save({ ...adjusting, onHand: next, stockMovements: [...(adjusting.stockMovements || []), entry].slice(-100), updatedAt: entry.createdAt })
      setMovement({ direction: 'Receive', quantity: '', reason: '' }); setAdjusting(null); setError('')
      setOperationNotice(`${movement.direction === 'Receive' ? 'Stock received' : 'Stock adjusted'}; the reason was added to the local item history.`)
    } catch (reason) { setError(reason?.message || 'Stock change could not be saved.') }
  }

  function exportCsv() {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['Name', 'SKU', 'Type', 'On hand', 'Reorder point', 'Vendor', 'Unit cost USD', 'Location', 'Status'], ...inventory.map((item) => [item.title, item.sku, item.recordType, item.onHand, item.reorderPoint, item.vendor, item.unitCost, item.location, Number(item.onHand || 0) <= Number(item.reorderPoint || 0) && item.recordType !== 'Service' ? 'Reorder' : 'In stock'])]
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([rows.map((row) => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); link.download = `overhead-inventory-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <section className="inventory-workspace">
    <header className="inventory-head"><div><p className="eyebrow">Operations · inventory</p><h2>Inventory &amp; reorder desk</h2><p>Track item counts, service SKUs, preferred vendors, and reorder thresholds in this encrypted local workspace.</p></div><button className="ghost-button" type="button" onClick={exportCsv} disabled={!inventory.length}>Export CSV</button></header>
    <div className="inventory-metrics"><span><strong>{inventory.length}</strong> catalog records</span><span className={lowStock.length ? 'inventory-alert' : ''}><strong>{lowStock.length}</strong> low-stock items</span><span><strong>{movements.length}</strong> recent stock changes</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {lowStock.length > 0 && <aside className="inventory-reorder"><strong>Reorder attention</strong><span>{lowStock.map((item) => `${item.title} (${item.onHand} on hand, reorder at ${item.reorderPoint})`).join(' · ')}</span></aside>}
    <div className="inventory-columns">
      <div className="inventory-panel"><h3>{editing ? 'Edit catalog details' : 'Add item or service'}</h3><p className="inventory-hint">On-hand quantity changes require a stock receipt or adjustment with a reason.</p><FeatureForm key={editing?.id || 'new-inventory-item'} fields={fields(!editing)} initial={editing || {}} submitLabel={editing ? 'Save details' : 'Add to inventory'} onSubmit={saveItem} onCancel={editing ? () => setEditing(null) : undefined} draftScope="inventory-item" /></div>
      <div className="inventory-panel"><div className="inventory-list-head"><div><h3>Catalog and stock</h3><p>{filtered.length} records</p></div><input aria-label="Search inventory" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, vendor…" /></div>
        {loading ? <p className="inventory-hint">Loading local inventory…</p> : filtered.length ? <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Item / SKU</th><th>On hand</th><th>Reorder at</th><th>Vendor / location</th><th>Unit cost</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className={item.recordType !== 'Service' && Number(item.onHand || 0) <= Number(item.reorderPoint || 0) ? 'is-low-stock' : ''}><td><strong>{item.title}</strong><small>{item.sku} · {item.recordType || 'Item'}</small></td><td>{item.recordType === 'Service' ? '—' : item.onHand}</td><td>{item.recordType === 'Service' ? '—' : item.reorderPoint}</td><td>{item.vendor || 'No vendor'}<small>{item.location || 'No location'}</small></td><td>{money(item.unitCost)}</td><td><div className="inventory-actions"><button className="ghost-button" type="button" onClick={() => { setEditing(item); setAdjusting(null) }}>Edit</button>{item.recordType !== 'Service' && <button className="ghost-button" type="button" onClick={() => { setAdjusting(item); setEditing(null) }}>Adjust stock</button>}<button className="ghost-button" type="button" onClick={() => window.confirm(`Delete ${item.title} from the local catalog?`) && remove(item.id)}>Delete</button></div></td></tr>)}</tbody></table></div> : <p className="inventory-empty">No inventory records match this search.</p>}
      </div>
    </div>
    {adjusting && <section className="inventory-adjust"><div><p className="eyebrow">Stock movement</p><h3>{adjusting.title} · {adjusting.onHand} on hand</h3></div><label>Action<select value={movement.direction} onChange={(event) => setMovement({ ...movement, direction: event.target.value })}><option>Receive</option><option>Adjust down</option><option>Adjust up</option></select></label><label>Quantity<input type="number" min="1" step="1" value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: event.target.value })} /></label><label>Reason / audit note<input value={movement.reason} onChange={(event) => setMovement({ ...movement, reason: event.target.value })} placeholder="Purchase receipt, count correction…" /></label><div className="button-row"><button className="primary-action" type="button" onClick={applyMovement}>Apply stock change</button><button className="ghost-button" type="button" onClick={() => setAdjusting(null)}>Cancel</button></div></section>}
    <section className="inventory-panel"><h3>Recent movement notes</h3>{movements.length ? <div className="inventory-movements">{movements.slice(0, 12).map((move) => <article key={move.id}><strong>{move.title}</strong><span>{move.direction} {move.quantity} · {move.reason}</span><small>{new Date(move.createdAt).toLocaleString()}</small></article>)}</div> : <p className="inventory-empty">Stock receipts and adjustments will appear here with their reason.</p>}</section>
    <p className="inventory-hint">Inventory data is stored locally and does not sync with suppliers, accounting software, point-of-sale systems, or other devices.</p>
  </section>
}
