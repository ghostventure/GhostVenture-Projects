const defaultTimeSlots = [
  "10:00 AM",
  "11:30 AM",
  "1:00 PM",
  "2:30 PM",
  "4:00 PM"
];

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function getConsultationAvailability() {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < 10) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      continue;
    }

    const isoDate = cursor.toISOString().slice(0, 10);
    dates.push({
      value: isoDate,
      label: `${formatDateLabel(cursor)} (${isoDate})`,
      timeSlots: [...defaultTimeSlots]
    });
  }

  return dates;
}

export function isValidConsultationSlot(dateValue, timeValue) {
  const availability = getConsultationAvailability();
  const dateOption = availability.find((date) => date.value === dateValue);
  if (!dateOption) {
    return false;
  }

  return dateOption.timeSlots.includes(timeValue);
}
