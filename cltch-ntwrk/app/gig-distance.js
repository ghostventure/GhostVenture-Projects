function isCoordinatePair(point) {
  return Number.isFinite(point?.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point?.lng) && point.lng >= -180 && point.lng <= 180;
}

export function approximateGigDistanceLabel(gig, performerProfile) {
  if (!isCoordinatePair(gig) || !isCoordinatePair(performerProfile)) return null;

  const radians = Math.PI / 180;
  const latitudeDelta = (performerProfile.lat - gig.lat) * radians;
  const longitudeDelta = (performerProfile.lng - gig.lng) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(gig.lat * radians) * Math.cos(performerProfile.lat * radians)
    * Math.sin(longitudeDelta / 2) ** 2;
  const clampedA = Math.min(1, Math.max(0, a));
  const distanceMiles = 3958.8 * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  if (!Number.isFinite(distanceMiles)) return null;
  if (distanceMiles < 0.5) return "Approx. straight-line distance: under 1 mile";

  const roundedMiles = Math.round(distanceMiles);
  const formattedMiles = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(roundedMiles);
  return `Approx. straight-line distance: ${formattedMiles} ${roundedMiles === 1 ? "mile" : "miles"}`;
}
