import { SiteShell } from '../components'
import SignInClient from './sign-in-client'

export default function SignInPage() {
  return (
    <SiteShell tone="light">
      <main className="portal-page">
        <SignInClient />
      </main>
    </SiteShell>
  )
}
