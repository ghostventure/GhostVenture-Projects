import { SiteShell } from '../components'
import DashboardClient from './dashboard-client'
import './dashboard.css'

export default function DashboardPage() {
  return (
    <SiteShell tone="light">
      <main className="portal-page dashboard-page">
        <DashboardClient />
      </main>
    </SiteShell>
  )
}
