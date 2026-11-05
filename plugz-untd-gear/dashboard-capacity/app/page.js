export default function HomePage() {
  return (
    <main className="dashboard-shell launch-shell">
      <p className="eyebrow">PLUGZ UNTD · MEMBER ACCESS</p>
      <section className="launch-card">
        <span className="launch-sigil" aria-hidden="true">P</span>
        <p className="eyebrow">Your account, in one place</p>
        <h1>Welcome to your Plugz space.</h1>
        <p>Manage your profile, preferences, saved addresses, and order history.</p>
        <a className="primary-button" href="/dashboard/">Open your dashboard <span aria-hidden="true">↗</span></a>
      </section>
      <footer className="page-footer"><span>PLUGZ UNTD · ACCOUNT CENTER</span><a href="https://plugz-untd-gear.web.app/">Visit the storefront</a></footer>
    </main>
  );
}
