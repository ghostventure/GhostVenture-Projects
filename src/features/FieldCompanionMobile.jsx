import { useEffect, useMemo, useRef, useState } from 'react'
import { useFeatureRecords } from './FeatureWave101Helpers'
import './FieldCompanionMobile.css'

const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const checklistTemplate = ['Confirm customer and arrival details', 'Review requested work and safety notes', 'Check tools and materials', 'Record work completed', 'Confirm next step with the office']
const timeLabel = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Time not set' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

export default function FieldCompanionMobile({ backendState = {} }) {
  const { records, loading, error, setError, save } = useFeatureRecords('mobile')
  const [day, setDay] = useState(dateKey())
  const [selectedId, setSelectedId] = useState('')
  const [consentPhoto, setConsentPhoto] = useState(false)
  const [consentAudio, setConsentAudio] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [recording, setRecording] = useState(false)
  const [captureNotice, setCaptureNotice] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const agenda = useMemo(() => (backendState.appointments || []).filter((item) => String(item.scheduled_for || '').slice(0, 10) === day).sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for))), [backendState.appointments, day])
  const selected = agenda.find((item) => item.id === selectedId) || agenda[0] || null
  const detail = records.find((record) => record.kind === 'field_visit' && record.appointmentId === selected?.id) || null

  useEffect(() => () => { streamRef.current?.getTracks?.().forEach((track) => track.stop()); if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id) }, [selected, selectedId])
  useEffect(() => { setNoteDraft(detail?.notes || '') }, [selected?.id, detail?.id])

  async function saveVisit(changes) {
    if (!selected) return
    try {
      await save({ ...(detail || {}), kind: 'field_visit', appointmentId: selected.id, title: selected.title || 'Field visit', checklist: detail?.checklist || checklistTemplate.map((label) => ({ label, done: false })), ...changes, updatedAt: new Date().toISOString() })
      setError('')
    } catch (reason) { setError(reason?.message || 'Field notes could not be saved locally.') }
  }

  async function toggleChecklist(index, checked) {
    const list = (detail?.checklist || checklistTemplate.map((label) => ({ label, done: false })).map((item) => ({ ...item }))).map((item, at) => at === index ? { ...item, done: checked, completedAt: checked ? new Date().toISOString() : '' } : item)
    await saveVisit({ checklist: list })
  }

  function selectPhoto(file) {
    setPhotoFile(file || null)
    if (file) setCaptureNotice(`Selected ${file.name}. The photo is not uploaded; save it to this device if you want to keep it.`)
  }

  function downloadFile(file, name) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a'); link.href = url; link.download = name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function startAudio() {
    if (!consentAudio) { setCaptureNotice('Confirm consent before recording audio.'); return }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setCaptureNotice('Audio recording is unavailable in this browser.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(blob)); setCaptureNotice('Recording is ready. It remains in this session until you download it or close the companion.')
      }
      recorderRef.current = recorder; recorder.start(); setRecording(true); setCaptureNotice('Recording on this device. Select Stop when finished.')
    } catch (reason) { setCaptureNotice(reason?.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Could not start the microphone.') }
  }

  function stopAudio() { if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); setRecording(false) } }

  return <main className="field-companion">
    <header className="field-companion-header"><div><span className="eyebrow">OverHead · Field Companion</span><h1>Today’s visits</h1><p>Quick agenda, job notes, and offline checklist.</p></div><label>Work date<input type="date" value={day} onChange={(event) => { setDay(event.target.value); setSelectedId('') }} /></label></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="field-companion-layout">
      <nav className="field-agenda" aria-label="Visit agenda"><h2>Agenda <span>{agenda.length}</span></h2>{loading ? <p>Loading local visits…</p> : agenda.length ? agenda.map((item) => <button type="button" key={item.id} className={`field-agenda-card ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><strong>{timeLabel(item.scheduled_for)}</strong><span>{item.title || 'Appointment'}</span><small>{item.customer_name || item.customer_id || 'Customer details in appointment'}</small></button>) : <p className="field-companion-empty">No visits scheduled for this date.</p>}</nav>
      {selected ? <section className="field-visit-detail"><div className="field-visit-title"><div><span className="eyebrow">Visit detail</span><h2>{selected.title || 'Appointment'}</h2><p>{timeLabel(selected.scheduled_for)} · {selected.customer_name || selected.customer_id || 'Customer not linked'}</p></div><span className="field-visit-status">{selected.status || 'Scheduled'}</span></div>
        <p className="field-appointment-notes">{selected.notes || 'No office notes attached to this appointment.'}</p>
        <section className="field-checklist"><h3>On-site checklist</h3><p>Checklist changes save to this device automatically when connected to OverHead.</p>{(detail?.checklist || checklistTemplate.map((label) => ({ label, done: false }))).map((item, index) => <label key={`${index}-${item.label}`}><input type="checkbox" checked={Boolean(item.done)} onChange={(event) => toggleChecklist(index, event.target.checked)} /><span>{item.label}</span></label>)}</section>
        <label className="field-note-label">Visit notes<textarea rows="4" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onBlur={() => { if (noteDraft !== (detail?.notes || '')) void saveVisit({ notes: noteDraft }) }} placeholder="Work completed, materials used, follow-up needed…" /></label>
        <details className="field-capture"><summary>Photo and audio notes</summary><p>Capture only with permission from people present. Files are not uploaded to OverHead.</p>
          <label className="field-consent"><input type="checkbox" checked={consentPhoto} onChange={(event) => setConsentPhoto(event.target.checked)} />I have permission to capture and store a photo for this visit.</label>
          <label className="field-consent"><input type="checkbox" checked={consentAudio} onChange={(event) => setConsentAudio(event.target.checked)} />I have permission to record audio for this visit.</label>
          <label className="field-photo-input">Choose or take a photo<input type="file" accept="image/*" capture="environment" disabled={!consentPhoto} onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>
          {photoFile && <div className="field-capture-actions"><span>{photoFile.name}</span><button className="ghost-button" type="button" onClick={() => downloadFile(photoFile, photoFile.name)}>Save photo to device</button></div>}
          {recording ? <button className="primary-action" type="button" onClick={stopAudio}>Stop audio recording</button> : <button className="ghost-button" type="button" disabled={!consentAudio} onClick={startAudio}>Start audio recording</button>}
          {audioUrl && <a className="field-audio-download" href={audioUrl} download={`overhead-visit-audio-${selected.id}.webm`}>Download audio note</a>}
          {captureNotice && <p aria-live="polite">{captureNotice}</p>}
        </details>
      </section> : <div className="field-companion-empty field-empty-detail">Choose a visit from the agenda to open its field checklist.</div>}
    </section>
    <footer className="field-companion-footer">Checklist and notes use OverHead’s local encrypted workspace. Captured media stays on this device and is not backed up or uploaded automatically. This view does not provide live GPS or native mobile functions.</footer>
  </main>
}
