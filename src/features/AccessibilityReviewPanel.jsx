import { useEffect, useState } from 'react'
import './AccessibilityReviewPanel.css'

const LINK_STYLE_KEY = 'overhead.accessibility.underlineLinks.v1'
const FOCUS_RING_KEY = 'overhead.accessibility.focusRing.v1'

function readLinkStyle() {
  try { return window.localStorage.getItem(LINK_STYLE_KEY) === 'true' } catch { return false }
}

function readFocusRing() {
  try { return window.localStorage.getItem(FOCUS_RING_KEY) === 'true' } catch { return false }
}

function readMotionStatus() {
  let systemRequestsReduction = false
  try { systemRequestsReduction = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) } catch {}
  const appAppliesReduction = document.documentElement.dataset.reducedMotion === 'true'
  return { systemRequestsReduction, appAppliesReduction }
}

/**
 * A small accessibility preferences and status panel. It reports the actual
 * reduced-motion state applied by the app and provides a persistent link-style
 * preference. It intentionally does not claim to run an automated WCAG audit.
 */
export function AccessibilityReviewPanel() {
  const [underlineLinks, setUnderlineLinks] = useState(readLinkStyle)
  const [highVisibilityFocus, setHighVisibilityFocus] = useState(readFocusRing)
  const [motion, setMotion] = useState(readMotionStatus)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.accessibilityUnderlineLinks = String(underlineLinks)
    try { window.localStorage.setItem(LINK_STYLE_KEY, String(underlineLinks)) } catch {}
  }, [underlineLinks])

  useEffect(() => {
    document.documentElement.dataset.accessibilityFocusRing = String(highVisibilityFocus)
    try { window.localStorage.setItem(FOCUS_RING_KEY, String(highVisibilityFocus)) } catch {}
  }, [highVisibilityFocus])

  useEffect(() => {
    const root = document.documentElement
    const update = () => setMotion(readMotionStatus())
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    let mediaQuery
    try {
      mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
      mediaQuery?.addEventListener?.('change', update)
      mediaQuery?.addListener?.(update)
    } catch {}
    return () => {
      observer.disconnect()
      try {
        mediaQuery?.removeEventListener?.('change', update)
        mediaQuery?.removeListener?.(update)
      } catch {}
    }
  }, [])

  useEffect(() => {
    function syncPreference(event) {
      if (event.key === LINK_STYLE_KEY) setUnderlineLinks(event.newValue === 'true')
      if (event.key === FOCUS_RING_KEY) setHighVisibilityFocus(event.newValue === 'true')
    }
    window.addEventListener('storage', syncPreference)
    return () => window.removeEventListener('storage', syncPreference)
  }, [])

  return <section className="accessibility-review panel" aria-labelledby="accessibility-review-title">
    <header className="accessibility-review-heading">
      <div>
        <h2 id="accessibility-review-title">Accessibility preferences</h2>
        <p>Adjust link visibility and review the motion preference currently applied by OverHead.</p>
      </div>
    </header>

    <label className="accessibility-review-toggle">
      <input type="checkbox" checked={underlineLinks} onChange={(event) => setUnderlineLinks(event.target.checked)} />
      <span><strong>Underline links</strong><small>Keep text links identifiable without relying on color. This preference is saved on this device.</small></span>
    </label>

    <label className="accessibility-review-toggle">
      <input type="checkbox" checked={highVisibilityFocus} onChange={(event) => setHighVisibilityFocus(event.target.checked)} />
      <span><strong>High visibility focus ring</strong><small>Show a stronger outline when moving through controls with a keyboard. Mouse clicks do not trigger this ring.</small></span>
    </label>

    <div className="accessibility-review-status" role="status" aria-live="polite">
      <strong>Reduced motion</strong>
      <span>{motion.systemRequestsReduction ? 'Your system requests reduced motion.' : 'Your system does not request reduced motion.'}</span>
      <span>{motion.appAppliesReduction ? 'OverHead is currently reducing animation and transitions.' : 'OverHead is currently using its standard animation setting.'}</span>
      <small>Change the app’s reduced-motion setting in Settings. This panel reports the active state; it does not override it.</small>
    </div>
    <p className="accessibility-review-note">These controls support individual preferences. They do not constitute a complete accessibility audit.</p>
  </section>
}

export default AccessibilityReviewPanel
