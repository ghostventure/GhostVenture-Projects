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

export async function createAccountExport({ user, readDocument, readCollection, readSubcollection, readCollectionGroup }) {
  if (!user?.uid || typeof readDocument !== "function") throw new Error("A signed-in account is required.");
  const records = await Promise.all(ACCOUNT_COLLECTIONS.map(async (collection) => {
    const result = await readDocument(collection, user.uid);
    return [collection, result ? plainValue(result) : null];
  }));
  const linkedGigs = readCollection ? await readCollection("gigs", user.uid) : [];
  const bookings = await Promise.all(linkedGigs.map(async (gig) => plainValue({
    ...gig,
    messages: readSubcollection && gig.status === "accepted" ? await readSubcollection("gigs", gig.id, "messages") : []
  })));
  const musician = records.find(([name]) => name === "musicians")?.[1];
  const [receivedReviews, writtenReviews] = await Promise.all([
    musician && readSubcollection ? readSubcollection("musicians", user.uid, "reviews") : [],
    readCollectionGroup ? readCollectionGroup("reviews", "hostId", user.uid) : []
  ]);
  const reviewsById = new Map([...receivedReviews, ...writtenReviews].map((review) => [review.id, review]));
  const reviews = plainValue([...reviewsById.values()]);
  return {
    format: "cltch-account-export-v2",
    exportedAt: new Date().toISOString(),
    account: {
      uid: user.uid,
      email: user.email || "",
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName || "",
      createdAt: user.metadata?.creationTime || null,
      lastSignInAt: user.metadata?.lastSignInTime || null,
      providers: (user.providerData || []).map((provider) => provider.providerId).filter(Boolean)
    },
    data: {
      ...Object.fromEntries(records),
      bookings,
      reviews,
      mediaMetadata: {
        musicianPortfolio: musician?.portfolio || musician?.media || musician?.photos || null,
        hostMedia: records.find(([name]) => name === "hosts")?.[1]?.media || null,
        note: "Profile media references and metadata only; uploaded file contents are not included."
      }
    }
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
