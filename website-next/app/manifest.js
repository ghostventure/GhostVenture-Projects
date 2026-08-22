export default function manifest() {
  return {
    name: 'OverHead Office',
    short_name: 'OverHead',
    description: 'Clearer operations for owner-led small-business teams.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1421',
    theme_color: '#0b1421',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
