const ACCOUNT_COLLECTIONS = ["users", "userRoles", "hosts", "musicians"];

function plainValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (Array.isArray(value)) return value.map(plainValue);
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, plainValue(nested)]));
}

function recordRows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item.id === 'string' && item.data && typeof item.data === 'object')
    .map((item) => ({ id: item.id, data: plainValue(item.data) }));
}

async function readGroup(failures, group, scope, read) {
  if (typeof read !== 'function') {
    failures.push({ group, scope, reason: 'The scoped reader is unavailable.' });
    return [];
  }
  try {
    return recordRows(await read());
  } catch {
    failures.push({ group, scope, reason: 'A permitted record group could not be read.' });
    return [];
  }
}

function isOwnedGig(gig, uid) {
  return !!gig && (gig.hostId === uid || gig.acceptedBy === uid);
}

function serializeGig(item, uid) {
  const data = item.data;
  const relationships = [];
  if (data.hostId === uid) relationships.push('host');
  if (data.acceptedBy === uid) relationships.push('assigned-performer');
  return { ...data, id: item.id, relationship: relationships };
}

function serializeMessage(item, gig) {
  const data = item.data;
  const senderMatchesRole = (data.senderRole === 'host' && data.senderId === gig.hostId)
    || (data.senderRole === 'musician' && data.senderId === gig.acceptedBy);
  if (!senderMatchesRole) return null;
  return { ...data, id: item.id };
}

function serializeReview(item, { authorId = null, bookingId = null } = {}) {
  return { ...item.data, id: item.id, ...(authorId ? { performerId: authorId } : {}), ...(bookingId ? { bookingId } : {}) };
}

export async function createAccountExport({
  user,
  readDocument,
  readGigsByHost,
  readGigsByPerformer,
  readBookingMessages,
  readPerformerReviews,
  readReviewsForBooking
}) {
  if (!user?.uid || typeof readDocument !== "function") throw new Error("A signed-in account is required.");
  const uid = user.uid;
  const failures = [];
  const recordGroups = await Promise.all(ACCOUNT_COLLECTIONS.map(async (collection) => {
    try {
      const result = await readDocument(collection, uid);
      return [collection, result ? plainValue(result) : null];
    } catch {
      failures.push({ group: collection, scope: `${collection}/{authenticated UID}`, reason: 'A permitted account record could not be read.' });
      return [collection, null];
    }
  }));
  const [hostGigs, performerGigs] = await Promise.all([
    readGroup(failures, 'bookingHistory', 'hostId == authenticated UID', () => readGigsByHost?.(uid)),
    readGroup(failures, 'bookingHistory', 'acceptedBy == authenticated UID', () => readGigsByPerformer?.(uid))
  ]);
  const gigsById = new Map();
  [...hostGigs, ...performerGigs].forEach((gig) => {
    if (isOwnedGig(gig.data, uid)) gigsById.set(gig.id, gig);
  });
  const bookingItems = [...gigsById.values()].map((gig) => serializeGig(gig, uid));

  const messageGroups = await Promise.all([...gigsById.values()].map(async (gig) => {
    if (gig.data.status !== 'accepted' || !isOwnedGig(gig.data, uid)) return [];
    const rows = await readGroup(failures, 'messages', `accepted booking ${gig.id}`, () => readBookingMessages?.(uid, gig.id, gig.data));
    return rows.map((item) => serializeMessage(item, gig.data)).filter(Boolean).map((item) => ({ bookingId: gig.id, ...item }));
  }));

  const receivedReviews = await readGroup(failures, 'reviews', 'musicians/{authenticated UID}/reviews', () => readPerformerReviews?.(uid));
  const authoredReviewGroups = await Promise.all([...gigsById.values()].filter((gig) =>
    gig.data.hostId === uid && typeof gig.data.acceptedBy === 'string' && gig.data.acceptedBy
  ).map(async (gig) => {
    const rows = await readGroup(failures, 'reviews', `host-authored review for booking ${gig.id}`, () => readReviewsForBooking?.(uid, gig.id, gig.data.acceptedBy));
    return rows.filter((item) => item.data.hostId === uid && item.data.gigId === gig.id)
      .map((item) => serializeReview(item, { authorId: gig.data.acceptedBy, bookingId: gig.id }));
  }));
  const uniqueBy = (items, keyFor) => [...new Map(items.map((item) => [keyFor(item), item])).values()];
  const messageItems = uniqueBy(messageGroups.flat(), (item) => `${item.bookingId}:${item.id}`);
  const receivedReviewItems = uniqueBy(receivedReviews.map((item) => serializeReview(item)), (item) => item.id);
  const authoredReviewItems = uniqueBy(authoredReviewGroups.flat(), (item) => `${item.bookingId}:${item.id}`);

  const inaccessible = failures.map((failure) => ({ ...failure }));
  const completeness = {
    status: inaccessible.length ? 'incomplete' : 'available-records-exported',
    allAccessibleRecordsIncluded: inaccessible.length === 0,
    inaccessible
  };
  return {
    format: "cltch-account-export-v2",
    exportedAt: new Date().toISOString(),
    account: {
      uid,
      email: user.email || "",
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName || "",
      createdAt: user.metadata?.creationTime || null,
      lastSignInAt: user.metadata?.lastSignInTime || null,
      providers: (user.providerData || []).map((provider) => provider.providerId).filter(Boolean)
    },
    data: {
      ...Object.fromEntries(recordGroups),
      bookingHistory: { items: bookingItems, count: bookingItems.length },
      messages: { items: messageItems, count: messageItems.length },
      reviews: {
        received: receivedReviewItems,
        authored: authoredReviewItems
      },
      mediaMetadata: {
        availability: 'unavailable',
        items: [],
        fileContentsIncluded: false,
        note: 'This build has no owner-scoped media metadata. Portfolio highlights in shared browser storage are excluded because their account ownership cannot be verified. Media file contents are not included.'
      }
    },
    completeness
  };
}

export function downloadAccountExport(snapshot, { documentRef = document, urlApi = URL } = {}) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = `cltch-account-copy-${new Date().toISOString().slice(0, 10)}.json`;
  link.hidden = true;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 1000);
}
