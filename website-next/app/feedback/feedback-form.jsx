'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firebaseAuth, firebaseDb } from '../firebase-client'

const feedbackTypes = ['Workflow', 'Bug', 'Feature request', 'Onboarding', 'Other']

export default function FeedbackForm() {
  const router = useRouter()
  const [account, setAccount] = useState(undefined)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => {
    if (!user || !user.emailVerified) { router.replace('/sign-in/?next=/feedback/'); return }
    setAccount(user)
  }), [router])

  async function submitFeedback(event) {
    event.preventDefault()
    if (!account || working) return
    const form = new FormData(event.currentTarget)
    const message = String(form.get('message') || '').trim()
    const rating = Number(form.get('rating'))
    if (message.length < 10) { setNotice('Please add a little more detail so the team can understand the improvement.'); return }
    setWorking(true); setNotice('')
    try {
      await addDoc(collection(firebaseDb, 'product_feedback'), {
        feedback_type: String(form.get('feedback_type') || 'Workflow'),
        rating,
        message,
        follow_up: form.get('follow_up') === 'yes',
        created_by: account.uid,
        created_by_email: account.email || '',
        created_at: serverTimestamp(),
        status: 'New',
      })
      event.currentTarget.reset()
      setNotice('Thank you — your feedback has been sent privately to the OverHead product team.')
    } catch (error) {
      setNotice(error?.message || 'Feedback could not be sent. Please try again or contact support.')
    } finally { setWorking(false) }
  }

  if (account === undefined) return <p className="notice" role="status">Checking your secure account…</p>
  return <form onSubmit={submitFeedback} noValidate>
    <label>Feedback type<select name="feedback_type" defaultValue="Workflow">{feedbackTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
    <label>How well did this part work?<select name="rating" defaultValue="3">{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} — {rating === 1 ? 'Did not work' : rating === 5 ? 'Worked very well' : 'Needs improvement'}</option>)}</select></label>
    <label>What should we improve?<textarea name="message" maxLength="4000" placeholder="What were you trying to do, what got in the way, and what would better look like?" /></label>
    <label>May we follow up?<select name="follow_up" defaultValue="yes"><option value="yes">Yes, use my account email</option><option value="no">No follow-up needed</option></select></label>
    <button className="primary" type="submit" disabled={working}>{working ? 'Sending feedback…' : 'Send feedback'}</button>
    {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
  </form>
}
