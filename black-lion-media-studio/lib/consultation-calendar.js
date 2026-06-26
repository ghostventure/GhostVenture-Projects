const inactiveBookingStatuses = new Set(["Cancelled", "Canceled", "Declined", "Closed"]);

function parseConsultationDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null;
  }

  const timeMatch = String(timeValue).match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
  if (!timeMatch) {
    return null;
  }

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3].toUpperCase();

  if (meridiem === "PM" && hours !== 12) {
    hours += 12;
  }

  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  const date = new Date(`${dateValue}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDayLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short"
  }).format(date);
}

function buildEventRows(days, perspective) {
  return days
    .filter((day) => day.bookings.length > 0)
    .flatMap((day) =>
      day.bookings.slice(0, 2).map((booking) => ({
        label: `${day.weekday} ${day.label}`,
        value: booking.title,
        note:
          perspective === "manager"
            ? `${booking.time} • ${booking.clientName || "Unknown client"}`
            : `${booking.time} • ${booking.status}`
      }))
    )
    .slice(0, 6);
}

export function buildConsultationCalendarData({
  availability,
  requests,
  perspective = "client"
}) {
  const activeRequests = requests.filter(
    (request) => !inactiveBookingStatuses.has(request.status)
  );
  const daysByDate = new Map(
    availability.map((day) => [
      day.value,
      {
        value: day.value,
        label: day.label,
        timeSlots: [...day.timeSlots]
      }
    ])
  );

  activeRequests
    .filter((request) => request.consultation_date)
    .forEach((request) => {
      if (daysByDate.has(request.consultation_date)) {
        return;
      }

      daysByDate.set(request.consultation_date, {
        value: request.consultation_date,
        label: `${formatWeekday(request.consultation_date)} ${formatDayLabel(request.consultation_date)} (${request.consultation_date})`,
        timeSlots: request.consultation_time ? [request.consultation_time] : []
      });
    });

  const calendarDays = [...daysByDate.values()].sort((a, b) =>
    String(a.value).localeCompare(String(b.value))
  );

  const availabilityDays = calendarDays.map((day) => {
    const bookings = activeRequests
      .filter((request) => request.consultation_date === day.value)
      .map((request) => ({
        time: request.consultation_time || "Unscheduled",
        title: request.project_type || "Consultation",
        status: request.status || "New",
        clientName: request.client_name || "",
        source: request.source || "Website"
      }))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

    const bookedCount = bookings.length;
    const remainingSlotsCount = Math.max(day.timeSlots.length - bookedCount, 0);
    const hasScheduled = bookedCount > 0;

    let status = "open";
    if (perspective === "client" && hasScheduled) {
      status = "scheduled";
    } else if (remainingSlotsCount <= 0) {
      status = "full";
    } else if (bookedCount >= Math.ceil(day.timeSlots.length / 2)) {
      status = "busy";
    }

    return {
      isoDate: day.value,
      label: formatDayLabel(day.value),
      weekday: formatWeekday(day.value),
      dayNumber: day.value.slice(-2),
      status,
      availableSlotsCount: day.timeSlots.length,
      bookedCount,
      remainingSlotsCount,
      primaryMeta:
        perspective === "manager"
          ? `${bookedCount} booked`
          : hasScheduled
            ? `${bookedCount} scheduled`
            : `${remainingSlotsCount} open`,
      secondaryMeta:
        perspective === "manager"
          ? `${remainingSlotsCount} slots left`
          : `${day.timeSlots.slice(0, 2).join(" • ")}`,
      bookings
    };
  });

  const totalBooked = availabilityDays.reduce((sum, day) => sum + day.bookedCount, 0);
  const totalOpen = availabilityDays.reduce((sum, day) => sum + day.remainingSlotsCount, 0);
  const busiestDay =
    [...availabilityDays].sort((a, b) => b.bookedCount - a.bookedCount)[0] || null;

  return {
    eyebrow: perspective === "manager" ? "Shared Calendar" : "Your Calendar",
    title:
      perspective === "manager"
        ? "Consultation flow across the next open booking days."
        : "Your next open booking days and scheduled consults.",
    copy:
      perspective === "manager"
        ? "The same calendar system used by clients, with request volume surfaced by day."
        : "Your booking availability and scheduled requests are connected through one shared calendar.",
    summary: [
      { label: "Open days", value: availabilityDays.length },
      { label: "Booked slots", value: totalBooked },
      { label: "Open slots", value: totalOpen },
      {
        label: "Busiest day",
        value: busiestDay ? `${busiestDay.weekday} ${busiestDay.label}` : "Open"
      }
    ],
    days: availabilityDays,
    events: buildEventRows(availabilityDays, perspective)
  };
}

export { parseConsultationDateTime };
