export function validateTourDraft(draft, existing = [], now = new Date()) {
  if (!draft?.listingId) return "Choose a property.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)) return "Choose a valid date and time.";
  const appointment = new Date(`${draft.date}T${draft.time}:00`);
  if (!Number.isFinite(appointment.getTime())) return "Choose a valid date and time.";
  if (appointment <= now) return "Appointments must be scheduled in the future.";
  const duration = Number(draft.durationMinutes || 60);
  if (![15, 30, 45, 60, 90, 120].includes(duration)) return "Choose an appointment duration from 15 to 120 minutes.";
  const startMinute = Number(draft.time.slice(0, 2)) * 60 + Number(draft.time.slice(3, 5));
  const endMinute = startMinute + duration;
  if (existing.some((item) => {
    if (item.status === "cancelled" || item.date !== draft.date) return false;
    const otherStart = Number(String(item.time).slice(0, 2)) * 60 + Number(String(item.time).slice(3, 5));
    const otherEnd = otherStart + Number(item.durationMinutes || 60);
    return startMinute < otherEnd && otherStart < endMinute;
  })) return "This appointment overlaps another scheduled appointment.";
  if (!draft.type) return "Choose an appointment type.";
  if ((draft.notes || "").length > 1000) return "Notes must be 1,000 characters or fewer.";
  return "";
}

export function makeTour(draft, listing, id = `TOUR-${Date.now()}`) {
  return { ...draft, durationMinutes: Number(draft.durationMinutes || 60), id, listingId: String(draft.listingId), property: listing.title, address: listing.address || "", status: "scheduled", createdAt: new Date().toISOString() };
}

export function updateTour(tours, id, patch) {
  if (!tours.some((tour) => tour.id === id)) throw new Error("Appointment was not found.");
  return tours.map((tour) => tour.id === id ? { ...tour, ...patch, id: tour.id, updatedAt: new Date().toISOString() } : tour);
}

export function cancelTour(tours, id) {
  return tours.map((tour) => tour.id === id ? { ...tour, status: "cancelled", cancelledAt: new Date().toISOString() } : tour);
}

export function filterTours(tours, query = "", status = "upcoming", now = new Date()) {
  const q = query.trim().toLowerCase();
  return tours.filter((tour) => {
    const match = !q || `${tour.property} ${tour.address} ${tour.type} ${tour.notes || ""}`.toLowerCase().includes(q);
    const date = new Date(`${tour.date}T${tour.time || "00:00"}:00`);
    const upcoming = tour.status !== "cancelled" && date >= now;
    return match && (status === "all" || (status === "upcoming" ? upcoming : status === "past" ? !upcoming && tour.status !== "cancelled" : tour.status === status));
  }).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

export function toTourCalendar(tours) {
  const esc = (value = "") => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const events = tours.filter((tour) => tour.status !== "cancelled").map((tour) => {
    const start = `${tour.date.replaceAll("-", "")}T${tour.time.replace(":", "")}00`;
    const endDate = new Date(`${tour.date}T${tour.time}:00`);
    endDate.setMinutes(endDate.getMinutes() + Number(tour.durationMinutes || 60));
    const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}T${String(endDate.getHours()).padStart(2, "0")}${String(endDate.getMinutes()).padStart(2, "0")}00`;
    return ["BEGIN:VEVENT", `UID:${esc(tour.id)}@estatehat.local`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${esc(`${tour.type}: ${tour.property}`)}`, `LOCATION:${esc(tour.address)}`, `DESCRIPTION:${esc(tour.notes || "")}`, "END:VEVENT"].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EstateHat//Tour Planner//EN", ...events, "END:VCALENDAR", ""].join("\r\n");
}
