function normalizedCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function nextHostReliability(current, { acceptance = false, hostCancellationAfterAcceptance = false, serverTime }) {
  if (!acceptance && !hostCancellationAfterAcceptance) return null;
  const prior = current && typeof current === 'object' ? current : {};
  const acceptedTransitions = normalizedCount(prior.acceptedTransitions);
  const hostCancellationsAfterAcceptance = normalizedCount(prior.hostCancellationsAfterAcceptance);
  // A tracked cancellation must pair with a still-unresolved accepted transition.
  // Missing or inconsistent aggregates are omitted rather than reported as 1 of 0.
  if (hostCancellationAfterAcceptance && acceptedTransitions <= hostCancellationsAfterAcceptance) return null;
  return {
    acceptedTransitions: acceptedTransitions + (acceptance ? 1 : 0),
    hostCancellationsAfterAcceptance: hostCancellationsAfterAcceptance + (hostCancellationAfterAcceptance ? 1 : 0),
    coverageStartedAt: prior.coverageStartedAt || serverTime,
    updatedAt: serverTime,
    schemaVersion: 1
  };
}

module.exports = { nextHostReliability };
