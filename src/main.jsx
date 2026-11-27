import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import BillingModule from './BillingModule.jsx'

const root = createRoot(document.getElementById('root'))
const isBillingModule = new URLSearchParams(window.location.search).get('module') === 'billing'
if (isBillingModule) document.title = 'OverHead Billing & Payments'

root.render(
  <StrictMode>
    {isBillingModule ? <BillingModule /> : <App />}
  </StrictMode>,
)
