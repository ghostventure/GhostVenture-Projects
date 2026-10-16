const ROLE_LABELS = {
  musician: "Musician",
  dj: "DJ",
  photographer: "Photographer",
  cinematographer: "Cinematographer",
  model: "Model"
};

export function activeGigSearchCriteria(search = {}) {
  const criteria = [];
  const phrase = String(search.phrase || "").trim();
  if (phrase) criteria.push({ key: "phrase", label: "Search phrase", value: `“${phrase}”` });

  const role = ROLE_LABELS[search.performerType];
  if (role) criteria.push({ key: "performerType", label: "Performer role", value: role });

  if (search.fromDate) criteria.push({ key: "fromDate", label: "Starting date", value: String(search.fromDate) });
  if (search.toDate) criteria.push({ key: "toDate", label: "Ending date", value: String(search.toDate) });

  const minimumPay = Number(search.minimumPay);
  if (Number.isFinite(minimumPay) && minimumPay > 0) {
    criteria.push({
      key: "minimumPay",
      label: "Minimum pay",
      value: new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minimumPay)
    });
  }
  return criteria;
}

export function clearOneGigSearchCriterion(search = {}, key) {
  const cleared = { ...search };
  switch (key) {
    case "phrase": cleared.phrase = ""; break;
    case "performerType": cleared.performerType = "any"; break;
    case "fromDate": cleared.fromDate = ""; break;
    case "toDate": cleared.toDate = ""; break;
    case "minimumPay": cleared.minimumPay = 0; break;
    default: return null;
  }
  return cleared;
}
