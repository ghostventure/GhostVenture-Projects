export const GIG_PREP_STORAGE_PREFIX = 'cltch_gig_prep_v1';
export const GIG_PREP_BOOKING_LIMIT = 120;
export const GIG_PREP_TASKS = Object.freeze([
  Object.freeze({ id: 'details', label: 'Recheck the event date, call time, venue, and booking notes.' }),
  Object.freeze({ id: 'arrival', label: 'Confirm arrival time, access, parking, and load-in instructions.' }),
  Object.freeze({ id: 'equipment', label: 'Confirm equipment, setup, power, and backup requirements.' }),
  Object.freeze({ id: 'run-of-show', label: 'Review the set list, run-of-show, wardrobe, or creative brief.' }),
  Object.freeze({ id: 'travel', label: 'Plan the route and leave an arrival buffer.' }),
  Object.freeze({ id: 'communication', label: 'Agree on the event-day check-in and communication plan.' }),
  Object.freeze({ id: 'materials', label: 'Prepare required materials, identification, and any agreed documents.' })
]);

const TASK_IDS = new Set(GIG_PREP_TASKS.map((task) => task.id));
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function selectUpcomingAcceptedBookings(records, userId, today) {
  if (typeof userId !== 'string' || !userId || !validDate(today)) return [];
  return (Array.isArray(records) ? records : [])
    .filter((record) => record
      && typeof record.id === 'string' && record.id.length > 0
      && record.status === 'accepted'
      && record.acceptedBy === userId
      && validDate(record.date)
      && record.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')) || a.id.localeCompare(b.id))
    .slice(0, GIG_PREP_BOOKING_LIMIT);
}

function storageKey(userId) {
  return `${GIG_PREP_STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function normalizeCheckedMap(value) {
  const result = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  Object.entries(value).slice(0, GIG_PREP_BOOKING_LIMIT).forEach(([bookingId, taskIds]) => {
    if (!bookingId || bookingId.length > 160 || !Array.isArray(taskIds)) return;
    const checked = [...new Set(taskIds.filter((id) => TASK_IDS.has(id)))];
    if (checked.length) result[bookingId] = checked;
  });
  return result;
}

export function readGigPrepState(userId, storage) {
  if (typeof userId !== 'string' || !userId) return { checkedByBooking: Object.create(null), persisted: false, recovered: false };
  const target = getStorage(storage);
  if (!target) return { checkedByBooking: Object.create(null), persisted: false, recovered: false };
  try {
    const raw = target.getItem(storageKey(userId));
    if (!raw) return { checkedByBooking: Object.create(null), persisted: true, recovered: false };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved?.userId !== userId) {
      return { checkedByBooking: Object.create(null), persisted: true, recovered: true };
    }
    return { checkedByBooking: normalizeCheckedMap(saved.checkedByBooking), persisted: true, recovered: false };
  } catch {
    return { checkedByBooking: Object.create(null), persisted: false, recovered: true };
  }
}

export function updateGigPrepState(checkedByBooking, bookingId, taskId, checked) {
  if (typeof bookingId !== 'string' || !bookingId || bookingId.length > 160 || !TASK_IDS.has(taskId)) return normalizeCheckedMap(checkedByBooking);
  const next = normalizeCheckedMap(checkedByBooking);
  const tasks = new Set(next[bookingId] || []);
  if (checked) tasks.add(taskId);
  else tasks.delete(taskId);
  if (tasks.size && !Object.hasOwn(next, bookingId) && Object.keys(next).length >= GIG_PREP_BOOKING_LIMIT) {
    delete next[Object.keys(next)[0]];
  }
  if (tasks.size) next[bookingId] = [...tasks];
  else delete next[bookingId];
  return normalizeCheckedMap(next);
}

export function persistGigPrepState(userId, checkedByBooking, storage) {
  if (typeof userId !== 'string' || !userId) return false;
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(storageKey(userId), JSON.stringify({
      version: 1,
      userId,
      checkedByBooking: normalizeCheckedMap(checkedByBooking)
    }));
    return true;
  } catch {
    return false;
  }
}

export function renderGigPrepChecklists(container, bookings, checkedByBooking, onChange, documentRef = globalThis.document) {
  container.replaceChildren();
  if (!Array.isArray(bookings) || !bookings.length) {
    const empty = documentRef.createElement('p');
    empty.className = 'prep-empty';
    empty.textContent = 'No upcoming accepted bookings are assigned to this performer account yet.';
    container.append(empty);
    return;
  }

  bookings.forEach((booking) => {
    const card = documentRef.createElement('article');
    card.className = 'prep-card';
    const heading = documentRef.createElement('h2');
    heading.textContent = String(booking.venue || 'Booked gig');
    const details = documentRef.createElement('p');
    details.textContent = `${booking.date}${booking.time ? ` · ${booking.time}` : ''}${booking.location ? ` · ${booking.location}` : ''}`;
    const detailsLink = documentRef.createElement('a');
    detailsLink.href = `booking.html?id=${encodeURIComponent(booking.id)}`;
    detailsLink.textContent = 'Open booking details';
    const fieldset = documentRef.createElement('fieldset');
    fieldset.className = 'prep-tasks';
    const legend = documentRef.createElement('legend');
    legend.textContent = `Preparation checklist for ${String(booking.venue || 'booked gig')}`;
    fieldset.append(legend);

    const completed = new Set(checkedByBooking?.[booking.id] || []);
    GIG_PREP_TASKS.forEach((task) => {
      const label = documentRef.createElement('label');
      const checkbox = documentRef.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = completed.has(task.id);
      checkbox.dataset.bookingId = booking.id;
      checkbox.dataset.taskId = task.id;
      checkbox.addEventListener('change', () => onChange(booking.id, task.id, checkbox.checked));
      const text = documentRef.createElement('span');
      text.textContent = task.label;
      label.append(checkbox, text);
      fieldset.append(label);
    });
    card.append(heading, details, detailsLink, fieldset);
    container.append(card);
  });
}
