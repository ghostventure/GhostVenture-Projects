const MAX_ACTIVE_BOOKINGS = 25;
const MAX_UNREAD_MESSAGES_PER_BOOKING = 1000;

function unavailable(reason) {
  return { available: false, exact: false, unreadCount: null, bookingThreads: null, reason };
}

function sameTimestamp(a, b) {
  if (typeof a?.isEqual === "function") return a.isEqual(b);
  return !!a && !!b && a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
}

function timestampLike(value) {
  return !!value && Number.isFinite(value.seconds) && Number.isFinite(value.nanoseconds);
}

async function upgradeLegacyReadState({ stateRef, stateSnap, messagesRef, documentIdField }) {
  const data = stateSnap.data() || {};
  if (data.readModelVersion === 2) return { stateSnap, data };
  if (data.readModelVersion != null || !timestampLike(data.lastReadAt)) return null;

  // Old receipts recorded only server time. If a message has that exact timestamp,
  // its read/unread ordering cannot be recovered, so withhold the aggregate.
  const tied = await messagesRef.where("createdAt", "==", data.lastReadAt).limit(1).get();
  if (!tied.empty) return null;
  const beforeRead = await messagesRef.where("createdAt", "<", data.lastReadAt)
    .orderBy("createdAt", "desc")
    .orderBy(documentIdField, "desc")
    .limit(1)
    .get();
  const latestRead = beforeRead.docs[0] || null;
  const nextData = {
    lastReadAt: data.lastReadAt,
    readModelVersion: 2
  };
  if (latestRead) {
    nextData.lastReadMessageId = latestRead.id;
    nextData.lastReadMessageCreatedAt = latestRead.get("createdAt");
  }
  await stateRef.set(nextData);
  const refreshed = await stateRef.get();
  return { stateSnap: refreshed, data: refreshed.data() || {} };
}

function createUnreadMessageCountService({ db, documentIdField, maxBookings = MAX_ACTIVE_BOOKINGS, maxMessagesPerBooking = MAX_UNREAD_MESSAGES_PER_BOOKING }) {
  if (!db || !documentIdField) throw new Error("Firestore and document ID field are required.");

  return async function getUnreadMessageCount(uid) {
    const gigs = db.collection("gigs");
    const [hostSnap, performerSnap] = await Promise.all([
      gigs.where("hostId", "==", uid).where("status", "==", "accepted").limit(maxBookings + 1).get(),
      gigs.where("acceptedBy", "==", uid).where("status", "==", "accepted").limit(maxBookings + 1).get()
    ]);
    const unique = new Map();
    [...hostSnap.docs, ...performerSnap.docs].forEach((snapshot) => unique.set(snapshot.id, snapshot));
    if (unique.size > maxBookings) return unavailable("booking_limit");

    const bookings = [...unique.values()];
    const prepared = await Promise.all(bookings.map(async (gigSnap) => {
      const gig = gigSnap.data();
      const peerId = gig.hostId === uid ? gig.acceptedBy : gig.hostId;
      if (gig.status !== "accepted" || typeof peerId !== "string" || !peerId || peerId === uid
        || (gig.hostId !== uid && gig.acceptedBy !== uid)) return null;
      const messagesRef = gigSnap.ref.collection("messages");
      const stateRef = gigSnap.ref.collection("messageStates").doc(uid);
      const stateSnap = await stateRef.get();
      let state = stateSnap.exists ? { stateSnap, data: stateSnap.data() || {} } : { stateSnap, data: {} };
      if (stateSnap.exists && state.data.readModelVersion !== 2) {
        state = await upgradeLegacyReadState({ stateRef, stateSnap, messagesRef, documentIdField });
        if (!state) return null;
      }

      const stateData = state.data;
      if (state.stateSnap.exists && (!timestampLike(stateData.lastReadAt) || stateData.readModelVersion !== 2)) return null;
      const hasId = typeof stateData.lastReadMessageId === "string" && stateData.lastReadMessageId.length > 0;
      const hasCreatedAt = timestampLike(stateData.lastReadMessageCreatedAt);
      if (hasId !== hasCreatedAt || (state.stateSnap.exists && stateData.readModelVersion !== 2)) return null;
      let cursor = null;
      if (hasId) {
        const cursorSnap = await messagesRef.doc(stateData.lastReadMessageId).get();
        if (!cursorSnap.exists || !sameTimestamp(cursorSnap.get("createdAt"), stateData.lastReadMessageCreatedAt)) return null;
        const senderId = cursorSnap.get("senderId");
        if (senderId !== uid && senderId !== peerId) return null;
        cursor = { createdAt: stateData.lastReadMessageCreatedAt, id: stateData.lastReadMessageId };
      }
      return { gigSnap, stateRef, stateExisted: state.stateSnap.exists, stateUpdateTime: state.stateSnap.updateTime || null, messagesRef, peerId, cursor };
    }));

    if (prepared.some((item) => item == null)) return unavailable("read_state_refresh_required");
    const counts = await Promise.all(prepared.map(async ({ messagesRef, peerId, cursor }) => {
      let query = messagesRef.where("senderId", "==", peerId);
      if (cursor) {
        query = query.orderBy("createdAt", "asc")
          .orderBy(documentIdField, "asc")
          .startAfter(cursor.createdAt, cursor.id);
      }
      const aggregate = await query.limit(maxMessagesPerBooking + 1).count().get();
      return aggregate.data().count;
    }));
    if (counts.some((count) => count > maxMessagesPerBooking)) return unavailable("message_limit");

    const stable = await Promise.all(prepared.map(async ({ gigSnap, stateRef, stateExisted, stateUpdateTime }) => {
      const [latestGig, latestState] = await Promise.all([gigSnap.ref.get(), stateRef.get()]);
      const sameGig = latestGig.exists && latestGig.updateTime.isEqual(gigSnap.updateTime)
        && latestGig.get("status") === "accepted";
      const sameState = stateExisted
        ? latestState.exists && latestState.updateTime.isEqual(stateUpdateTime)
        : !latestState.exists;
      return sameGig && sameState;
    }));
    if (stable.some((isStable) => !isStable)) return unavailable("state_changed_retry");

    return {
      available: true,
      exact: true,
      unreadCount: counts.reduce((total, count) => total + count, 0),
      bookingThreads: bookings.length,
      checkedAt: new Date().toISOString()
    };
  };
}

module.exports = {
  MAX_ACTIVE_BOOKINGS,
  MAX_UNREAD_MESSAGES_PER_BOOKING,
  createUnreadMessageCountService
};
