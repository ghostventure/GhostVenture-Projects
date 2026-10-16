import React from "react";

const images = {
  homes: {
    src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=78",
    alt: "Modern home with a bright front yard",
  },
  interior: {
    src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=78",
    alt: "Clean living room inside a home",
  },
  paperwork: {
    src: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=78",
    alt: "Home paperwork with keys",
  },
  kitchen: {
    src: "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=900&q=78",
    alt: "Bright kitchen in a home",
  },
  planning: {
    src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=78",
    alt: "Simple planning desk with notes",
  },
  city: {
    src: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=900&q=78",
    alt: "City street with homes and buildings",
  },
  familyHome: {
    src: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=900&q=78",
    alt: "Family home with front lawn",
  },
  desk: {
    src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=78",
    alt: "Clean work desk",
  },
};

function pickImages(context = "") {
  const key = context.toLowerCase();
  if (key.includes("browse") || key.includes("watchlist") || key.includes("match")) return [images.homes, images.familyHome, images.city];
  if (key.includes("list") || key.includes("property")) return [images.kitchen, images.homes, images.interior];
  if (key.includes("form") || key.includes("active") || key.includes("transaction")) return [images.paperwork, images.planning, images.desk];
  if (key.includes("profile") || key.includes("info") || key.includes("help") || key.includes("faq")) return [images.desk, images.paperwork, images.interior];
  if (key.includes("calculator") || key.includes("admin") || key.includes("data")) return [images.planning, images.city, images.paperwork];
  if (key.includes("move") || key.includes("goodies")) return [images.familyHome, images.planning, images.interior];
  return [images.homes, images.interior, images.paperwork];
}

export function SimpleImageBand({ context, compact = false, style }) {
  const selected = pickImages(context);

  return (
    <div
      className="estatehat-image-band"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
        gap: 10,
        margin: compact ? "14px 0 18px" : "16px 0 22px",
        minWidth: 0,
        ...style,
      }}
    >
      {selected.map((image, index) => (
        <img
          key={`${image.src}-${index}`}
          src={image.src}
          alt={image.alt}
          loading="lazy"
          style={{
            width: "100%",
            height: compact ? 118 : 154,
            minWidth: 0,
            objectFit: "cover",
            borderRadius: 8,
            border: "1px solid var(--s-border, rgba(0,0,0,0.12))",
            boxShadow: "0 12px 30px var(--s-shadow-soft, rgba(0,0,0,0.08))",
            display: "block",
          }}
        />
      ))}
    </div>
  );
}

export function SimpleImageCard({ context, style }) {
  const [image] = pickImages(context);

  return (
    <img
      className="estatehat-simple-image-card"
      src={image.src}
      alt={image.alt}
      loading="lazy"
      style={{
        width: "100%",
        height: 160,
        objectFit: "cover",
        borderRadius: 8,
        border: "1px solid var(--s-border, rgba(0,0,0,0.12))",
        boxShadow: "0 12px 30px var(--s-shadow-soft, rgba(0,0,0,0.08))",
        display: "block",
        ...style,
      }}
    />
  );
}
