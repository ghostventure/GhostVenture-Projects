import { SiteShell } from '../components'
import StaffPortalClient from './staff-portal-client'

export const metadata = {
  title: 'Staff Portal',
  description: 'Authorized OverHead Staff workspace support console.',
  robots: { index: false, follow: false },
}

export default function StaffPortalPage() {
  return (
    <SiteShell tone="light">
      <main className="portal-page staff-page">
        <StaffPortalClient />
      </main>
    </SiteShell>
  )
}
