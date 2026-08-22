import { SiteShell } from '../components'
import AccountSettingsClient from './account-settings-client'
import BillingClient from './billing-client'

export default function AccountPage() {
  return (
    <SiteShell tone="light">
      <main className="portal-page">
        <AccountSettingsClient />
        <BillingClient />
      </main>
    </SiteShell>
  )
}
