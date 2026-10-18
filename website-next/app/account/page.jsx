import { SiteShell } from '../components'
import AccountSettingsClient from './account-settings-client'

export default function AccountPage() {
  return (
    <SiteShell tone="light">
      <main className="portal-page">
        <AccountSettingsClient />
      </main>
    </SiteShell>
  )
}
