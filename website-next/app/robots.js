export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/account/', '/dashboard/', '/sign-in/'] },
    sitemap: 'https://overhead-office.web.app/sitemap.xml',
  }
}
