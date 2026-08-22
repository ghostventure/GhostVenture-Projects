import './globals.css'

export const metadata = {
  metadataBase: new URL('https://overhead-office.web.app'),
  title: {
    default: 'OverHead | Clearer small-business operations',
    template: '%s | OverHead',
  },
  description: 'OverHead gives owner-led teams a clearer command center for customer follow-through, staff approvals, revenue work, and operational evidence.',
  applicationName: 'OverHead',
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
    images: [{ url: '/assets/overhead-desktop.png', width: 1440, height: 900, alt: 'OverHead desktop workspace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OverHead | Clearer small-business operations',
    description: 'A focused operating system for owner-led business teams.',
    images: ['/assets/overhead-desktop.png'],
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
