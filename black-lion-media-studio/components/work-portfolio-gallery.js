"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

const visualPreviews = [
  {
    title: "Visual storytelling",
    branch: "Black Lion Multimedia",
    type: "Photography & video",
    image: "/ai/visual-storytelling.png",
    description: "Illustrative visual direction for photography, video, and campaign production."
  },
  {
    title: "Sound atmosphere",
    branch: "Black Lion Multimedia",
    type: "Sound & events",
    image: "/ai/sound-atmosphere.png",
    description: "Illustrative visual direction for DJ services, event sound, and beat sessions."
  },
  {
    title: "Digital support",
    branch: "Black Lion Tech Development",
    type: "AI & software",
    image: "/ai/digital-support.png",
    description: "Illustrative visual direction for AI guidance, apps, automation, and PC support."
  },
  {
    title: "Editorial concept",
    branch: "Black Lion Fashion",
    type: "Fashion & campaigns",
    image: "/ai/hero-editorial.png",
    description: "Illustrative editorial artwork for fashion, product visuals, and campaign planning."
  }
];

export default function WorkPortfolioGallery() {
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activePreview, setActivePreview] = useState(null);
  const dialogRef = useRef(null);

  const branches = [...new Set(visualPreviews.map((item) => item.branch))];
  const types = [...new Set(visualPreviews
    .filter((item) => branchFilter === "all" || item.branch === branchFilter)
    .map((item) => item.type))];
  const visiblePreviews = useMemo(() => visualPreviews.filter((item) =>
    (branchFilter === "all" || item.branch === branchFilter) &&
    (typeFilter === "all" || item.type === typeFilter)
  ), [branchFilter, typeFilter]);

  useEffect(() => {
    if (branchFilter !== "all" && !branches.includes(branchFilter)) setBranchFilter("all");
    if (typeFilter !== "all" && !types.includes(typeFilter)) setTypeFilter("all");
  }, [branchFilter, typeFilter, branches, types]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activePreview && !dialog.open) dialog.showModal();
    if (!activePreview && dialog.open) dialog.close();
  }, [activePreview]);

  function movePreview(direction) {
    if (!activePreview || visiblePreviews.length < 2) return;
    const currentIndex = visiblePreviews.findIndex((item) => item.image === activePreview.image);
    const nextIndex = (currentIndex + direction + visiblePreviews.length) % visiblePreviews.length;
    setActivePreview(visiblePreviews[nextIndex]);
  }

  return (
    <section className="panel work-preview-gallery" aria-labelledby="work-preview-heading">
      <p className="label">Visual previews</p>
      <h2 className="editorial-heading" id="work-preview-heading">Explore studio visual direction</h2>
      <p className="muted">These are illustrative studio visuals, not client case studies. Real project samples will appear here when portfolio records are available.</p>
      <div className="work-preview-filters">
        <label>
          Studio branch
          <select value={branchFilter} onChange={(event) => {
            setBranchFilter(event.target.value);
            setTypeFilter("all");
          }}>
            <option value="all">All branches</option>
            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        </label>
        <label>
          Project type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>
      <p className="muted" aria-live="polite">Showing {visiblePreviews.length} visual previews.</p>
      <div className="work-preview-grid">
        {visiblePreviews.map((item) => (
          <article className="work-preview-card" key={item.image}>
            <button
              type="button"
              className="work-preview-open"
              onClick={() => setActivePreview(item)}
              aria-label={`Open full-screen visual preview: ${item.title}`}
            >
              <Image src={item.image} alt="" width={960} height={640} sizes="(max-width: 700px) 100vw, 50vw" />
              <span>View full screen</span>
            </button>
            <div className="work-preview-copy">
              <p className="label">{item.branch} · {item.type}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
      <dialog
        className="work-preview-dialog"
        ref={dialogRef}
        aria-label={activePreview ? `Full-screen visual preview: ${activePreview.title}` : "Full-screen visual preview"}
        onClose={() => setActivePreview(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setActivePreview(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            movePreview(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            movePreview(-1);
          }
        }}
      >
        {activePreview ? (
          <div className="work-preview-viewer">
            <div className="work-preview-viewer-tools">
              <p>{activePreview.title} · {activePreview.branch} · {activePreview.type}</p>
              <button type="button" className="button button-secondary" onClick={() => setActivePreview(null)}>Close</button>
            </div>
            <Image src={activePreview.image} alt={`${activePreview.title}, illustrative studio visual`} width={1600} height={1067} sizes="95vw" priority />
            <p className="muted">Illustrative studio visual · Use left and right arrow keys to browse.</p>
            <div className="work-preview-viewer-tools">
              <button type="button" className="button button-secondary" onClick={() => movePreview(-1)} disabled={visiblePreviews.length < 2}>Previous</button>
              <button type="button" className="button button-secondary" onClick={() => movePreview(1)} disabled={visiblePreviews.length < 2}>Next</button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
