export function isValidGigMapPoint(point) {
  return Number.isFinite(point?.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point?.lng) && point.lng >= -180 && point.lng <= 180;
}

export function buildOpenStreetMapEmbedUrl(gig) {
  if (!isValidGigMapPoint(gig)) return null;
  const latitude = Number(gig.lat);
  const longitude = Number(gig.lng);
  const latitudePad = 0.01;
  const longitudePad = 0.01;
  const bounds = [
    Math.max(-180, longitude - longitudePad),
    Math.max(-90, latitude - latitudePad),
    Math.min(180, longitude + longitudePad),
    Math.min(90, latitude + latitudePad)
  ];
  const params = new URLSearchParams({
    bbox: bounds.join(","),
    layer: "mapnik",
    marker: `${latitude},${longitude}`
  });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}
