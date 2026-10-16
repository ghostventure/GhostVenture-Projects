import React from "react";

const colors = {
  nav: "#042529",
  ink: "#f4f7f3",
  muted: "rgba(244,247,243,0.68)",
  faint: "rgba(244,247,243,0.1)",
  line: "rgba(244,247,243,0.14)",
  gold: "#d4a053",
  green: "#39b6a6",
  greenDeep: "#11847f",
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  serif: "'DM Serif Display', Georgia, serif",
};

const productItems = ["Browse Listings", "Match Services", "List Property", "Forms", "Move Kit", "Hat Data", "Goodies", "Calculator"];
const companyItems = ["About Us", "Help Center", "FAQ & Scope", "Invest", "Careers", "Press"];
const legalItems = ["Terms of Service", "Privacy Policy", "FAQ & Scope", "Accessibility", "DMCA Policy"];
const publicPageRoutes = {
  "About Us": "about",
  "Help Center": "help",
  "FAQ & Scope": "faq",
  Invest: "invest",
  "Press": "press",
  "Terms of Service": "terms",
  "Privacy Policy": "privacy",
  Accessibility: "accessibility",
  "DMCA Policy": "dmca",
};
const badges = [
  "U.S. Verified Users Only",
  "Encrypted In Transit & At Rest",
  "Role-Based Access Controls",
  "Policy & Compliance Workflows",
  "Licensed Escrow Partners",
];

function FooterButton({ children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: "block",
        width: "100%",
        border: "none",
        background: "transparent",
        color: disabled ? "rgba(244,247,243,0.45)" : colors.muted,
        padding: "4px 0",
        textAlign: "left",
        fontFamily: colors.font,
        fontSize: 13,
        lineHeight: 1.35,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function FooterColumn({ title, items, onSelect }) {
  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          color: colors.ink,
          fontFamily: colors.font,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {items.map((item) => (
        <FooterButton key={item} onClick={() => onSelect(item)} disabled={item === "Careers"}>
          {item}
          {item === "Careers" ? " (Coming Soon)" : ""}
        </FooterButton>
      ))}
    </div>
  );
}

export default function EstateHatPublicFooter({ onCreateAccount, onSignIn, onOpenApp, onOpenPublicPage, isAuthenticated = false }) {
  const openAppOrSignIn = isAuthenticated ? onOpenApp : onSignIn;
  const openFooterItem = (item) => {
    const route = publicPageRoutes[item];
    if (route && onOpenPublicPage) {
      onOpenPublicPage(route);
      return;
    }
    openAppOrSignIn();
  };

  return (
    <footer
      style={{
        width: "min(1160px, 100%)",
        margin: "26px auto 0",
        borderRadius: 8,
        background: colors.nav,
        color: colors.ink,
        padding: "34px clamp(18px, 4vw, 34px) 28px",
        boxShadow: "0 24px 70px rgba(4, 37, 41, 0.25)",
        boxSizing: "border-box",
        fontFamily: colors.font,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
          gap: 28,
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ fontFamily: colors.serif, fontSize: 24, color: colors.gold, marginBottom: 8 }}>EstateHat</div>
          <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.7 }}>
            A Place Where You Can Hang Your Hat. A simpler way to keep up with homes, paperwork, and closing steps in one place.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {["Web", "iOS", "Android", "Windows"].map((platform) => (
              <span
                key={platform}
                style={{
                  borderRadius: 8,
                  background: "rgba(212,160,83,0.12)",
                  color: colors.gold,
                  padding: "4px 10px",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
        <FooterColumn title="Product" items={productItems} onSelect={openAppOrSignIn} />
        <FooterColumn title="Company" items={companyItems} onSelect={openFooterItem} />
        <FooterColumn title="Legal" items={legalItems} onSelect={openFooterItem} />
        <div>
          <div style={{ marginBottom: 12, color: colors.ink, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Contact</div>
          <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.7 }}>
            EstateHat LLC<br />
            421 Fayetteville St, Suite 1100<br />
            Raleigh, NC 27601<br />
            <span style={{ color: colors.gold }}>hello@estatehat.com</span><br />
            <span style={{ color: colors.gold }}>investors@estatehat.com</span><br />
            (919) 555-0100
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {badges.map((badge) => (
          <span
            key={badge}
            style={{
              border: `1px solid ${colors.line}`,
              borderRadius: 8,
              background: colors.faint,
              color: colors.muted,
              padding: "6px 12px",
              fontSize: 11,
              lineHeight: 1.35,
            }}
          >
            {badge}
          </span>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${colors.line}`, paddingTop: 18, color: "rgba(244,247,243,0.62)", fontSize: 11, lineHeight: 1.75, textAlign: "center" }}>
        <p style={{ margin: "0 0 8px" }}>
          EstateHat LLC is a technology platform and is not a licensed real estate brokerage, law firm, bank, title company, or insurance provider. EstateHat does not provide legal, financial, tax, or investment advice. All real estate transactions are between independent parties, with workflow checks applied through the platform.
        </p>
        <p style={{ margin: "0 0 8px" }}>
          1.50% processing fee appears in current platform fee workflows and is deducted from seller proceeds at closing where applicable. Additional escrow, payment rail, and service-provider fees may apply by transaction setup. Savings examples are illustrative and not guaranteed.
        </p>
        <p style={{ margin: 0, color: colors.muted }}>
          © 2026 EstateHat LLC. All rights reserved. NC LLC. EIN: XX-XXXXXXX. 421 Fayetteville Street, Suite 1100, Raleigh, NC 27601
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
        <button
          type="button"
          onClick={isAuthenticated ? onOpenApp : onCreateAccount}
          style={{
            border: "none",
            borderRadius: 8,
            minHeight: 44,
            padding: "0 18px",
            background: `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenDeep} 100%)`,
            color: "#fff",
            fontFamily: colors.font,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {isAuthenticated ? "Open EstateHat" : "Create Account"}
        </button>
        <button
          type="button"
          onClick={isAuthenticated ? onOpenApp : onSignIn}
          style={{
            border: `1px solid ${colors.line}`,
            borderRadius: 8,
            minHeight: 44,
            padding: "0 18px",
            background: "transparent",
            color: colors.ink,
            fontFamily: colors.font,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {isAuthenticated ? "Go To Dashboard" : "Sign In"}
        </button>
      </div>
    </footer>
  );
}
