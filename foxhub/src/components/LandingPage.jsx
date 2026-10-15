import FoxHeadMark from "../FoxHeadMark.jsx";
import { LandingFooter } from "./LandingFooter.jsx";

export function LandingPage({openSignIn,openSignUp,openFeedback,openWorkspace,isAuthenticated=false,campaignSource=null}) {
  return <div className="auth-page refreshed-landing">
    <header className="landing-nav" aria-label="FoxHub landing navigation">
      <button type="button" className="landing-brand" onClick={() => window.scrollTo({top:0,behavior:"smooth"})}><span aria-hidden="true"><FoxHeadMark className="fox-head-icon" /></span><strong>FoxHub</strong></button>
      <div className="landing-nav-actions">
        <a href="#why-foxhub">Why FoxHub</a><a href="/android/">Android app</a><a href="/comparison">Compare</a>
        <button type="button" className="ghost-button small" onClick={isAuthenticated ? openWorkspace : openSignIn}>{isAuthenticated ? "Open app" : "Sign in"}</button>
        <button type="button" className="accent-button small" onClick={openSignUp}>Sign up</button>
      </div>
    </header>
    <main className="landing-page">
      <section className="landing-hero refreshed-hero">
        <div className="landing-copy">
          <p className="card-label">Founding access is open</p>
          <h1>A place for your people.</h1>
          <p>Stay close to your circles, make plans, and find local help through people you know.</p>
          <div className="hero-cta-row">
            <button type="button" className="accent-button" onClick={isAuthenticated ? openWorkspace : openSignUp}>{isAuthenticated ? "Open your workspace" : "Join FoxHub"}</button>
            <button type="button" className="text-link-button" onClick={openSignIn}>Already a member? Sign in</button>
          </div>
          <p className="surface-note">Early access is free during launch review. An invite or approval is required to join. For adults 18 and older.</p>
          {campaignSource ? <p className="surface-note">Ad source: {campaignSource.label || campaignSource.source || "Community invitation"}</p> : null}
        </div>
        <section className="product-preview surface" aria-label="Example FoxHub workspace">
          <div className="surface-head"><strong>FoxHub · Home</strong><span className="badge subtle">Illustrative preview</span></div>
          <h2>Your circle, all together.</h2>
          <div className="preview-shortcuts"><span>Messages</span><span>Circles</span><span>Local help</span></div>
          <article className="preview-post"><p className="card-label">Weekend circle · Example</p><h3>Same park, Saturday?</h3><p>Bring a picnic. We’ll pick a time together.</p><span className="surface-note">A shared plan, without the scattered messages.</span></article>
          <article className="preview-post"><p className="card-label">Local help · Example</p><h3>Know a great bike repair shop?</h3><p>Ask your circle for a recommendation.</p></article>
          <p className="surface-note">Example content. Your workspace shows your own conversations and activity.</p>
        </section>
      </section>
      <section id="why-foxhub" className="landing-band">
        <p className="card-label">Everyday connections</p><h2>Less searching around. More staying in touch.</h2>
        <div className="member-benefits">
          {[['Keep conversations close','Message your people and pick up where you left off.'],['Make room for your circles','Share updates and plans with the groups that matter to you.'],['Ask someone you trust','Find recommendations, local offers, and a helping hand.']].map(([title,copy]) => <article className="landing-card" key={title}><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="landing-band joining-guide">
        <div><p className="card-label">Getting started</p><h2>A few steps to your circle.</h2></div>
        <ol><li>Create your profile with your email, username, city, and age confirmation.</li><li>Use an invitation or request access for review.</li><li>After approval, sign in with the same email and password on web or Android.</li></ol>
        <button type="button" className="text-link-button" onClick={openFeedback}>Need help joining?</button>
      </section>
      <section className="landing-band mobile-invitation"><div><p className="card-label">Take FoxHub with you</p><h2>One account, wherever you are.</h2><p>Use your FoxHub account on the website or Android. Your profile comes with you.</p></div><div className="inline-actions wrap"><a className="accent-button" href="/android/">Open mobile app</a><a className="text-link-button" href="/downloads/FoxHub-Android-Debug-0.1.0.apk.zip">Download Android test build (ZIP)</a></div></section>
      <LandingFooter />
    </main>
  </div>;
}
