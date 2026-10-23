function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function availabilityPauseActive(profile, today = localDateString()) {
  if (!profile || profile.available !== false) return false;
  const resumeDate = typeof profile.availabilityResumeDate === 'string' ? profile.availabilityResumeDate : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resumeDate)) return true;
  return today < resumeDate;
}

export function localAvailabilityDate(date = new Date()) {
  return localDateString(date);
}
