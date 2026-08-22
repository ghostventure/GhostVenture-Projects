const site = 'https://overhead-office.web.app'

export default function sitemap() {
  return [
    ['', 1],
    ['/about/', 0.8],
    ['/careers/', 0.6],
    ['/contact/', 0.7],
    ['/faq/', 0.7],
    ['/investors/', 0.6],
    ['/legal/', 0.4],
    ['/support/', 0.6],
  ].map(([path, priority]) => ({
    url: `${site}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority,
  }))
}
