"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const palette = {
  bg: "#0b1210",
  panel: "rgba(255,255,255,0.08)",
  panelSoft: "rgba(255,255,255,0.05)",
  line: "rgba(255,255,255,0.12)",
  text: "#f4f7f3",
  muted: "rgba(244,247,243,0.72)",
  gold: "#d4a053",
  green: "#53d7c0",
  serif: "'DM Serif Display', Georgia, serif",
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const STEPS = [
  {
    id: "board",
    title: "Start at Hat Board",
    body: "The walkthrough opens on the main workspace so viewers understand EstateHat as an operating platform, not just a listing page.",
  },
  {
    id: "browse",
    title: "Browse or search homes",
    body: "Show how property discovery lives inside the same account and workflow shell.",
  },
  {
    id: "list",
    title: "List a property and prep the sale",
    body: "Move into the listing flow to show sellers where the process begins.",
  },
  {
    id: "messages",
    title: "Keep communication in one place",
    body: "Messages stay attached to the same product experience so the sale does not spill into scattered channels.",
  },
  {
    id: "documents",
    title: "Follow documents and next steps",
    body: "The final beat brings viewers back to the guided process: forms, helpers, and closing readiness.",
  },
];

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function findClickableByText(doc, text) {
  const candidates = Array.from(doc.querySelectorAll("button, a, [role='button'], div, span"));
  const match = candidates.find((node) => node.textContent?.trim() === text);
  if (match) return match;
  return candidates.find((node) => node.textContent?.trim()?.includes(text));
}

export default function DemoVideoPage() {
  const iframeRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);

  const { autoplay, recording } = useMemo(() => {
    if (typeof window === "undefined") {
      return { autoplay: false, recording: false };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      autoplay: params.get("autoplay") === "1",
      recording: params.get("recording") === "1",
    };
  }, []);

  useEffect(() => {
    if (!autoplay) return undefined;

    let cancelled = false;

    async function runSequence() {
      const iframe = iframeRef.current;
      if (!iframe) return;

      await new Promise((resolve) => {
        if (iframe.contentDocument?.readyState === "complete") {
          resolve();
          return;
        }
        iframe.addEventListener("load", resolve, { once: true });
      });

      await sleep(1200);
      if (cancelled) return;

      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return;

      win.scrollTo({ top: 0, behavior: "smooth" });
      setCurrentStep(0);
      await sleep(3500);
      if (cancelled) return;

      findClickableByText(doc, "Browse")?.click();
      setCurrentStep(1);
      await sleep(1800);
      if (cancelled) return;
      win.scrollTo({ top: 420, behavior: "smooth" });
      await sleep(2600);
      if (cancelled) return;

      findClickableByText(doc, "List")?.click();
      setCurrentStep(2);
      await sleep(2200);
      if (cancelled) return;
      win.scrollTo({ top: 460, behavior: "smooth" });
      await sleep(2800);
      if (cancelled) return;

      findClickableByText(doc, "Messages")?.click();
      setCurrentStep(3);
      await sleep(2600);
      if (cancelled) return;

      const docsTarget = findClickableByText(doc, "Open My Active Hats") || findClickableByText(doc, "Docs") || findClickableByText(doc, "Forms");
      docsTarget?.click();
      setCurrentStep(4);
      await sleep(3400);
      if (cancelled) return;

      win.scrollTo({ top: 0, behavior: "smooth" });
    }

    runSequence();

    return () => {
      cancelled = true;
    };
  }, [autoplay]);

  const step = STEPS[currentStep];
  const stageHeight = recording ? 960 : 860;
  const framePadding = recording ? 12 : 18;
  const titleSize = recording ? "clamp(1.8rem, 3vw, 2.9rem)" : "clamp(2rem, 5vw, 3.2rem)";
  const shellWidth = recording ? "min(1780px, 100%)" : "min(1600px, 100%)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: [
          "radial-gradient(circle at 20% 0%, rgba(83,215,192,0.16), transparent 28%)",
          "radial-gradient(circle at 100% 0%, rgba(212,160,83,0.18), transparent 30%)",
          `linear-gradient(180deg, ${palette.bg} 0%, #07100e 100%)`,
        ].join(","),
        color: palette.text,
        fontFamily: palette.sans,
        padding: recording ? "18px 20px 24px" : "32px 28px 40px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: shellWidth, margin: "0 auto", display: "grid", gap: recording ? 14 : 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: palette.green, fontWeight: 800 }}>EstateHat Demo Recording</div>
            <div style={{ marginTop: 6, fontFamily: palette.serif, fontSize: titleSize, lineHeight: 1.02 }}>
              A guided product walkthrough, not a slideshow.
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, minWidth: 280 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
              {STEPS.map((item, index) => (
                <div key={item.id} style={{ height: 5, borderRadius: 999, background: index <= currentStep ? "#53d7c0" : "rgba(255,255,255,0.16)" }} />
              ))}
            </div>
            <div style={{ fontSize: 12, color: palette.muted, textAlign: "right" }}>{currentStep + 1} / {STEPS.length}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: recording ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr) 360px", gap: recording ? 14 : 18, alignItems: "start" }}>
          <div style={{ borderRadius: 24, border: `1px solid ${palette.line}`, background: palette.panel, boxShadow: "0 28px 80px rgba(0,0,0,0.35)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${palette.line}`, background: "rgba(255,255,255,0.04)" }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
                <span key={color} style={{ width: 12, height: 12, borderRadius: 999, background: color }} />
              ))}
              <div style={{ marginLeft: 8, color: palette.muted, fontSize: 12 }}>estatehat demo walkthrough</div>
            </div>
            <div style={{ padding: framePadding, background: "#0f1513" }}>
              <iframe
                ref={iframeRef}
                src="/demo.html"
                title="EstateHat Demo"
                style={{
                  width: "100%",
                  height: stageHeight,
                  border: "none",
                  borderRadius: 18,
                  background: "#fff",
                  boxShadow: "0 12px 38px rgba(0,0,0,0.28)",
                }}
              />
            </div>
          </div>

          <aside style={{ display: "grid", gap: recording ? 12 : 14 }}>
            <div style={{ borderRadius: 22, border: `1px solid ${palette.line}`, background: "rgba(255,255,255,0.06)", padding: recording ? 18 : 20 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: palette.gold, fontWeight: 800 }}>Current Step</div>
              <div style={{ marginTop: 10, fontFamily: palette.serif, fontSize: recording ? 31 : 34, lineHeight: 1.05 }}>{step.title}</div>
              <div style={{ marginTop: 12, color: palette.muted, fontSize: recording ? 14 : 15, lineHeight: 1.7 }}>{step.body}</div>
            </div>

            <div style={{ borderRadius: 22, border: `1px solid ${palette.line}`, background: palette.panelSoft, padding: recording ? 18 : 20, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: palette.gold, fontWeight: 800 }}>Narrative</div>
              {[
                "Show EstateHat as one connected workspace.",
                "Demonstrate search, listing, messages, and process support.",
                "Keep the story grounded in the current product surface.",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: palette.text, fontSize: 14, lineHeight: 1.6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: palette.green, marginTop: 6, flex: "0 0 auto" }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
