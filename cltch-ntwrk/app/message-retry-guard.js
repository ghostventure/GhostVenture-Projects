function samePayload(left, right) {
  return left.gigId === right.gigId
    && left.senderId === right.senderId
    && left.senderRole === right.senderRole
    && left.text === right.text;
}

function matchesStoredMessage(existing, payload) {
  return existing.senderId === payload.senderId
    && existing.senderRole === payload.senderRole
    && existing.text === payload.text;
}

export function createMessageRetryGuard() {
  let pending = null;
  let inFlight = false;

  return {
    async send(payload, { createRef, read, create }) {
      const normalized = {
        gigId: String(payload?.gigId || ''),
        senderId: String(payload?.senderId || ''),
        senderRole: payload?.senderRole === 'host' ? 'host' : 'musician',
        text: String(payload?.text || '')
      };
      if (!normalized.gigId || !normalized.senderId || !normalized.text) return { status: 'invalid' };
      if (inFlight) return { status: 'busy' };
      if (pending && !samePayload(pending.payload, normalized)) return { status: 'pending-different-payload' };
      if (!pending) pending = { payload: normalized, ref: createRef() };

      inFlight = true;
      try {
        const existing = await read(pending.ref);
        if (existing) {
          if (!matchesStoredMessage(existing, normalized)) return { status: 'unknown' };
          pending = null;
          return { status: 'already-created' };
        }
        await create(pending.ref, normalized);
        pending = null;
        return { status: 'sent' };
      } catch {
        return { status: 'unknown' };
      } finally {
        inFlight = false;
      }
    },
    hasPending() {
      return !!pending;
    }
  };
}
