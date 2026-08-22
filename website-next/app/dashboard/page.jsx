import { SiteShell } from '../components'
import DashboardClient from './dashboard-client'

export default function DashboardPage() {
  return (
    <SiteShell tone="light">
      <main className="portal-page dashboard-page">
        <DashboardClient />
      </main>
    </SiteShell>
  )
}
