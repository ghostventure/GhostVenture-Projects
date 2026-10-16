import React, { useEffect, useState } from "react";
import EstateHatPublicFooter from "./EstateHatPublicFooter.jsx";

const palette = {
  bg: "#f4fff6",
  ink: "#123429",
  muted: "#53685f",
  card: "rgba(255, 255, 247, 0.9)",
  cardStrong: "rgba(248, 255, 241, 0.96)",
  border: "rgba(27, 111, 82, 0.22)",
  accent: "#1f9d6b",
  accentDeep: "#0f6b4f",
  amber: "#f4b740",
  pine: "#e8f8ed",
  pineSoft: "rgba(244,183,64,0.16)",
  sand: "#eaf7ff",
  serif: "'Newsreader', Georgia, serif",
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const FEATURES = [
  {
    title: "Know What To Do Next",
    body: "EstateHat keeps the listing, messages, forms, and next steps in one place so the sale feels easier to follow.",
  },
  {
    title: "Feel Safer From The Start",
    body: "Profiles, documents, and role checks help buyers and sellers understand who they are working with.",
  },
  {
    title: "See The Costs Up Front",
    body: "The fee model is presented plainly so people are not surprised late in the process.",
  },
  {
    title: "Use It Anywhere",
    body: "The web app works across phones and desktops, so the same sale stays with you.",
  },
];

const READINESS_SIGNALS = [
  {
    label: "Role fit",
    value: "Buyer, seller, pro, admin, or government",
    body: "Account setup now points people into the right lane before they hit the signed-in workspace.",
  },
  {
    label: "Jurisdiction",
    value: "State, county, city, territory",
    body: "Compliance posture is framed around the local recording and privacy rules that can change the transaction path.",
  },
  {
    label: "Trust record",
    value: "Verification + reputation",
    body: "Profiles can carry verified status, feedback, testimonials, and legal readiness signals instead of a bare account card.",
  },
  {
    label: "Review path",
    value: "Listing queue + featured placement",
    body: "Seller submissions, admin review, and paid visibility are presented as a controlled workflow instead of a loose listing post.",
  },
  {
    label: "Desktop software",
    value: "Windows desktop app available",
    body: "EstateHat can be used from the web and from the packaged Windows desktop software for users who prefer an installed workspace.",
  },
];

const TRANSACTION_LEAKS = [
  {
    label: "Offer drift",
    value: "Unsigned or unanswered",
    body: "Flags offers, counter terms, and seller replies that need a clear next action before momentum is lost.",
  },
  {
    label: "Document gaps",
    value: "Disclosure, ID, proof",
    body: "Keeps required forms, identity readiness, and supporting files visible instead of buried in message threads.",
  },
  {
    label: "Closing friction",
    value: "Inspection, escrow, title",
    body: "Separates EstateHat guidance from licensed escrow, title, and professional responsibilities so scope stays clear.",
  },
  {
    label: "Support evidence",
    value: "Packet-ready history",
    body: "Turns transaction activity into a cleaner record for support review, dispute triage, and user handoff.",
  },
];

const CONTROL_LANES = [
  ["Role-aware access", "Buyer, seller, professional, admin, and government lanes stay separate so the right controls appear at the right time."],
  ["Action queue", "Next steps, missing records, and stalled deal signals are grouped into a daily work queue instead of scattered reminders."],
  ["Tamper-resistant posture", "Critical profile, legal, consent, and support packet events are framed as traceable records that should not be silently overwritten."],
  ["Desktop + web proof", "Download links, SHA-256 verification, and website sign-in paths sit together so users can verify what they install."],
];

const STARTER_WORKFLOW = [
  "Choose a role and finish the account record.",
  "Start a listing, saved search, or transaction workspace.",
  "Attach forms, photos, notes, and required deal records.",
  "Use the queue to clear blockers before support or closing review.",
];

const WINDOWS_INSTALLER_ZIP = "/downloads/EstateHat-Windows-Installer.zip";
const WINDOWS_DESKTOP_ZIP = "/downloads/EstateHat-Windows-Desktop.zip";
const WINDOWS_INSTALLER_HASH = "a7c966eda2e34e85828fa88d519b6c7f4c70365f59ad0a5d8a44ef8940997a02";

const INTRO_SLIDES = [
  {
    id: "workflow",
    eyebrow: "One EstateHat",
    title: "Keep the listing, forms, messages, and next steps in one place.",
    body: "EstateHat is strongest when it works like one connected home-sale workspace instead of scattered tabs, texts, and documents.",
    image: "/landing/estatehat-intro-workflow.png",
    points: ["List or search from one account", "Track forms and document steps", "See what to do next without guesswork"],
  },
  {
    id: "trust",
    eyebrow: "Trust before stress",
    title: "Move forward with clearer identity, role, and closing boundaries.",
    body: "The public site leans hardest on verification posture, role separation, and licensed escrow boundaries to make the process feel safer and easier to follow.",
    image: "/landing/estatehat-intro-closing.png",
    points: ["U.S.-verified buyer and seller workflows", "Role checks reduce conflicts of interest", "Funds move through licensed escrow partners"],
  },
  {
    id: "clarity",
    eyebrow: "Cost clarity",
    title: "Show the fee story and closing path early.",
    body: "The most useful promise is not hype. It is simple guidance, visible costs, and fewer surprises as the sale moves toward closing.",
    metrics: [
      ["Platform fee", "1.50%"],
      ["Listing fee", "No upfront listing fee"],
      ["Support flow", "Move Kit, Forms, Hat Data"],
    ],
    checklist: [
      "Guided steps instead of scattered reminders",
      "Public/legal pages keep scope clear",
      "Works across web, phone, and desktop",
    ],
  },
];

function CtaButton({ label, onClick, tone = "primary", disabled = false }) {
  const isPrimary = tone === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: isPrimary ? "1px solid rgba(15,107,79,0.3)" : `1px solid ${palette.border}`,
        background: isPrimary
          ? `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentDeep} 100%)`
          : "rgba(255,255,247,0.62)",
        color: isPrimary ? "#fffef6" : palette.ink,
        borderRadius: 8,
        minHeight: 48,
        padding: "0 22px",
        maxWidth: "100%",
        fontFamily: palette.sans,
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "normal",
        boxShadow: isPrimary && !disabled ? "0 18px 42px rgba(31,157,107,0.24)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function IntroReel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % INTRO_SLIDES.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      className="estatehat-intro-reel"
      style={{
        position: "relative",
        minHeight: 520,
        height: "100%",
        background: [
          "linear-gradient(rgba(31,157,107,0.12) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(31,157,107,0.12) 1px, transparent 1px)",
          "linear-gradient(165deg, rgba(255,255,247,0.94) 0%, rgba(221,246,225,0.92) 48%, rgba(255,248,220,0.9) 100%)",
        ].join(","),
        backgroundSize: "44px 44px, 44px 44px, auto",
        overflow: "hidden",
      }}
    >
      <div className="estatehat-intro-topline" style={{ position: "absolute", top: 20, left: 20, right: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, zIndex: 3 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8, border: "1px solid rgba(15,107,79,0.24)", background: "rgba(255,255,247,0.78)", padding: "7px 12px", color: palette.ink, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: palette.amber, boxShadow: "0 0 18px rgba(244,183,64,0.58)" }} />
          Solar-ready workspace
        </div>
        <div style={{ color: palette.muted, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Verified flow</div>
      </div>

      <div style={{ position: "absolute", top: 58, left: 20, right: 20, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, zIndex: 3 }}>
        {INTRO_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Show ${slide.eyebrow} slide`}
            style={{
              border: "none",
              height: 5,
              borderRadius: 8,
              background: index === activeIndex ? palette.amber : "rgba(15,107,79,0.22)",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>

      {INTRO_SLIDES.map((slide, index) => {
        const isActive = index === activeIndex;
        return (
          <article
            key={slide.id}
            className={`estatehat-intro-slide${isActive ? " is-active" : ""}`}
            aria-hidden={!isActive}
            style={{
              position: "absolute",
              inset: 0,
              opacity: isActive ? 1 : 0,
              transform: isActive ? "scale(1)" : "scale(1.02)",
              transition: "opacity 700ms ease, transform 700ms ease",
            }}
          >
            {"image" in slide ? (
              <>
                <img
                  src={slide.image}
                  alt={slide.title}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(15,57,43,0.82) 0%, rgba(15,57,43,0.52) 48%, rgba(244,183,64,0.16) 100%)" }} />
                <div className="estatehat-intro-copy" style={{ position: "absolute", left: 26, right: 26, bottom: 26, display: "grid", gap: 14, maxWidth: 420 }}>
                  <div>
                    <div style={{ color: "#e9c75f", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>{slide.eyebrow}</div>
                    <div style={{ marginTop: 10, color: "#fff", fontFamily: palette.serif, fontSize: "clamp(2rem, 4vw, 2.65rem)", lineHeight: 1.04 }}>{slide.title}</div>
                    <div style={{ marginTop: 10, color: "rgba(244,251,247,0.8)", fontSize: 14, lineHeight: 1.65 }}>{slide.body}</div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {slide.points.map((point) => (
                      <div key={point} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 8, background: "rgba(255,255,247,0.16)", border: "1px solid rgba(255,255,247,0.24)", padding: "10px 12px", color: "#fff", fontSize: 13.5, lineHeight: 1.45, backdropFilter: "blur(12px)" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 8, background: palette.amber, flex: "0 0 auto" }} />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg, rgba(15,107,79,0.96), rgba(244,183,64,0.26))" }} />
                <div style={{ position: "absolute", inset: "90px 24px 24px", display: "grid", gap: 18, gridTemplateRows: "auto auto 1fr" }}>
                  <div>
                    <div style={{ color: "#fff5b8", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>{slide.eyebrow}</div>
                    <div style={{ marginTop: 10, color: "#fff", fontFamily: palette.serif, fontSize: "clamp(2rem, 4vw, 2.5rem)", lineHeight: 1.04, maxWidth: 500 }}>{slide.title}</div>
                    <div style={{ marginTop: 10, color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 1.65, maxWidth: 520 }}>{slide.body}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                    {slide.metrics.map(([label, value]) => (
                      <div key={label} style={{ borderRadius: 8, border: "1px solid rgba(255,255,247,0.26)", background: "rgba(255,255,247,0.14)", padding: 14 }}>
                        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
                        <div style={{ marginTop: 8, color: "#fff", fontSize: 19, lineHeight: 1.2, fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderRadius: 8, border: "1px solid rgba(255,255,247,0.26)", background: "linear-gradient(180deg, rgba(255,255,247,0.16), rgba(255,255,247,0.08))", padding: 18, display: "grid", gap: 12, alignContent: "start" }}>
                    <div style={{ color: "#fff", fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>What the site should sell first</div>
                    {slide.checklist.map((item, itemIndex) => (
                      <div key={item} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 12, alignItems: "start" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,247,0.2)", color: itemIndex === 1 ? "#fff5b8" : "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>{itemIndex + 1}</div>
                        <div style={{ color: "rgba(255,255,255,0.86)", fontSize: 14, lineHeight: 1.6 }}>{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </article>
        );
      })}

      <div className="estatehat-intro-chip-row" style={{ position: "absolute", left: 20, right: 20, bottom: 18, display: "flex", gap: 8, flexWrap: "wrap", zIndex: 3 }}>
        {INTRO_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            style={{
              border: `1px solid ${index === activeIndex ? "rgba(255,255,255,0.36)" : "rgba(255,255,255,0.12)"}`,
              background: index === activeIndex ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {slide.eyebrow}
          </button>
        ))}
      </div>
    </div>
  );
}

function OperatingCommandCenter({ isAuthenticated, onOpenApp, onSignIn }) {
  return (
    <section
      className="estatehat-operating-center"
      aria-labelledby="estatehat-operating-heading"
      style={{
        borderRadius: 8,
        border: "1px solid rgba(244,183,64,0.28)",
        background: [
          "linear-gradient(rgba(255,255,247,0.07) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,247,0.07) 1px, transparent 1px)",
          "linear-gradient(145deg, #10281f 0%, #164436 48%, #2d4935 100%)",
        ].join(","),
        backgroundSize: "40px 40px, 40px 40px, auto",
        color: "#fffef6",
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 30px 82px rgba(18,52,41,0.24)",
      }}
    >
      <div className="estatehat-operating-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.02fr) minmax(330px, 0.98fr)", gap: 0 }}>
        <div style={{ padding: "clamp(22px, 4vw, 36px)", display: "grid", gap: 18, alignContent: "start" }}>
          <div>
            <div style={{ color: "#f7d66f", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 900 }}>Deal operations layer</div>
            <h2 id="estatehat-operating-heading" style={{ margin: "10px 0 0", fontFamily: palette.serif, fontSize: "clamp(2rem, 5vw, 3.35rem)", lineHeight: 1.02 }}>
              Catch the loose ends before the home deal gets noisy.
            </h2>
            <p style={{ margin: "14px 0 0", color: "rgba(255,254,246,0.76)", fontSize: 15, lineHeight: 1.68, maxWidth: 680 }}>
              EstateHat now presents the same kind of operating discipline documented for OverHead, translated for residential transactions: leak checks, owner-aware lanes, evidence records, install verification, and a cleaner support handoff.
            </p>
          </div>

          <div className="estatehat-leak-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {TRANSACTION_LEAKS.map((item) => (
              <article key={item.label} style={{ minHeight: 172, borderRadius: 8, border: "1px solid rgba(255,254,246,0.14)", background: "rgba(255,254,246,0.08)", padding: 16, display: "grid", gap: 8, alignContent: "start" }}>
                <span style={{ color: "#f7d66f", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 900 }}>{item.label}</span>
                <strong style={{ color: "#fffef6", fontSize: 19, lineHeight: 1.18 }}>{item.value}</strong>
                <p style={{ margin: 0, color: "rgba(255,254,246,0.7)", fontSize: 13.5, lineHeight: 1.58 }}>{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div style={{ borderLeft: "1px solid rgba(255,254,246,0.12)", background: "rgba(4,18,13,0.28)", padding: "clamp(22px, 4vw, 34px)", display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ borderRadius: 8, border: "1px solid rgba(244,183,64,0.24)", background: "rgba(244,183,64,0.1)", padding: 16 }}>
            <div style={{ color: "#f7d66f", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 900 }}>Starter workflow</div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {STARTER_WORKFLOW.map((step, index) => (
                <div key={step} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, alignItems: "start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: index === 0 ? palette.amber : "rgba(255,254,246,0.12)", color: index === 0 ? "#17351e" : "#fffef6", display: "grid", placeItems: "center", fontWeight: 900 }}>{index + 1}</div>
                  <div style={{ color: "rgba(255,254,246,0.82)", fontSize: 13.5, lineHeight: 1.55 }}>{step}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {CONTROL_LANES.map(([title, body]) => (
              <article key={title} style={{ borderRadius: 8, border: "1px solid rgba(255,254,246,0.13)", background: "rgba(255,254,246,0.07)", padding: 14 }}>
                <strong style={{ display: "block", color: "#fffef6", fontSize: 15 }}>{title}</strong>
                <span style={{ display: "block", marginTop: 6, color: "rgba(255,254,246,0.68)", fontSize: 13, lineHeight: 1.55 }}>{body}</span>
              </article>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="button" onClick={isAuthenticated ? onOpenApp : onSignIn} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(244,183,64,0.36)", background: palette.amber, color: "#17351e", fontFamily: palette.sans, fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
              {isAuthenticated ? "Open Deal Queue" : "Sign In To Continue"}
            </button>
            <a href="/downloads/SHA256SUMS.txt" style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(255,254,246,0.18)", color: "#fffef6", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
              Check Installer Hashes
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MarketingLanding({ onStartSignup, onSignIn, onOpenApp, onOpenPublicPage, isAuthenticated = false }) {
  return (
    <div
      className="estatehat-landing-root"
      style={{
        minHeight: "100vh",
        background: [
          "linear-gradient(rgba(31,157,107,0.08) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(31,157,107,0.08) 1px, transparent 1px)",
          `linear-gradient(180deg, ${palette.bg} 0%, ${palette.sand} 58%, #fff8dc 100%)`,
        ].join(","),
        backgroundSize: "52px 52px, 52px 52px, auto",
        color: palette.ink,
        fontFamily: palette.sans,
        overflowX: "hidden",
      }}
    >
      <div style={{ width: "min(1180px, 100%)", margin: "0 auto", padding: "26px 18px 44px", boxSizing: "border-box" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 24,
            position: "sticky",
            top: 10,
            zIndex: 5,
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: "rgba(255,255,247,0.78)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 18px 54px rgba(27,111,82,0.14)",
          }}
        >
          <div style={{ minWidth: 0, maxWidth: "100%" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: palette.accent }}>EstateHat</div>
            <div style={{ fontFamily: palette.serif, fontSize: "clamp(1.45rem, 5.6vw, 1.82rem)", lineHeight: 1.1, overflowWrap: "anywhere", wordBreak: "break-word" }}>The modern command center for home deals</div>
          </div>
          <div className="estatehat-landing-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <a
              href={WINDOWS_INSTALLER_ZIP}
              download
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                padding: "0 18px",
                borderRadius: 8,
                border: `1px solid ${palette.border}`,
                background: "rgba(244,183,64,0.2)",
                color: palette.ink,
                fontFamily: palette.sans,
                fontSize: 14,
                fontWeight: 800,
                textDecoration: "none",
                maxWidth: "100%",
                boxShadow: "0 14px 34px rgba(244,183,64,0.16)",
              }}
            >
              Download Windows ZIP
            </a>
            <CtaButton label={isAuthenticated ? "Open App" : "Sign In"} onClick={isAuthenticated ? onOpenApp : onSignIn} tone="secondary" />
            {!isAuthenticated ? <CtaButton label="Create Account" onClick={onStartSignup} /> : null}
          </div>
        </header>

        <section
          style={{
            background: palette.card,
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            boxShadow: "0 32px 90px rgba(27,111,82,0.18)",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div className="estatehat-landing-hero-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
            <div
              style={{
                padding: "clamp(24px, 5vw, 48px)",
                background: [
                  "linear-gradient(rgba(31,157,107,0.08) 1px, transparent 1px)",
                  "linear-gradient(90deg, rgba(31,157,107,0.08) 1px, transparent 1px)",
                  "linear-gradient(180deg, rgba(255,255,247,0.96), rgba(232,248,237,0.9))",
                ].join(","),
                backgroundSize: "38px 38px, 38px 38px, auto",
                display: "grid",
                alignContent: "center",
              }}
            >
              <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: palette.accent, marginBottom: 10, fontWeight: 800 }}>
                Sell smarter. Buy with a clearer path.
              </div>
              <h1 style={{ margin: 0, fontFamily: palette.serif, fontSize: "clamp(2.25rem, 7vw, 5.2rem)", lineHeight: 0.98, maxWidth: 540, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                A sharper way to move a home deal forward.
              </h1>
              <p style={{ margin: "16px 0 0", color: palette.muted, lineHeight: 1.65, fontSize: 16, maxWidth: 620 }}>
                EstateHat keeps listings, messages, forms, money reminders, and closing steps in one guided workspace. It is built for people who want a premium home-sale experience that feels bright, organized, and easier to trust.
              </p>
              <div style={{ marginTop: 16, maxWidth: 640, borderLeft: `3px solid ${palette.accent}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: palette.accent, fontWeight: 800 }}>
                  The EstateHat edge
                </div>
                <div style={{ marginTop: 6, color: palette.ink, fontSize: 14, lineHeight: 1.6 }}>
                  Listing sites help people find homes. EstateHat helps people stay organized after interest turns into action, with one place for listings, conversations, forms, account setup, trust signals, and next steps.
                </div>
              </div>
              <div className="estatehat-landing-actions" style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!isAuthenticated ? <CtaButton label="Start Free Account" onClick={onStartSignup} /> : <CtaButton label="Open EstateHat" onClick={onOpenApp} />}
                <a
                  href={WINDOWS_INSTALLER_ZIP}
                  download
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 48,
                    padding: "0 22px",
                    borderRadius: 8,
                    border: "1px solid rgba(15,107,79,0.24)",
                    background: palette.amber,
                    color: "#17351e",
                    fontFamily: palette.sans,
                    fontSize: 14,
                    fontWeight: 900,
                    textDecoration: "none",
                    boxShadow: "0 18px 42px rgba(244,183,64,0.28)",
                  }}
                >
                  Download Windows App ZIP
                </a>
                <CtaButton label={isAuthenticated ? "You Are Signed In" : "I Already Have Access"} onClick={isAuthenticated ? undefined : onSignIn} tone="secondary" disabled={isAuthenticated} />
              </div>
              <div
                style={{
                  marginTop: 14,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 8,
                  background: "rgba(255,255,247,0.82)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                  maxWidth: 640,
                }}
              >
                <div style={{ color: palette.accentDeep, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 900 }}>
                  Prefer the desktop app?
                </div>
                <div style={{ color: palette.ink, fontSize: 13.5, lineHeight: 1.55 }}>
                  New clients can grab the Windows installer ZIP right here, then use the same EstateHat account on the website.
                </div>
                <a href="/downloads/SHA256SUMS.txt" style={{ color: palette.accentDeep, fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
                  Verify the ZIP with SHA-256
                </a>
              </div>
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))", gap: 10 }}>
                {[
                  ["No listing fee", "Publish your home without paying just to start."],
                  ["1.50% fee model", "Keep the cost story visible early instead of late."],
                  ["One account", "Listings, forms, messages, and next steps stay together."],
                ].map(([label, detail]) => (
                  <div key={label} style={{ border: `1px solid ${palette.border}`, borderRadius: 8, background: "rgba(255,255,247,0.74)", padding: 12 }}>
                    <strong style={{ display: "block", color: palette.ink, fontSize: 14 }}>{label}</strong>
                    <span style={{ display: "block", marginTop: 4, color: palette.muted, fontSize: 12.5, lineHeight: 1.45 }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <IntroReel />
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 14, marginBottom: 24 }}>
          {FEATURES.map((feature) => (
            <article key={feature.title} style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 8, padding: "18px 16px", boxShadow: "0 18px 48px rgba(27,111,82,0.12)" }}>
              <h2 style={{ margin: "0 0 6px", fontFamily: palette.serif, fontSize: 25, lineHeight: 1.1 }}>{feature.title}</h2>
              <p style={{ margin: 0, color: palette.muted, fontSize: 13.5, lineHeight: 1.6 }}>{feature.body}</p>
            </article>
          ))}
        </section>

        <OperatingCommandCenter isAuthenticated={isAuthenticated} onOpenApp={onOpenApp} onSignIn={onSignIn} />

        <section
          className="estatehat-readiness-center"
          aria-labelledby="estatehat-readiness-heading"
          style={{
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: [
              "linear-gradient(rgba(255,255,247,0.1) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,247,0.1) 1px, transparent 1px)",
              "linear-gradient(135deg, rgba(15,107,79,0.96), rgba(76,132,77,0.92), rgba(244,183,64,0.34))",
            ].join(","),
            backgroundSize: "42px 42px, 42px 42px, auto",
            color: "#fff",
            overflow: "hidden",
            marginBottom: 24,
            boxShadow: "0 28px 76px rgba(27,111,82,0.2)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(320px, 1.1fr)", gap: 0 }}>
            <div style={{ padding: "clamp(22px, 4vw, 34px)", display: "grid", alignContent: "center", gap: 14 }}>
              <div style={{ color: "#fff5b8", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>Readiness garden</div>
              <h2 id="estatehat-readiness-heading" style={{ margin: 0, fontFamily: palette.serif, fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.02 }}>
                EstateHat grows around the whole deal, not just the listing.
              </h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: 15, lineHeight: 1.65 }}>
                The public entry now connects the pieces users meet after sign-in: role controls, local requirements, reputation signals, legal readiness, listing review, featured placement, and the available Windows desktop software.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {["US-51 baseline", "Government lanes", "Profile reputation", "Listing review", "Windows app"].map((tag) => (
                  <span key={tag} style={{ border: "1px solid rgba(255,255,247,0.28)", borderRadius: 8, background: "rgba(255,255,247,0.14)", padding: "8px 11px", color: "rgba(255,255,247,0.94)", fontSize: 12, fontWeight: 800 }}>
                    {tag}
                  </span>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13.5, lineHeight: 1.55 }}>
                Download the Windows installer ZIP for the desktop app, or skip the download and sign in through the website.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                <a href={WINDOWS_INSTALLER_ZIP} download style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 16px", borderRadius: 8, background: palette.amber, color: "#17351e", fontSize: 13, fontWeight: 900, textDecoration: "none" }}>
                  Download Windows Installer ZIP
                </a>
                <button type="button" onClick={isAuthenticated ? onOpenApp : onSignIn} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 900, fontFamily: palette.sans, cursor: "pointer" }}>
                  {isAuthenticated ? "Open Website App" : "Sign In On Website"}
                </button>
                <a href="/downloads/SHA256SUMS.txt" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                  Verify SHA-256
                </a>
                <a href={WINDOWS_DESKTOP_ZIP} download style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                  Advanced Bundle ZIP
                </a>
              </div>
              <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, lineHeight: 1.55, overflowWrap: "anywhere" }}>
                Installer ZIP SHA-256: {WINDOWS_INSTALLER_HASH}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, background: "rgba(255,255,255,0.12)" }}>
              {READINESS_SIGNALS.map((signal, index) => (
                <article key={signal.label} style={{ minHeight: 168, padding: 18, background: "rgba(13,68,51,0.52)", display: "grid", alignContent: "start", gap: 8, gridColumn: index === READINESS_SIGNALS.length - 1 ? "1 / -1" : "auto" }}>
                  <span style={{ color: "#fff5b8", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>{signal.label}</span>
                  <strong style={{ color: "#fff", fontSize: 18, lineHeight: 1.25 }}>{signal.value}</strong>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.72)", fontSize: 13.5, lineHeight: 1.55 }}>{signal.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            ["1", "Create One EstateHat", "Pick your role and add the basics so EstateHat can show the right next steps."],
            ["2", "Start your listing or search", "Put the home, photos, saved options, and people involved in one workspace."],
            ["3", "Follow the path to close", "Use reminders, forms, Hat Data, and Goodies so important details are easier to track."],
          ].map(([step, title, body]) => (
            <article key={step} style={{ borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.card, padding: 18, display: "grid", gap: 8, boxShadow: "0 18px 48px rgba(27,111,82,0.12)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(244,183,64,0.22)", color: palette.accentDeep, fontWeight: 800 }}>{step}</div>
              <strong style={{ fontSize: 18, color: palette.ink }}>{title}</strong>
              <p style={{ margin: 0, color: palette.muted, fontSize: 13.5, lineHeight: 1.6 }}>{body}</p>
            </article>
          ))}
        </section>

        <section style={{ borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.pineSoft, padding: "24px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: palette.accent, fontWeight: 800 }}>Ready to make the move simpler?</div>
            <div style={{ fontFamily: palette.serif, fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.04 }}>Create your EstateHat account in minutes.</div>
          </div>
          {!isAuthenticated ? <CtaButton label="Create Account Now" onClick={onStartSignup} /> : <CtaButton label="Open EstateHat" onClick={onOpenApp} />}
        </section>

        <EstateHatPublicFooter
          isAuthenticated={isAuthenticated}
          onCreateAccount={onStartSignup}
          onSignIn={onSignIn}
          onOpenApp={onOpenApp}
          onOpenPublicPage={onOpenPublicPage}
        />

        <style>{`
          .estatehat-landing-root,
          .estatehat-landing-root * {
            box-sizing: border-box;
          }
          .estatehat-landing-root {
            max-width: 100vw;
            color: #123429;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
          .estatehat-landing-root header {
            border-radius: 18px !important;
            transition: box-shadow 180ms ease, border-color 180ms ease;
          }
          .estatehat-landing-root header:focus-within {
            border-color: rgba(31,157,107,0.5) !important;
            box-shadow: 0 20px 56px rgba(27,111,82,0.2);
          }
          .estatehat-landing-root section,
          .estatehat-landing-root article {
            border-radius: 20px !important;
          }
          .estatehat-landing-root button,
          .estatehat-landing-root a {
            transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
          }
          .estatehat-landing-root button:not(:disabled):hover,
          .estatehat-landing-root a:hover {
            transform: translateY(-2px);
          }
          .estatehat-landing-root button:focus-visible,
          .estatehat-landing-root a:focus-visible {
            outline: 3px solid #1f9d6b;
            outline-offset: 3px;
          }
          .estatehat-landing-root .estatehat-intro-reel {
            border-radius: 18px;
          }
          @media (prefers-reduced-motion: reduce) {
            .estatehat-landing-root *,
            .estatehat-landing-root *::before,
            .estatehat-landing-root *::after {
              scroll-behavior: auto !important;
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
            .estatehat-landing-root button:not(:disabled):hover,
            .estatehat-landing-root a:hover {
              transform: none;
            }
          }
          .estatehat-landing-hero-grid > *,
          .estatehat-landing-actions,
          .estatehat-landing-actions > * {
            min-width: 0;
          }
          @media (max-width: 1040px) {
            .estatehat-landing-root {
              overflow-x: clip;
            }
            .estatehat-landing-root > div {
              width: 100% !important;
              padding: 24px 10px 38px !important;
            }
            .estatehat-landing-root header {
              align-items: stretch !important;
              width: 100% !important;
            }
            .estatehat-landing-root header > div:first-child,
            .estatehat-landing-root section,
            .estatehat-landing-root article,
            .estatehat-landing-root h1,
            .estatehat-landing-root h2,
            .estatehat-landing-root p {
              width: 100% !important;
              max-width: 100% !important;
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
            }
            .estatehat-landing-root header > div:first-child div:last-child {
              font-size: 1.35rem !important;
              line-height: 1.15 !important;
            }
            .estatehat-landing-root h1 {
              font-size: clamp(2rem, 10vw, 2.65rem) !important;
              line-height: 1.04 !important;
            }
            .estatehat-landing-root section[style*="grid-template-columns"] {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .estatehat-readiness-center > div {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .estatehat-operating-grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .estatehat-operating-grid > div:last-child {
              border-left: 0 !important;
              border-top: 1px solid rgba(255,254,246,0.12) !important;
            }
            .estatehat-readiness-center > div > div:last-child {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .estatehat-landing-hero-grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .estatehat-landing-actions {
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) !important;
              width: 100%;
            }
            .estatehat-landing-actions button {
              width: 100%;
            }
          }
          @media (max-width: 720px) {
            .estatehat-landing-root {
              overflow-x: hidden !important;
            }
            .estatehat-intro-reel {
              min-height: 620px !important;
            }
            .estatehat-leak-grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .estatehat-intro-topline {
              flex-wrap: wrap;
              align-items: flex-start !important;
            }
            .estatehat-intro-copy {
              left: 18px !important;
              right: 18px !important;
              bottom: 74px !important;
              max-width: calc(100% - 36px) !important;
            }
            .estatehat-intro-chip-row {
              bottom: 14px !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
