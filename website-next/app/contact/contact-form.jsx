'use client'

import { useState } from 'react'

const topics = [
  ['product', 'Product or setup'],
  ['support', 'Support'],
  ['partnership', 'Partnership'],
  ['investor', 'Investor'],
  ['legal', 'Legal review'],
  ['billing', 'Billing'],
  ['webmaster', 'Webmaster'],
]

export default function ContactForm() {
  const [notice, setNotice] = useState('')

  function prepareRequest(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const email = String(form.get('email') || '').trim()
    const topic = String(form.get('topic') || 'support')
    const message = String(form.get('message') || '').trim()

    if (!name || !email || !message) {
      setNotice('Add your name, email, and a short description so we can prepare the right request.')
      return
    }

    const subject = `OverHead ${topic} request from ${name}`
    const body = `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`
    setNotice('Your email app is opening with the request prepared.')
    window.location.href = `mailto:solidartentertainment@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <form onSubmit={prepareRequest} noValidate>
      <label>Name<input name="name" autoComplete="name" placeholder="Your name" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
      <label>Topic<select name="topic" defaultValue="support">{topics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Message<textarea name="message" placeholder="Describe the request." /></label>
      <button className="primary" type="submit">Prepare My Request</button>
      {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
    </form>
  )
}
