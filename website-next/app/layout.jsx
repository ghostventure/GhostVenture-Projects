import './globals.css'

export const metadata = {
  metadataBase: new URL('https://overhead-office.web.app'),
  title: {
    default: 'OverHead | Clearer small-business operations',
    template: '%s | OverHead',
  },
  description: 'OverHead gives owner-led teams a clearer command center for customer follow-through, staff approvals, revenue work, and operational evidence.',
  applicationName: 'OverHead',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
  keywords: ['small business operations', 'customer follow-up', 'office management', 'workflow approvals', 'Windows Server office software', 'Windows IoT office software', 'OverHead Cylinder', 'OverHead'],
  authors: [{ name: 'Black Lion Studios' }],
  creator: 'Black Lion Studios',
  publisher: 'Black Lion Studios',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'OverHead',
    title: 'OverHead | Clearer small-business operations',
    description: 'A focused operating system for owner-led business teams.',
    images: [{ url: '/assets/overhead-social-card.png', width: 1200, height: 630, alt: 'OverHead brings customers, workflows, and decisions together' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OverHead | Clearer small-business operations',
    description: 'A focused operating system for owner-led business teams.',
    images: ['/assets/overhead-social-card.png'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
